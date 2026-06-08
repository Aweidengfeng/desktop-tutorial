/**
 * 官网线索收集（Leads MVP）集成测试
 * 覆盖：
 *   - POST /api/contact|/api/partnerships|/api/applications/guide|/api/applications/seven-summits
 *       · 必填校验 400
 *       · 邮箱格式 400
 *       · honeypot 命中 → 200 静默成功（不写库）
 *       · 正常提交 → 201 + { success, id, message }
 *   - GET /api/admin/leads
 *       · 未登录 401 / 非管理员 403
 *       · 管理员 200 + 列表 + 类型过滤
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
const { createApp } = require('./helpers/testApp');
const { createTestUser, createAdminToken } = require('./helpers/auth');
const { createTestDb, clearDbCache } = require('./helpers/db');

const bearer = (token) => 'Bearer ' + token;

describe('官网线索收集 /api/leads', () => {
  let app, db, user, userAuth, adminAuthHeader;

  beforeAll(() => {
    clearDbCache();
    app = createApp();
    db = createTestDb();
    user = createTestUser(db, { phone: '13900002200', name: '线索用户' });
    userAuth = bearer(user.token);
    adminAuthHeader = bearer(createAdminToken());
  });

  test('Contact 缺少必填 → 400', async () => {
    const res = await request(app).post('/api/contact').send({ name: 'A', email: 'a@b.com' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('Contact 邮箱格式错误 → 400', async () => {
    const res = await request(app)
      .post('/api/contact')
      .send({ name: 'A', email: 'not-an-email', message: 'hi' });
    expect(res.status).toBe(400);
  });

  test('Contact honeypot 命中 → 200 静默成功且不写库', async () => {
    const before = await request(app).get('/api/admin/leads?type=contact').set('Authorization', adminAuthHeader);
    const beforeTotal = before.body.total;

    const res = await request(app)
      .post('/api/contact')
      .send({ name: 'Bot', email: 'bot@spam.com', message: 'spam', website: 'http://spam.example' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.id).toBeUndefined();

    const after = await request(app).get('/api/admin/leads?type=contact').set('Authorization', adminAuthHeader);
    expect(after.body.total).toBe(beforeTotal);
  });

  test('Contact 正常提交 → 201 + id', async () => {
    const res = await request(app)
      .post('/api/contact')
      .send({ name: 'Climber', email: 'climber@example.com', subject: 'General', message: 'Hello there' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.id).toBe('number');
    expect(res.body.message).toBeTruthy();
  });

  test('Partnerships 正常提交 → 201', async () => {
    const res = await request(app)
      .post('/api/partnerships')
      .send({ name: 'VC', company: 'Acme', email: 'vc@acme.com', investmentType: 'Venture Capital', message: 'interested' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  test('Guide 申请正常提交 → 201', async () => {
    const res = await request(app)
      .post('/api/applications/guide')
      .send({ fullName: 'Guide One', email: 'guide@example.com', country: 'Nepal', phone: '123', yearsOfExperience: '10', certifications: 'IFMGA', specialtyMountains: 'Everest', personalBio: 'Veteran' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  test('Seven Summits 申请正常提交 → 201', async () => {
    const res = await request(app)
      .post('/api/applications/seven-summits')
      .send({ fullName: 'Summit Hopeful', email: 'hopeful@example.com', country: 'USA', phone: '456', experienceLevel: 'Advanced', targetSummit: 'Everest', personalStatement: 'Dream' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  test('Guide 缺少必填 fullName → 400', async () => {
    const res = await request(app)
      .post('/api/applications/guide')
      .send({ email: 'guide2@example.com' });
    expect(res.status).toBe(400);
  });

  test('管理员列表未登录 → 401', async () => {
    const res = await request(app).get('/api/admin/leads');
    expect(res.status).toBe(401);
  });

  test('非管理员访问列表 → 403', async () => {
    const res = await request(app).get('/api/admin/leads').set('Authorization', userAuth);
    expect(res.status).toBe(403);
  });

  test('管理员列表 → 200 + 数组 + total', async () => {
    const res = await request(app).get('/api/admin/leads').set('Authorization', adminAuthHeader);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.leads)).toBe(true);
    expect(typeof res.body.total).toBe('number');
    expect(res.body.total).toBeGreaterThan(0);
    // payload 应被解析为对象
    const sample = res.body.leads[0];
    expect(sample).toHaveProperty('type');
    expect(sample).toHaveProperty('createdAt');
  });

  test('管理员按类型过滤 type=guide 命中', async () => {
    const res = await request(app).get('/api/admin/leads?type=guide').set('Authorization', adminAuthHeader);
    expect(res.status).toBe(200);
    expect(res.body.leads.every((l) => l.type === 'guide')).toBe(true);
    expect(res.body.leads.length).toBeGreaterThan(0);
  });
});
