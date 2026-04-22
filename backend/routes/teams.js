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
             status, group_chat_id as groupChatId, created_at as createdAt
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
    // 自动为新队伍创建群聊
    const chatResult = db.prepare(`
      INSERT INTO group_chats (team_id, name, avatar, created_by) VALUES (?, ?, ?, ?)
    `).run(teamId, name, user.avatar || '', req.user.id);
    const chatId = chatResult.lastInsertRowid;
    db.prepare(`UPDATE teams SET group_chat_id = ? WHERE id = ?`).run(chatId, teamId);
    // 队长加入群聊
    db.prepare(`INSERT OR IGNORE INTO group_chat_members (chat_id, user_id, role) VALUES (?, ?, 'owner')`).run(chatId, req.user.id);

    const team = db.prepare(`
      SELECT id, name, peak, date, spots, total_spots as totalSpots,
             level, leader, leader_avatar as leaderAvatar, description,
             equipment_required as equipmentRequired, notes, difficulty, fee,
             group_chat_id as groupChatId
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
    // 通知队长有新的加入申请
    if (team.leader_id) {
      try {
        db.prepare(`
          INSERT INTO notifications (user_id, type, content, related_id)
          VALUES (?, 'team_join_request', ?, ?)
        `).run(team.leader_id,
          `${user ? user.name : '有人'} 申请加入您的队伍「${team.name}」，请及时审核`,
          team.id);
      } catch(e) {}
    }
    res.json({ success: true, message: '成功申请加入队伍，等待队长审核' });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/teams/:id/members/:memberId/approve — 队长审批成员加入（需要JWT）
router.put('/:id/members/:memberId/approve', auth, (req, res) => {
  try {
    const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(req.params.id);
    if (!team) return res.status(404).json({ error: '队伍不存在' });
    if (team.leader_id !== req.user.id) return res.status(403).json({ error: '只有队长可以审批成员' });
    const member = db.prepare('SELECT * FROM team_members WHERE id = ? AND team_id = ?').get(req.params.memberId, req.params.id);
    if (!member) return res.status(404).json({ error: '申请记录不存在' });
    if (member.status !== 'pending') return res.status(400).json({ error: '该申请已处理' });
    // 更新成员状态
    db.prepare(`
      UPDATE team_members SET status = 'approved', approved_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(member.id);
    // 将成员加入队伍群聊
    if (team.group_chat_id) {
      try {
        db.prepare(`INSERT OR IGNORE INTO group_chat_members (chat_id, user_id, role) VALUES (?, ?, 'member')`).run(team.group_chat_id, member.user_id);
      } catch(e) {}
    }
    // 通知申请人已被批准
    try {
      db.prepare(`
        INSERT INTO notifications (user_id, type, content, related_id)
        VALUES (?, 'team_join_approved', ?, ?)
      `).run(member.user_id,
        `您加入队伍「${team.name}」的申请已通过，快来认识你的队友吧！`,
        team.id);
    } catch(e) {}
    res.json({ success: true, groupChatId: team.group_chat_id });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/teams/:id/members/:memberId/reject — 队长拒绝成员（需要JWT）
router.put('/:id/members/:memberId/reject', auth, (req, res) => {
  try {
    const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(req.params.id);
    if (!team) return res.status(404).json({ error: '队伍不存在' });
    if (team.leader_id !== req.user.id) return res.status(403).json({ error: '只有队长可以审批成员' });
    const member = db.prepare('SELECT * FROM team_members WHERE id = ? AND team_id = ?').get(req.params.memberId, req.params.id);
    if (!member) return res.status(404).json({ error: '申请记录不存在' });
    if (member.status !== 'pending') return res.status(400).json({ error: '该申请已处理' });
    const { reason } = req.body;
    // 删除申请记录，恢复名额
    db.prepare('DELETE FROM team_members WHERE id = ?').run(member.id);
    db.prepare('UPDATE teams SET spots = spots + 1 WHERE id = ?').run(team.id);
    // 通知申请人
    try {
      db.prepare(`
        INSERT INTO notifications (user_id, type, content, related_id)
        VALUES (?, 'team_join_rejected', ?, ?)
      `).run(member.user_id,
        `您加入队伍「${team.name}」的申请未通过${reason ? '：' + reason : ''}`,
        team.id);
    } catch(e) {}
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
