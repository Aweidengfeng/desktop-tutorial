const express = require('express');
const router = express.Router();
const db = require('../db/database');
const auth = require('../middleware/auth');

// GET /api/notifications（需要JWT）
router.get('/', auth, (req, res) => {
  try {
    const notifications = db.prepare(`
      SELECT id, type, content, related_id, is_read, created_at
      FROM notifications WHERE user_id = ?
      ORDER BY created_at DESC LIMIT 50
    `).all(req.user.id);
    res.json(notifications);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/notifications/read-all（全部标为已读，需要JWT）
router.put('/read-all', auth, (req, res) => {
  try {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/notifications/:id/read（单条已读，需要JWT）
router.put('/:id/read', auth, (req, res) => {
  try {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
