/**
 * API 2026 Features Test Suite
 * Tests for: chat REST API, mountains wishlist/footprint, badges, feed, post saves
 */
process.env.DATABASE_PATH  = process.env.TEST_DB_PATH || '/tmp/test-alpinelink.db';
process.env.DATABASE_URL   = process.env.DATABASE_URL || `file:${process.env.DATABASE_PATH}`;
process.env.JWT_SECRET     = 'test-jwt-secret-summitlink';
process.env.ADMIN_PASSWORD = 'test-admin-password';
process.env.NODE_ENV       = 'test';

const request = require('supertest');
const { createApp }      = require('./helpers/testApp');
const { createTestUser, authHeader } = require('./helpers/auth');
const { createTestDb }   = require('./helpers/db');

let app, db, user1, user2;

beforeEach(() => {
  app = createApp();
  db  = createTestDb();
  user1 = createTestUser(db);
  user2 = createTestUser(db);
});

describe('Feed API', () => {
  test('GET /api/posts/feed?mode=recommended returns posts array', async () => {
    const res = await request(app).get('/api/posts/feed?mode=recommended');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('posts');
    expect(Array.isArray(res.body.posts)).toBe(true);
  });

  test('GET /api/posts/feed?mode=nearby returns posts with location', async () => {
    await request(app)
      .post('/api/posts')
      .set(authHeader(user1.token))
      .send({ content: '测试nearby帖子', location: '珠峰大本营' });

    const res = await request(app).get('/api/posts/feed?mode=nearby');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('posts');
    expect(Array.isArray(res.body.posts)).toBe(true);
  });

  test('GET /api/posts/feed?mode=following requires auth', async () => {
    const res = await request(app).get('/api/posts/feed?mode=following');
    expect(res.status).toBe(401);
  });

  test('GET /api/posts/feed?mode=following with auth returns posts', async () => {
    const res = await request(app)
      .get('/api/posts/feed?mode=following')
      .set(authHeader(user1.token));
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('posts');
    expect(Array.isArray(res.body.posts)).toBe(true);
  });

  test('GET /api/posts/feed returns nextCursor for pagination', async () => {
    const res = await request(app).get('/api/posts/feed?mode=recommended&limit=20');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('nextCursor');
  });

  test('GET /api/posts/feed?mode=invalid returns 400', async () => {
    const res = await request(app).get('/api/posts/feed?mode=invalid');
    expect(res.status).toBe(400);
  });
});

