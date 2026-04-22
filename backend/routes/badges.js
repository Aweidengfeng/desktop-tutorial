const express = require('express');
const router = express.Router();
const db = require('../db/database');
const auth = require('../middleware/auth');

// GET /api/badges
router.get('/', (req, res) => {
  try {
    const badges = db.prepare('SELECT * FROM badges ORDER BY category, condition_value').all();
    res.json(badges);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/badges/my
router.get('/my', auth, (req, res) => {
  try {
    const badges = db.prepare(`
      SELECT b.*, ub.unlocked_at, ub.progress
      FROM badges b
      LEFT JOIN user_badges ub ON ub.badge_id = b.id AND ub.user_id = ?
      ORDER BY b.category, b.condition_value
    `).all(req.user.id);
    res.json(badges);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/badges/check
router.post('/check', auth, (req, res) => {
  try {
    const uid = req.user.id;
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(uid);
    if (!user) return res.status(404).json({ error: '用户不存在' });

    const postCount = db.prepare('SELECT COUNT(*) as cnt FROM posts WHERE user_id = ?').get(uid).cnt;
    const totalLikes = db.prepare('SELECT COALESCE(SUM(likes), 0) as total FROM posts WHERE user_id = ?').get(uid).total;

    const allBadges = db.prepare('SELECT * FROM badges').all();
    const unlocked = [];

    const insertBadge = db.prepare('INSERT OR IGNORE INTO user_badges (user_id, badge_id, progress) VALUES (?, ?, ?)');

    for (const badge of allBadges) {
      let eligible = false;
      switch (badge.condition_type) {
        case 'post_count':
          eligible = postCount >= badge.condition_value;
          break;
        case 'summit_altitude': {
          const highPeak = db.prepare(`
            SELECT mf.id FROM mountain_footprints mf
            JOIN peaks p ON p.id = mf.peak_id
            WHERE mf.user_id = ? AND p.altitude >= ?
            LIMIT 1
          `).get(uid, badge.condition_value);
          eligible = !!highPeak;
          break;
        }
        case 'likes_count':
          eligible = totalLikes >= badge.condition_value;
          break;
        case 'followers_count':
          eligible = (user.followers || 0) >= badge.condition_value;
          break;
        default:
          break;
      }
      if (eligible) {
        const r = insertBadge.run(uid, badge.id, 100);
        if (r.changes > 0) unlocked.push(badge);
      }
    }

    res.json({ unlocked, count: unlocked.length });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
