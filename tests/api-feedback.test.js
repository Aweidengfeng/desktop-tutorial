/**
 * 反馈接口集成测试
 * 覆盖：POST /api/feedback 匿名提交成功、内容为空返回 400、内容过长返回 400、登录用户提交成功
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
const { createTestUser }       = require('./helpers/auth');
const { clearDbCache, createTestDb } = require('./helpers/db');

describe('POST /api/feedback', () => {
  let app, db, user;

  beforeAll(() => {
    clearDbCache();
    app = createApp();
    db  = createTestDb();
    user = createTestUser(db, { phone: '13900001200', name: '反馈用户' });
  });

  test('匿名提交成功 → 200 + 标准成功响应', async () => {
    const res = await request(app)
      .post('/api/feedback')
      .send({ type: 'suggestion', content: '这是一条匿名建议' });
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
    expect(typeof res.body.data.id).toBe('number');
    expect(typeof res.body.message).toBe('string');
  });

  test('登录用户提交成功 → 200 + 标准成功响应', async () => {
    const res = await request(app)
      .post('/api/feedback')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ type: 'bug', content: '发现了一个 bug', contact: 'user@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
    expect(typeof res.body.data.id).toBe('number');
  });

  test('内容为空 → 400', async () => {
    const res = await request(app)
      .post('/api/feedback')
      .send({ type: 'suggestion', content: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.code).not.toBe(0);
    expect(res.body.error).toBeTruthy();
  });

  test('缺少 content 字段 → 400', async () => {
    const res = await request(app)
      .post('/api/feedback')
      .send({ type: 'other' });
    expect(res.status).toBe(400);
    expect(res.body.code).not.toBe(0);
    expect(res.body.error).toBeTruthy();
  });

  test('内容超过 2000 字 → 400', async () => {
    const res = await request(app)
      .post('/api/feedback')
      .send({ type: 'suggestion', content: 'x'.repeat(2001) });
    expect(res.status).toBe(400);
    expect(res.body.code).not.toBe(0);
    expect(res.body.error).toBeTruthy();
  });
});
