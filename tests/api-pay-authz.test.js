/**
 * 阶段1（C0）安全回归：/api/pay/* 越权（IDOR / 未授权资金操作）修复验证
 *
 * 覆盖：
 *  - 未认证请求一律 401
 *  - 平台级资金操作（escrow / settle）要求管理员
 *  - 提现 / 账务查询要求归属校验（不能操作/查看他人账户）
 *  - 订单状态查询的 IDOR 防护（仅订单所有者或管理员可见）
 *  - 弃用响应头（Deprecation）存在
 */

'use strict';

// 使用独立数据库文件，避免与共享测试库相互污染（本套件会写入 users/orders）。
const PAY_AUTHZ_DB = '/tmp/test-pay-authz.db';
const _origEnv = {
  TEST_DB_PATH: process.env.TEST_DB_PATH,
  DATABASE_PATH: process.env.DATABASE_PATH,
  DATABASE_URL: process.env.DATABASE_URL,
};
try { require('fs').rmSync(PAY_AUTHZ_DB, { force: true }); } catch (_) {}
process.env.TEST_DB_PATH    = PAY_AUTHZ_DB;
process.env.DATABASE_PATH   = PAY_AUTHZ_DB;
process.env.DATABASE_URL    = `file:${PAY_AUTHZ_DB}`;
process.env.JWT_SECRET      = 'test-jwt-secret-summitlink';
process.env.ADMIN_PASSWORD  = 'test-admin-password';
process.env.ADMIN_USERNAME  = 'admin';
process.env.PAYMENTS_ENABLED = 'true';
process.env.NODE_ENV        = 'test';

function restoreEnv(key) {
  if (_origEnv[key] === undefined) delete process.env[key];
  else process.env[key] = _origEnv[key];
}

const request = require('supertest');
const { createApp } = require('./helpers/testApp');
const { createTestUser, createAdminToken, authHeader } = require('./helpers/auth');
const { clearDbCache } = require('./helpers/db');

