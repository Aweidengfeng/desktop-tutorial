'use strict';
/**
 * Phase 5.3 — JWT 过期全链路测试
 *
 * 覆盖四个场景：
 *   1. 已过期 JWT 请求受保护接口 → 401
 *   2. 有效 JWT 能正常访问受保护接口 → 非 401
 *   3. 无 JWT 请求受保护接口 → 401
 *   4. 篡改 JWT 请求受保护接口 → 401
 */

// 环境变量必须在 require 任何后端模块之前设置
process.env.DATABASE_PATH  = process.env.TEST_DB_PATH || '/tmp/test-jwt.db';
process.env.DATABASE_URL   = process.env.DATABASE_URL || `file:${process.env.DATABASE_PATH}`;
process.env.DATABASE_PROVIDER = process.env.DATABASE_PROVIDER || 'sqlite';
process.env.JWT_SECRET     = 'test-jwt-secret-summitlink';
process.env.ADMIN_PASSWORD = 'test-admin-password';
process.env.ADMIN_USERNAME = 'admin';
process.env.NODE_ENV       = 'test';

const request = require('supertest');
const jwt     = require('jsonwebtoken');

const { createApp }    = require('../../tests/helpers/testApp');
const { clearDbCache, createTestDb } = require('../../tests/helpers/db');

const JWT_SECRET = process.env.JWT_SECRET;

// ── 辅助：生成各类 token ─────────────────────────────────────────
function makeExpiredToken()  { return jwt.sign({ id: 9999 }, JWT_SECRET, { expiresIn: -1 }); }
function makeValidToken()    { return jwt.sign({ id: 9999, role: 'user' }, JWT_SECRET, { expiresIn: '1h' }); }
function tamperToken(token)  { return token.slice(0, -5) + 'xxxxx'; }

// ── 受保护接口（需要 Bearer JWT） ────────────────────────────────
// GET /api/tracks 和 GET /api/peaks 都受 auth 中间件保护
const PROTECTED_ENDPOINT = '/api/tracks';

describe('Phase 5.3 — JWT 过期全链路测试', () => {
  let app;

  beforeAll(() => {
    clearDbCache();
    process.env.NODE_ENV = 'test';
    app = createApp();
    createTestDb();
  });

  describe('Google accessToken 登录校验', () => {
    beforeEach(() => {
      clearDbCache();
      jest.restoreAllMocks();
      delete process.env.GOOGLE_CLIENT_ID;
    });

    test('未配置 GOOGLE_CLIENT_ID 时拒绝 accessToken 登录', async () => {
      const app = createApp();
      const res = await request(app).post('/api/auth/google').send({ accessToken: 'test-token' });

      expect(res.status).toBe(503);
      expect(res.body.error).toBe('Google 登录未配置');
    });

    test('tokeninfo 的受众不匹配时拒绝 accessToken 登录', async () => {
      process.env.GOOGLE_CLIENT_ID = 'expected-client-id';
      const fetchSpy = jest.spyOn(global, 'fetch')
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ aud: 'different-client-id' }),
        });

      const app = createApp();
      const res = await request(app).post('/api/auth/google').send({ accessToken: 'test-token' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Google access_token 受众不匹配');
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ─── 场景 1：已过期的 JWT → 401 ────────────────────────────────
  test('1. 已过期 JWT 请求受保护接口 → 401', async () => {
    const expiredToken = makeExpiredToken();
    const res = await request(app)
      .get(PROTECTED_ENDPOINT)
      .set('Authorization', `Bearer ${expiredToken}`);
    expect(res.status).toBe(401);
  });

  // ─── 场景 2：有效 JWT 能正常访问 ────────────────────────────────
  test('2. 有效 JWT 请求受保护接口 → 非 401', async () => {
    const validToken = makeValidToken();
    const res = await request(app)
      .get(PROTECTED_ENDPOINT)
      .set('Authorization', `Bearer ${validToken}`);
    // 可能返回 200 (有数据) 或 200 (空数组)；不应返回 401
    expect(res.status).not.toBe(401);
  });

  // ─── 场景 3：无 JWT 请求受保护接口 → 401 ───────────────────────
  test('3. 无 JWT 请求受保护接口 → 401', async () => {
    const res = await request(app).get(PROTECTED_ENDPOINT);
    expect(res.status).toBe(401);
  });

  // ─── 场景 4：篡改 JWT 请求受保护接口 → 401 ─────────────────────
  test('4. 篡改 JWT 请求受保护接口 → 401', async () => {
    const validToken   = makeValidToken();
    const tamperedToken = tamperToken(validToken);
    const res = await request(app)
      .get(PROTECTED_ENDPOINT)
      .set('Authorization', `Bearer ${tamperedToken}`);
    expect(res.status).toBe(401);
  });

  // ─── 附加：格式错误的 Authorization 头 → 401 ────────────────────
  test('5. 格式错误的 Authorization 头 → 401', async () => {
    const res = await request(app)
      .get(PROTECTED_ENDPOINT)
      .set('Authorization', 'NotBearer sometoken');
    expect(res.status).toBe(401);
  });

  // ─── 附加：有效 JWT 访问山峰列表（公开或受保护均可）──────────────
  test('6. 有效 JWT 访问 /api/peaks → 非 401', async () => {
    const validToken = makeValidToken();
    const res = await request(app)
      .get('/api/peaks')
      .set('Authorization', `Bearer ${validToken}`);
    expect(res.status).not.toBe(401);
  });
});
