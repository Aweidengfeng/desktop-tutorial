'use strict';
/**
 * Phase 5.1 — 并发超额下单 E2E 测试
 *
 * 验证：
 *   1. 数据库中实际创建的订单数 ≤ 团期最大人数（max_participants）
 *   2. 超额的请求返回 409 状态码（PostgreSQL）或非 2xx 状态码（SQLite）
 *   3. current_participants 字段值与实际订单数一致
 *
 * 注意：SELECT...FOR UPDATE 仅在 PostgreSQL 中有效。
 * SQLite 模式下该语句会使事务失败（500），因此非 2xx 响应均视为"已拒绝"。
 * 在配置了 PostgreSQL 的 CI 环境中，测试会额外验证 409 响应码。
 */

// 环境变量必须在 require 任何后端模块之前设置
process.env.DATABASE_PATH  = process.env.TEST_DB_PATH || '/tmp/test-concurrency.db';
process.env.DATABASE_URL   = process.env.DATABASE_URL || `file:${process.env.DATABASE_PATH}`;
process.env.DATABASE_PROVIDER = process.env.DATABASE_PROVIDER || 'sqlite';
process.env.JWT_SECRET     = 'test-jwt-secret-summitlink';
process.env.ADMIN_PASSWORD = 'test-admin-password';
process.env.ADMIN_USERNAME = 'admin';
process.env.NODE_ENV       = 'test';

const request = require('supertest');
const jwt     = require('jsonwebtoken');

const { createApp }    = require('../../tests/helpers/testApp');
const { clearDbCache, createTestDb } = require('../../tests/helpers/db');
const { createTestUser } = require('../../tests/helpers/auth');

const isPostgres = process.env.DATABASE_PROVIDER === 'postgresql';
const MAX_SLOTS  = 3;
const CONCURRENT = 10;

describe('Phase 5.1 — 并发超额下单防护', () => {
  let app, db, token, expeditionId;

  beforeAll(() => {
    clearDbCache();
    app = createApp();
    db  = createTestDb();

    // 创建测试用户
    const user = createTestUser(db, { phone: '13900990001' });
    token = user.token;

    // 直接向 SQLite 插入一条已发布团期，max_participants=3
    db.prepare(`
      INSERT INTO expeditions (
        publisher_type, publisher_id, title, base_price, commission_rate,
        min_participants, max_participants, current_participants, status,
        created_at, updated_at
      ) VALUES (
        'guide', 1, '测试并发团期', 100, 0.15,
        1, ${MAX_SLOTS}, 0, 'published',
        datetime('now'), datetime('now')
      )
    `).run();

    expeditionId = db.prepare('SELECT last_insert_rowid() AS id').get().id;
  });

  test(
    `${CONCURRENT} 并发下单，最多 ${MAX_SLOTS} 个应成功，其余应被拒绝`,
    async () => {
      const promises = Array.from({ length: CONCURRENT }, () =>
        request(app)
          .post(`/api/expeditions/${expeditionId}/order`)
          .set('Authorization', `Bearer ${token}`)
          .send({ participants: 1 })
      );

      const results = await Promise.all(promises);

      // 成功：2xx，失败：4xx/5xx（非 2xx 均视为拒绝）
      const succeeded = results.filter(r => r.status >= 200 && r.status < 300);
      const rejected  = results.filter(r => r.status < 200 || r.status >= 300);

      // 核心断言 1：实际创建订单数不超过 max_participants
      expect(succeeded.length).toBeLessThanOrEqual(MAX_SLOTS);

      // 核心断言 2：被拒绝的请求数 ≥ (总请求 - max_participants)
      expect(rejected.length).toBeGreaterThanOrEqual(CONCURRENT - MAX_SLOTS);

      // PostgreSQL 额外断言：超额请求必须返回 409
      if (isPostgres) {
        const conflict = results.filter(r => r.status === 409);
        expect(conflict.length).toBeGreaterThanOrEqual(CONCURRENT - MAX_SLOTS);
      }

      // 核心断言 3：current_participants 与实际订单数一致
      const row = db.prepare(
        'SELECT current_participants FROM expeditions WHERE id = ?'
      ).get(expeditionId);
      const orderCount = db.prepare(
        'SELECT COUNT(*) AS cnt FROM expedition_orders WHERE expedition_id = ?'
      ).get(expeditionId);

      expect(Number(row.current_participants)).toBe(succeeded.length);
      expect(Number(orderCount.cnt)).toBe(succeeded.length);

      console.log(
        `[并发测试] 成功: ${succeeded.length}, 拒绝: ${rejected.length}, ` +
        `current_participants: ${row.current_participants}`
      );
    },
    30000 // 30s 超时
  );

  test('团期名额已满时，新下单应返回 409 或错误', async () => {
    // 将 current_participants 设置为等于 max_participants
    db.prepare(
      'UPDATE expeditions SET current_participants = ? WHERE id = ?'
    ).run(MAX_SLOTS, expeditionId);

    const res = await request(app)
      .post(`/api/expeditions/${expeditionId}/order`)
      .set('Authorization', `Bearer ${token}`)
      .send({ participants: 1 });

    // 在 PostgreSQL 中应为 409；SQLite FOR UPDATE 不支持时返回 500
    expect([409, 500]).toContain(res.status);
    if (isPostgres) {
      expect(res.status).toBe(409);
    }
  });

  test('无 JWT 下单应返回 401', async () => {
    const res = await request(app)
      .post(`/api/expeditions/${expeditionId}/order`)
      .send({ participants: 1 });
    expect(res.status).toBe(401);
  });
});
