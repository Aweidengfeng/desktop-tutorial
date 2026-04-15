const express = require('express');
const router = express.Router();
const db = require('../db/database');
const auth = require('../middleware/auth');

// GET /api/teams
router.get('/', (req, res) => {
  try {
    const teams = db.prepare(`
      SELECT id, name, peak, date, spots, total_spots as totalSpots,
             level, leader, leader_avatar as leaderAvatar, description
      FROM teams WHERE status = 'recruiting'
      ORDER BY created_at DESC
    `).all();
    res.json(teams);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/teams（需要JWT）
router.post('/', auth, (req, res) => {
  try {
    const { name, peak, date, totalSpots, level, description } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    const result = db.prepare(`
      INSERT INTO teams (name, peak, date, spots, total_spots, level, leader, leader_avatar, leader_id, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, peak, date, totalSpots, totalSpots, level,
           user.name, user.avatar, req.user.id, description || '');
    const team = db.prepare(`
      SELECT id, name, peak, date, spots, total_spots as totalSpots,
             level, leader, leader_avatar as leaderAvatar, description
      FROM teams WHERE id = ?
    `).get(result.lastInsertRowid);
    res.json(team);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/teams/:id/join（需要JWT）
router.post('/:id/join', auth, (req, res) => {
  try {
    const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(req.params.id);
    if (!team) return res.status(404).json({ error: '队伍不存在' });
    if (team.spots <= 0) return res.status(400).json({ error: '名额已满' });
    db.prepare('UPDATE teams SET spots = spots - 1 WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: '成功申请加入队伍' });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