describe('C0 /api/pay/* 越权修复', () => {
  let app;
  let db;
  let userA;
  let userB;
  let adminToken;

  beforeAll(() => {
    clearDbCache();
    app = createApp();
    db = require('../backend/db/database');
    userA = createTestUser(db);
    userB = createTestUser(db);
    adminToken = createAdminToken();
  });

  afterAll(() => {
    // 还原环境变量，防止泄漏到后续测试套件（它们共享同一进程）
    restoreEnv('TEST_DB_PATH');
    restoreEnv('DATABASE_PATH');
    restoreEnv('DATABASE_URL');
    clearDbCache();
  });

  // ── 1. 未认证 → 401 ─────────────────────────────────────────────
  describe('未认证请求一律拒绝', () => {
    test('POST /api/pay/create 无 token → 401', async () => {
      const res = await request(app).post('/api/pay/create').send({ amount: 100, method: 'alipay' });
      expect(res.status).toBe(401);
    });
    test('GET /api/pay/status/:orderNo 无 token → 401', async () => {
      const res = await request(app).get('/api/pay/status/SL_X');
      expect(res.status).toBe(401);
    });
    test('POST /api/pay/withdraw 无 token → 401', async () => {
      const res = await request(app).post('/api/pay/withdraw').send({ owner_type: 'guide', owner_id: 1, amount: 100 });
      expect(res.status).toBe(401);
    });
    test('GET /api/pay/transactions 无 token → 401', async () => {
      const res = await request(app).get('/api/pay/transactions?owner_type=guide&owner_id=1');
      expect(res.status).toBe(401);
    });
    test('POST /api/pay/escrow 无 token → 401', async () => {
      const res = await request(app).post('/api/pay/escrow').send({ order_type: 'expedition', order_id: 1, total_amount: 100 });
      expect(res.status).toBe(401);
    });
    test('POST /api/pay/settle 无 token → 401', async () => {
      const res = await request(app).post('/api/pay/settle').send({ transaction_id: 1 });
      expect(res.status).toBe(401);
    });
  });

  // ── 2. 平台级资金操作需要管理员 ───────────────────────────────────
  describe('escrow / settle 需要管理员', () => {
    test('普通用户 POST /api/pay/escrow → 403', async () => {
      const res = await request(app)
        .post('/api/pay/escrow')
        .set(authHeader(userA.token))
        .send({ order_type: 'expedition', order_id: 1, total_amount: 100 });
      expect(res.status).toBe(403);
    });
    test('普通用户 POST /api/pay/settle → 403', async () => {
      const res = await request(app)
        .post('/api/pay/settle')
        .set(authHeader(userA.token))
        .send({ transaction_id: 1 });
      expect(res.status).toBe(403);
    });
    test('管理员 POST /api/pay/escrow → 200 + 托管记录', async () => {
      const res = await request(app)
        .post('/api/pay/escrow')
        .set(authHeader(adminToken))
        .send({ order_type: 'expedition', order_id: 9001, total_amount: 1000, owner_type: 'guide', owner_id: 1 });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe('held');
      expect(typeof res.body.transaction_id).toBe('number');
    });
  });

  // ── 3. 提现 / 账务归属校验 ────────────────────────────────────────
  describe('提现与账务的归属校验', () => {
    test('为不属于自己的向导账户提现 → 403', async () => {
      const res = await request(app)
        .post('/api/pay/withdraw')
        .set(authHeader(userA.token))
        .send({ owner_type: 'guide', owner_id: 999999, amount: 100 });
      expect(res.status).toBe(403);
    });
    test('查询不属于自己的向导账务 → 403', async () => {
      const res = await request(app)
        .get('/api/pay/transactions?owner_type=guide&owner_id=999999')
        .set(authHeader(userA.token));
      expect(res.status).toBe(403);
    });
    test('为自己（owner_type=user 且 owner_id=自身）提现 → 非 403', async () => {
      const res = await request(app)
        .post('/api/pay/withdraw')
        .set(authHeader(userA.token))
        .send({ owner_type: 'user', owner_id: userA.id, amount: 100 });
      // 归属校验通过；具体返回 200 成功或 400（业务校验）皆可，但绝不能是 403
      expect(res.status).not.toBe(403);
    });
  });

  // ── 4. 订单状态查询的 IDOR 防护 ──────────────────────────────────
  describe('GET /api/pay/status/:orderNo IDOR 防护', () => {
    let orderNo;
    test('用户 A 创建订单', async () => {
      const res = await request(app)
        .post('/api/pay/create')
        .set(authHeader(userA.token))
        .send({ amount: 150, method: 'alipay' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      orderNo = res.body.orderNo;
      expect(typeof orderNo).toBe('string');
    });
    test('用户 A 可查询自己订单 → 200', async () => {
      const res = await request(app)
        .get(`/api/pay/status/${orderNo}`)
        .set(authHeader(userA.token));
      expect(res.status).toBe(200);
      expect(res.body.orderNo).toBe(orderNo);
    });
    test('用户 B 查询他人订单 → 403', async () => {
      const res = await request(app)
        .get(`/api/pay/status/${orderNo}`)
        .set(authHeader(userB.token));
      expect(res.status).toBe(403);
    });
    test('管理员可查询任意订单 → 200', async () => {
      const res = await request(app)
        .get(`/api/pay/status/${orderNo}`)
        .set(authHeader(adminToken));
      expect(res.status).toBe(200);
      expect(res.body.orderNo).toBe(orderNo);
    });
  });

  // ── 5. 弃用响应头 ────────────────────────────────────────────────
  test('响应包含 Deprecation 头', async () => {
    const res = await request(app).get('/api/pay/transactions?owner_type=guide&owner_id=1');
    expect(res.headers['deprecation']).toBe('true');
  });
});
