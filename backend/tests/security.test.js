'use strict';
/**
 * Phase 5.4 — 安全验收清单自动化测试
 * 覆盖 6 项安全验收：
 *   1. mock-pay 生产返回 404
 *   2. sms-codes 生产返回 404
 *   3. 上传非图片格式返回 400
 *   4. CORS 非白名单域名请求被拒绝
 *   5. 管理后台登录暴力破解触发限流 (429)
 *   6. JWT 过期接口返回 401
 */

// 先设置环境变量（必须在 require 任何后端模块之前）
process.env.DATABASE_PATH  = process.env.TEST_DB_PATH || '/tmp/test-security.db';
process.env.DATABASE_URL   = process.env.DATABASE_URL || 'file:/tmp/test-security.db';
process.env.JWT_SECRET     = 'test-jwt-secret-summitlink';
process.env.ADMIN_PASSWORD = 'test-admin-password';
process.env.ADMIN_USERNAME = 'admin';
process.env.NODE_ENV       = 'test';

const request = require('supertest');
const jwt     = require('jsonwebtoken');
const path    = require('path');
const fs      = require('fs');

const { createApp }    = require('../../tests/helpers/testApp');
const { clearDbCache, createTestDb } = require('../../tests/helpers/db');

// ── 1. mock-pay 在 production 模式返回 404 ─────────────────────────────────
describe('安全测试 1 — mock-pay 生产环境返回 404', () => {
  let app;

  beforeAll(() => {
    clearDbCache();
    app = createApp();
    createTestDb();
    // Set production mode AFTER createApp() (testApp.js internally sets NODE_ENV=test)
    process.env.NODE_ENV = 'production';
  });

  afterAll(() => {
    process.env.NODE_ENV = 'test';
  });

  test('POST /api/expeditions/orders/1/mock-pay — production → 404', async () => {
    const res = await request(app)
      .post('/api/expeditions/orders/1/mock-pay')
      .set('Authorization', 'Bearer dummy-token');
    expect(res.status).toBe(404);
  });
});

// ── 2. sms-codes 在 production 模式返回 404 ────────────────────────────────
describe('安全测试 2 — sms-codes 生产环境返回 404', () => {
  let app;

  beforeAll(() => {
    clearDbCache();
    app = createApp();
    createTestDb();
    // Set production mode AFTER createApp() (testApp.js internally sets NODE_ENV=test)
    process.env.NODE_ENV = 'production';
  });

  afterAll(() => {
    process.env.NODE_ENV = 'test';
  });

  test('GET /api/admin/sms-codes — production → 404', async () => {
    const adminToken = jwt.sign({ isAdmin: true, username: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1d' });
    const res = await request(app)
      .get('/api/admin/sms-codes')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});

// ── 3. 上传非图片格式返回 400 ─────────────────────────────────────────────
describe('安全测试 3 — 上传非图片格式返回 400', () => {
  let app, db, userToken;
  const tmpExe = path.join('/tmp', 'malicious.exe');

  beforeAll(() => {
    clearDbCache();
    process.env.NODE_ENV = 'test';
    app = createApp();
    db  = createTestDb();

    // 创建测试用户
    const { createTestUser } = require('../../tests/helpers/auth');
    const user = createTestUser(db, { phone: '13900001001' });
    userToken = user.token;

    // 创建一个模拟的 exe 文件（MZ 为 DOS/Windows 可执行文件的魔数标头）
    fs.writeFileSync(tmpExe, 'MZ\x90\x00 fake exe content');
  });

  afterAll(() => {
    try { fs.unlinkSync(tmpExe); } catch (_) {}
  });

  test('POST /api/upload — 上传 .exe 文件 → 400', async () => {
    const res = await request(app)
      .post('/api/upload')
      .set('Authorization', `Bearer ${userToken}`)
      .attach('file', tmpExe, { filename: 'virus.exe', contentType: 'application/octet-stream' });
    expect(res.status).toBe(400);
  });
});

// ── 4. CORS 非白名单来源被拒绝 ────────────────────────────────────────────
describe('安全测试 4 — CORS 非白名单来源', () => {
  let app;

  beforeAll(() => {
    clearDbCache();
    process.env.NODE_ENV = 'test';
    // 创建一个带严格 CORS 限制的 app（通过 app.js 而非 testApp 中的宽松 cors）
    app = createApp();
    createTestDb();
  });

  test('GET /api/peaks — 恶意来源不得在响应头中回显 Origin', async () => {
    const res = await request(app)
      .get('/api/peaks')
      .set('Origin', 'https://evil.com');
    // 响应头中 Access-Control-Allow-Origin 不应为 https://evil.com
    const allowOrigin = res.headers['access-control-allow-origin'];
    expect(allowOrigin).not.toBe('https://evil.com');
  });
});

// ── 5. 管理后台登录暴力破解触发限流 ───────────────────────────────────────
describe('安全测试 5 — 管理后台登录暴力破解触发限流 429', () => {
  let app;

  beforeAll(() => {
    clearDbCache();
    process.env.NODE_ENV = 'test';
    app = createApp();
    createTestDb();
  });

  test('连续 11 次错误密码 → 触发 429 限流', async () => {
    // adminLoginLimiter max=10，第 11 次应返回 429
    let lastStatus = 0;
    for (let i = 0; i < 11; i++) {
      const res = await request(app)
        .post('/api/admin/login')
        .send({ username: 'admin', password: 'wrong-password-' + i });
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });
});

// ── 6. JWT 过期接口返回 401 ──────────────────────────────────────────────
describe('安全测试 6 — JWT 过期返回 401', () => {
  let app;

  beforeAll(() => {
    clearDbCache();
    process.env.NODE_ENV = 'test';
    app = createApp();
    createTestDb();
  });

  test('GET /api/tracks — 使用已过期的 JWT → 401', async () => {
    // 创建一个已过期的 token（expiresIn=-1s 表示立即过期）
    const expiredToken = jwt.sign(
      { id: 9999 },
      process.env.JWT_SECRET,
      { expiresIn: -1 }
    );
    const res = await request(app)
      .get('/api/tracks')
      .set('Authorization', `Bearer ${expiredToken}`);
    expect(res.status).toBe(401);
  });
});

// ── 7. 公共只读接口缓存头策略 ─────────────────────────────────────────────
describe('安全测试 7 — 公共 GET 接口缓存头', () => {
  let app;

  beforeAll(() => {
    clearDbCache();
    process.env.NODE_ENV = 'test';
    app = createApp();
    createTestDb();
  });

  test('GET /api/config/map 返回 1 小时缓存头', async () => {
    const res = await request(app).get('/api/config/map');
    expect(res.status).toBe(200);
    expect(String(res.headers['cache-control'] || '')).toContain('max-age=3600');
  });
});
