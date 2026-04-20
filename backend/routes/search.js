const express = require('express');
const router = express.Router();
const db = require('../db/database');

// Initialize FTS5 search index
try {
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
      name, description, type UNINDEXED, ref_id UNINDEXED
    );
  `);
  const indexCount = db.prepare('SELECT COUNT(*) as cnt FROM search_index').get();
  if (indexCount.cnt === 0) {
    const peaks = db.prepare('SELECT id, name, description FROM peaks').all();
    const insertIdx = db.prepare('INSERT INTO search_index (name, description, type, ref_id) VALUES (?, ?, ?, ?)');
    const insertMany = db.transaction((items, type) => {
      for (const item of items) insertIdx.run(item.name || '', item.description || '', type, String(item.id));
    });
    insertMany(peaks, 'peak');
    try {
      const guides = db.prepare('SELECT id, name, bio as description FROM guides').all();
      insertMany(guides, 'guide');
    } catch(e) {}
    try {
      const clubs = db.prepare('SELECT id, name, description FROM clubs').all();
      insertMany(clubs, 'club');
    } catch(e) {}
    try {
      const articles = db.prepare('SELECT id, title as name, content as description FROM articles').all();
      insertMany(articles, 'article');
    } catch(e) {}
  }
} catch(e) {
  console.warn('FTS5 index init failed:', e.message);
}

// GET /api/search?q=xxx&type=all|peak|guide|club|article&limit=20
router.get('/', (req, res) => {
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
      results = db.prepare(sql).all(...params);
    } catch(ftsErr) {
      // Fallback: LIKE query for CJK and other non-ASCII characters
      const likeQ = `%${q.replace(/[%_]/g, '')}%`;
      let sql = 'SELECT name, description, type, ref_id FROM search_index WHERE name LIKE ?';
      const params = [likeQ];
      if (type !== 'all') { sql += ' AND type = ?'; params.push(type); }
      sql += ' LIMIT ?';
      params.push(safeLimit);
      results = db.prepare(sql).all(...params);
    }

    res.json(results);
  } catch(e) {
    console.error('Search error:', e.message);
    res.status(500).json({ error: '搜索失败', results: [] });
  }
});

module.exports = router;
