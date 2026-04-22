const express = require('express');
const router = express.Router();
const db = require('../db/database');
const auth = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

const shareLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: '分享过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/location-share — 创建位置分享
router.post('/', shareLimiter, auth, (req, res) => {
  try {
    const { recipient_id, recipient_type, lat, lng } = req.body;
    if (!lat || !lng) return res.status(400).json({ error: '位置信息不能为空' });

    const token = require('crypto').randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const shareUrl = `${process.env.APP_URL || ''}/share-location/${token}`;

    // Try to save to DB (table may not exist, that's ok)
    try {
      db.exec(`CREATE TABLE IF NOT EXISTS location_shares (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token TEXT UNIQUE,
        sender_id INTEGER NOT NULL,
        recipient_id TEXT,
        recipient_type TEXT,
        lat REAL,
        lng REAL,
        share_url TEXT,
        expires_at DATETIME,
        viewed_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);
      db.prepare(`INSERT INTO location_shares (token, sender_id, recipient_id, recipient_type, lat, lng, share_url, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
        token, req.user.id, recipient_id ? String(recipient_id) : null,
        recipient_type || 'unknown', parseFloat(lat), parseFloat(lng), shareUrl, expiresAt
      );
    } catch(e) {}

    // If recipient is a chat friend, send as a message
    if (recipient_type === 'friend' && recipient_id && typeof recipient_id === 'number') {
      try {
        const sender = db.prepare('SELECT name FROM users WHERE id = ?').get(req.user.id);
        db.prepare(`INSERT INTO messages (from_user_id, to_user_id, content, type)
          VALUES (?, ?, ?, 'location')`).run(
          req.user.id, parseInt(recipient_id),
          JSON.stringify({ lat: parseFloat(lat), lng: parseFloat(lng), shareUrl })
        );
      } catch(e) {}
    }

    res.json({ success: true, token, shareUrl, expiresAt });
  } catch(e) {
    console.error('[location-share]', e);
    res.status(500).json({ error: '分享失败' });
  }
});

// GET /api/location-share/:token — 查看共享位置（公开）
router.get('/:token', (req, res) => {
  try {
    const share = db.prepare('SELECT * FROM location_shares WHERE token = ?').get(req.params.token);
    if (!share) return res.status(404).json({ error: '链接不存在或已过期' });
    if (new Date(share.expires_at) < new Date()) return res.status(410).json({ error: '分享链接已过期' });
    // Mark as viewed
    db.prepare('UPDATE location_shares SET viewed_at = CURRENT_TIMESTAMP WHERE token = ?').run(req.params.token);
    const sender = db.prepare('SELECT name, avatar FROM users WHERE id = ?').get(share.sender_id);
    res.json({ lat: share.lat, lng: share.lng, sender: sender || { name: '用户' }, expiresAt: share.expires_at });
  } catch(e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
