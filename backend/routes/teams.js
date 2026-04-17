const express = require('express');
const router = express.Router();
const db = require('../db/database');
const auth = require('../middleware/auth');

// GET /api/teams
router.get('/', (req, res) => {
  try {
    const teams = db.prepare(`
      SELECT id, name, peak, date, spots, total_spots as totalSpots,
             level, leader, leader_avatar as leaderAvatar, description,
             equipment_required as equipmentRequired, notes, difficulty, fee
      FROM teams WHERE status = 'recruiting'
      ORDER BY created_at DESC
    `).all();
    res.json(teams);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/teams/:id — 组队详情
router.get('/:id', (req, res) => {
  try {
    const team = db.prepare(`
      SELECT id, name, peak, date, spots, total_spots as totalSpots,
             level, leader, leader_avatar as leaderAvatar, leader_id as leaderId,
             description, equipment_required as equipmentRequired, notes, difficulty, fee,
             status, created_at as createdAt
      FROM teams WHERE id = ?
    `).get(req.params.id);
    if (!team) return res.status(404).json({ error: '队伍不存在' });
    const members = db.prepare(`
      SELECT tm.id, tm.user_id as userId, tm.name, tm.avatar, tm.status, tm.joined_at as joinedAt
      FROM team_members tm
      WHERE tm.team_id = ?
      ORDER BY tm.joined_at ASC
    `).all(req.params.id);
    res.json({ ...team, members });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/teams（需要JWT）
router.post('/', auth, (req, res) => {
  try {
    const { name, peak, date, totalSpots, level, description, equipment_required, notes, difficulty, fee } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    const result = db.prepare(`
      INSERT INTO teams (name, peak, date, spots, total_spots, level, leader, leader_avatar, leader_id, description, equipment_required, notes, difficulty, fee)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, peak, date, totalSpots, totalSpots, level,
           user.name, user.avatar, req.user.id, description || '',
           equipment_required || null, notes || null, difficulty || null, fee || null);
    const teamId = result.lastInsertRowid;
    // 创建者自动加入 team_members（leader）
    db.prepare(`
      INSERT OR IGNORE INTO team_members (team_id, user_id, name, avatar, status) VALUES (?, ?, ?, ?, 'leader')
    `).run(teamId, req.user.id, user.name, user.avatar);
    const team = db.prepare(`
      SELECT id, name, peak, date, spots, total_spots as totalSpots,
             level, leader, leader_avatar as leaderAvatar, description,
             equipment_required as equipmentRequired, notes, difficulty, fee
      FROM teams WHERE id = ?
    `).get(teamId);
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
    const existing = db.prepare('SELECT id FROM team_members WHERE team_id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (existing) return res.status(400).json({ error: '您已申请加入该队伍' });
    const user = db.prepare('SELECT name, avatar FROM users WHERE id = ?').get(req.user.id);
    db.prepare(`
      INSERT INTO team_members (team_id, user_id, name, avatar, status) VALUES (?, ?, ?, ?, 'pending')
    `).run(req.params.id, req.user.id, user ? user.name : null, user ? user.avatar : null);
    db.prepare('UPDATE teams SET spots = spots - 1 WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: '成功申请加入队伍' });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
