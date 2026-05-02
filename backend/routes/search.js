/**
 * search.js — 全文搜索路由
 * 支持山峰、向导、俱乐部、动态的统一搜索
 * PostgreSQL: 使用 tsvector + GIN 索引
 * SQLite 降级: 使用 LIKE 模糊匹配
 */
const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const rateLimit = require('express-rate-limit');

const searchLimiter = rateLimit({
  windowMs: 60 * 1000, max: 30,
  message: { error: '搜索过于频繁，请稍后再试' },
  standardHeaders: true, legacyHeaders: false,
});

const IS_PG = (process.env.DATABASE_PROVIDER || 'sqlite') === 'postgresql';

// GET /api/search?q=...&type=all|peaks|guides|clubs|posts&limit=10&page=1
router.get('/', searchLimiter, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q || q.length < 1) return res.json({ peaks: [], guides: [], clubs: [], posts: [], total: 0 });

    const type = req.query.type || 'all';
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const offset = (page - 1) * limit;

    const results = {};

    if (type === 'all' || type === 'peaks') {
      if (IS_PG) {
        results.peaks = await prisma.$queryRaw`
          SELECT id, name, name_en, altitude, country, difficulty, image, cover_image,
                 ts_rank(to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(name_en,'') || ' ' || coalesce(description,'')),
                         plainto_tsquery('simple', ${q})) AS rank
          FROM peaks
          WHERE to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(name_en,'') || ' ' || coalesce(description,''))
                @@ plainto_tsquery('simple', ${q})
             OR name ILIKE ${'%' + q + '%'}
             OR name_en ILIKE ${'%' + q + '%'}
          ORDER BY rank DESC, altitude DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
      } else {
        results.peaks = await prisma.$queryRaw`
          SELECT id, name, altitude, country, difficulty, image FROM peaks
          WHERE name LIKE ${'%' + q + '%'} OR description LIKE ${'%' + q + '%'}
          ORDER BY altitude DESC LIMIT ${limit} OFFSET ${offset}
        `;
      }
    }

    if (type === 'all' || type === 'guides') {
      if (IS_PG) {
        results.guides = await prisma.$queryRaw`
          SELECT g.id, g.name, g.avatar, g.rating, g.specialty, g.region, g.day_rate, g.nationality
          FROM guides g
          WHERE g.status = 'active'
            AND (to_tsvector('simple', coalesce(g.name,'') || ' ' || coalesce(g.specialty,'') || ' ' || coalesce(g.region,'') || ' ' || coalesce(g.bio,''))
                 @@ plainto_tsquery('simple', ${q})
              OR g.name ILIKE ${'%' + q + '%'}
              OR g.specialty ILIKE ${'%' + q + '%'})
          ORDER BY g.rating DESC LIMIT ${limit} OFFSET ${offset}
        `;
      } else {
        results.guides = await prisma.$queryRaw`
          SELECT id, name, avatar, rating, specialty, region, day_rate FROM guides
          WHERE status = 'active' AND (name LIKE ${'%' + q + '%'} OR specialty LIKE ${'%' + q + '%'} OR region LIKE ${'%' + q + '%'})
          ORDER BY rating DESC LIMIT ${limit} OFFSET ${offset}
        `;
      }
    }

    if (type === 'all' || type === 'clubs') {
      if (IS_PG) {
        results.clubs = await prisma.$queryRaw`
          SELECT id, name, description, cover, specialty, region, members_count, verified
          FROM clubs
          WHERE status = 'active'
            AND (to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(description,'') || ' ' || coalesce(specialty,'') || ' ' || coalesce(region,''))
                 @@ plainto_tsquery('simple', ${q})
              OR name ILIKE ${'%' + q + '%'})
          ORDER BY verified DESC, members_count DESC LIMIT ${limit} OFFSET ${offset}
        `;
      } else {
        results.clubs = await prisma.$queryRaw`
          SELECT id, name, description, cover, specialty, region, members_count, verified FROM clubs
          WHERE status = 'active' AND (name LIKE ${'%' + q + '%'} OR description LIKE ${'%' + q + '%'})
          ORDER BY members_count DESC LIMIT ${limit} OFFSET ${offset}
        `;
      }
    }

    if (type === 'all' || type === 'posts') {
      if (IS_PG) {
        results.posts = await prisma.$queryRaw`
          SELECT p.id, p.content, p.image, p.likes, p.created_at, u.name as author_name, u.avatar as author_avatar
          FROM posts p JOIN users u ON u.id = p.user_id
          WHERE to_tsvector('simple', coalesce(p.content,''))
                @@ plainto_tsquery('simple', ${q})
             OR p.content ILIKE ${'%' + q + '%'}
          ORDER BY p.created_at DESC LIMIT ${limit} OFFSET ${offset}
        `;
      } else {
        results.posts = await prisma.$queryRaw`
          SELECT p.id, p.content, p.image, p.likes, p.created_at, u.name as author_name, u.avatar as author_avatar
          FROM posts p JOIN users u ON u.id = p.user_id
          WHERE p.content LIKE ${'%' + q + '%'}
          ORDER BY p.created_at DESC LIMIT ${limit} OFFSET ${offset}
        `;
      }
    }

    const total = Object.values(results).reduce((s, arr) => s + (arr?.length || 0), 0);
    res.json({ ...results, query: q, total });
  } catch (e) {
    console.error('[search]', e.message);
    res.status(500).json({ error: '搜索失败' });
  }
});

// GET /api/search/suggest?q=... — 搜索建议（仅山峰名称）
router.get('/suggest', searchLimiter, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q || q.length < 1) return res.json([]);
    let suggestions;
    if (IS_PG) {
      suggestions = await prisma.$queryRaw`
        SELECT id, name, altitude, country FROM peaks
        WHERE name ILIKE ${'%' + q + '%'} OR name_en ILIKE ${'%' + q + '%'}
        ORDER BY altitude DESC LIMIT 8
      `;
    } else {
      suggestions = await prisma.$queryRaw`
        SELECT id, name, altitude, country FROM peaks
        WHERE name LIKE ${'%' + q + '%'}
        ORDER BY altitude DESC LIMIT 8
      `;
    }
    res.json(suggestions);
  } catch (e) {
    res.status(500).json({ error: '搜索建议失败' });
  }
});

module.exports = router;
