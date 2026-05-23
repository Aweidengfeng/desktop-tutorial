'use strict';
/**
 * posts-resilience.test.js
 *
 * Regression tests for GET /api/posts robustness:
 *   1. Falls back to Prisma ORM when $queryRaw throws (e.g. schema mismatch in CI)
 *   2. Malformed tags/emojis/images JSON does not crash the endpoint
 */

process.env.DATABASE_PATH    = process.env.TEST_DB_PATH || '/tmp/test-posts-resilience.db';
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

describe('GET /api/posts — raw SQL fallback', () => {
  let app, db, user;

  beforeAll(() => {
    clearDbCache();
    app = createApp();
    db  = createTestDb();
    user = createTestUser(db, { phone: '13700000011' });
    // Insert a post with valid JSON fields
    db.prepare(
      `INSERT INTO posts (user_id, author_name, content, tags, emojis, images)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(user.id, 'Alice', 'Valid post', '["hiking"]', '["🏔️"]', '["img1.jpg"]');
  });

  test('returns 200 with post array when $queryRaw succeeds', async () => {
    const res = await request(app).get('/api/posts');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('falls back to Prisma ORM and returns 200 when $queryRaw throws', async () => {
    // Spy on prisma.$queryRaw to simulate a schema-mismatch error on the first call
    const prisma = require('../db/prisma');
    const spy = jest.spyOn(prisma, '$queryRaw').mockRejectedValueOnce(
      new Error('no such column: images')
    );

    const res = await request(app).get('/api/posts');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    spy.mockRestore();
  });
});

describe('GET /api/posts — malformed JSON fields do not crash', () => {
  let app, db, user, malformedPostId;

  beforeAll(() => {
    clearDbCache();
    app = createApp();
    db  = createTestDb();
    user = createTestUser(db, { phone: '13700000012' });
    // Insert a post with malformed JSON in all three JSON fields
    db.prepare(
      `INSERT INTO posts (user_id, author_name, content, tags, emojis, images)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(user.id, 'Bob', 'Malformed JSON post', 'not-json', '{bad}', '123');
    malformedPostId = db.prepare('SELECT id FROM posts WHERE content = ? ORDER BY id DESC LIMIT 1')
      .get('Malformed JSON post')?.id;
  });

  test('GET /api/posts returns 200 and normalises malformed JSON fields to []', async () => {
    const res = await request(app).get('/api/posts');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    const post = res.body.find(p => p.content === 'Malformed JSON post');
    expect(post).toBeDefined();
    expect(post.tags).toEqual([]);
    expect(post.emojis).toEqual([]);
    expect(post.images).toEqual([]);
  });

  test('GET /api/posts/:id returns 200 and normalises malformed JSON fields to []', async () => {
    // Retrieve the ID of the malformed post
    const listRes = await request(app).get('/api/posts');
    const post = listRes.body.find(p => p.content === 'Malformed JSON post');
    expect(post).toBeDefined();

    const res = await request(app).get(`/api/posts/${post.id}`);
    expect(res.status).toBe(200);
    expect(res.body.tags).toEqual([]);
    expect(res.body.emojis).toEqual([]);
    expect(res.body.images).toEqual([]);
  });

  test('GET /api/posts/:id falls back when images column is missing', async () => {
    const prisma = require('../db/prisma');
    const spy = jest.spyOn(prisma, '$queryRaw')
      .mockRejectedValueOnce(new Error('column "images" does not exist'))
      .mockResolvedValueOnce([{
        id: malformedPostId,
        authorName: 'Bob',
        authorAvatar: null,
        content: 'Malformed JSON post',
        image: null,
        location: null,
        likes: 0,
        comments: 0,
        createdAt: new Date().toISOString(),
      }]);

    const res = await request(app).get(`/api/posts/${malformedPostId}`);
    expect(res.status).toBe(200);
    expect(res.body.images).toEqual([]);

    spy.mockRestore();
  });
});

describe('GET /api/users/:id — bio column fallback', () => {
  let app, db, user;

  beforeAll(() => {
    clearDbCache();
    app = createApp();
    db = createTestDb();
    user = createTestUser(db, { phone: '13700000013', name: 'User Bio Fallback' });
  });

  test('returns 200 with default bio when raw query fails on missing bio column', async () => {
    const prisma = require('../db/prisma');
    const spy = jest.spyOn(prisma, '$queryRaw')
      .mockRejectedValueOnce(new Error('column "bio" does not exist'))
      .mockResolvedValueOnce([{
        id: user.id,
        name: 'User Bio Fallback',
        username: null,
        avatar: null,
        level: '初级攀登者',
        summits: 0,
        expeditions: 0,
        followers: 0,
        following: 0,
        created_at: new Date().toISOString(),
      }]);

    const res = await request(app).get(`/api/users/${user.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(user.id);
    expect(res.body.bio).toBe('');

    spy.mockRestore();
  });
});
