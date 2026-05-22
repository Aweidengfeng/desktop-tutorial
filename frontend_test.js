#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

const CONFIG_PATH = path.resolve(__dirname, 'config.json');

function loadConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function getByPath(obj, p) {
  if (!p) return undefined;
  return p.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

function applyTemplate(value, context) {
  if (typeof value === 'string') {
    return value.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
      const v = getByPath(context, key.trim());
      return v == null ? '' : String(v);
    });
  }
  if (Array.isArray(value)) return value.map((item) => applyTemplate(item, context));
  if (value && typeof value === 'object') {
    const result = {};
    for (const [k, v] of Object.entries(value)) result[k] = applyTemplate(v, context);
    return result;
  }
  return value;
}

function validateSchema(ajv, schemaMap, schemaName, payload) {
  const schema = schemaMap[schemaName];
  if (!schema) {
    return { valid: false, errors: [`Schema \"${schemaName}\" not found in expectedJsonSchemas`] };
  }
  const validate = ajv.compile(schema);
  const valid = validate(payload);
  return { valid, errors: validate.errors || [] };
}

function isPlaceholderUrl(url) {
  if (!url || typeof url !== 'string') return true;
  const markers = ['example.com', 'your-app-url', 'your-domain', 'placeholder'];
  return markers.some((m) => url.includes(m));
}

async function runAction(page, action) {
  const type = action.type;
  switch (type) {
    case 'waitForSelector':
      await page.waitForSelector(action.selector, { timeout: action.timeoutMs || 10000, state: action.state || 'visible' });
      break;
    case 'fill':
      await page.fill(action.selector, action.value || '');
      break;
    case 'click':
      await page.click(action.selector, { timeout: action.timeoutMs || 10000 });
      break;
    case 'press':
      await page.press(action.selector, action.key || 'Enter');
      break;
    case 'select':
      await page.selectOption(action.selector, action.value);
      break;
    case 'check':
      await page.check(action.selector);
      break;
    case 'uncheck':
      await page.uncheck(action.selector);
      break;
    case 'wait':
      await page.waitForTimeout(action.ms || 1000);
      break;
    case 'goto':
      await page.goto(action.url, { waitUntil: action.waitUntil || 'domcontentloaded', timeout: action.timeoutMs || 30000 });
      break;
    default:
      throw new Error(`Unsupported action type: ${type}`);
  }
}

