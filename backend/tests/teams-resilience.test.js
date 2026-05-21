'use strict';
/**
 * teams-resilience.test.js
 *
 * Regression tests for GET /api/teams robustness:
 *   1. Falls back to Prisma ORM when $queryRaw throws (e.g. schema mismatch in CI)
 *      and still returns a 200 with the expected response shape.
 */

process.env.DATABASE_PATH    = process.env.TEST_DB_PATH || '/tmp/test-teams-resilience.db';
process.env.DATABASE_URL     = process.env.DATABASE_URL || `file:${process.env.DATABASE_PATH}`;
process.env.DATABASE_PROVIDER = process.env.DATABASE_PROVIDER || 'sqlite';
process.env.JWT_SECRET       = 'test-jwt-secret-summitlink';
process.env.ADMIN_PASSWORD   = 'test-admin-password';
process.env.ADMIN_USERNAME   = 'admin';
process.env.NODE_ENV         = 'test';

const request = require('supertest');
const { createApp }    = require('../../tests/helpers/testApp');
const { clearDbCache, createTestDb } = require('../../tests/helpers/db');
const { createTestUser } = require('../../tests/helpers/auth');

describe('GET /api/teams — raw SQL fallback', () => {
  let app, db, user;

  beforeAll(() => {
    clearDbCache();
    app = createApp();
    db  = createTestDb();
    user = createTestUser(db, { phone: '13800000021' });
    // Insert a recruiting team so the fallback has data to return
    db.prepare(
      `INSERT INTO teams (name, peak, date, spots, total_spots, level, leader, leader_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('Test Team', 'Everest', '2026-07-01', 5, 5, '初级', user.phone, user.id, 'recruiting');
  });

  test('returns 200 with team array when $queryRaw succeeds', async () => {
    const res = await request(app).get('/api/teams');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('falls back to Prisma ORM and returns 200 when $queryRaw throws', async () => {
    // Spy on prisma.$queryRaw to simulate a schema-mismatch error on the first call
    const prisma = require('../../backend/db/prisma');
    const spy = jest.spyOn(prisma, '$queryRaw').mockRejectedValueOnce(
      new Error('no such column: equipment_required')
    );

    const res = await request(app).get('/api/teams');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // Fallback response should contain at minimum id and name
    if (res.body.length > 0) {
      expect(res.body[0]).toHaveProperty('id');
      expect(res.body[0]).toHaveProperty('name');
    }

    spy.mockRestore();
  });
});
