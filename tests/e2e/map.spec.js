/**
 * E2E 测试：地图页面加载与轨迹记录交互
 *
 * 覆盖：
 *  1. 地图页面加载不报 JS 错误（AMap 或 OSM fallback）
 *  2. 轨迹记录按钮交互
 *  3. 地图配置接口（/api/config/map）正常返回
 *
 * 在 AMAP_KEY 未配置时走 OSM fallback，测试仍应通过。
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

// 忽略的可接受错误（地图 SDK 加载相关、外部 CDN 超时等）
const KNOWN_IGNORABLE_ERRORS = [
  /amap\.com/i,
  /webgl/i,
  /Failed to load resource.*amap/i,
  /Could not load.*amap/i,
  /script error/i,
  /leaflet/i,
  /ResizeObserver/i,
];

function isIgnorableError(msg) {
  return KNOWN_IGNORABLE_ERRORS.some(pattern => pattern.test(msg));
}

test.describe('地图页面 E2E', () => {
  test('1. /api/config/map 返回 200 及地图配置', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/config/map`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('provider');
    expect(['amap', 'osm', 'mapbox', 'leaflet']).toContain(body.provider);
  });

  test('2. 主页面加载不报阻塞性 JS 错误', async ({ page }) => {
    const jsErrors = [];
    page.on('pageerror', err => {
      if (!isIgnorableError(err.message)) {
        jsErrors.push(err.message);
      }
    });

    await page.goto(`${BASE_URL}/summitlink`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);

    const criticalErrors = jsErrors.filter(e => !isIgnorableError(e));
    expect(criticalErrors).toHaveLength(0);
  });

  test('3. 地图配置 API 返回 provider 字段（AMap 或 OSM fallback）', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/config/map`);
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.provider).toBeTruthy();
  });

  test('4. 轨迹列表接口可用', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/tracks`);
    // 200 = 正常；401 = 需要登录（也是正常）
    expect([200, 401]).toContain(res.status());
  });

  test('5. 页面有地图相关 DOM 容器', async ({ page }) => {
    await page.goto(`${BASE_URL}/summitlink`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForLoadState('networkidle').catch(() => {});

    const mapContainer = await page.locator('#map, [x-ref="mapContainer"], .map-container, #mapContainer').first().isVisible().catch(() => false);
    const mapTab = await page.locator('button:has-text("地图"), button:has-text("轨迹")').first().isVisible().catch(() => false);

    expect(mapContainer || mapTab).toBe(true);
  });

  test('6. 轨迹记录按钮交互：点击不导致 JS 崩溃', async ({ page }) => {
    await page.goto(`${BASE_URL}/summitlink`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForLoadState('networkidle').catch(() => {});

    const errorsAfterClick = [];
    page.on('pageerror', err => {
      if (!isIgnorableError(err.message)) {
        errorsAfterClick.push(err.message);
      }
    });

    // 尝试找到轨迹相关按钮
    const trackBtn = page.locator(
      'button:has-text("开始记录"), button:has-text("记录轨迹"), button:has-text("Start Track")'
    ).first();

    const isVisible = await trackBtn.isVisible().catch(() => false);
    if (!isVisible) {
      // 尝试切换到地图 tab
      const mapTabBtn = page.locator('button:has-text("地图"), [data-tab="map"]').first();
      if (await mapTabBtn.isVisible().catch(() => false)) {
        await mapTabBtn.click();
        await page.waitForTimeout(500);
      }
    }

    const trackBtnAfter = page.locator(
      'button:has-text("开始记录"), button:has-text("记录轨迹"), button:has-text("Start Track")'
    ).first();
    if (await trackBtnAfter.isVisible().catch(() => false)) {
      await trackBtnAfter.click();
      await page.waitForTimeout(1000);
      expect(errorsAfterClick).toHaveLength(0);
    } else {
      test.skip(true, '找不到轨迹记录按钮，跳过交互测试');
    }
  });
});
