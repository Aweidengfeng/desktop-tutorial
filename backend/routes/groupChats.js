const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const auth = require('../middleware/auth');
const rateLimit = require('express-rate-limit');
const moderation = require('../utils/moderation');

const groupMsgLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: '发送太频繁，请稍候再试' },
  standardHeaders: true,
  legacyHeaders: false,
});

// GET / - get user's group chats
router.get('/', auth, async (req, res) => {
  try {
    const chats = await prisma.$queryRaw`
      SELECT gc.id, gc.team_id as teamId, gc.name, gc.avatar, gc.created_at as createdAt,
        (SELECT gm.content FROM group_messages gm WHERE gm.chat_id = gc.id ORDER BY gm.created_at DESC LIMIT 1) as lastMsg,
        (SELECT gm.created_at FROM group_messages gm WHERE gm.chat_id = gc.id ORDER BY gm.created_at DESC LIMIT 1) as lastMsgAt
      FROM group_chats gc
      JOIN group_chat_members gcm ON gcm.chat_id = gc.id
      WHERE gcm.user_id = ${req.user.id}
      ORDER BY lastMsgAt DESC, gc.created_at DESC
    `;
    res.json(chats);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /:id - group chat details
router.get('/:id', auth, async (req, res) => {
  try {
    const member = (await prisma.$queryRaw`SELECT id FROM group_chat_members WHERE chat_id = ${Number(req.params.id)} AND user_id = ${req.user.id}`)[0];
    if (!member) return res.status(403).json({ error: '您不是该群聊成员' });
    const chat = (await prisma.$queryRaw`SELECT id, team_id as teamId, name, avatar, created_at as createdAt FROM group_chats WHERE id = ${Number(req.params.id)}`)[0];
    if (!chat) return res.status(404).json({ error: '群聊不存在' });
    const members = await prisma.$queryRaw`
      SELECT gcm.user_id as userId, gcm.role, gcm.joined_at as joinedAt,
             u.name, u.avatar
      FROM group_chat_members gcm
      JOIN users u ON u.id = gcm.user_id
      WHERE gcm.chat_id = ${Number(req.params.id)}
      ORDER BY gcm.joined_at ASC
    `;
    res.json({ ...chat, members });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /:id/messages - get messages with pagination
router.get('/:id/messages', auth, async (req, res) => {
  try {
    const member = (await prisma.$queryRaw`SELECT id FROM group_chat_members WHERE chat_id = ${Number(req.params.id)} AND user_id = ${req.user.id}`)[0];
    if (!member) return res.status(403).json({ error: '您不是该群聊成员' });
    const { before, limit = 50 } = req.query;
    let sql = `
      SELECT gm.id, gm.sender_id as senderId, gm.content, gm.type, gm.images, gm.created_at as createdAt,
             u.name as senderName, u.avatar as senderAvatar
      FROM group_messages gm
      JOIN users u ON u.id = gm.sender_id
      WHERE gm.chat_id = ?
    `;
    const params = [Number(req.params.id)];
    if (before) {
      sql += ' AND gm.id < ?';
      params.push(parseInt(before));
    }
    sql += ' ORDER BY gm.created_at DESC LIMIT ?';
    params.push(Math.min(parseInt(limit), 100));
    const msgs = await prisma.$queryRawUnsafe(sql, ...params);
    const parsed = msgs.reverse().map(m => ({
      ...m,
      images: m.images ? JSON.parse(m.images) : [],
    }));
    res.json(parsed);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /:id/messages - send group message
router.post('/:id/messages', groupMsgLimiter, auth, async (req, res) => {
  try {
    const member = (await prisma.$queryRaw`SELECT id FROM group_chat_members WHERE chat_id = ${Number(req.params.id)} AND user_id = ${req.user.id}`)[0];
    if (!member) return res.status(403).json({ error: '您不是该群聊成员' });
    const { content, type, images } = req.body;
    const imagesArr = Array.isArray(images) ? images : [];
    if (!content && imagesArr.length === 0) return res.status(400).json({ error: '消息不能为空' });
    if (content) {
      const check = moderation.checkText(content);
      if (!check.ok) return res.status(422).json({ error: 'content_blocked', reason: check.reason });
    }
    const msgType = type || (imagesArr.length > 0 && content ? 'mixed' : imagesArr.length > 0 ? 'image' : 'text');
    const imagesStr = imagesArr.length > 0 ? JSON.stringify(imagesArr) : null;
    await prisma.$executeRaw`
      INSERT INTO group_messages (chat_id, sender_id, content, type, images) VALUES (${Number(req.params.id)}, ${req.user.id}, ${content || ''}, ${msgType}, ${imagesStr})
    `;
    // TODO(Phase1-PG): PostgreSQL迁移时替换为 RETURNING id 语法
    // 参考：INSERT INTO group_messages (...) VALUES (...) RETURNING id
    const idRow = (await prisma.$queryRaw`SELECT last_insert_rowid() as id`)[0];
    const msg = (await prisma.$queryRaw`
      SELECT id, sender_id as senderId, content, type, images, created_at as createdAt FROM group_messages WHERE id = ${insertedId}
    `)[0];
    msg.images = msg.images ? JSON.parse(msg.images) : [];
    msg.senderName = user ? user.name : '';
    msg.senderAvatar = user ? user.avatar : '';
    res.json(msg);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /:id/messages/poll
router.get('/:id/messages/poll', auth, async (req, res) => {
  try {
    const member = (await prisma.$queryRaw`SELECT id FROM group_chat_members WHERE chat_id = ${Number(req.params.id)} AND user_id = ${req.user.id}`)[0];
    if (!member) return res.status(403).json({ error: '您不是该群聊成员' });
    const after = parseInt(req.query.after) || 0;
    const msgs = await prisma.$queryRaw`
      SELECT gm.id, gm.sender_id as senderId, gm.content, gm.type, gm.images, gm.created_at as createdAt,
             u.name as senderName, u.avatar as senderAvatar
      FROM group_messages gm
      JOIN users u ON u.id = gm.sender_id
      WHERE gm.chat_id = ${Number(req.params.id)} AND gm.id > ${after}
      ORDER BY gm.created_at ASC
      LIMIT 50
    `;
    const parsed = msgs.map(m => ({ ...m, images: m.images ? JSON.parse(m.images) : [] }));
    res.json(parsed);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
