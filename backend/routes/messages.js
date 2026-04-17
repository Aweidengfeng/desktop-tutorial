const express = require('express');
const router = express.Router();
const db = require('../db/database');
const auth = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

// 消息发送速率限制：每分钟最多 30 条
const msgRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: '发消息太频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
});

// GET /api/messages/conversations（需要JWT）
router.get('/conversations', auth, (req, res) => {
  try {
    const uid = req.user.id;
    const convs = db.prepare(`
      SELECT c.id,
        CASE WHEN c.user1_id = ? THEN u2.id    ELSE u1.id    END as otherId,
        CASE WHEN c.user1_id = ? THEN u2.name   ELSE u1.name   END as otherName,
        CASE WHEN c.user1_id = ? THEN u2.avatar ELSE u1.avatar END as otherAvatar,
        (SELECT content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) as lastMsg,
        (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.sender_id != ? AND m.is_read = 0) as unread,
        c.updated_at
      FROM conversations c
      JOIN users u1 ON u1.id = c.user1_id
      JOIN users u2 ON u2.id = c.user2_id
      WHERE c.user1_id = ? OR c.user2_id = ?
      ORDER BY c.updated_at DESC
    `).all(uid, uid, uid, uid, uid, uid);
    res.json(convs);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/messages/conversations（创建或获取与某用户的会话，需要JWT）
router.post('/conversations', auth, (req, res) => {
  try {
    const { target_user_id } = req.body;
    if (!target_user_id) return res.status(400).json({ error: '请提供目标用户ID' });
    const targetUser = db.prepare('SELECT id, name, avatar FROM users WHERE id = ?').get(target_user_id);
    if (!targetUser) return res.status(404).json({ error: '用户不存在' });
    const u1 = Math.min(req.user.id, parseInt(target_user_id, 10));
    const u2 = Math.max(req.user.id, parseInt(target_user_id, 10));
    let conv = db.prepare('SELECT * FROM conversations WHERE user1_id = ? AND user2_id = ?').get(u1, u2);
    if (!conv) {
      const result = db.prepare('INSERT INTO conversations (user1_id, user2_id) VALUES (?, ?)').run(u1, u2);
      conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(result.lastInsertRowid);
    }
    res.json({ ...conv, otherId: targetUser.id, otherName: targetUser.name, otherAvatar: targetUser.avatar });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/messages/conversations/:id/messages（需要JWT）
router.get('/conversations/:id/messages', auth, (req, res) => {
  try {
    const conv = db.prepare(
      'SELECT * FROM conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)'
    ).get(req.params.id, req.user.id, req.user.id);
    if (!conv) return res.status(403).json({ error: '无权访问此会话' });
    const msgs = db.prepare(
      'SELECT id, sender_id, content, type, images, is_read, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC'
    ).all(req.params.id);
    db.prepare('UPDATE messages SET is_read = 1 WHERE conversation_id = ? AND sender_id != ?').run(req.params.id, req.user.id);
    const parsed = msgs.map(m => ({ ...m, images: m.images ? JSON.parse(m.images) : [] }));
    res.json(parsed);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/messages/conversations/:id/messages（发送消息，需要JWT）
// 支持 { content, type, images } — type: 'text'|'image'|'mixed'，images: string[]
router.post('/conversations/:id/messages', auth, msgRateLimit, (req, res) => {
  try {
    const { content, type, images } = req.body;
    const msgType = type || 'text';
    const imagesArr = Array.isArray(images) ? images : [];
    if (!content && imagesArr.length === 0) return res.status(400).json({ error: '消息不能为空' });
    const conv = db.prepare(
      'SELECT * FROM conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)'
    ).get(req.params.id, req.user.id, req.user.id);
    if (!conv) return res.status(403).json({ error: '无权访问此会话' });
    const imagesJson = imagesArr.length > 0 ? JSON.stringify(imagesArr) : null;
    const result = db.prepare(
      'INSERT INTO messages (conversation_id, sender_id, content, type, images) VALUES (?, ?, ?, ?, ?)'
    ).run(req.params.id, req.user.id, content || '', msgType, imagesJson);
    db.prepare('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.id);
    const message = db.prepare('SELECT id, sender_id, content, type, images, is_read, created_at FROM messages WHERE id = ?').get(result.lastInsertRowid);
    res.json({ ...message, images: message.images ? JSON.parse(message.images) : [] });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
