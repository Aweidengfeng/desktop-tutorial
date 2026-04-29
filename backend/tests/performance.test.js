'use strict';
/**
 * Phase 5.5 — 性能基准测试
 *
 * 覆盖：
 *   1. 50 并发查询山峰列表（GET /api/peaks）— 无 500 错误，记录 P99 响应时间
 *   2. 轨迹上传（POST /api/tracks）包含 100 个 GPS 点 — 响应时间 < 3000ms
 *   3. 输出测试报告到控制台
 */

// 环境变量必须在 require 任何后端模块之前设置
process.env.DATABASE_PATH  = process.env.TEST_DB_PATH || '/tmp/test-performance.db';
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

// ── 统计辅助 ─────────────────────────────────────────────────────

/**
 * 计算百分位响应时间（毫秒）
 * @param {number[]} times - 排好序的响应时间数组
 * @param {number}   p     - 百分位（0-100）
 */
function percentile(times, p) {
  if (!times.length) return 0;
  const sorted = [...times].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

describe('Phase 5.5 — 性能基准测试', () => {
  let app, userToken;

  beforeAll(() => {
    clearDbCache();
    process.env.NODE_ENV = 'test';
    app = createApp();
    const db = createTestDb();

    // 创建测试用户（用于需要鉴权的接口）
    const user = createTestUser(db, { phone: '13900880001' });
    userToken = user.token;
  });

  // ── 测试 1：50 并发查询山峰列表 ─────────────────────────────────
  test(
    '50 并发请求 GET /api/peaks — 无 500 错误',
    async () => {
      const CONCURRENT = 50;

      const promises = Array.from({ length: CONCURRENT }, (_, i) => {
        const t0 = Date.now();
        return request(app)
          .get('/api/peaks')
          .then(res => ({ status: res.status, elapsed: Date.now() - t0 }));
      });

      const start   = Date.now();
      const results = await Promise.all(promises);
      const elapsed = Date.now() - start;

      const errors      = results.filter(r => r.status >= 500);
      const responseTimes = results.map(r => r.elapsed);
      const p50 = percentile(responseTimes, 50);
      const p99 = percentile(responseTimes, 99);
      const maxTime = Math.max(...responseTimes);

      console.log(
        `[性能] 50 并发峰值列表查询\n` +
        `  总耗时: ${elapsed}ms | P50: ${p50}ms | P99: ${p99}ms | 最大: ${maxTime}ms\n` +
        `  成功: ${results.length - errors.length} | 500 错误: ${errors.length}`
      );

      expect(errors.length).toBe(0);
    },
    30000 // 30s 超时
  );

  // ── 测试 2：100 个 GPS 点的轨迹上传 < 3s ────────────────────────
  test(
    '上传包含 100 个 GPS 点的轨迹 — 响应时间 < 3000ms',
    async () => {
      const points = Array.from({ length: 100 }, (_, i) => ({
        lat: parseFloat((30 + i * 0.001).toFixed(6)),
        lng: parseFloat((80 + i * 0.001).toFixed(6)),
        ele: 5000 + i,
        ts: new Date(Date.now() + i * 1000).toISOString(),
      }));

      const start = Date.now();
      const res = await request(app)
        .post('/api/tracks')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name:   '性能基准轨迹',
          date:   new Date().toISOString().slice(0, 10),
          points,
        });
      const elapsed = Date.now() - start;

      console.log(
        `[性能] 100 点轨迹上传\n` +
        `  响应时间: ${elapsed}ms | 状态码: ${res.status}`
      );

      // 响应时间必须小于 3000ms
      expect(elapsed).toBeLessThan(3000);

      // 接口本身不应返回 5xx
      expect(res.status).toBeLessThan(500);
    },
    10000 // 10s 超时
  );

  // ── 测试 3：健康检查接口基准 ──────────────────────────────────────
  test(
    '健康检查接口 GET /health — 响应时间 < 200ms',
    async () => {
      const start = Date.now();
      const res   = await request(app).get('/health');
      const elapsed = Date.now() - start;

      console.log(`[性能] /health 响应时间: ${elapsed}ms`);

      expect(res.status).toBe(200);
      expect(elapsed).toBeLessThan(200);
    }
  );
});
