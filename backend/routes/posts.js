const express = require('express');
const router = express.Router();
const db = require('../db/database');
const auth = require('../middleware/auth');
const moderation = require('../utils/moderation');
const rateLimit = require('express-rate-limit');

const postWriteLimiter = rateLimit({ windowMs: 60 * 1000, max: 20, message: { error: '发布过于频繁，请稍后再试' } });

// GET /api/posts?type=all
router.get('/', (req, res) => {
  try {
    const posts = db.prepare(`
      SELECT id, author_name as authorName, author_avatar as authorAvatar,
             content, image, images, video_url as videoUrl, location, likes, comments, tags, emojis, created_at as createdAt
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

// GET /api/posts/feed - 3 modes: following, recommended, nearby
router.get('/feed', (req, res) => {
  try {
    const { mode = 'recommended', cursor, limit = 20 } = req.query;
    const lim = Math.min(parseInt(limit, 10) || 20, 50);
    let posts;

    if (mode === 'following') {
      const authHeader = req.headers['authorization'];
      let userId = null;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const jwt = require('jsonwebtoken');
          const secret = process.env.JWT_SECRET || 'summitlink_dev_secret_do_not_use_in_production';
          const decoded = jwt.verify(authHeader.split(' ')[1], secret);
          userId = decoded.id;
        } catch (e) {}
      }
      if (!userId) return res.status(401).json({ error: '请先登录' });
      const cursorClause = cursor ? 'AND p.id < ?' : '';
      const params = cursor ? [userId, parseInt(cursor, 10), lim] : [userId, lim];
      posts = db.prepare(`
        SELECT p.id, p.author_name as authorName, p.author_avatar as authorAvatar,
               p.content, p.image, p.images, p.location, p.likes, p.comments, p.tags, p.created_at as createdAt
        FROM posts p
        JOIN follows f ON f.following_id = p.user_id AND f.follower_id = ?
        WHERE 1=1 ${cursorClause}
        ORDER BY p.created_at DESC LIMIT ?
      `).all(...params);
    } else if (mode === 'recommended') {
      const cursorClause = cursor ? 'AND p.id < ?' : '';
      const params = cursor ? [parseInt(cursor, 10), lim] : [lim];
      posts = db.prepare(`
        SELECT p.id, p.author_name as authorName, p.author_avatar as authorAvatar,
               p.content, p.image, p.images, p.location, p.likes, p.comments, p.tags, p.created_at as createdAt,
               COALESCE(fs.score, 0) as feed_score
        FROM posts p
        LEFT JOIN feed_scores fs ON fs.post_id = p.id
        WHERE 1=1 ${cursorClause}
        ORDER BY COALESCE(fs.score, 0) DESC, p.created_at DESC LIMIT ?
      `).all(...params);
    } else if (mode === 'nearby') {
      const cursorClause = cursor ? 'AND p.id < ?' : '';
      const params = cursor ? [parseInt(cursor, 10), lim] : [lim];
      posts = db.prepare(`
        SELECT p.id, p.author_name as authorName, p.author_avatar as authorAvatar,
               p.content, p.image, p.images, p.location, p.likes, p.comments, p.tags, p.created_at as createdAt
        FROM posts p
        WHERE p.location IS NOT NULL AND p.location != '' ${cursorClause}
        ORDER BY p.created_at DESC LIMIT ?
      `).all(...params);
    } else {
      return res.status(400).json({ error: '无效的 mode 参数' });
    }

    const parsed = posts.map(p => ({
      ...p,
      tags: p.tags ? JSON.parse(p.tags) : [],
      images: p.images ? JSON.parse(p.images) : [],
    }));
    const nextCursor = parsed.length === lim ? parsed[parsed.length - 1].id : null;
    res.json({ posts: parsed, nextCursor });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/posts/:id/saves
router.get('/:id/saves', (req, res) => {
  try {
    const count = db.prepare('SELECT COUNT(*) as cnt FROM post_saves WHERE post_id = ?').get(req.params.id).cnt;
    res.json({ count });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/posts/:id/save
router.post('/:id/save', auth, (req, res) => {
  try {
    const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(req.params.id);
    if (!post) return res.status(404).json({ error: '帖子不存在' });
    db.prepare('INSERT OR IGNORE INTO post_saves (user_id, post_id) VALUES (?, ?)').run(req.user.id, req.params.id);
    const count = db.prepare('SELECT COUNT(*) as cnt FROM post_saves WHERE post_id = ?').get(req.params.id).cnt;
    res.json({ success: true, saved: true, count });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// DELETE /api/posts/:id/save
router.delete('/:id/save', auth, (req, res) => {
  try {
    db.prepare('DELETE FROM post_saves WHERE user_id = ? AND post_id = ?').run(req.user.id, req.params.id);
    const count = db.prepare('SELECT COUNT(*) as cnt FROM post_saves WHERE post_id = ?').get(req.params.id).cnt;
    res.json({ success: true, saved: false, count });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/posts/:id — 动态详情
router.get('/:id', (req, res) => {
  try {
    const post = db.prepare(`
      SELECT id, author_name as authorName, author_avatar as authorAvatar,
             content, image, images, video_url as videoUrl, location, likes, comments, tags, emojis, created_at as createdAt
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
router.post('/', postWriteLimiter, auth, (req, res) => {
  try {
    const { content, image, images, video_url, location, tags, emojis } = req.body;
    if (content) {
      const check = moderation.checkText(content);
      if (!check.ok) {
        try {
          db.prepare('INSERT INTO moderation_logs (content_type, content_snippet, reason, user_id) VALUES (?, ?, ?, ?)').run('post', content.substring(0, 100), check.reason, req.user.id);
        } catch(e) {}
        return res.status(422).json({ error: 'content_blocked', reason: check.reason });
      }
    }
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    const tagsStr = tags ? JSON.stringify(tags) : null;
    const emojisStr = emojis ? JSON.stringify(emojis) : null;
    const imagesArr = Array.isArray(images) ? images : [];
    const imagesStr = imagesArr.length > 0 ? JSON.stringify(imagesArr) : null;
    const firstImage = image || imagesArr[0] || '';
    const result = db.prepare(`
      INSERT INTO posts (user_id, author_name, author_avatar, content, image, images, video_url, location, tags, emojis)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.user.id, user.name, user.avatar, content, firstImage, imagesStr, video_url || null, location || '', tagsStr, emojisStr);
    const post = db.prepare(`
      SELECT id, author_name as authorName, author_avatar as authorAvatar,
             content, image, images, video_url as videoUrl, location, likes, comments, tags, emojis, created_at as createdAt
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
