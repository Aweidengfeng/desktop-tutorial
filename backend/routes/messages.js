const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const auth = require('../middleware/auth');
const rateLimit = require('express-rate-limit');
const moderation = require('../utils/moderation');

const msgRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: '发送太频繁，请稍候再试' },
  standardHeaders: true,
  legacyHeaders: false,
});

// GET /api/messages/conversations
router.get('/conversations', auth, async (req, res) => {
  try {
    const uid = req.user.id;
    const convs = await prisma.$queryRaw`
      SELECT c.id,
        CASE WHEN c.user1_id = ${uid} THEN u2.id    ELSE u1.id    END as otherId,
        CASE WHEN c.user1_id = ${uid} THEN u2.name   ELSE u1.name   END as otherName,
        CASE WHEN c.user1_id = ${uid} THEN u2.avatar ELSE u1.avatar END as otherAvatar,
        (SELECT content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) as lastMsg,
        (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.sender_id != ${uid} AND m.is_read = 0) as unread,
        c.updated_at
      FROM conversations c
      JOIN users u1 ON u1.id = c.user1_id
      JOIN users u2 ON u2.id = c.user2_id
      WHERE c.user1_id = ${uid} OR c.user2_id = ${uid}
      ORDER BY c.updated_at DESC
    `;
    res.json(convs.map(c => ({ ...c, id: Number(c.id), otherId: Number(c.otherId), unread: Number(c.unread) })));
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/messages/conversations
router.post('/conversations', auth, async (req, res) => {
  try {
    const { target_user_id } = req.body;
    if (!target_user_id) return res.status(400).json({ error: '请提供目标用户ID' });
    const targetUser = (await prisma.$queryRaw`SELECT id, name, avatar FROM users WHERE id = ${Number(target_user_id)}`)[0];
    if (!targetUser) return res.status(404).json({ error: '用户不存在' });
    const u1 = Math.min(req.user.id, parseInt(target_user_id, 10));
    const u2 = Math.max(req.user.id, parseInt(target_user_id, 10));
    let conv = (await prisma.$queryRaw`SELECT * FROM conversations WHERE user1_id = ${u1} AND user2_id = ${u2}`)[0];
    if (!conv) {
      await prisma.$executeRaw`INSERT INTO conversations (user1_id, user2_id) VALUES (${u1}, ${u2})`;
      const idRow = (await prisma.$queryRaw`SELECT last_insert_rowid() as id`)[0];
      conv = (await prisma.$queryRaw`SELECT * FROM conversations WHERE id = ${Number(idRow.id)}`)[0];
    }
    res.json({ ...conv, otherId: targetUser.id, otherName: targetUser.name, otherAvatar: targetUser.avatar });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/messages/conversations/:id/messages
router.get('/conversations/:id/messages', auth, async (req, res) => {
  try {
    const conv = (await prisma.$queryRaw`
      SELECT * FROM conversations WHERE id = ${Number(req.params.id)} AND (user1_id = ${req.user.id} OR user2_id = ${req.user.id})
    `)[0];
    if (!conv) return res.status(403).json({ error: '无权访问此会话' });
    const msgs = await prisma.$queryRaw`
      SELECT id, sender_id, content, type, images, is_read, created_at FROM messages WHERE conversation_id = ${Number(req.params.id)} ORDER BY created_at ASC
    `;
    await prisma.$executeRaw`UPDATE messages SET is_read = 1 WHERE conversation_id = ${Number(req.params.id)} AND sender_id != ${req.user.id}`;
    const parsed = msgs.map(m => ({ ...m, images: m.images ? JSON.parse(m.images) : [] }));
    res.json(parsed);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/messages/conversations/:id/messages
router.post('/conversations/:id/messages', msgRateLimit, auth, async (req, res) => {
  try {
    const { content, type, images } = req.body;
    const imagesArr = Array.isArray(images) ? images : [];
    if (!content && imagesArr.length === 0) return res.status(400).json({ error: '消息不能为空' });
    if (content) {
      const check = moderation.checkText(content);
      if (!check.ok) {
        return res.status(422).json({ error: 'content_blocked', reason: check.reason });
      }
    }
    const conv = (await prisma.$queryRaw`
      SELECT * FROM conversations WHERE id = ${Number(req.params.id)} AND (user1_id = ${req.user.id} OR user2_id = ${req.user.id})
    `)[0];
    if (!conv) return res.status(403).json({ error: '无权访问此会话' });
    const msgType = type || (imagesArr.length > 0 && content ? 'mixed' : imagesArr.length > 0 ? 'image' : 'text');
    const imagesStr = imagesArr.length > 0 ? JSON.stringify(imagesArr) : null;
    await prisma.$executeRaw`
      INSERT INTO messages (conversation_id, sender_id, content, type, images) VALUES (${Number(req.params.id)}, ${req.user.id}, ${content || ''}, ${msgType}, ${imagesStr})
    `;
    const idRow = (await prisma.$queryRaw`SELECT last_insert_rowid() as id`)[0];
    await prisma.$executeRaw`UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ${Number(req.params.id)}`;
    const message = (await prisma.$queryRaw`SELECT id, sender_id, content, type, images, is_read, created_at FROM messages WHERE id = ${Number(idRow.id)}`)[0];
    message.images = message.images ? JSON.parse(message.images) : [];
    res.json(message);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/messages/conversations/:id/messages/poll
router.get('/conversations/:id/messages/poll', auth, async (req, res) => {
  try {
    const conv = (await prisma.$queryRaw`
      SELECT * FROM conversations WHERE id = ${Number(req.params.id)} AND (user1_id = ${req.user.id} OR user2_id = ${req.user.id})
    `)[0];
    if (!conv) return res.status(403).json({ error: '无权访问此会话' });
    const after = parseInt(req.query.after) || 0;
    const msgs = await prisma.$queryRaw`
      SELECT id, sender_id, content, type, images, is_read, created_at FROM messages WHERE conversation_id = ${Number(req.params.id)} AND id > ${after} ORDER BY created_at ASC LIMIT 50
    `;
    if (msgs.length > 0) {
      await prisma.$executeRaw`UPDATE messages SET is_read = 1 WHERE conversation_id = ${Number(req.params.id)} AND sender_id != ${req.user.id} AND id > ${after}`;
    }
    const parsed = msgs.map(m => ({ ...m, images: m.images ? JSON.parse(m.images) : [] }));
    res.json(parsed);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
