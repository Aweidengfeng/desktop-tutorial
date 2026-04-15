const express = require('express');
const router = express.Router();
const db = require('../db/database');
const auth = require('../middleware/auth');

// GET /api/gear?mode=buy&category=全部
router.get('/', (req, res) => {
  try {
    const { mode, category } = req.query;
    let sql = `
      SELECT id, name, brand, price, condition_text as condition,
             image, description, mode, category
      FROM gear WHERE 1=1
    `;
    const params = [];
    if (mode && mode !== 'all') { sql += ' AND mode = ?'; params.push(mode); }
    if (category && category !== '全部') { sql += ' AND category = ?'; params.push(category); }
    sql += ' ORDER BY created_at DESC';
    res.json(db.prepare(sql).all(...params));
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/gear（需要JWT）
router.post('/', auth, (req, res) => {
  try {
    const { name, brand, price, condition, image, description, mode, category } = req.body;
    const result = db.prepare(`
      INSERT INTO gear (seller_id, name, brand, price, condition_text, image, description, mode, category)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.user.id, name, brand, price, condition, image || '', description || '', mode || 'buy', category || '');
    const item = db.prepare(`
      SELECT id, name, brand, price, condition_text as condition,
             image, description, mode, category FROM gear WHERE id = ?
    `).get(result.lastInsertRowid);
    res.json(item);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
