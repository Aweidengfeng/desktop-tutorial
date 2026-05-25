'use strict';

process.env.DATABASE_PATH = process.env.TEST_DB_PATH || '/tmp/test-club-console-orders.db';
process.env.DATABASE_URL = process.env.DATABASE_URL || `file:${process.env.DATABASE_PATH}`;
process.env.DATABASE_PROVIDER = process.env.DATABASE_PROVIDER || 'sqlite';
process.env.JWT_SECRET = 'test-jwt-secret-summitlink';
process.env.ADMIN_PASSWORD = 'test-admin-password';
process.env.ADMIN_USERNAME = 'admin';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const { createApp } = require('../../tests/helpers/testApp');
const { clearDbCache, createTestDb } = require('../../tests/helpers/db');
const { createTestUser } = require('../../tests/helpers/auth');

describe('GET /api/club-console/orders', () => {
  let app;
  let db;
  let creator;
  let customer;

  beforeAll(() => {
    clearDbCache();
    app = createApp();
    db = createTestDb();
    creator = createTestUser(db, { phone: '13800001001', name: '俱乐部管理员' });
    customer = createTestUser(db, { phone: '13800001002', name: '报名用户' });

    const clubResult = db.prepare(`
      INSERT INTO clubs (name, status, creator_id)
      VALUES (?, ?, ?)
    `).run('测试俱乐部', 'active', creator.id);
    const clubId = Number(clubResult.lastInsertRowid);

    const activityResult = db.prepare(`
      INSERT INTO club_activities (club_id, title, status)
      VALUES (?, ?, ?)
    `).run(clubId, '测试活动', 'active');
    const activityId = Number(activityResult.lastInsertRowid);

    db.prepare(`
      INSERT INTO activity_orders (order_no, activity_id, club_id, user_id, amount, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('ACT-CLUB-ORDER-1', activityId, clubId, customer.id, 1299, 'paid');
  });

  test('returns club activity orders with joined user/activity fields', async () => {
    const res = await request(app)
      .get('/api/club-console/orders')
      .set('Authorization', `Bearer ${creator.token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.orders)).toBe(true);
    expect(res.body.orders.length).toBeGreaterThan(0);
    expect(res.body.orders[0]).toEqual(expect.objectContaining({
      activity_title: '测试活动',
      user_name: '报名用户',
    }));
  });

  test('returns 403 for non-club users', async () => {
    const res = await request(app)
      .get('/api/club-console/orders')
      .set('Authorization', `Bearer ${customer.token}`);

    expect(res.status).toBe(403);
  });
});
