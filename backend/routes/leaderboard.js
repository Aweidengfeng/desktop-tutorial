const express = require('express');
const router = express.Router();
const db = require('../db/database');

// GET /api/leaderboard/monthly
router.get('/monthly', (req, res) => {
  try {
    const records = db.prepare(`
      SELECT id, flag, name, peak, date, avatar
      FROM summit_records
      ORDER BY id DESC
      LIMIT 10
    `).all();
    res.json(records);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
