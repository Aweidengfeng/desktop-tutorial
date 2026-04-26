const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const prisma = require('../db/prisma');

const searchLimiter = rateLimit({ windowMs: 60*1000, max: 60 });

// Initialize FTS5 search index
(async () => {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
        name, description, type UNINDEXED, ref_id UNINDEXED
      );
    `);
    const rows = await prisma.$queryRawUnsafe('SELECT COUNT(*) as cnt FROM search_index');
    if (Number(rows[0].cnt) === 0) {
      const peaks = await prisma.$queryRawUnsafe('SELECT id, name, description FROM peaks');
      for (const item of peaks) {
        await prisma.$executeRawUnsafe('INSERT INTO search_index (name, description, type, ref_id) VALUES (?, ?, ?, ?)',
          item.name || '', item.description || '', 'peak', String(item.id));
      }
      try {
        const guides = await prisma.$queryRawUnsafe('SELECT id, name, bio as description FROM guides');
        for (const item of guides) {
          await prisma.$executeRawUnsafe('INSERT INTO search_index (name, description, type, ref_id) VALUES (?, ?, ?, ?)',
            item.name || '', item.description || '', 'guide', String(item.id));
        }
      } catch(e) {}
      try {
        const clubs = await prisma.$queryRawUnsafe('SELECT id, name, description FROM clubs');
        for (const item of clubs) {
          await prisma.$executeRawUnsafe('INSERT INTO search_index (name, description, type, ref_id) VALUES (?, ?, ?, ?)',
            item.name || '', item.description || '', 'club', String(item.id));
        }
      } catch(e) {}
      try {
        const articles = await prisma.$queryRawUnsafe('SELECT id, title as name, content as description FROM articles');
        for (const item of articles) {
          await prisma.$executeRawUnsafe('INSERT INTO search_index (name, description, type, ref_id) VALUES (?, ?, ?, ?)',
            item.name || '', item.description || '', 'article', String(item.id));
        }
      } catch(e) {}
    }
  } catch(e) {
    console.warn('FTS5 index init failed:', e.message);
  }
})();

// GET /api/search?q=xxx&type=all|peak|guide|club|article&limit=20
/**
 * @swagger
 * /api/search:
 *   get:
 *     tags: [搜索]
 *     summary: 全局搜索
 *     description: 搜索山峰、向导、俱乐部、文章等内容
 *     security: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string }
 *         description: 搜索关键词
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [all, peak, guide, club, article]
 *           default: all
 *         description: 搜索类型
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *     responses:
 *       200:
 *         description: 搜索结果数组
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   type: { type: string }
 *                   id: { type: integer }
 *                   name: { type: string }
 *                   description: { type: string }
 */
router.get('/', searchLimiter, async (req, res) => {
  try {
    const { q, type = 'all', limit = 20 } = req.query;
    if (!q || q.trim().length < 1) return res.json([]);

    const safeLimit = Math.min(Number(limit) || 20, 100);
    let results = [];

    try {
      // Try FTS5 first (works well for ASCII/English queries)
      const safeQ = q.replace(/['"*]/g, '') + '*';
      let sql = 'SELECT name, description, type, ref_id FROM search_index WHERE search_index MATCH ?';
      const params = [safeQ];
      if (type !== 'all') { sql += ' AND type = ?'; params.push(type); }
      sql += ' LIMIT ?';
      params.push(safeLimit);
      results = await prisma.$queryRawUnsafe(sql, ...params);
    } catch(ftsErr) {
      // Fallback: LIKE query for CJK and other non-ASCII characters
      const likeQ = `%${q.replace(/[%_]/g, '')}%`;
      let sql = 'SELECT name, description, type, ref_id FROM search_index WHERE name LIKE ?';
      const params = [likeQ];
      if (type !== 'all') { sql += ' AND type = ?'; params.push(type); }
      sql += ' LIMIT ?';
      params.push(safeLimit);
      results = await prisma.$queryRawUnsafe(sql, ...params);
    }

    res.json(results);
  } catch(e) {
    console.error('Search error:', e.message);
    res.status(500).json({ error: '搜索失败', results: [] });
  }
});

module.exports = router;
