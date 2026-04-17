const express = require('express');
const router = express.Router();
const db = require('../db/database');
const auth = require('../middleware/auth');

// GET /api/posts?type=all
router.get('/', (req, res) => {
  try {
    const posts = db.prepare(`
      SELECT id, author_name as authorName, author_avatar as authorAvatar,
             content, image, images, location, likes, comments, tags, emojis, created_at as createdAt
      FROM posts ORDER BY created_at DESC
    `).all();
    const parsed = posts.map(p => ({
      ...p,
      tags: p.tags ? JSON.parse(p.tags) : [],
      emojis: p.emojis ? JSON.parse(p.emojis) : [],
      images: p.images ? JSON.parse(p.images) : []
    }));
    res.json(parsed);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/posts/:id — 动态详情
router.get('/:id', (req, res) => {
  try {
    const post = db.prepare(`
      SELECT id, author_name as authorName, author_avatar as authorAvatar,
             content, image, images, location, likes, comments, tags, emojis, created_at as createdAt
      FROM posts WHERE id = ?
    `).get(req.params.id);
    if (!post) return res.status(404).json({ error: '动态不存在' });
    post.tags = post.tags ? JSON.parse(post.tags) : [];
    post.emojis = post.emojis ? JSON.parse(post.emojis) : [];
    post.images = post.images ? JSON.parse(post.images) : [];
    res.json(post);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/posts（需要JWT）
router.post('/', auth, (req, res) => {
  try {
    const { content, image, images, location, tags, emojis } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    const tagsStr = tags ? JSON.stringify(tags) : null;
    const emojisStr = emojis ? JSON.stringify(emojis) : null;
    const imagesArr = Array.isArray(images) ? images : [];
    const imagesStr = imagesArr.length > 0 ? JSON.stringify(imagesArr) : null;
    const firstImage = image || imagesArr[0] || '';
    const result = db.prepare(`
      INSERT INTO posts (user_id, author_name, author_avatar, content, image, images, location, tags, emojis)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.user.id, user.name, user.avatar, content, firstImage, imagesStr, location || '', tagsStr, emojisStr);
    const post = db.prepare(`
      SELECT id, author_name as authorName, author_avatar as authorAvatar,
             content, image, images, location, likes, comments, tags, emojis, created_at as createdAt
      FROM posts WHERE id = ?
    `).get(result.lastInsertRowid);
    post.tags = post.tags ? JSON.parse(post.tags) : [];
    post.emojis = post.emojis ? JSON.parse(post.emojis) : [];
    post.images = post.images ? JSON.parse(post.images) : [];
    res.json(post);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/posts/:id/like（需要JWT，支持取消赞）
router.post('/:id/like', auth, (req, res) => {
  try {
    const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
    if (!post) return res.status(404).json({ error: '帖子不存在' });
    const existing = db.prepare('SELECT id FROM likes WHERE user_id = ? AND post_id = ?').get(req.user.id, req.params.id);
    if (existing) {
      db.prepare('DELETE FROM likes WHERE user_id = ? AND post_id = ?').run(req.user.id, req.params.id);
      db.prepare('UPDATE posts SET likes = MAX(0, likes - 1) WHERE id = ?').run(req.params.id);
      const updated = db.prepare('SELECT likes FROM posts WHERE id = ?').get(req.params.id);
      res.json({ success: true, liked: false, likes: updated.likes });
    } else {
      db.prepare('INSERT INTO likes (user_id, post_id) VALUES (?, ?)').run(req.user.id, req.params.id);
      db.prepare('UPDATE posts SET likes = likes + 1 WHERE id = ?').run(req.params.id);
      const updated = db.prepare('SELECT likes FROM posts WHERE id = ?').get(req.params.id);
      res.json({ success: true, liked: true, likes: updated.likes });
    }
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
