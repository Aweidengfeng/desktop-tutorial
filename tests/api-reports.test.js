/**
 * UGC 举报接口集成测试（Apple App Store Guideline 1.2）
 * 覆盖：
 *   - POST /api/reports：未登录 401、参数校验 400、登录提交成功 200
 *   - GET  /api/reports/mine：返回本人举报列表
 *   - GET  /api/admin/reports：管理员列表 + 状态过滤
 *   - PUT  /api/admin/reports/:id/status：状态管理（含校验与 404）
 */

'use strict';

const testDbPath = process.env.TEST_DB_PATH || '/tmp/test-summitlink.db';
process.env.DATABASE_PATH  = testDbPath;
process.env.DATABASE_URL   = process.env.DATABASE_URL || `file:${testDbPath}`;
process.env.JWT_SECRET     = 'test-jwt-secret-summitlink';
process.env.ADMIN_PASSWORD = 'test-admin-password';
process.env.ADMIN_USERNAME = 'admin';
process.env.NODE_ENV       = 'test';

const request = require('supertest');
const { createApp }            = require('./helpers/testApp');
const { createTestUser, createAdminToken } = require('./helpers/auth');
const { clearDbCache, createTestDb } = require('./helpers/db');

// 构造 Authorization 头，避免把 token 直接拼到字面量里
const TOKEN_PREFIX = 'Bearer ';
const bearer = (token) => TOKEN_PREFIX + token;

describe('UGC 举报 /api/reports', () => {
  let app, db, user, userAuth, adminAuthHeader;

  beforeAll(() => {
    clearDbCache();
    app = createApp();
    db  = createTestDb();
    user = createTestUser(db, { phone: '13900002100', name: '举报用户' });
    userAuth = bearer(user.token);
    adminAuthHeader = bearer(createAdminToken());
  });

  test('未登录提交 → 401', async () => {
    const res = await request(app)
      .post('/api/reports')
      .send({ targetType: 'post', targetId: 1, reason: 'spam' });
    expect(res.status).toBe(401);
  });

  test('无效对象类型 → 400', async () => {
    const res = await request(app)
      .post('/api/reports')
      .set('Authorization', userAuth)
      .send({ targetType: 'invalid_type', targetId: 1, reason: 'spam' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
  });

  test('无效原因 → 400', async () => {
    const res = await request(app)
      .post('/api/reports')
      .set('Authorization', userAuth)
      .send({ targetType: 'post', targetId: 1, reason: 'not_a_reason' });
    expect(res.status).toBe(400);
  });

  test('无效对象 ID → 400', async () => {
    const res = await request(app)
      .post('/api/reports')
      .set('Authorization', userAuth)
      .send({ targetType: 'post', targetId: 'abc', reason: 'spam' });
    expect(res.status).toBe(400);
  });

  test('登录用户提交成功 → 200 + { success, id, status: pending }', async () => {
    const res = await request(app)
      .post('/api/reports')
      .set('Authorization', userAuth)
      .send({ targetType: 'post', targetId: 42, reason: 'abuse', detail: '辱骂他人' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.id).toBe('number');
    expect(res.body.status).toBe('pending');
  });

  test('GET /api/reports/mine 返回本人举报', async () => {
    const res = await request(app)
      .get('/api/reports/mine')
      .set('Authorization', userAuth);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.reports)).toBe(true);
    expect(res.body.reports.length).toBeGreaterThan(0);
    expect(res.body.reports[0]).toHaveProperty('status');
  });

  test('管理员列表 GET /api/admin/reports', async () => {
    const res = await request(app)
      .get('/api/admin/reports')
      .set('Authorization', adminAuthHeader);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.reports)).toBe(true);
    expect(typeof res.body.total).toBe('number');
  });

  test('管理员更新状态 → resolved + handledAt', async () => {
    const created = await request(app)
      .post('/api/reports')
      .set('Authorization', userAuth)
      .send({ targetType: 'comment', targetId: 7, reason: 'spam' });
    const id = created.body.id;

    const res = await request(app)
      .put(`/api/admin/reports/${id}/status`)
      .set('Authorization', adminAuthHeader)
      .send({ status: 'resolved', resolution: '已删除违规内容' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.report.status).toBe('resolved');
    expect(res.body.report.handledAt).toBeTruthy();
  });

  test('管理员状态过滤 status=resolved 命中', async () => {
    const res = await request(app)
      .get('/api/admin/reports?status=resolved')
      .set('Authorization', adminAuthHeader);
    expect(res.status).toBe(200);
    expect(res.body.reports.every((r) => r.status === 'resolved')).toBe(true);
  });

  test('管理员更新无效状态 → 400', async () => {
    const res = await request(app)
      .put('/api/admin/reports/1/status')
      .set('Authorization', adminAuthHeader)
      .send({ status: 'bogus' });
    expect(res.status).toBe(400);
  });

  test('管理员更新不存在的举报 → 404', async () => {
    const res = await request(app)
      .put('/api/admin/reports/99999999/status')
      .set('Authorization', adminAuthHeader)
      .send({ status: 'reviewing' });
    expect(res.status).toBe(404);
  });

  test('非管理员访问管理员列表 → 403', async () => {
    const res = await request(app)
      .get('/api/admin/reports')
      .set('Authorization', userAuth);
    expect(res.status).toBe(403);
  });
});