describe('Post Save API', () => {
  let postId;
  beforeEach(async () => {
    const res = await request(app)
      .post('/api/posts')
      .set(authHeader(user1.token))
      .send({ content: '保存测试帖子' });
    postId = res.body.id;
  });

  test('POST /api/posts/:id/save saves a post', async () => {
    const res = await request(app)
      .post(`/api/posts/${postId}/save`)
      .set(authHeader(user2.token));
    expect(res.status).toBe(200);
    expect(res.body.saved).toBe(true);
    expect(res.body.count).toBe(1);
  });

  test('POST /api/posts/:id/save is idempotent', async () => {
    await request(app).post(`/api/posts/${postId}/save`).set(authHeader(user2.token));
    const res = await request(app).post(`/api/posts/${postId}/save`).set(authHeader(user2.token));
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
  });

  test('DELETE /api/posts/:id/save unsaves a post', async () => {
    await request(app).post(`/api/posts/${postId}/save`).set(authHeader(user2.token));
    const res = await request(app)
      .delete(`/api/posts/${postId}/save`)
      .set(authHeader(user2.token));
    expect(res.status).toBe(200);
    expect(res.body.saved).toBe(false);
    expect(res.body.count).toBe(0);
  });

  test('GET /api/posts/:id/saves returns count', async () => {
    const res = await request(app).get(`/api/posts/${postId}/saves`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('count');
    expect(typeof res.body.count).toBe('number');
  });

  test('POST /api/posts/:id/save requires auth', async () => {
    const res = await request(app).post(`/api/posts/${postId}/save`);
    expect(res.status).toBe(401);
  });
});

describe('Mountain API', () => {
  test('GET /api/mountains/categories returns 4 categories', async () => {
    const res = await request(app).get('/api/mountains/categories');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(4);
  });

  test('GET /api/mountains/:id/detail returns 404 for missing peak', async () => {
    const res = await request(app).get('/api/mountains/99999/detail');
    expect(res.status).toBe(404);
  });

  test('GET /api/mountains/:id/detail returns peak details', async () => {
    const peakId = db.prepare("INSERT INTO peaks (name, altitude, continent) VALUES (?, ?, ?)").run('测试峰', 6000, '亚洲').lastInsertRowid;
    const res = await request(app).get(`/api/mountains/${peakId}/detail`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('测试峰');
    expect(res.body).toHaveProperty('footprint_count');
    expect(res.body).toHaveProperty('wishlist_count');
  });

  test('POST /api/mountains/:id/wishlist requires auth', async () => {
    const res = await request(app).post('/api/mountains/1/wishlist');
    expect(res.status).toBe(401);
  });

  test('POST /api/mountains/:id/wishlist adds to wishlist', async () => {
    const peakId = db.prepare("INSERT INTO peaks (name, altitude, continent) VALUES (?, ?, ?)").run('愿望峰', 5500, '亚洲').lastInsertRowid;
    const res = await request(app)
      .post(`/api/mountains/${peakId}/wishlist`)
      .set(authHeader(user1.token))
      .send({ note: '梦想之山' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('POST /api/mountains/:id/wishlist is idempotent', async () => {
    const peakId = db.prepare("INSERT INTO peaks (name, altitude, continent) VALUES (?, ?, ?)").run('幂等峰', 5500, '亚洲').lastInsertRowid;
    await request(app).post(`/api/mountains/${peakId}/wishlist`).set(authHeader(user1.token));
    const res = await request(app).post(`/api/mountains/${peakId}/wishlist`).set(authHeader(user1.token));
    expect(res.status).toBe(200);
  });

  test('DELETE /api/mountains/:id/wishlist removes from wishlist', async () => {
    const peakId = db.prepare("INSERT INTO peaks (name, altitude, continent) VALUES (?, ?, ?)").run('删除峰', 5500, '亚洲').lastInsertRowid;
    await request(app).post(`/api/mountains/${peakId}/wishlist`).set(authHeader(user1.token));
    const res = await request(app)
      .delete(`/api/mountains/${peakId}/wishlist`)
      .set(authHeader(user1.token));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('POST /api/mountains/:id/footprint records summit', async () => {
    const peakId = db.prepare("INSERT INTO peaks (name, altitude, continent) VALUES (?, ?, ?)").run('登顶峰', 5000, '亚洲').lastInsertRowid;
    const res = await request(app)
      .post(`/api/mountains/${peakId}/footprint`)
      .set(authHeader(user1.token))
      .send({ summit_date: '2026-05-15', story: '登顶成功！' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty('id');
  });

  test('GET /api/mountains/:id/footprints returns summiteers', async () => {
    const peakId = db.prepare("INSERT INTO peaks (name, altitude, continent) VALUES (?, ?, ?)").run('足迹峰', 5000, '亚洲').lastInsertRowid;
    await request(app).post(`/api/mountains/${peakId}/footprint`).set(authHeader(user1.token)).send({ summit_date: '2026-05-15' });
    const res = await request(app).get(`/api/mountains/${peakId}/footprints`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty('user_name');
  });
});

describe('Badge API', () => {
  test('GET /api/badges returns all badges', async () => {
    const res = await request(app).get('/api/badges');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(20);
  });

  test('GET /api/badges/my requires auth', async () => {
    const res = await request(app).get('/api/badges/my');
    expect(res.status).toBe(401);
  });

  test('GET /api/badges/my returns badges with progress', async () => {
    const res = await request(app)
      .get('/api/badges/my')
      .set(authHeader(user1.token));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  test('POST /api/badges/check requires auth', async () => {
    const res = await request(app).post('/api/badges/check');
    expect(res.status).toBe(401);
  });

  test('POST /api/badges/check returns unlocked badges', async () => {
    const res = await request(app)
      .post('/api/badges/check')
      .set(authHeader(user1.token));
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('unlocked');
    expect(res.body).toHaveProperty('count');
    expect(Array.isArray(res.body.unlocked)).toBe(true);
  });

  test('POST /api/badges/check is idempotent', async () => {
    const res1 = await request(app).post('/api/badges/check').set(authHeader(user1.token));
    const res2 = await request(app).post('/api/badges/check').set(authHeader(user1.token));
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(res2.body.count).toBe(0);
  });

  test('POST /api/badges/check unlocks first post badge after posting', async () => {
    await request(app)
      .post('/api/posts')
      .set(authHeader(user1.token))
      .send({ content: '我的第一条动态' });

    const res = await request(app)
      .post('/api/badges/check')
      .set(authHeader(user1.token));
    expect(res.status).toBe(200);
    const unlockedTypes = res.body.unlocked.map(b => b.condition_type);
    expect(unlockedTypes).toContain('post_count');
  });
});

describe('Chat Conversations REST API', () => {
  test('GET /api/messages/conversations requires auth', async () => {
    const res = await request(app).get('/api/messages/conversations');
    expect(res.status).toBe(401);
  });

  test('POST /api/messages/conversations creates a conversation', async () => {
    const res = await request(app)
      .post('/api/messages/conversations')
      .set(authHeader(user1.token))
      .send({ target_user_id: user2.id });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
  });

  test('GET /api/messages/conversations returns conversation list', async () => {
    await request(app)
      .post('/api/messages/conversations')
      .set(authHeader(user1.token))
      .send({ target_user_id: user2.id });

    const res = await request(app)
      .get('/api/messages/conversations')
      .set(authHeader(user1.token));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
