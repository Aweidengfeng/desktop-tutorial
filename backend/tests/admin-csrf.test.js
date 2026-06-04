'use strict';
/**
 * 管理后台 CSRF 防护测试
 *
 * 设计：
 *   - 基于 Cookie 的管理会话，对状态变更请求（POST/PUT/PATCH/DELETE）强制
 *     校验双提交（double-submit）CSRF 令牌（X-CSRF-Token 头需与 adminCsrf Cookie 一致）。
 *   - 使用 Authorization 头（Bearer）的 API 客户端不受 CSRF 影响，予以豁免，
 *     因为浏览器不会自动附带 Authorization 头。
 *   - 安全方法（GET 等）无需 CSRF 令牌。
 *
 * 说明：supertest 每次请求绑定新的临时端口，agent 的 cookie jar 不会自动回传，
 * 因此显式从登录响应提取 Set-Cookie 并通过 .set('Cookie', ...) 传递。
 */

process.env.DATABASE_PATH  = process.env.TEST_DB_PATH || '/tmp/test-csrf.db';
process.env.DATABASE_URL   = process.env.DATABASE_URL || 'file:/tmp/test-csrf.db';
process.env.JWT_SECRET     = 'test-jwt-secret-summitlink';
process.env.ADMIN_PASSWORD = 'test-admin-password';
process.env.ADMIN_USERNAME = 'admin';
process.env.NODE_ENV       = 'test';

const request = require('supertest');
const jwt     = require('jsonwebtoken');

const { createApp } = require('../../tests/helpers/testApp');
const { clearDbCache, createTestDb } = require('../../tests/helpers/db');

const AUTH_SCHEME = 'Bearer ';

describe('管理后台 CSRF 防护', () => {
  let app;
  let cookieHeader;
  let csrfToken;

  beforeAll(async () => {
    clearDbCache();
    app = createApp();
    createTestDb();
    const login = await request(app)
      .post('/api/admin/login')
      .send({ username: 'admin', password: 'test-admin-password' });
    expect(login.status).toBe(200);
    csrfToken = login.body.csrfToken;
    // 仅保留 "name=value" 部分用于回传
    cookieHeader = (login.headers['set-cookie'] || [])
      .map((c) => c.split(';')[0])
      .join('; ');
  });

  test('登录应下发 adminCsrf Cookie 并在响应体返回 csrfToken', () => {
    expect(typeof csrfToken).toBe('string');
    expect(csrfToken.length).toBeGreaterThan(0);
    expect(cookieHeader).toMatch(/adminToken=/);
    expect(cookieHeader).toMatch(/adminCsrf=/);
  });

  test('Cookie 会话 + 状态变更请求但缺少 X-CSRF-Token → 403', async () => {
    const res = await request(app)
      .patch('/api/sos/1/resolve')
      .set('Cookie', cookieHeader);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/CSRF/);
  });

  test('Cookie 会话 + 错误的 X-CSRF-Token → 403', async () => {
    const res = await request(app)
      .patch('/api/sos/1/resolve')
      .set('Cookie', cookieHeader)
      .set('X-CSRF-Token', 'wrong-token-value');
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/CSRF/);
  });

  test('Cookie 会话 + 正确的 X-CSRF-Token → 通过 CSRF 校验（非 403）', async () => {
    const res = await request(app)
      .patch('/api/sos/1/resolve')
      .set('Cookie', cookieHeader)
      .set('X-CSRF-Token', csrfToken);
    expect(res.status).not.toBe(403);
  });

  test('****** Cookie）状态变更请求豁免 CSRF（非 403）', async () => {
    const adminToken = jwt.sign(
      { isAdmin: true, username: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );
    const res = await request(app)
      .patch('/api/sos/1/resolve')
      .set('Authorization', AUTH_SCHEME + adminToken);
    expect(res.status).not.toBe(403);
  });

  test('Cookie 会话 + 安全方法（GET）无需 CSRF 令牌 → 非 403', async () => {
    const res = await request(app)
      .get('/api/sos/active')
      .set('Cookie', cookieHeader);
    expect(res.status).not.toBe(403);
  });
});
