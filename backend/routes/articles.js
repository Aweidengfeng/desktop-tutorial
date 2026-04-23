const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const auth = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

const articlesReadLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false, message: { error: '请求过于频繁' } });
const articlesWriteLimiter = rateLimit({ windowMs: 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false, message: { error: '操作过于频繁' } });

// GET /api/articles?category=expedition|technical|hiking|gear
router.get('/', articlesReadLimiter, async (req, res) => {
  try {
    const { category } = req.query;
    let sql = `
      SELECT a.id, a.title, a.category, a.read_time_minutes, a.cover_image,
             a.view_count, a.like_count, a.created_at, a.status,
             u.name AS author_name
      FROM articles a
      LEFT JOIN users u ON u.id = a.author_id
      WHERE (a.status IS NULL OR a.status = 'published')
    `;
    const params = [];
    if (category && category !== 'all') {
      sql += ' AND a.category = ?';
      params.push(category);
    }
    sql += ' ORDER BY a.created_at DESC';
    const rows = await prisma.$queryRawUnsafe(sql, ...params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/articles/featured — 热门文章（必须在 /:id 之前）
router.get('/featured', articlesReadLimiter, async (req, res) => {
  try {
    const rows = await prisma.$queryRaw`
      SELECT a.id, a.title, a.category, a.read_time_minutes, a.cover_image,
             a.view_count, a.like_count, a.created_at,
             u.name AS author_name
      FROM articles a
      LEFT JOIN users u ON u.id = a.author_id
      WHERE (a.status IS NULL OR a.status = 'published')
      ORDER BY a.view_count DESC, a.like_count DESC
      LIMIT 6
    `;
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/articles/:id — 文章详情
router.get('/:id', articlesReadLimiter, async (req, res) => {
  try {
    const article = (await prisma.$queryRaw`
      SELECT a.id, a.title, a.category, a.content, a.read_time_minutes,
             a.cover_image, a.view_count, a.like_count, a.created_at,
             u.name AS author_name, u.avatar AS author_avatar
      FROM articles a
      LEFT JOIN users u ON u.id = a.author_id
      WHERE a.id = ${Number(req.params.id)}
    `)[0];
    if (!article) return res.status(404).json({ error: '文章不存在' });
    // Increment view count
    await prisma.$executeRaw`UPDATE articles SET view_count = view_count + 1 WHERE id = ${Number(req.params.id)}`;
    // Return article with updated view count
    article.view_count = article.view_count + 1;
    res.json(article);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/articles — 发布文章（需登录，提交后待审核）
router.post('/', articlesWriteLimiter, auth, async (req, res) => {
  try {
    const { title, category, content, read_time_minutes, cover_image } = req.body;
    if (!title || !category || !content) {
      return res.status(400).json({ error: '标题、分类和内容不能为空' });
    }
    const validCategories = ['expedition', 'technical', 'hiking', 'gear'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: '分类不正确' });
    }
    const inserted = await prisma.$queryRaw`
      INSERT INTO articles (title, category, content, read_time_minutes, cover_image, author_id, status)
      VALUES (${title}, ${category}, ${content}, ${read_time_minutes || 5}, ${cover_image || null}, ${req.user.id}, 'pending')
      RETURNING id
    `;
    const article = (await prisma.$queryRaw`SELECT * FROM articles WHERE id = ${inserted[0].id}`)[0];
    res.json({ ...article, message: '攻略已提交，等待管理员审核后公开展示' });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/articles/:id/like — 点赞文章
router.post('/:id/like', articlesWriteLimiter, auth, async (req, res) => {
  try {
    const article = (await prisma.$queryRaw`SELECT id, like_count FROM articles WHERE id = ${Number(req.params.id)}`)[0];
    if (!article) return res.status(404).json({ error: '文章不存在' });
    await prisma.$executeRaw`UPDATE articles SET like_count = like_count + 1 WHERE id = ${Number(req.params.id)}`;
    const updated = (await prisma.$queryRaw`SELECT like_count FROM articles WHERE id = ${Number(req.params.id)}`)[0];
    res.json({ success: true, like_count: updated.like_count });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
