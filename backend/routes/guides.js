const express = require('express');
const router = express.Router();
const db = require('../db/database');
const auth = require('../middleware/auth');

// GET /api/guides
router.get('/', (req, res) => {
  try {
    const guides = db.prepare(`
      SELECT id, name, avatar, flag, nationality, rating, reviews,
             specialty, day_rate as dayRate
      FROM guides WHERE status = 'approved'
      ORDER BY rating DESC
    `).all();
    res.json(guides);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/guides/apply（需要JWT）
router.post('/apply', auth, (req, res) => {
  try {
    const { name, cert, specialty, languages, dayRate, region } = req.body;
    // 插入申请记录
    db.prepare(`
      INSERT INTO guide_applications (user_id, name, cert, specialty, languages, day_rate, region)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(req.user.id, name, cert, specialty, languages, dayRate, region);
    // 同时插入向导表（待审核）
    db.prepare(`
      INSERT INTO guides (user_id, name, cert, specialty, languages, day_rate, region, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
    `).run(req.user.id, name, cert, specialty, languages, dayRate, region);
    res.json({ success: true, message: '申请已提交，7天内审核完成' });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
