/**
 * location.js — 团队实时位置追踪 API
 *
 * POST /api/location/update   — 上报当前用户位置（需JWT）
 * GET  /api/location/team     — 获取探险团队所有成员位置（需JWT）
 */
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const prisma = require('../db/prisma');
const auth = require('../middleware/auth');

const locationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: { error: '请求过于频繁' },
  standardHeaders: true,
  legacyHeaders: false,
});

// 确保 user_locations 表存在（兼容无 Prisma migrate 的生产环境）
async function ensureTable() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS user_locations (
        userId INTEGER PRIMARY KEY,
        lat REAL,
        lng REAL,
        expeditionId INTEGER,
        userName TEXT,
        updatedAt TEXT
      )
    `);
  } catch (e) {
    // 表已存在或不支持，忽略
  }
}
ensureTable().catch(() => {});

// POST /api/location/update — 上报当前用户位置
router.post('/update', locationLimiter, auth, async (req, res) => {
  try {
    const { lat, lng, expeditionId } = req.body;
    if (lat == null || lng == null) {
      return res.status(400).json({ error: 'lat 和 lng 是必填项' });
    }
    const userId = req.user.id;
    const now = new Date().toISOString();
    // Upsert 按 userId
    await prisma.$executeRawUnsafe(`
      INSERT INTO user_locations (userId, lat, lng, expeditionId, updatedAt)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(userId) DO UPDATE SET
        lat = excluded.lat,
        lng = excluded.lng,
        expeditionId = excluded.expeditionId,
        updatedAt = excluded.updatedAt
    `, userId, Number(lat), Number(lng), expeditionId ? Number(expeditionId) : null, now);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/location/team?expeditionId=xxx — 获取团队成员位置（5分钟内有更新的）
router.get('/team', locationLimiter, auth, async (req, res) => {
  try {
    const { expeditionId } = req.query;
    // Use JS-computed timestamp for cross-DB compatibility (no SQLite datetime() calls)
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    let members;
    if (expeditionId) {
      members = await prisma.$queryRawUnsafe(`
        SELECT ul.userId, ul.lat, ul.lng, ul.updatedAt, u.name, u.avatar
        FROM user_locations ul
        LEFT JOIN users u ON u.id = ul.userId
        WHERE ul.expeditionId = ?
          AND ul.updatedAt >= ?
      `, Number(expeditionId), fiveMinAgo);
    } else {
      members = await prisma.$queryRawUnsafe(`
        SELECT ul.userId, ul.lat, ul.lng, ul.updatedAt, u.name, u.avatar
        FROM user_locations ul
        LEFT JOIN users u ON u.id = ul.userId
        WHERE ul.updatedAt >= ?
      `, fiveMinAgo);
    }
    res.json(members.map(m => ({
      userId: Number(m.userId),
      lat: Number(m.lat),
      lng: Number(m.lng),
      updatedAt: m.updatedAt,
      name: m.name || `用户${m.userId}`,
      avatar: m.avatar || null,
      online: true,
    })));
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
