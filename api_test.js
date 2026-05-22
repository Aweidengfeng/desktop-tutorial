#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const axios = require('axios');
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
  const markers = ['example.com', 'your-api-url', 'your-domain', 'placeholder'];
  return markers.some((m) => url.includes(m));
}

async function main() {
  const config = loadConfig();
  const logDir = path.resolve(__dirname, config.logging?.dir || 'logs');
  ensureDir(logDir);

  const result = {
    script: 'api_test.js',
    startedAt: new Date().toISOString(),
    success: false,
    warnings: [],
    errors: [],
    testResults: [],
  };

  const printToConsole = !!config.logging?.printToConsole;
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);

  const runtimeContext = {
    token: config.auth?.token || '',
    testUser: config.testUser || {},
  };

  try {
    const api = config.api || {};
    const resolvedBaseURL = process.env.BASE_URL || api.baseURL;

    if (isPlaceholderUrl(resolvedBaseURL)) {
      throw new Error('api.baseURL 当前是占位值，请在 config.json 中设置为真实 API URL，或通过 BASE_URL 环境变量传入。');
    }

    const tests = Array.isArray(api.tests) ? api.tests : [];

    for (const testCase of tests) {
      const t = applyTemplate(testCase, runtimeContext);
      const item = {
        name: t.name || `${t.method || 'GET'} ${t.url || '/'}`,
        optional: !!t.optional,
        request: null,
        response: null,
        passed: false,
      };

      try {
        const headers = Object.assign({}, api.defaultHeaders || {}, t.headers || {});
        if (!headers.Authorization && runtimeContext.token) {
          headers.Authorization = `Bearer ${runtimeContext.token}`;
        }

        item.request = {
          method: (t.method || 'GET').toUpperCase(),
          url: t.url,
          headers,
          body: t.body || null,
        };

        const response = await axios({
          method: item.request.method,
          url: t.url,
          baseURL: resolvedBaseURL,
          timeout: api.timeoutMs || 10000,
          headers,
          data: t.body,
          validateStatus: () => true,
        });

        item.response = {
          status: response.status,
          headers: response.headers,
          data: response.data,
        };

        const expectedStatus = Array.isArray(t.expectedStatus) ? t.expectedStatus : [t.expectedStatus || 200];
        if (!expectedStatus.includes(response.status)) {
          throw new Error(`Expected status ${expectedStatus.join('/')}, got ${response.status}`);
        }

        if (t.expectedSchema) {
          const schemaResult = validateSchema(ajv, config.expectedJsonSchemas || {}, t.expectedSchema, response.data);
          if (!schemaResult.valid) {
            throw new Error(`Schema validation failed: ${schemaResult.errors.map((err) => `${err.instancePath || '/'} ${err.message}`).join('; ')}`);
          }
        }

        if (t.extractTokenPath) {
          const extractedToken = getByPath(response.data, t.extractTokenPath);
          if (extractedToken) {
            runtimeContext.token = extractedToken;
            item.extractedToken = true;
          }
        }

        item.passed = true;
      } catch (err) {
        item.error = err.message;
        if (!item.response && err.response) {
          item.response = {
            status: err.response.status,
            headers: err.response.headers,
            data: err.response.data,
          };
        }

        if (item.optional) {
          result.warnings.push(`Optional case failed [${item.name}]: ${err.message}`);
          item.passed = false;
        } else {
          result.errors.push({ case: item.name, message: err.message, stack: err.stack });
          item.passed = false;
        }
      } finally {
        result.testResults.push(item);
      }
    }

    const requiredFailures = result.testResults.filter((r) => !r.passed && !r.optional);
    result.success = requiredFailures.length === 0;
  } catch (err) {
    result.success = false;
    result.errors.push({ message: err.message, stack: err.stack });
  } finally {
    result.finishedAt = new Date().toISOString();
    const logFile = path.join(logDir, `api_test_${timestamp()}.json`);
    writeJson(logFile, result);

    if (printToConsole) {
      console.log(`[api_test] success=${result.success} log=${logFile}`);
      if (result.errors.length) console.error('[api_test] errors:', result.errors);
      if (result.warnings.length) console.warn('[api_test] warnings:', result.warnings);
    }

    process.exit(result.success ? 0 : 1);
  }
}

main().catch((e) => {
  console.error('[api_test] fatal error:', e);
  process.exit(1);
});
