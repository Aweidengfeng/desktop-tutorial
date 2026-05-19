const express = require('express');
const rateLimit = require('express-rate-limit');
const prisma = require('../db/prisma');
const adminAuth = require('../middleware/adminAuth');
const { sendPush } = require('../lib/pushSender');
const { captureEvent } = require('../middleware/sentry');

const router = express.Router();

const sosLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: '请求太频繁' },
  standardHeaders: true,
  legacyHeaders: false,
});

function toNullableNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function createSosAlert(req, res) {
  try {
    const userId = toNullableNumber(req.body?.userId);
    const lat = toNullableNumber(req.body?.lat);
    const lng = toNullableNumber(req.body?.lng);
    const accuracy = toNullableNumber(req.body?.accuracy);
    const phone = req.body?.phone ? String(req.body.phone).slice(0, 32) : null;
    const timestampRaw = req.body?.timestamp;
    const timestampDate = timestampRaw ? new Date(timestampRaw) : null;
    if (!timestampRaw || userId === null || lat === null || lng === null || accuracy === null) {
      return res.status(400).json({ error: '缺少必填字段: userId, lat, lng, accuracy, timestamp' });
    }
    if (Number.isNaN(timestampDate.getTime())) {
      console.warn('[SOS] Invalid timestamp received:', timestampRaw);
      return res.status(400).json({ error: '无效 timestamp' });
    }
    const timestamp = timestampDate.toISOString();

    const inserted = await prisma.$queryRaw`
      INSERT INTO sos_alerts (user_id, lat, lng, accuracy, timestamp, phone)
      VALUES (${userId}, ${lat}, ${lng}, ${accuracy}, ${timestamp}, ${phone})
      RETURNING id
    `;
    const alertId = inserted[0].id;
    console.log(`[SOS ALERT] id=${alertId} userId=${userId} lat=${lat} lng=${lng} accuracy=${accuracy}`);
    captureEvent({
      message: 'sos.alert.created',
      level: 'warning',
    }, {
      userId,
      tags: { module: 'sos', action: 'alert' },
      extra: { alertId, lat, lng, accuracy },
    });
    res.json({ ok: true, alertId });

    // 异步推送 SOS 告警至管理员和向导（不阻塞响应）
    setImmediate(async () => {
      try {
        const recipients = await prisma.$queryRawUnsafe(
          `SELECT push_token as token, push_platform as platform FROM users
           WHERE (is_admin = 1 OR is_guide = 1) AND push_token IS NOT NULL AND push_platform IS NOT NULL`
        );
        if (recipients.length > 0) {
          await sendPush(recipients, {
            title: '🆘 SOS 紧急告警',
            body: `用户 #${userId} 在 (${lat && lat.toFixed ? lat.toFixed(4) : lat}, ${lng && lng.toFixed ? lng.toFixed(4) : lng}) 触发 SOS`,
            data: { type: 'sos_alert', alertId: String(alertId), userId: String(userId) },
          });
        }
      } catch (pushErr) {
        console.warn('[SOS] 推送告警失败:', pushErr.message);
      }
    });
  } catch (e) {
    console.error('[SOS] Alert creation failed:', e);
    res.status(500).json({ error: '服务器错误' });
  }
}

async function listSosAlerts(req, res) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const alerts = await prisma.$queryRawUnsafe(
      `SELECT id, user_id as userId, lat, lng, accuracy, timestamp, phone, created_at as createdAt
       FROM sos_alerts
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      limit,
      offset
    );
    const total = Number((await prisma.$queryRaw`SELECT COUNT(*) as c FROM sos_alerts`)[0].c || 0);
    res.json({ alerts, total, page, limit });
  } catch (e) {
    console.error('[SOS] Alerts fetch failed:', e);
    res.status(500).json({ error: '服务器错误' });
  }
}

// POST /api/sos（新标准端点） + 兼容旧版 /alert
/**
 * @swagger
 * /api/sos/alert:
 *   post:
 *     tags: [通知]
 *     summary: 创建 SOS 告警
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, lat, lng, accuracy, timestamp]
 *             properties:
 *               userId: { type: integer }
 *               lat: { type: number }
 *               lng: { type: number }
 *               accuracy: { type: number }
 *               timestamp: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: 告警已创建
 */
router.post('/', sosLimiter, createSosAlert);
router.post('/alert', sosLimiter, createSosAlert);

// GET /api/sos（新标准端点） + 兼容旧版 /alerts
router.get('/', sosLimiter, adminAuth, listSosAlerts);
router.get('/alerts', sosLimiter, adminAuth, listSosAlerts);

// GET /api/sos/active — 过去24小时内的未处理 SOS（管理端轮询用）
router.get('/active', sosLimiter, adminAuth, async (req, res) => {
  // Use JS-computed timestamp for cross-DB compatibility (SQLite and PostgreSQL)
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  try {
    const alerts = await prisma.$queryRawUnsafe(
      `SELECT id, user_id as userId, lat, lng, accuracy, timestamp, phone, status, created_at as createdAt
       FROM sos_alerts
       WHERE created_at >= ?
         AND (status IS NULL OR status != 'resolved')
       ORDER BY created_at DESC`,
      since24h
    );
    res.json({ alerts: alerts.map(a => ({ ...a, userId: Number(a.userId) })), count: alerts.length });
  } catch (e) {
    console.error('[SOS] Active alerts fetch failed:', e);
    // 兼容没有 status 列的旧表
    try {
      const alerts = await prisma.$queryRawUnsafe(
        `SELECT id, user_id as userId, lat, lng, accuracy, timestamp, phone, created_at as createdAt
         FROM sos_alerts
         WHERE created_at >= ?
         ORDER BY created_at DESC`,
        since24h
      );
      res.json({ alerts: alerts.map(a => ({ ...a, userId: Number(a.userId), status: 'pending' })), count: alerts.length });
    } catch (e2) {
      res.status(500).json({ error: '服务器错误' });
    }
  }
});

// PATCH /api/sos/:id/resolve — 管理员标记 SOS 已处理
router.patch('/:id/resolve', sosLimiter, adminAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    // 尝试更新 status 字段（若列不存在则降级）
    try {
      await prisma.$executeRaw`UPDATE sos_alerts SET status = 'resolved' WHERE id = ${id}`;
    } catch (e) {
      // 若列不存在，尝试建列后重试
      try {
        await prisma.$executeRawUnsafe(`ALTER TABLE sos_alerts ADD COLUMN status TEXT DEFAULT 'pending'`);
        await prisma.$executeRaw`UPDATE sos_alerts SET status = 'resolved' WHERE id = ${id}`;
      } catch (e2) { /* 忽略 */ }
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