async function main() {
  const config = loadConfig();
  const logDir = path.resolve(__dirname, config.logging?.dir || 'logs');
  ensureDir(logDir);

  const result = {
    script: 'frontend_test.js',
    startedAt: new Date().toISOString(),
    success: false,
    warnings: [],
    errors: [],
    actions: [],
    schemaValidations: [],
    consoleMessages: [],
    network: { requests: [], responses: [] },
  };

  const context = {
    testUser: config.testUser || {},
    token: config.auth?.token || '',
  };

  const frontend = applyTemplate(config.frontend || {}, context);
  const expectedSchemas = config.expectedJsonSchemas || {};
  const expectedResponses = frontend.expectedResponses || [];
  const printToConsole = !!config.logging?.printToConsole;

  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);

  let browser;
  let page;

  try {
    if (isPlaceholderUrl(frontend.url)) {
      throw new Error('frontend.url 当前是占位值，请在 config.json 中设置为真实 URL 后再执行测试。');
    }

    browser = await chromium.launch({ headless: frontend.headless !== false });
    const contextObj = await browser.newContext({
      viewport: frontend.viewport || { width: 1280, height: 720 },
    });
    page = await contextObj.newPage();
    page.setDefaultTimeout(frontend.timeoutMs || 30000);

    page.on('console', (msg) => {
      const item = { type: msg.type(), text: msg.text(), time: new Date().toISOString() };
      result.consoleMessages.push(item);
      if (printToConsole) console.log(`[frontend:console:${item.type}] ${item.text}`);
    });

    page.on('request', (req) => {
      result.network.requests.push({
        time: new Date().toISOString(),
        method: req.method(),
        url: req.url(),
        headers: req.headers(),
        postData: req.postData() || null,
      });
    });

    page.on('response', async (res) => {
      const contentType = (res.headers()['content-type'] || '').toLowerCase();
      let body = null;
      let jsonBody = null;
      try {
        if (contentType.includes('application/json')) {
          jsonBody = await res.json();
          body = jsonBody;
        } else {
          body = await res.text();
          if (body.length > 5000) body = `${body.slice(0, 5000)}...<truncated>`;
        }
      } catch (e) {
        body = `Failed to parse body: ${e.message}`;
      }

      const responseLog = {
        time: new Date().toISOString(),
        url: res.url(),
        status: res.status(),
        headers: res.headers(),
        body,
      };
      result.network.responses.push(responseLog);

      for (const expected of expectedResponses) {
        const matched = expected.urlIncludes ? res.url().includes(expected.urlIncludes) : false;
        if (!matched) continue;

        const validation = {
          url: res.url(),
          expected: expected,
          passed: true,
          issues: [],
        };

        if (typeof expected.status === 'number' && expected.status !== res.status()) {
          validation.passed = false;
          validation.issues.push(`Expected status ${expected.status}, got ${res.status()}`);
        }

        if (expected.schema) {
          if (jsonBody == null) {
            validation.passed = false;
            validation.issues.push('Expected JSON response but body is not JSON');
          } else {
            const schemaResult = validateSchema(ajv, expectedSchemas, expected.schema, jsonBody);
            if (!schemaResult.valid) {
              validation.passed = false;
              validation.issues.push(...schemaResult.errors.map((err) => `${err.instancePath || '/'} ${err.message}`));
            }
          }
        }

        if (!validation.passed && expected.optional) {
          result.warnings.push(`Optional expected response validation failed for ${res.url()}: ${validation.issues.join('; ')}`);
        }

        result.schemaValidations.push(validation);
      }
    });

    const response = await page.goto(frontend.url, {
      waitUntil: 'domcontentloaded',
      timeout: frontend.timeoutMs || 30000,
    });

    if (!response || response.status() >= 400) {
      throw new Error(`页面加载失败，HTTP 状态码: ${response ? response.status() : 'unknown'}`);
    }

    const actions = frontend.actions || [];
    for (const action of actions) {
      const actionLog = { action, startedAt: new Date().toISOString(), success: false };
      try {
        await runAction(page, action);
        actionLog.success = true;
      } catch (e) {
        actionLog.error = e.message;
        if (action.optional) {
          result.warnings.push(`Optional action failed: ${e.message}`);
        } else {
          throw e;
        }
      } finally {
        actionLog.finishedAt = new Date().toISOString();
        result.actions.push(actionLog);
      }
    }

    await page.waitForTimeout(500);

    const requiredSchemaFailures = result.schemaValidations.filter((item) => !item.passed && !item.expected.optional);
    if (requiredSchemaFailures.length > 0) {
      throw new Error(`存在 ${requiredSchemaFailures.length} 个非 optional 响应校验失败`);
    }

    result.success = true;
  } catch (err) {
    result.success = false;
    result.errors.push({ message: err.message, stack: err.stack });
  } finally {
    result.finishedAt = new Date().toISOString();
    const logFile = path.join(logDir, `frontend_test_${timestamp()}.json`);
    writeJson(logFile, result);
    if (browser) await browser.close();

    if (printToConsole) {
      console.log(`[frontend_test] success=${result.success} log=${logFile}`);
      if (result.errors.length) console.error('[frontend_test] errors:', result.errors);
      if (result.warnings.length) console.warn('[frontend_test] warnings:', result.warnings);
    }

    process.exit(result.success ? 0 : 1);
  }
}

main().catch((e) => {
  console.error('[frontend_test] fatal error:', e);
  process.exit(1);
});
