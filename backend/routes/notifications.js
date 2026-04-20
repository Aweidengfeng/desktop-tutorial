const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const db = require('../db/database');
const auth = require('../middleware/auth');

const notifLimiter = rateLimit({ windowMs: 60*1000, max: 60 });

// GET /api/notifications（需要JWT）
router.get('/', auth, (req, res) => {
  try {
    const notifications = db.prepare(`
      SELECT id, type, content, title, body, link, related_id, is_read, read_at, created_at
      FROM notifications WHERE user_id = ?
      ORDER BY created_at DESC LIMIT 20
    `).all(req.user.id);
    res.json(notifications);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/notifications/unread-count（未读通知数）
router.get('/unread-count', auth, (req, res) => {
  try {
    const result = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0').get(req.user.id);
    res.json({ count: result.count });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/notifications/read-all（全部标为已读，需要JWT）
router.put('/read-all', notifLimiter, auth, (req, res) => {
  try {
    db.prepare('UPDATE notifications SET is_read = 1, read_at = CURRENT_TIMESTAMP WHERE user_id = ? AND is_read = 0').run(req.user.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/notifications/read-all (alias)
router.post('/read-all', notifLimiter, auth, (req, res) => {
  try {
    db.prepare('UPDATE notifications SET is_read = 1, read_at = CURRENT_TIMESTAMP WHERE user_id = ? AND is_read = 0').run(req.user.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/notifications/:id/read（单条已读，需要JWT）
router.put('/:id/read', notifLimiter, auth, (req, res) => {
  try {
    db.prepare('UPDATE notifications SET is_read = 1, read_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/notifications/:id/read (alias)
router.post('/:id/read', notifLimiter, auth, (req, res) => {
  try {
    db.prepare('UPDATE notifications SET is_read = 1, read_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
