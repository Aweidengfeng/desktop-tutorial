const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const auth = require('../middleware/auth');
const moderation = require('../utils/moderation');
const rateLimit = require('express-rate-limit');

const postWriteLimiter = rateLimit({ windowMs: 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false, message: { error: '发布过于频繁，请稍后再试' } });
const feedLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false, message: { error: '请求太频繁' } });
const saveLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false, message: { error: '操作太频繁' } });

// GET /api/posts?type=all
/**
 * @swagger
 * /api/posts:
 *   get:
 *     tags: [帖子]
 *     summary: 获取全部帖子
 *     description: 返回所有帖子，按发布时间倒序
 *     security: []
 *     responses:
 *       200:
 *         description: 帖子数组
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Post'
 */
router.get('/', async (req, res) => {
  try {
    const posts = await prisma.$queryRaw`
      SELECT id, author_name as authorName, author_avatar as authorAvatar,
             content, image, images, video_url as videoUrl, location, likes, comments, tags, emojis, created_at as createdAt
      FROM posts ORDER BY created_at DESC
    `;
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
/**
 * @swagger
 * /api/posts/feed:
 *   get:
 *     tags: [帖子]
 *     summary: 获取信息流帖子
 *     description: 支持三种模式：following（关注）、recommended（推荐）、nearby（附近）
 *     security: []
 *     parameters:
 *       - in: query
 *         name: mode
 *         schema:
 *           type: string
 *           enum: [following, recommended, nearby]
 *           default: recommended
 *       - in: query
 *         name: cursor
 *         schema: { type: integer }
 *         description: 翻页游标（上次最后一条帖子 ID）
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 50 }
 *     responses:
 *       200:
 *         description: 帖子数组
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Post'
 */
router.get('/feed', feedLimiter, async (req, res) => {
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
      if (cursor) {
        const cursorId = parseInt(cursor, 10);
        posts = await prisma.$queryRaw`
          SELECT p.id, p.author_name as authorName, p.author_avatar as authorAvatar,
                 p.content, p.image, p.images, p.location, p.likes, p.comments, p.tags, p.created_at as createdAt
          FROM posts p
          JOIN follows f ON f.following_id = p.user_id AND f.follower_id = ${userId}
          WHERE p.id < ${cursorId}
          ORDER BY p.created_at DESC LIMIT ${lim}
        `;
      } else {
        posts = await prisma.$queryRaw`
          SELECT p.id, p.author_name as authorName, p.author_avatar as authorAvatar,
                 p.content, p.image, p.images, p.location, p.likes, p.comments, p.tags, p.created_at as createdAt
          FROM posts p
          JOIN follows f ON f.following_id = p.user_id AND f.follower_id = ${userId}
          ORDER BY p.created_at DESC LIMIT ${lim}
        `;
      }
    } else if (mode === 'recommended') {
      if (cursor) {
        const cursorId = parseInt(cursor, 10);
        posts = await prisma.$queryRaw`
          SELECT p.id, p.author_name as authorName, p.author_avatar as authorAvatar,
                 p.content, p.image, p.images, p.location, p.likes, p.comments, p.tags, p.created_at as createdAt,
                 COALESCE(fs.score, 0) as feed_score
          FROM posts p
          LEFT JOIN feed_scores fs ON fs.post_id = p.id
          WHERE p.id < ${cursorId}
          ORDER BY COALESCE(fs.score, 0) DESC, p.created_at DESC LIMIT ${lim}
        `;
      } else {
        posts = await prisma.$queryRaw`
          SELECT p.id, p.author_name as authorName, p.author_avatar as authorAvatar,
                 p.content, p.image, p.images, p.location, p.likes, p.comments, p.tags, p.created_at as createdAt,
                 COALESCE(fs.score, 0) as feed_score
          FROM posts p
          LEFT JOIN feed_scores fs ON fs.post_id = p.id
          ORDER BY COALESCE(fs.score, 0) DESC, p.created_at DESC LIMIT ${lim}
        `;
      }
    } else if (mode === 'nearby') {
      if (cursor) {
        const cursorId = parseInt(cursor, 10);
        posts = await prisma.$queryRaw`
          SELECT p.id, p.author_name as authorName, p.author_avatar as authorAvatar,
                 p.content, p.image, p.images, p.location, p.likes, p.comments, p.tags, p.created_at as createdAt
          FROM posts p
          WHERE p.location IS NOT NULL AND p.location != '' AND p.id < ${cursorId}
          ORDER BY p.created_at DESC LIMIT ${lim}
        `;
      } else {
        posts = await prisma.$queryRaw`
          SELECT p.id, p.author_name as authorName, p.author_avatar as authorAvatar,
                 p.content, p.image, p.images, p.location, p.likes, p.comments, p.tags, p.created_at as createdAt
          FROM posts p
          WHERE p.location IS NOT NULL AND p.location != ''
          ORDER BY p.created_at DESC LIMIT ${lim}
        `;
      }
    } else {
      return res.status(400).json({ error: '无效的 mode 参数' });
    }

    const parsed = posts.map(p => ({
      ...p,
      feed_score: p.feed_score !== undefined ? Number(p.feed_score) : undefined,
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
router.get('/:id/saves', feedLimiter, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [row] = await prisma.$queryRaw`SELECT COUNT(*) as cnt FROM post_saves WHERE post_id = ${id}`;
    res.json({ count: Number(row.cnt) });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/posts/:id/save
router.post('/:id/save', saveLimiter, auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [post] = await prisma.$queryRaw`SELECT id FROM posts WHERE id = ${id}`;
    if (!post) return res.status(404).json({ error: '帖子不存在' });
    await prisma.$executeRaw`INSERT INTO post_saves (user_id, post_id) VALUES (${req.user.id}, ${id}) ON CONFLICT DO NOTHING`;
    const [row] = await prisma.$queryRaw`SELECT COUNT(*) as cnt FROM post_saves WHERE post_id = ${id}`;
    res.json({ success: true, saved: true, count: Number(row.cnt) });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// DELETE /api/posts/:id/save
router.delete('/:id/save', saveLimiter, auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.$executeRaw`DELETE FROM post_saves WHERE user_id = ${req.user.id} AND post_id = ${id}`;
    const [row] = await prisma.$queryRaw`SELECT COUNT(*) as cnt FROM post_saves WHERE post_id = ${id}`;
    res.json({ success: true, saved: false, count: Number(row.cnt) });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/posts/:id — 动态详情
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [post] = await prisma.$queryRaw`
      SELECT id, author_name as authorName, author_avatar as authorAvatar,
             content, image, images, video_url as videoUrl, location, likes, comments, tags, emojis, created_at as createdAt
      FROM posts WHERE id = ${id}
    `;
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
router.post('/', postWriteLimiter, auth, async (req, res) => {
  try {
    const { content, image, images, video_url, location, tags, emojis } = req.body;
    if (content) {
      const check = moderation.checkText(content);
      if (!check.ok) {
        try {
          await prisma.$executeRaw`
            INSERT INTO moderation_logs (content_type, content_snippet, reason, user_id)
            VALUES ('post', ${content.substring(0, 100)}, ${check.reason}, ${req.user.id})
          `;
        } catch(e) {}
        return res.status(422).json({ error: 'content_blocked', reason: check.reason });
      }
    }
    const [user] = await prisma.$queryRaw`SELECT * FROM users WHERE id = ${req.user.id}`;
    const tagsStr = tags ? JSON.stringify(tags) : null;
    const emojisStr = emojis ? JSON.stringify(emojis) : null;
    const imagesArr = Array.isArray(images) ? images : [];
    const imagesStr = imagesArr.length > 0 ? JSON.stringify(imagesArr) : null;
    const firstImage = image || imagesArr[0] || '';
    await prisma.$executeRaw`
      INSERT INTO posts (user_id, author_name, author_avatar, content, image, images, video_url, location, tags, emojis)
      VALUES (${req.user.id}, ${user.name}, ${user.avatar}, ${content}, ${firstImage}, ${imagesStr},
              ${video_url || null}, ${location || ''}, ${tagsStr}, ${emojisStr})
    `;
    const [post] = await prisma.$queryRaw`
      SELECT id, author_name as authorName, author_avatar as authorAvatar,
             content, image, images, video_url as videoUrl, location, likes, comments, tags, emojis, created_at as createdAt
      FROM posts WHERE user_id = ${req.user.id} ORDER BY id DESC LIMIT 1
    `;
    post.tags = post.tags ? JSON.parse(post.tags) : [];
    post.emojis = post.emojis ? JSON.parse(post.emojis) : [];
    post.images = post.images ? JSON.parse(post.images) : [];
    res.json(post);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/posts/:id/like（需要JWT，支持取消赞）
router.post('/:id/like', saveLimiter, auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [post] = await prisma.$queryRaw`SELECT * FROM posts WHERE id = ${id}`;
    if (!post) return res.status(404).json({ error: '帖子不存在' });
    const [existing] = await prisma.$queryRaw`
      SELECT id FROM likes WHERE user_id = ${req.user.id} AND post_id = ${id}
    `;
    if (existing) {
      await prisma.$executeRaw`DELETE FROM likes WHERE user_id = ${req.user.id} AND post_id = ${id}`;
      await prisma.$executeRaw`UPDATE posts SET likes = MAX(0, likes - 1) WHERE id = ${id}`;
      const [updated] = await prisma.$queryRaw`SELECT likes FROM posts WHERE id = ${id}`;
      res.json({ success: true, liked: false, likes: updated.likes });
    } else {
      await prisma.$executeRaw`INSERT INTO likes (user_id, post_id) VALUES (${req.user.id}, ${id})`;
      await prisma.$executeRaw`UPDATE posts SET likes = likes + 1 WHERE id = ${id}`;
      const [updated] = await prisma.$queryRaw`SELECT likes FROM posts WHERE id = ${id}`;
      res.json({ success: true, liked: true, likes: updated.likes });
    }
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
