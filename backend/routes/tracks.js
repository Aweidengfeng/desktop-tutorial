const express = require('express');
const router = express.Router();
const db = require('../db/database');
const auth = require('../middleware/auth');

// GET /api/tracks/my（需要JWT）
router.get('/my', auth, (req, res) => {
  try {
    const tracks = db.prepare(`
      SELECT id, name, date, distance, elevation, duration, image
      FROM tracks WHERE user_id = ?
      ORDER BY date DESC
    `).all(req.user.id);
    res.json(tracks);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/tracks（需要JWT）
router.post('/', auth, (req, res) => {
  try {
    const { name, date, distance, elevation, duration, image } = req.body;
    const result = db.prepare(`
      INSERT INTO tracks (user_id, name, date, distance, elevation, duration, image)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(req.user.id, name, date, distance, elevation, duration, image || '');
    const track = db.prepare(`
      SELECT id, name, date, distance, elevation, duration, image
      FROM tracks WHERE id = ?
    `).get(result.lastInsertRowid);
    res.json(track);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
