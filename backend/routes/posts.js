const express = require('express');
const router = express.Router();
const db = require('../db/database');
const auth = require('../middleware/auth');

// GET /api/posts?type=all
router.get('/', (req, res) => {
  try {
    const posts = db.prepare(`
      SELECT id, author_name as authorName, author_avatar as authorAvatar,
             content, image, location, likes, comments, created_at as createdAt
      FROM posts ORDER BY created_at DESC
    `).all();
    res.json(posts);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/posts（需要JWT）
router.post('/', auth, (req, res) => {
  try {
    const { content, image, location } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    const result = db.prepare(`
      INSERT INTO posts (user_id, author_name, author_avatar, content, image, location)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(req.user.id, user.name, user.avatar, content, image || '', location || '');
    const post = db.prepare(`
      SELECT id, author_name as authorName, author_avatar as authorAvatar,
             content, image, location, likes, comments, created_at as createdAt
      FROM posts WHERE id = ?
    `).get(result.lastInsertRowid);
    res.json(post);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/posts/:id/like（需要JWT）
router.post('/:id/like', auth, (req, res) => {
  try {
    const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
    if (!post) return res.status(404).json({ error: '帖子不存在' });
    db.prepare('UPDATE posts SET likes = likes + 1 WHERE id = ?').run(req.params.id);
    res.json({ success: true, likes: post.likes + 1 });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
