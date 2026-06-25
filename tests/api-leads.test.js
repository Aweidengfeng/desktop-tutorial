/**
 * 官网线索收集（Lead Collection）集成测试
 * 覆盖：4 个公开表单写入、必填校验、管理端列表 + 类型过滤 + 鉴权。
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
const { createApp }       = require('./helpers/testApp');
const { createAdminToken } = require('./helpers/auth');
const { clearDbCache }    = require('./helpers/db');

describe('Lead Collection', () => {
  let app;

  beforeAll(() => {
    clearDbCache();
    app = createApp();
  });

  test('POST /api/contact 成功写入 → 201 + { success, id }', async () => {
    const res = await request(app)
      .post('/api/contact')
      .send({ name: '联系人', email: 'contact@example.com', subject: '咨询', message: '你好' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.id).toBe('number');
    expect(res.body.status).toBe('new');
    expect(res.body.confirmationEmail).toBe(true);
    expect(res.body.nextSteps).toContain('1–2 business days');
  });

  test('POST /api/partnerships 成功写入 → 201', async () => {
    const res = await request(app)
      .post('/api/partnerships')
      .send({ name: '合作方', company: 'Acme', email: 'biz@acme.com', investmentType: 'A轮', message: '合作意向' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.nextSteps).toContain('partnership');
  });

  test('POST /api/applications/guide 成功写入 → 201', async () => {
    const res = await request(app)
      .post('/api/applications/guide')
      .send({ fullName: '向导', email: 'guide@example.com', country: 'Nepal', phone: '+97712345', certifications: 'IFMGA', personalBio: '资深向导' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.nextSteps).toContain('certifications');
  });

  test('POST /api/applications/seven-summits 成功写入 → 201', async () => {
    const res = await request(app)
      .post('/api/applications/seven-summits')
      .send({ fullName: '报名者', email: 'climber@example.com', phone: '+1555', country: 'USA', targetSummit: 'Everest', personalStatement: '梦想' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.nextSteps).toContain('cohort selection');
  });

  test('GET /api/health exposes lead notification readiness without leaking secrets', async () => {
    const original = {
      LEADS_NOTIFY_EMAIL: process.env.LEADS_NOTIFY_EMAIL,
      ADMIN_EMAIL: process.env.ADMIN_EMAIL,
      RESEND_API_KEY: process.env.RESEND_API_KEY,
      RESEND_FROM: process.env.RESEND_FROM,
    };
    process.env.LEADS_NOTIFY_EMAIL = 'admin@example.com';
    process.env.RESEND_API_KEY = 're_test_key';
    process.env.RESEND_FROM = 'noreply@example.com';
    delete process.env.ADMIN_EMAIL;

    let res;
    try {
      res = await request(app).get('/api/health');
    } finally {
      Object.entries(original).forEach(([key, value]) => {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      });
    }

    expect(res.status).toBe(200);
    expect(res.body.lead_notifications).toEqual({
      ready: true,
      recipient_configured: true,
      resend_configured: true,
      from_configured: true,
    });
    expect(JSON.stringify(res.body)).not.toContain('re_test_key');
  });

  test('缺少邮箱 → 400', async () => {
    const res = await request(app)
      .post('/api/contact')
      .send({ name: '无邮箱', message: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
  });

  test('邮箱格式非法 → 400', async () => {
    const res = await request(app)
      .post('/api/contact')
      .send({ name: '坏邮箱', email: 'not-an-email', message: 'x' });
    expect(res.status).toBe(400);
  });

  test('缺少姓名 → 400', async () => {
    const res = await request(app)
      .post('/api/contact')
      .send({ email: 'noname@example.com', message: 'x' });
    expect(res.status).toBe(400);
  });

  test('GET /api/admin/leads 无 token → 401', async () => {
    const res = await request(app).get('/api/admin/leads');
    expect(res.status).toBe(401);
  });

  test('GET /api/admin/leads 管理员可见全部线索 → 200', async () => {
    const token = createAdminToken();
    const res = await request(app)
      .get('/api/admin/leads')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.leads)).toBe(true);
    expect(res.body.total).toBeGreaterThanOrEqual(4);
    // payload 应被解析为对象
    expect(typeof res.body.leads[0].payload).toBe('object');
  });

  test('GET /api/admin/leads?type=guide_application 类型过滤 → 仅返回向导申请', async () => {
    const token = createAdminToken();
    const res = await request(app)
      .get('/api/admin/leads?type=guide_application')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200);
    expect(res.body.leads.length).toBeGreaterThanOrEqual(1);
    expect(res.body.leads.every((l) => l.type === 'guide_application')).toBe(true);
  });
});
