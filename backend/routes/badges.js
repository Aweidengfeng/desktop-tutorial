const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const auth = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

const readLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, message: { error: '请求太频繁' } });
const checkLimiter = rateLimit({ windowMs: 60 * 1000, max: 20, message: { error: '操作太频繁' } });

// GET /api/badges
router.get('/', readLimiter, async (req, res) => {
  try {
    const badges = await prisma.$queryRaw`SELECT * FROM badges ORDER BY category, condition_value`;
    res.json(badges);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/badges/my
router.get('/my', readLimiter, auth, async (req, res) => {
  try {
    const badges = await prisma.$queryRaw`
      SELECT b.*, ub.unlocked_at, ub.progress
      FROM badges b
      LEFT JOIN user_badges ub ON ub.badge_id = b.id AND ub.user_id = ${req.user.id}
      ORDER BY b.category, b.condition_value
    `;
    res.json(badges);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/badges/check
router.post('/check', checkLimiter, auth, async (req, res) => {
  try {
    const uid = req.user.id;
    const user = (await prisma.$queryRaw`SELECT * FROM users WHERE id = ${uid}`)[0];
    if (!user) return res.status(404).json({ error: '用户不存在' });

    const postCountRow = (await prisma.$queryRaw`SELECT COUNT(*) as cnt FROM posts WHERE user_id = ${uid}`)[0];
    const postCount = Number(postCountRow.cnt);
    const totalLikesRow = (await prisma.$queryRaw`SELECT COALESCE(SUM(likes), 0) as total FROM posts WHERE user_id = ${uid}`)[0];
    const totalLikes = Number(totalLikesRow.total);

    const allBadges = await prisma.$queryRaw`SELECT * FROM badges`;
    const unlocked = [];

    for (const badge of allBadges) {
      let eligible = false;
      switch (badge.condition_type) {
        case 'post_count':
          eligible = postCount >= badge.condition_value;
          break;
        case 'summit_altitude': {
          const highPeak = (await prisma.$queryRaw`
            SELECT mf.id FROM mountain_footprints mf
            JOIN peaks p ON p.id = mf.peak_id
            WHERE mf.user_id = ${uid} AND p.altitude >= ${badge.condition_value}
            LIMIT 1
          `)[0];
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
        const changes = await prisma.$executeRaw`INSERT INTO user_badges (user_id, badge_id, progress) VALUES (${uid}, ${badge.id}, 100) ON CONFLICT DO NOTHING`;
        if (changes > 0) unlocked.push(badge);
      }
    }

    res.json({ unlocked, count: unlocked.length });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
