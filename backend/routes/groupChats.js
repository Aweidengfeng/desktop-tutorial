const express = require('express');
const router = express.Router();
const db = require('../db/database');
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

/**
 * GET /api/group-chats — 获取当前用户所在的所有群聊
 */
router.get('/', auth, (req, res) => {
  try {
    const chats = db.prepare(`
      SELECT gc.id, gc.team_id as teamId, gc.name, gc.avatar, gc.created_at as createdAt,
        (SELECT gm.content FROM group_messages gm WHERE gm.chat_id = gc.id ORDER BY gm.created_at DESC LIMIT 1) as lastMsg,
        (SELECT gm.created_at FROM group_messages gm WHERE gm.chat_id = gc.id ORDER BY gm.created_at DESC LIMIT 1) as lastMsgAt
      FROM group_chats gc
      JOIN group_chat_members gcm ON gcm.chat_id = gc.id
      WHERE gcm.user_id = ?
      ORDER BY lastMsgAt DESC, gc.created_at DESC
    `).all(req.user.id);
    res.json(chats);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

/**
 * GET /api/group-chats/:id — 群聊详情（包含成员列表）
 */
router.get('/:id', auth, (req, res) => {
  try {
    const member = db.prepare('SELECT id FROM group_chat_members WHERE chat_id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!member) return res.status(403).json({ error: '您不是该群聊成员' });
    const chat = db.prepare('SELECT id, team_id as teamId, name, avatar, created_at as createdAt FROM group_chats WHERE id = ?').get(req.params.id);
    if (!chat) return res.status(404).json({ error: '群聊不存在' });
    const members = db.prepare(`
      SELECT gcm.user_id as userId, gcm.role, gcm.joined_at as joinedAt,
             u.name, u.avatar
      FROM group_chat_members gcm
      JOIN users u ON u.id = gcm.user_id
      WHERE gcm.chat_id = ?
      ORDER BY gcm.joined_at ASC
    `).all(req.params.id);
    res.json({ ...chat, members });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

/**
 * GET /api/group-chats/:id/messages — 获取群聊消息（分页）
 */
router.get('/:id/messages', auth, (req, res) => {
  try {
    const member = db.prepare('SELECT id FROM group_chat_members WHERE chat_id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!member) return res.status(403).json({ error: '您不是该群聊成员' });
    const { before, limit = 50 } = req.query;
    let sql = `
      SELECT gm.id, gm.sender_id as senderId, gm.content, gm.type, gm.images, gm.created_at as createdAt,
             u.name as senderName, u.avatar as senderAvatar
      FROM group_messages gm
      JOIN users u ON u.id = gm.sender_id
      WHERE gm.chat_id = ?
    `;
    const params = [req.params.id];
    if (before) {
      sql += ' AND gm.id < ?';
      params.push(parseInt(before));
    }
    sql += ' ORDER BY gm.created_at DESC LIMIT ?';
    params.push(Math.min(parseInt(limit), 100));
    const msgs = db.prepare(sql).all(...params);
    // Return in chronological order
    const parsed = msgs.reverse().map(m => ({
      ...m,
      images: m.images ? JSON.parse(m.images) : [],
    }));
    res.json(parsed);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

/**
 * POST /api/group-chats/:id/messages — 发送群聊消息（需要JWT，限流）
 */
router.post('/:id/messages', groupMsgLimiter, auth, (req, res) => {
  try {
    const member = db.prepare('SELECT id FROM group_chat_members WHERE chat_id = ? AND user_id = ?').get(req.params.id, req.user.id);
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
    const result = db.prepare(`
      INSERT INTO group_messages (chat_id, sender_id, content, type, images) VALUES (?, ?, ?, ?, ?)
    `).run(req.params.id, req.user.id, content || '', msgType, imagesStr);
    const user = db.prepare('SELECT name, avatar FROM users WHERE id = ?').get(req.user.id);
    const msg = db.prepare(`
      SELECT id, sender_id as senderId, content, type, images, created_at as createdAt FROM group_messages WHERE id = ?
    `).get(result.lastInsertRowid);
    msg.images = msg.images ? JSON.parse(msg.images) : [];
    msg.senderName = user ? user.name : '';
    msg.senderAvatar = user ? user.avatar : '';
    res.json(msg);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

/**
 * GET /api/group-chats/:id/messages/poll?after=<lastMsgId> — 长轮询获取新消息
 */
router.get('/:id/messages/poll', auth, (req, res) => {
  try {
    const member = db.prepare('SELECT id FROM group_chat_members WHERE chat_id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!member) return res.status(403).json({ error: '您不是该群聊成员' });
    const after = parseInt(req.query.after) || 0;
    const msgs = db.prepare(`
      SELECT gm.id, gm.sender_id as senderId, gm.content, gm.type, gm.images, gm.created_at as createdAt,
             u.name as senderName, u.avatar as senderAvatar
      FROM group_messages gm
      JOIN users u ON u.id = gm.sender_id
      WHERE gm.chat_id = ? AND gm.id > ?
      ORDER BY gm.created_at ASC
      LIMIT 50
    `).all(req.params.id, after);
    const parsed = msgs.map(m => ({ ...m, images: m.images ? JSON.parse(m.images) : [] }));
    res.json(parsed);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
