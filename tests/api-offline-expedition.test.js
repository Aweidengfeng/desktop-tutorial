'use strict';

process.env.DATABASE_PATH  = process.env.TEST_DB_PATH || '/tmp/test-alpinelink.db';
process.env.DATABASE_URL   = process.env.DATABASE_URL || `file:${process.env.DATABASE_PATH}`;
process.env.JWT_SECRET     = 'test-jwt-secret-summitlink';
process.env.ADMIN_PASSWORD = 'test-admin-password';
process.env.ADMIN_USERNAME = 'admin';
process.env.NODE_ENV       = 'test';
process.env.INVESTOR_TOKEN = 'test-investor-token';

const request = require('supertest');
const { createApp }       = require('./helpers/testApp');
const { createTestUser }  = require('./helpers/auth');
const { clearDbCache, createTestDb } = require('./helpers/db');

// ─────────────────────────────────────────────────────────────
// Module A: Offline Expeditions
// ─────────────────────────────────────────────────────────────
describe('Module A: Offline Expeditions', () => {
  let app, db, token, userId, expeditionId;
  const uuid1 = 'test-uuid-001';

  beforeAll(() => {
    clearDbCache();
    app = createApp();
    db  = createTestDb();
    const user = createTestUser(db, { name: '测试攀登者', phone: '13800000001' });
    token = user.token;
    userId = user.id;
  });

  test('1. POST /api/offline-expeditions - create expedition', async () => {
    const res = await request(app)
      .post('/api/offline-expeditions')
      .set('Authorization', `Bearer ${token}`)
      .send({ client_uuid: uuid1, peak_name: '珠穆朗玛峰', started_at: new Date().toISOString() });
    expect(res.status).toBe(200);
    expect(res.body.client_uuid).toBe(uuid1);
    expect(res.body.status).toBe('ongoing');
    expeditionId = res.body.id;
  });

  test('2. POST /api/offline-expeditions - idempotent (same uuid)', async () => {
    const res = await request(app)
      .post('/api/offline-expeditions')
      .set('Authorization', `Bearer ${token}`)
      .send({ client_uuid: uuid1, peak_name: '珠穆朗玛峰 (更新)', started_at: new Date().toISOString() });
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(expeditionId);
  });

  test('3. POST /api/offline-expeditions - missing client_uuid → 400', async () => {
    const res = await request(app)
      .post('/api/offline-expeditions')
      .set('Authorization', `Bearer ${token}`)
      .send({ started_at: new Date().toISOString() });
    expect(res.status).toBe(400);
  });

  test('4. POST /api/offline-expeditions - unauthorized → 401', async () => {
    const res = await request(app)
      .post('/api/offline-expeditions')
      .send({ client_uuid: 'any', started_at: new Date().toISOString() });
    expect(res.status).toBe(401);
  });

  test('5. GET /api/offline-expeditions/my - list expeditions', async () => {
    const res = await request(app)
      .get('/api/offline-expeditions/my')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  test('6. GET /api/offline-expeditions/:id - get detail', async () => {
    const res = await request(app)
      .get(`/api/offline-expeditions/${expeditionId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(expeditionId);
  });

  test('7. GET /api/offline-expeditions/:id - not found → 404', async () => {
    const res = await request(app)
      .get('/api/offline-expeditions/99999')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  test('8. POST /api/offline-expeditions/:id/moments - batch upload', async () => {
    const moments = [
      { client_uuid: 'moment-001', recorded_at: new Date().toISOString(), altitude: 5364, type: 'text', content: '到达大本营' },
      { client_uuid: 'moment-002', recorded_at: new Date().toISOString(), altitude: 6000, type: 'text', content: '营地1' },
    ];
    const res = await request(app)
      .post(`/api/offline-expeditions/${expeditionId}/moments`)
      .set('Authorization', `Bearer ${token}`)
      .send(moments);
    expect(res.status).toBe(200);
    expect(res.body.total_moments).toBe(2);
  });

  test('9. POST /api/offline-expeditions/:id/moments - idempotent', async () => {
    const moments = [{ client_uuid: 'moment-001', recorded_at: new Date().toISOString(), altitude: 5364, type: 'text' }];
    const res = await request(app)
      .post(`/api/offline-expeditions/${expeditionId}/moments`)
      .set('Authorization', `Bearer ${token}`)
      .send(moments);
    expect(res.status).toBe(200);
    expect(res.body.total_moments).toBe(2); // still 2, not 3
  });

  test('10. GET /api/offline-expeditions/:id/moments - list moments', async () => {
    const res = await request(app)
      .get(`/api/offline-expeditions/${expeditionId}/moments`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);
  });

  test('11. POST /api/offline-expeditions/:id/finalize - finalize expedition', async () => {
    const res = await request(app)
      .post(`/api/offline-expeditions/${expeditionId}/finalize`)
      .set('Authorization', `Bearer ${token}`)
      .send({ summited: 1, max_altitude: 8848, total_gain: 3500, duration_sec: 86400, ended_at: new Date().toISOString() });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('completed');
    expect(res.body.summited).toBe(1);
    expect(res.body.max_altitude).toBe(8848);
  });

  test('12. POST /api/offline-expeditions/:id/subscribe - subscribe', async () => {
    const res = await request(app)
      .post(`/api/offline-expeditions/${expeditionId}/subscribe`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('13. POST /api/offline-expeditions/:id/subscribe - idempotent', async () => {
    const res = await request(app)
      .post(`/api/offline-expeditions/${expeditionId}/subscribe`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  test('14. GET /api/offline-expeditions/public/:userId - public expeditions', async () => {
    const res = await request(app).get(`/api/offline-expeditions/public/${userId}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
// Module B: Gear Checklist
// ─────────────────────────────────────────────────────────────
describe('Module B: Gear Checklist', () => {
  let app, db, token, gearListId;

  beforeAll(() => {
    clearDbCache();
    app = createApp();
    db  = createTestDb();
    const user = createTestUser(db, { name: '装备测试员', phone: '13800000002' });
    token = user.token;
  });

  test('15. POST /api/climbing-log/gear-list - generate gear list', async () => {
    const res = await request(app)
      .post('/api/climbing-log/gear-list')
      .set('Authorization', `Bearer ${token}`)
      .send({ peak_name: '珠穆朗玛峰', altitude_tier: '8000+', season: 'winter', difficulty: 'technical' });
    expect(res.status).toBe(200);
    expect(res.body.peak_name).toBe('珠穆朗玛峰');
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeGreaterThan(5);
    gearListId = res.body.id;
  });

  test('16. GET /api/climbing-log/gear-list/:id - get gear list', async () => {
    const res = await request(app)
      .get(`/api/climbing-log/gear-list/${gearListId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(gearListId);
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  test('17. PUT /api/climbing-log/gear-list/:id - update gear list', async () => {
    const items = [{ name: '登山靴', checked: true }, { name: '冰爪', checked: false }];
    const res = await request(app)
      .put(`/api/climbing-log/gear-list/${gearListId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ items });
    expect(res.status).toBe(200);
    expect(res.body.items[0].checked).toBe(true);
  });

  test('18. GET /api/climbing-log/stats - user stats', async () => {
    const res = await request(app)
      .get('/api/climbing-log/stats')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('total_expeditions');
  });
});

// ─────────────────────────────────────────────────────────────
// Module E: AI Coach
// ─────────────────────────────────────────────────────────────
describe('Module E: AI Coach', () => {
  let app, db, token;

  beforeAll(() => {
    clearDbCache();
    app = createApp();
    db  = createTestDb();
    const user = createTestUser(db, { name: 'AI教练测试', phone: '13800000003' });
    token = user.token;
  });

  test('19. POST /api/ai-coach/assessment - save assessment', async () => {
    const res = await request(app)
      .post('/api/ai-coach/assessment')
      .set('Authorization', `Bearer ${token}`)
      .send({ max_altitude: 4000, gear_skill: 'intermediate', fitness: 'good', technical_skill: 'beginner', goal_peak: '玉珠峰' });
    expect(res.status).toBe(200);
    expect(res.body.goal_peak).toBe('玉珠峰');
  });

  test('20. GET /api/ai-coach/assessment - get assessment', async () => {
    const res = await request(app)
      .get('/api/ai-coach/assessment')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.max_altitude).toBe(4000);
  });

  test('21. GET /api/ai-coach/roadmap - get roadmap', async () => {
    const res = await request(app)
      .get('/api/ai-coach/roadmap')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.roadmap).toBeTruthy();
    expect(Array.isArray(res.body.roadmap)).toBe(true);
  });

  test('22. GET /api/ai-coach/terms - get glossary', async () => {
    const res = await request(app).get('/api/ai-coach/terms');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  test('23. POST /api/ai-coach/ask - ask question', async () => {
    const res = await request(app)
      .post('/api/ai-coach/ask')
      .set('Authorization', `Bearer ${token}`)
      .send({ question: '如何预防高原反应' });
    expect(res.status).toBe(200);
    expect(res.body.answer).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────
// Module F: Investor Dashboard
// ─────────────────────────────────────────────────────────────
describe('Module F: Investor Metrics', () => {
  let app;

  beforeAll(() => {
    clearDbCache();
    app = createApp();
  });

  test('24. GET /api/investor/metrics - no token → 401', async () => {
    const res = await request(app).get('/api/investor/metrics');
    expect(res.status).toBe(401);
  });

  test('25. GET /api/investor/metrics - with valid token → 200', async () => {
    const res = await request(app)
      .get('/api/investor/metrics')
      .set('x-investor-token', 'test-investor-token');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('dau');
    expect(res.body).toHaveProperty('gmv');
  });

  test('26. GET /api/investor/funnel - with valid token → 200', async () => {
    const res = await request(app)
      .get('/api/investor/funnel')
      .set('x-investor-token', 'test-investor-token');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('registered');
  });

  test('27. GET /api/investor/top-guides', async () => {
    const res = await request(app)
      .get('/api/investor/top-guides')
      .set('x-investor-token', 'test-investor-token');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('28. GET /api/investor/top-peaks', async () => {
    const res = await request(app)
      .get('/api/investor/top-peaks')
      .set('x-investor-token', 'test-investor-token');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('29. GET /api/investor/badges-stats', async () => {
    const res = await request(app)
      .get('/api/investor/badges-stats')
      .set('x-investor-token', 'test-investor-token');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('30. GET /api/investor/regional', async () => {
    const res = await request(app)
      .get('/api/investor/regional')
      .set('x-investor-token', 'test-investor-token');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('regions');
  });
});
