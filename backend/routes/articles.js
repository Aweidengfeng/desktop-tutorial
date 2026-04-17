const express = require('express');
const router = express.Router();
const db = require('../db/database');
const auth = require('../middleware/auth');

// GET /api/articles?category=expedition|technical|hiking|gear
router.get('/', (req, res) => {
  try {
    const { category } = req.query;
    let sql = `
      SELECT a.id, a.title, a.category, a.read_time_minutes, a.cover_image,
             a.view_count, a.like_count, a.created_at,
             u.name AS author_name
      FROM articles a
      LEFT JOIN users u ON u.id = a.author_id
    `;
    const params = [];
    if (category && category !== 'all') {
      sql += ' WHERE a.category = ?';
      params.push(category);
    }
    sql += ' ORDER BY a.created_at DESC';
    const rows = db.prepare(sql).all(...params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/articles/featured — 热门文章（必须在 /:id 之前）
router.get('/featured', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT a.id, a.title, a.category, a.read_time_minutes, a.cover_image,
             a.view_count, a.like_count, a.created_at,
             u.name AS author_name
      FROM articles a
      LEFT JOIN users u ON u.id = a.author_id
      ORDER BY a.view_count DESC, a.like_count DESC
      LIMIT 6
    `).all();
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/articles/:id — 文章详情
router.get('/:id', (req, res) => {
  try {
    const article = db.prepare(`
      SELECT a.id, a.title, a.category, a.content, a.read_time_minutes,
             a.cover_image, a.view_count, a.like_count, a.created_at,
             u.name AS author_name, u.avatar AS author_avatar
      FROM articles a
      LEFT JOIN users u ON u.id = a.author_id
      WHERE a.id = ?
    `).get(req.params.id);
    if (!article) return res.status(404).json({ error: '文章不存在' });
    // Increment view count
    db.prepare('UPDATE articles SET view_count = view_count + 1 WHERE id = ?').run(req.params.id);
    // Return article with updated view count
    article.view_count = article.view_count + 1;
    res.json(article);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/articles — 发布文章（需登录）
router.post('/', auth, (req, res) => {
  try {
    const { title, category, content, read_time_minutes, cover_image } = req.body;
    if (!title || !category || !content) {
      return res.status(400).json({ error: '标题、分类和内容不能为空' });
    }
    const validCategories = ['expedition', 'technical', 'hiking', 'gear'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: '分类不正确' });
    }
    const result = db.prepare(`
      INSERT INTO articles (title, category, content, read_time_minutes, cover_image, author_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(title, category, content, read_time_minutes || 5, cover_image || null, req.user.id);
    const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(result.lastInsertRowid);
    res.json(article);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/articles/:id/like — 点赞文章
router.post('/:id/like', auth, (req, res) => {
  try {
    const article = db.prepare('SELECT id, like_count FROM articles WHERE id = ?').get(req.params.id);
    if (!article) return res.status(404).json({ error: '文章不存在' });
    db.prepare('UPDATE articles SET like_count = like_count + 1 WHERE id = ?').run(req.params.id);
    const updated = db.prepare('SELECT like_count FROM articles WHERE id = ?').get(req.params.id);
    res.json({ success: true, like_count: updated.like_count });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
