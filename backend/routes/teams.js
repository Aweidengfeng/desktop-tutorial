const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const auth = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

const teamsReadLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false, message: { error: '请求过于频繁' } });
const teamsWriteLimiter = rateLimit({ windowMs: 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false, message: { error: '操作过于频繁' } });

// GET /api/teams
router.get('/', teamsReadLimiter, async (req, res) => {
  try {
    const teams = await prisma.$queryRaw`
      SELECT id, name, peak, date, spots, total_spots as totalSpots,
             level, leader, leader_avatar as leaderAvatar, description,
             equipment_required as equipmentRequired, notes, difficulty, fee
      FROM teams WHERE status = 'recruiting'
      ORDER BY created_at DESC
    `;
    res.json(teams);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/teams/:id — 组队详情
router.get('/:id', teamsReadLimiter, async (req, res) => {
  try {
    const team = (await prisma.$queryRaw`
      SELECT id, name, peak, date, spots, total_spots as totalSpots,
             level, leader, leader_avatar as leaderAvatar, leader_id as leaderId,
             description, equipment_required as equipmentRequired, notes, difficulty, fee,
             status, group_chat_id as groupChatId, created_at as createdAt
      FROM teams WHERE id = ${Number(req.params.id)}
    `)[0];
    if (!team) return res.status(404).json({ error: '队伍不存在' });
    const members = await prisma.$queryRaw`
      SELECT tm.id, tm.user_id as userId, tm.name, tm.avatar, tm.status, tm.joined_at as joinedAt
      FROM team_members tm
      WHERE tm.team_id = ${Number(req.params.id)}
      ORDER BY tm.joined_at ASC
    `;
    res.json({ ...team, members });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/teams（需要JWT）
router.post('/', teamsWriteLimiter, auth, async (req, res) => {
  try {
    const { name, peak, date, totalSpots, level, description, equipment_required, notes, difficulty, fee } = req.body;
    const user = (await prisma.$queryRaw`SELECT * FROM users WHERE id = ${req.user.id}`)[0];
    const [{ id: teamId }] = await prisma.$queryRaw`
      INSERT INTO teams (name, peak, date, spots, total_spots, level, leader, leader_avatar, leader_id, description, equipment_required, notes, difficulty, fee)
      VALUES (${name}, ${peak}, ${date}, ${totalSpots}, ${totalSpots}, ${level},
              ${user.name}, ${user.avatar}, ${req.user.id}, ${description || ''},
              ${equipment_required || null}, ${notes || null}, ${difficulty || null}, ${fee || null})
      RETURNING id
    `;
    // 创建者自动加入 team_members（leader）
    await prisma.$executeRaw`
      INSERT INTO team_members (team_id, user_id, name, avatar, status) VALUES (${teamId}, ${req.user.id}, ${user.name}, ${user.avatar}, 'leader') ON CONFLICT DO NOTHING
    `;
    // 自动为新队伍创建群聊
    const [{ id: chatId }] = await prisma.$queryRaw`
      INSERT INTO group_chats (team_id, name, avatar, created_by) VALUES (${teamId}, ${name}, ${user.avatar || ''}, ${req.user.id})
      RETURNING id
    `;
    await prisma.$executeRaw`UPDATE teams SET group_chat_id = ${chatId} WHERE id = ${teamId}`;
    // 队长加入群聊
    await prisma.$executeRaw`INSERT INTO group_chat_members (chat_id, user_id, role) VALUES (${chatId}, ${req.user.id}, 'owner') ON CONFLICT DO NOTHING`;

    const team = (await prisma.$queryRaw`
      SELECT id, name, peak, date, spots, total_spots as totalSpots,
             level, leader, leader_avatar as leaderAvatar, description,
             equipment_required as equipmentRequired, notes, difficulty, fee,
             group_chat_id as groupChatId
      FROM teams WHERE id = ${teamId}
    `)[0];
    res.json(team);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/teams/:id/join（需要JWT）
router.post('/:id/join', teamsWriteLimiter, auth, async (req, res) => {
  try {
    const team = (await prisma.$queryRaw`SELECT * FROM teams WHERE id = ${Number(req.params.id)}`)[0];
    if (!team) return res.status(404).json({ error: '队伍不存在' });
    if (team.spots <= 0) return res.status(400).json({ error: '名额已满' });
    const existing = (await prisma.$queryRaw`SELECT id FROM team_members WHERE team_id = ${Number(req.params.id)} AND user_id = ${req.user.id}`)[0];
    if (existing) return res.status(400).json({ error: '您已申请加入该队伍' });
    const user = (await prisma.$queryRaw`SELECT name, avatar FROM users WHERE id = ${req.user.id}`)[0];
    await prisma.$executeRaw`
      INSERT INTO team_members (team_id, user_id, name, avatar, status) VALUES (${Number(req.params.id)}, ${req.user.id}, ${user ? user.name : null}, ${user ? user.avatar : null}, 'pending')
    `;
    // 通知队长有新的加入申请
    if (team.leader_id) {
      try {
        await prisma.$executeRaw`
          INSERT INTO notifications (user_id, type, content, related_id)
          VALUES (${team.leader_id}, 'team_join_request', ${`${user ? user.name : '有人'} 申请加入您的队伍「${team.name}」，请及时审核`}, ${team.id})
        `;
      } catch(e) {}
    }
    res.json({ success: true, message: '成功申请加入队伍，等待队长审核' });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/teams/:id/members/:memberId/approve — 队长审批成员加入（需要JWT）
router.put('/:id/members/:memberId/approve', teamsWriteLimiter, auth, async (req, res) => {
  try {
    const team = (await prisma.$queryRaw`SELECT * FROM teams WHERE id = ${Number(req.params.id)}`)[0];
    if (!team) return res.status(404).json({ error: '队伍不存在' });
    if (team.leader_id !== req.user.id) return res.status(403).json({ error: '只有队长可以审批成员' });
    const member = (await prisma.$queryRaw`SELECT * FROM team_members WHERE id = ${Number(req.params.memberId)} AND team_id = ${Number(req.params.id)}`)[0];
    if (!member) return res.status(404).json({ error: '申请记录不存在' });
    if (member.status !== 'pending') return res.status(400).json({ error: '该申请已处理' });
    // 更新成员状态
    await prisma.$executeRaw`
      UPDATE team_members SET status = 'approved', approved_at = CURRENT_TIMESTAMP WHERE id = ${member.id}
    `;
    // 将成员加入队伍群聊
    if (team.group_chat_id) {
      try {
        await prisma.$executeRaw`INSERT INTO group_chat_members (chat_id, user_id, role) VALUES (${team.group_chat_id}, ${member.user_id}, 'member') ON CONFLICT DO NOTHING`;
      } catch(e) {}
    }
    // 通知申请人已被批准
    try {
      await prisma.$executeRaw`
        INSERT INTO notifications (user_id, type, content, related_id)
        VALUES (${member.user_id}, 'team_join_approved', ${`您加入队伍「${team.name}」的申请已通过，快来认识你的队友吧！`}, ${team.id})
      `;
    } catch(e) {}
    res.json({ success: true, groupChatId: team.group_chat_id });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/teams/:id/members/:memberId/reject — 队长拒绝成员（需要JWT）
router.put('/:id/members/:memberId/reject', teamsWriteLimiter, auth, async (req, res) => {
  try {
    const team = (await prisma.$queryRaw`SELECT * FROM teams WHERE id = ${Number(req.params.id)}`)[0];
    if (!team) return res.status(404).json({ error: '队伍不存在' });
    if (team.leader_id !== req.user.id) return res.status(403).json({ error: '只有队长可以审批成员' });
    const member = (await prisma.$queryRaw`SELECT * FROM team_members WHERE id = ${Number(req.params.memberId)} AND team_id = ${Number(req.params.id)}`)[0];
    if (!member) return res.status(404).json({ error: '申请记录不存在' });
    if (member.status !== 'pending') return res.status(400).json({ error: '该申请已处理' });
    const { reason } = req.body;
    // 删除申请记录，恢复名额
    await prisma.$executeRaw`DELETE FROM team_members WHERE id = ${member.id}`;
    await prisma.$executeRaw`UPDATE teams SET spots = spots + 1 WHERE id = ${team.id}`;
    // 通知申请人
    try {
      await prisma.$executeRaw`
        INSERT INTO notifications (user_id, type, content, related_id)
        VALUES (${member.user_id}, 'team_join_rejected', ${`您加入队伍「${team.name}」的申请未通过${reason ? '：' + reason : ''}`}, ${team.id})
      `;
    } catch(e) {}
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
