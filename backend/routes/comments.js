const express = require('express');
const router = express.Router();
const db = require('../db/database');
const auth = require('../middleware/auth');

// GET /api/comments?post_id=X
router.get('/', (req, res) => {
  try {
    const { post_id } = req.query;
    if (!post_id) return res.status(400).json({ error: '请提供帖子ID' });
    const comments = db.prepare(`
      SELECT id, post_id, user_id, author_name as authorName, author_avatar as authorAvatar,
             content, created_at as createdAt
      FROM comments WHERE post_id = ? ORDER BY created_at ASC
    `).all(post_id);
    res.json(comments);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/comments（需要JWT）
router.post('/', auth, (req, res) => {
  try {
    const { post_id, content } = req.body;
    if (!post_id || !content) return res.status(400).json({ error: '请提供帖子ID和评论内容' });
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: '用户不存在' });
    const result = db.prepare(`
      INSERT INTO comments (post_id, user_id, author_name, author_avatar, content)
      VALUES (?, ?, ?, ?, ?)
    `).run(post_id, req.user.id, user.name, user.avatar, content);
    db.prepare('UPDATE posts SET comments = comments + 1 WHERE id = ?').run(post_id);
    const comment = db.prepare(`
      SELECT id, post_id, user_id, author_name as authorName, author_avatar as authorAvatar,
             content, created_at as createdAt
      FROM comments WHERE id = ?
    `).get(result.lastInsertRowid);
    res.json(comment);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
