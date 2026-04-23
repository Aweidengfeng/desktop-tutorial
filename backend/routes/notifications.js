const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const prisma = require('../db/prisma');
const auth = require('../middleware/auth');

const notifLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false, message: { error: '请求过于频繁' } });

// GET /api/notifications（需要JWT）
router.get('/', notifLimiter, auth, async (req, res) => {
  try {
    const notifications = await prisma.$queryRaw`
      SELECT id, type, content, title, body, link, related_id, is_read, read_at, created_at
      FROM notifications WHERE user_id = ${req.user.id}
      ORDER BY created_at DESC LIMIT 20
    `;
    res.json(notifications);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/notifications/unread-count（未读通知数）
router.get('/unread-count', notifLimiter, auth, async (req, res) => {
  try {
    const [row] = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM notifications WHERE user_id = ${req.user.id} AND is_read = 0
    `;
    res.json({ count: Number(row.count) });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/notifications/read-all（全部标为已读，需要JWT）
router.put('/read-all', notifLimiter, auth, async (req, res) => {
  try {
    await prisma.$executeRaw`
      UPDATE notifications SET is_read = 1, read_at = CURRENT_TIMESTAMP WHERE user_id = ${req.user.id} AND is_read = 0
    `;
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/notifications/read-all (alias)
router.post('/read-all', notifLimiter, auth, async (req, res) => {
  try {
    await prisma.$executeRaw`
      UPDATE notifications SET is_read = 1, read_at = CURRENT_TIMESTAMP WHERE user_id = ${req.user.id} AND is_read = 0
    `;
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/notifications/:id/read（单条已读，需要JWT）
router.put('/:id/read', notifLimiter, auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.$executeRaw`
      UPDATE notifications SET is_read = 1, read_at = CURRENT_TIMESTAMP WHERE id = ${id} AND user_id = ${req.user.id}
    `;
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/notifications/:id/read (alias)
router.post('/:id/read', notifLimiter, auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.$executeRaw`
      UPDATE notifications SET is_read = 1, read_at = CURRENT_TIMESTAMP WHERE id = ${id} AND user_id = ${req.user.id}
    `;
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
