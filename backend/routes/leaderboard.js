const express = require('express');
const router = express.Router();
const db = require('../db/database');

// GET /api/leaderboard — 获取本月攀登榜单（基于tracks表）
router.get('/', (req, res) => {
  try {
    const { sort = 'count', month } = req.query;
    const targetMonth = month || new Date().toISOString().slice(0, 7);

    const sortField = sort === 'elevation' ? 'MAX(COALESCE(t.max_elevation, t.elevation, 0))'
                    : sort === 'distance'  ? 'SUM(COALESCE(t.distance_km, t.distance, 0))'
                    : 'COUNT(t.id)';

    const leaders = db.prepare(`
      SELECT u.id, u.name, u.avatar, u.level,
             COUNT(t.id) as summit_count,
             MAX(COALESCE(t.max_elevation, t.elevation, 0)) as max_elevation,
             ROUND(SUM(COALESCE(t.distance_km, t.distance, 0)), 1) as total_distance,
             MAX(COALESCE(t.peak_name, t.name, '')) as best_peak
      FROM tracks t
      JOIN users u ON u.id = t.user_id
      WHERE strftime('%Y-%m', t.date) = ?
      GROUP BY u.id
      ORDER BY ${sortField} DESC
      LIMIT 20
    `).all(targetMonth);

    res.json({ month: targetMonth, sort, leaders });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// Keep legacy /monthly route for backward compat
router.get('/monthly', (req, res) => {
  try {
    const targetMonth = new Date().toISOString().slice(0, 7);
    const leaders = db.prepare(`
      SELECT u.id, u.name, u.avatar, u.level,
             COUNT(t.id) as summit_count,
             MAX(COALESCE(t.max_elevation, t.elevation, 0)) as max_elevation,
             MAX(COALESCE(t.peak_name, t.name, '')) as best_peak
      FROM tracks t
      JOIN users u ON u.id = t.user_id
      WHERE strftime('%Y-%m', t.date) = ?
      GROUP BY u.id
      ORDER BY COUNT(t.id) DESC
      LIMIT 10
    `).all(targetMonth);
    res.json(leaders);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
