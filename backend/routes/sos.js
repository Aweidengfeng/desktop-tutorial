'use strict';

/**
 * PR-160: SOS 真实化路由
 *
 * POST /api/sos          — 接收 SOS 告警，写入 sos_alerts 表（无需登录，紧急场景）
 * GET  /api/sos/history  — 返回最近 50 条记录（需 admin token）
 */

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const prisma = require('../db/prisma');
const adminAuth = require('../middleware/adminAuth');

// 限流：每个 IP 每 60 秒最多 5 次 SOS（防滥用）
const sosLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: '操作过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * @swagger
 * /api/sos:
 *   post:
 *     summary: 提交 SOS 紧急求救记录
 *     tags: [SOS]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [timestamp]
 *             properties:
 *               userId:    { type: string }
 *               lat:       { type: number }
 *               lng:       { type: number }
 *               timestamp: { type: string }
 *               userAgent: { type: string }
 *     responses:
 *       200: { description: '入库成功' }
 *       400: { description: '缺少必填字段' }
 *       500: { description: '服务器错误' }
 */
router.post('/', sosLimiter, async (req, res) => {
  try {
    const { userId, lat, lng, timestamp, userAgent } = req.body || {};

    if (!timestamp) {
      return res.status(400).json({ error: '缺少必填字段：timestamp' });
    }

    const record = await prisma.$queryRaw`
      INSERT INTO sos_alerts (userId, lat, lng, timestamp, userAgent)
      VALUES (${userId ?? null}, ${lat ?? null}, ${lng ?? null}, ${timestamp}, ${userAgent ?? null})
      RETURNING *
    `;

    const inserted = record && record[0] ? record[0] : { userId, lat, lng, timestamp, userAgent };

    console.warn(
      '[SOS ALERT] 新 SOS 求救记录：',
      JSON.stringify({ userId, lat, lng, timestamp, userAgent })
    );

    res.json({ success: true, record: inserted });
  } catch (e) {
    console.error('[SOS] POST /api/sos 错误：', e.message);
    res.status(500).json({ error: '服务器错误' });
  }
});

/**
 * @swagger
 * /api/sos/history:
 *   get:
 *     summary: 获取最近 50 条 SOS 记录（需 admin token）
 *     tags: [SOS]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: '记录列表' }
 *       401: { description: '未认证' }
 *       403: { description: '无权限' }
 */
router.get('/history', adminAuth, async (req, res) => {
  try {
    const records = await prisma.$queryRaw`
      SELECT * FROM sos_alerts ORDER BY createdAt DESC LIMIT 50
    `;
    res.json(records);
  } catch (e) {
    console.error('[SOS] GET /api/sos/history 错误：', e.message);
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
