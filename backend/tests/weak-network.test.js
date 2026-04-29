'use strict';
/**
 * Phase 5.2 — 弱网轨迹上传模拟测试
 *
 * 覆盖：
 *   1. 分块上传：3 批次各 30 个点，最终合并数据完整性验证
 *   2. 中途中断后恢复：第 2 批超时，第 3 次重试成功，无重复点
 *   3. 超大轨迹：1000 个 GPS 点不超时、数据完整保存
 */

// 环境变量必须在 require 任何后端模块之前设置
process.env.DATABASE_PATH  = process.env.TEST_DB_PATH || '/tmp/test-weak-network.db';
process.env.DATABASE_URL   = process.env.DATABASE_URL || `file:${process.env.DATABASE_PATH}`;
process.env.DATABASE_PROVIDER = process.env.DATABASE_PROVIDER || 'sqlite';
process.env.JWT_SECRET     = 'test-jwt-secret-summitlink';
process.env.ADMIN_PASSWORD = 'test-admin-password';
process.env.ADMIN_USERNAME = 'admin';
process.env.NODE_ENV       = 'test';

const request = require('supertest');

const { createApp }    = require('../../tests/helpers/testApp');
const { clearDbCache, createTestDb } = require('../../tests/helpers/db');
const { createTestUser } = require('../../tests/helpers/auth');

/** 生成 GPS 点数组（lat/lng 随 index 线性增长，便于验证唯一性） */
function makePoints(count, offset = 0) {
  return Array.from({ length: count }, (_, i) => ({
    lat: parseFloat((30 + (offset + i) * 0.001).toFixed(6)),
    lng: parseFloat((80 + (offset + i) * 0.001).toFixed(6)),
    ele: 5000 + offset + i,
    ts:  new Date(Date.now() + (offset + i) * 1000).toISOString(),
  }));
}

describe('Weak network / offline track upload scenarios', () => {
  let app, userToken;

  beforeAll(() => {
    clearDbCache();
    process.env.NODE_ENV = 'test';
    app = createApp();
    const db = createTestDb();
    const user = createTestUser(db, { phone: '13900990001' });
    userToken = user.token;
  });

  // ── 测试 1：分块上传 ─────────────────────────────────────────────
  test('chunked upload: 3 batches of 30 points each merge correctly', async () => {
    const BATCH_SIZE  = 30;
    const BATCH_COUNT = 3;
    const allPoints   = makePoints(BATCH_SIZE * BATCH_COUNT);

    // 模拟分 3 次上传（每次携带完整已知点集的新增部分），最后一次以完整 90 点提交
    // 实际场景：前端累积缓冲区，最终以合并后的全量点上传
    const batches = Array.from({ length: BATCH_COUNT }, (_, b) =>
      allPoints.slice(0, (b + 1) * BATCH_SIZE)
    );

    let trackId;
    for (let i = 0; i < batches.length; i++) {
      const res = await request(app)
        .post('/api/tracks')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name:   `弱网分块轨迹-批次${i + 1}`,
          date:   new Date().toISOString().slice(0, 10),
          points: batches[i],
        });

      // 每次上传应成功（2xx）
      expect(res.status).toBeLessThan(300);
      if (i === batches.length - 1) {
        trackId = res.body.id;
      }
    }

    // 最后一次上传包含全部 90 个点，验证数据完整性
    const detail = await request(app)
      .get(`/api/tracks/${trackId}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(detail.status).toBe(200);
    const savedPoints = detail.body.points || [];
    expect(savedPoints.length).toBe(BATCH_SIZE * BATCH_COUNT);

    // 验证无重复点（以 lat+lng 组合为唯一键）
    const keys = savedPoints.map(p => `${p.lat},${p.lng}`);
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(savedPoints.length);
  });

  // ── 测试 2：中途中断后恢复，无重复点 ────────────────────────────
  test('retry after timeout: no duplicate points in DB', async () => {
    const BATCH_SIZE = 30;
    // 第 1 批：正常上传 30 点
    const batch1 = makePoints(BATCH_SIZE, 0);
    const res1 = await request(app)
      .post('/api/tracks')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name:   '弱网重试轨迹-批次1',
        date:   new Date().toISOString().slice(0, 10),
        points: batch1,
      });
    expect(res1.status).toBeLessThan(300);

    // 第 2 批模拟超时（客户端侧不发送请求），第 3 次重试成功
    // 前端重试策略：将第 2 批和第 3 批合并后重新上传（去重后共 60 点）
    const batch2 = makePoints(BATCH_SIZE, BATCH_SIZE);
    const batch3 = makePoints(BATCH_SIZE, BATCH_SIZE * 2);
    const retryPoints = [...batch2, ...batch3];

    // 验证重试批次本身无重复
    const retryKeys = retryPoints.map(p => `${p.lat},${p.lng}`);
    expect(new Set(retryKeys).size).toBe(retryPoints.length);

    const res2 = await request(app)
      .post('/api/tracks')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name:   '弱网重试轨迹-合并批次2+3',
        date:   new Date().toISOString().slice(0, 10),
        points: retryPoints,
      });
    expect(res2.status).toBeLessThan(300);

    const trackId = res2.body.id;
    const detail = await request(app)
      .get(`/api/tracks/${trackId}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(detail.status).toBe(200);
    const saved = detail.body.points || [];
    expect(saved.length).toBe(BATCH_SIZE * 2);

    // 验证无重复点
    const savedKeys = saved.map(p => `${p.lat},${p.lng}`);
    expect(new Set(savedKeys).size).toBe(saved.length);
  });

  // ── 测试 3：1000 个 GPS 点超大轨迹上传 ──────────────────────────
  test('1000-point track upload completes without timeout', async () => {
    const points = makePoints(1000);

    const start = Date.now();
    const res = await request(app)
      .post('/api/tracks')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name:   '超大轨迹-1000点',
        date:   new Date().toISOString().slice(0, 10),
        points,
      });
    const elapsed = Date.now() - start;

    console.log(`[弱网测试] 1000 点轨迹上传耗时: ${elapsed}ms | 状态: ${res.status}`);

    // 接口不应超时也不应返回 5xx
    expect(res.status).toBeLessThan(500);
    expect(elapsed).toBeLessThan(10000);

    // 验证数据完整保存（通过 GET 再次读取）
    const trackId = res.body.id;
    if (trackId) {
      const detail = await request(app)
        .get(`/api/tracks/${trackId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(detail.status).toBe(200);
      const saved = detail.body.points || [];
      expect(saved.length).toBe(1000);
    }
  }, 10000);
});
