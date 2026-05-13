#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const baseUrl = process.env.BASE_URL || 'http://localhost:8080';
const reportPath = path.resolve(process.cwd(), 'audit-clickables.json');
const baselinePath = path.resolve(process.cwd(), 'scripts/audit-clickables.baseline.json');
const shouldUpdateBaseline = process.argv.includes('--update-baseline');

const pages = [
  '/',
  '/admin',
  '/guide-portal',
  '/club-portal',
  '/investor',
  '/expedition/1',
  '/legal/privacy',
  '/legal/terms',
];

function isInternalHref(href) {
  return href && href.startsWith('/') && !href.startsWith('//');
}

function isEmptyHref(href) {
  if (!href) return true;
  const v = href.trim().toLowerCase();
  return v === '' || v === '#' || v.startsWith('javascript:void(0)');
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ baseURL: baseUrl });
  const results = {};

  for (const route of pages) {
    const page = await context.newPage();
    const pageResult = { anchors: [], buttons: [], pointers: [], meta: {} };
    try {
      const resp = await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
      pageResult.meta.status = resp ? resp.status() : null;
      pageResult.meta.url = page.url();

      const collected = await page.evaluate(() => {
        const getAttrs = (el) => {
          const attrs = {};
          for (const a of el.attributes) attrs[a.name] = a.value;
          return attrs;
        };
        const isVisible = (el) => {
          const style = window.getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
          return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
        };
        return {
          anchors: Array.from(document.querySelectorAll('a')).map((el) => ({
            text: (el.textContent || '').trim().slice(0, 80),
            hrefAttr: el.getAttribute('href') || '',
            href: el.href || '',
            attrs: getAttrs(el),
            visible: isVisible(el),
          })),
          buttons: Array.from(document.querySelectorAll('button')).map((el) => ({
            text: (el.textContent || '').trim().slice(0, 80),
            disabled: !!el.disabled,
            type: (el.getAttribute('type') || '').toLowerCase(),
            inForm: !!el.closest('form'),
            hasOnClickProperty: typeof el.onclick === 'function',
            attrs: getAttrs(el),
            visible: isVisible(el),
          })),
          pointers: Array.from(document.querySelectorAll('[style*="cursor:pointer"], [style*="cursor: pointer"], .cursor-pointer')).filter((el) => el.tagName !== 'A' && el.tagName !== 'BUTTON' && el.tagName !== 'LABEL').map((el) => ({
            tag: el.tagName,
            text: (el.textContent || '').trim().slice(0, 80),
            attrs: getAttrs(el),
            visible: isVisible(el),
          })),
        };
      });

      for (const a of collected.anchors) {
        if (!a.visible) continue;
        const attrs = a.attrs || {};
        const hasDynamicHref = Object.prototype.hasOwnProperty.call(attrs, ':href') || Object.prototype.hasOwnProperty.call(attrs, 'x-bind:href');
        if (isEmptyHref(a.hrefAttr)) {
          if (hasDynamicHref) continue;
          pageResult.anchors.push({ type: 'empty_href', text: a.text, href: a.hrefAttr || '' });
          continue;
        }
        if (isInternalHref(a.hrefAttr)) {
          const check = await context.request.get(a.hrefAttr, { failOnStatusCode: false, timeout: 10000 });
          if (check.status() >= 400) {
            pageResult.anchors.push({ type: 'dead_link', text: a.text, href: a.hrefAttr, status: check.status() });
          }
        }
      }

      for (const b of collected.buttons) {
        if (!b.visible) continue;
        const attrs = b.attrs || {};
        const hasReadableLabel = !!((b.text || '').trim() || attrs['aria-label'] || attrs.title);
        if (!hasReadableLabel) continue;
        const hasAction = !!(
          attrs.onclick || attrs['@click'] || attrs['x-on:click'] || attrs['v-on:click'] || attrs['data-action'] || attrs['data-href'] || attrs['aria-controls']
        );
        const hasPropertyHandler = !!b.hasOnClickProperty;
        const functionalByType = b.type === 'submit' && b.inForm;
        if (!b.disabled && !hasAction && !hasPropertyHandler && !functionalByType) {
          pageResult.buttons.push({ type: 'no_handler', text: b.text || '(no text)' });
        }
      }

      for (const p of collected.pointers) {
        if (!p.visible) continue;
        const attrs = p.attrs || {};
        const hasAction = !!(attrs.onclick || attrs['@click'] || attrs['x-on:click'] || attrs['v-on:click'] || attrs['data-action'] || attrs['data-href']);
        if (!hasAction) {
          pageResult.pointers.push({ type: 'pointer_no_handler', tag: p.tag, text: p.text || '(no text)' });
        }
      }
    } catch (e) {
      pageResult.meta.error = e.message;
    } finally {
      await page.close();
    }
    results[route] = pageResult;
  }

  await browser.close();

  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`✅ clickable audit report written: ${reportPath}`);

  if (shouldUpdateBaseline) {
    fs.writeFileSync(baselinePath, JSON.stringify(results, null, 2));
    console.log(`✅ baseline updated: ${baselinePath}`);
    process.exit(0);
  }

  if (!fs.existsSync(baselinePath)) {
    console.error(`❌ baseline missing: ${baselinePath}`);
    process.exit(1);
  }

  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  const regressions = [];

  for (const route of Object.keys(results)) {
    const curr = results[route];
    const base = baseline[route] || { anchors: [], buttons: [], pointers: [] };
    const currCount = curr.anchors.length + curr.buttons.length + curr.pointers.length;
    const baseCount = (base.anchors || []).length + (base.buttons || []).length + (base.pointers || []).length;
    if (currCount > baseCount) {
      regressions.push({ route, baseline: baseCount, current: currCount });
    }
  }

  console.log('\n| 页面 | 发现死链/空按钮数 |');
  console.log('|---|---:|');
  for (const route of Object.keys(results)) {
    const d = results[route];
    const count = d.anchors.length + d.buttons.length + d.pointers.length;
    console.log(`| ${route} | ${count} |`);
  }

  if (regressions.length) {
    console.error('\n❌ clickable audit regression detected:');
    regressions.forEach((r) => console.error(`- ${r.route}: baseline ${r.baseline} -> current ${r.current}`));
    process.exit(1);
  }

  console.log('\n✅ clickable audit passed (no regressions vs baseline).');
})();
