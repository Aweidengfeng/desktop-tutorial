/**
 * PR-160: SOS 真实化 API 集成测试
 * 覆盖：POST /api/sos/alert、缺少/无效字段 400、GET /api/sos/alerts 需 admin token
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
const { createApp }                             = require('./helpers/testApp');
const { createAdminToken, authHeader }          = require('./helpers/auth');
const { clearDbCache }                          = require('./helpers/db');

describe('PR-160 SOS API', () => {
  let app;

  beforeAll(() => {
    clearDbCache();
    app = createApp();
  });

  // ── 1. POST /api/sos/alert → 200 并入库 ──────────────────────────────────
  describe('POST /api/sos/alert', () => {
    test('合法请求 → 200 + { success: true }', async () => {
      const res = await request(app)
        .post('/api/sos/alert')
        .send({
          userId:    123,
          lat:       27.9881,
          lng:       86.9250,
          timestamp: new Date().toISOString(),
          phone:     '112',
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.alert).toBeDefined();
    });

    test('userId / lat / lng / phone 可选 → 200', async () => {
      const res = await request(app)
        .post('/api/sos/alert')
        .send({ timestamp: new Date().toISOString() });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('无 body 也 → 200（timestamp 默认 now）', async () => {
      const res = await request(app).post('/api/sos/alert').send({});
      expect(res.status).toBe(200);
    });

    // ── 2. 无效 timestamp → 400 ──────────────────────────────────────────
    test('无效 timestamp → 400', async () => {
      const res = await request(app)
        .post('/api/sos/alert')
        .send({ userId: 1, lat: 30, lng: 100, timestamp: 'not-a-date' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBeTruthy();
    });
  });

  // ── 3. GET /api/sos/alerts 需要 admin token ───────────────────────────────
  describe('GET /api/sos/alerts', () => {
    test('无 token → 401', async () => {
      const res = await request(app).get('/api/sos/alerts');
      expect(res.status).toBe(401);
    });

    test('普通用户 token（无 isAdmin）→ 403', async () => {
      const jwt = require('jsonwebtoken');
      const secret = process.env.JWT_SECRET;
      const userToken = jwt.sign({ id: 1, isAdmin: false }, secret, { expiresIn: '1d' });
      const res = await request(app)
        .get('/api/sos/alerts')
        .set(authHeader(userToken));
      expect(res.status).toBe(403);
    });

    test('admin token → 200 + { alerts, total, page, limit }', async () => {
      const token = createAdminToken();
      const res = await request(app)
        .get('/api/sos/alerts')
        .set(authHeader(token));
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.alerts)).toBe(true);
      expect(typeof res.body.total).toBe('number');
    });

    test('admin token → 返回最近插入的记录', async () => {
      const ts = new Date().toISOString();
      await request(app)
        .post('/api/sos/alert')
        .send({ userId: 999, lat: 1.1, lng: 2.2, timestamp: ts, phone: '120' });

      const token = createAdminToken();
      const res = await request(app)
        .get('/api/sos/alerts')
        .set(authHeader(token));
      expect(res.status).toBe(200);
      const found = res.body.alerts.find(r => r.userId === 999);
      expect(found).toBeDefined();
      expect(found.lat).toBeCloseTo(1.1);
    });
  });
});
