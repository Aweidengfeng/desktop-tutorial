const express = require('express');
const rateLimit = require('express-rate-limit');
const prisma = require('../db/prisma');
const adminAuth = require('../middleware/adminAuth');

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

// POST /api/sos/alert
router.post('/alert', sosLimiter, async (req, res) => {
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
    res.json({ ok: true, alertId });
  } catch (e) {
    console.error('[SOS] Alert creation failed:', e);
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/sos/alerts
router.get('/alerts', sosLimiter, adminAuth, async (req, res) => {
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
});

module.exports = router;
