const express = require('express');
const router = express.Router();
const db = require('../db/database');

// GET /api/peaks?type=8000ers
router.get('/', (req, res) => {
  try {
    const { type } = req.query;
    let stmt;
    if (type) {
      stmt = db.prepare(`
        SELECT id, name, name_en as nameEn, altitude, country, continent, difficulty,
               image, type, description, best_season as bestSeason,
               success_rate as successRate, first_ascent as firstAscent, deaths
        FROM peaks WHERE type = ?
      `);
      return res.json(stmt.all(type));
    }
    stmt = db.prepare(`
      SELECT id, name, name_en as nameEn, altitude, country, continent, difficulty,
             image, type, description, best_season as bestSeason,
             success_rate as successRate, first_ascent as firstAscent, deaths
      FROM peaks
    `);
    res.json(stmt.all());
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/peaks/:id
router.get('/:id', (req, res) => {
  try {
    const peak = db.prepare(`
      SELECT id, name, name_en as nameEn, altitude, country, continent, difficulty,
             image, type, description, best_season as bestSeason,
             success_rate as successRate, first_ascent as firstAscent, deaths
      FROM peaks WHERE id = ?
    `).get(req.params.id);
    if (!peak) return res.status(404).json({ error: '山峰不存在' });
    res.json(peak);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
