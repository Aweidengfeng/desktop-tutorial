/**
 * SummitLink Production Smoke Test
 * 验证生产环境核心 API 端点可用性
 * 使用: API_BASE_URL=https://your-app.railway.app node scripts/smoke-test.js
 */

const https = require('https');
const http = require('http');

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const isHttps = BASE_URL.startsWith('https');

const results = [];
let passed = 0;
let failed = 0;

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const client = isHttps ? https : http;
    const req = client.request({
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      timeout: 10000,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data), raw: data, headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, body: null, raw: data, headers: res.headers });
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

async function test(name, fn) {
  try {
    await fn();
    results.push({ name, status: '✅ PASS' });
    passed++;
  } catch (err) {
    results.push({ name, status: `❌ FAIL: ${err.message}` });
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function runTests() {
  console.log('\n🚀 SummitLink Smoke Tests');
  console.log(`📡 Target: ${BASE_URL}`);
  console.log(`⏰ ${new Date().toISOString()}\n`);

  await test('GET /api/health → 200 + db:ok', async () => {
    const res = await request('/api/health');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body?.status === 'ok', `Expected status:ok, got ${res.body?.status}`);
  });

  const uniqueEmail = `smoke-test-${Date.now()}@example.com`;
  await test('POST /api/auth/register → not 404', async () => {
    const res = await request('/api/auth/register', {
      method: 'POST',
      body: { email: uniqueEmail, password: 'TestPass123!', name: 'Smoke Test' },
    });
    assert(res.status !== 404, 'Route not found (404)');
  });

  await test('POST /api/auth/login → not 404', async () => {
    const res = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'nobody@nowhere.com', password: 'wrong' },
    });
    assert(res.status !== 404, 'Route not found (404)');
    assert([400, 401, 422].includes(res.status), `Expected 4xx for wrong credentials, got ${res.status}`);
  });

  await test('GET /api/routes → 200 or 401', async () => {
    const res = await request('/api/routes');
    assert([200, 401].includes(res.status), `Unexpected status ${res.status}`);
  });

  await test('GET /api/guides → 200 or 401', async () => {
    const res = await request('/api/guides');
    assert([200, 401].includes(res.status), `Unexpected status ${res.status}`);
  });

  await test('GET /api/clubs → 200 or 401', async () => {
    const res = await request('/api/clubs');
    assert([200, 401].includes(res.status), `Unexpected status ${res.status}`);
  });

  await test('GET /api/config/map → 200 with map engine/provider field', async () => {
    const res = await request('/api/config/map');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body?.engine !== undefined || res.body?.provider !== undefined, 'Missing engine/provider field');
  });

  await test('GET /api/currency/rates → 200', async () => {
    const res = await request('/api/currency/rates');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  await test('GET /legal/privacy → 200', async () => {
    const res = await request('/legal/privacy');
    assert([200, 301, 302].includes(res.status), `Expected 2xx/3xx, got ${res.status}`);
  });

  await test('GET /legal/terms → 200', async () => {
    const res = await request('/legal/terms');
    assert([200, 301, 302].includes(res.status), `Expected 2xx/3xx, got ${res.status}`);
  });

  await test('Security: /api/health has security headers', async () => {
    const res = await request('/api/health');
    assert(res.status === 200, 'Health check failed');
    assert(!!res.headers?.['x-content-type-options'], 'Missing X-Content-Type-Options');
    assert(!!res.headers?.['x-frame-options'], 'Missing X-Frame-Options');
  });

  await test('GET /api/payment/config → not 404', async () => {
    const res = await request('/api/payment/config');
    assert(res.status !== 404, 'Payment config route missing');
  });

  await test('GET /api/gdpr/region → 200', async () => {
    const res = await request('/api/gdpr/region');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  console.log('\n📊 Results:\n');
  results.forEach((r) => console.log(`  ${r.status}  ${r.name}`));
  console.log(`\n  Total: ${passed + failed} | ✅ Passed: ${passed} | ❌ Failed: ${failed}`);

  if (failed > 0) {
    console.log(`\n⚠️  ${failed} test(s) failed. Check logs above.`);
    process.exit(1);
  } else {
    console.log('\n🎉 All smoke tests passed! Production is healthy.');
  }
}

runTests().catch((err) => {
  console.error('\n💥 Smoke test runner crashed:', err.message);
  process.exit(1);
});
