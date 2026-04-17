const express = require('express');
const router = express.Router();
const db = require('../db/database');
const auth = require('../middleware/auth');

// GET /api/peaks?type=8000ers
router.get('/', (req, res) => {
  try {
    const { type } = req.query;
    let stmt;
    if (type) {
      stmt = db.prepare(`
        SELECT id, name, name_en as nameEn, altitude, country, continent, difficulty,
               image, type, description, best_season as bestSeason,
               success_rate as successRate, first_ascent as firstAscent, deaths,
               latitude, longitude,
               annual_climbers as annualClimbers, commercial_teams as commercialTeams,
               season_detail as seasonDetail, supplemental_oxygen as supplementalOxygen,
               main_route as mainRoute, operating_company as operatingCompany,
               data_source as dataSource
        FROM peaks WHERE type = ?
      `);
      return res.json(stmt.all(type));
    }
    stmt = db.prepare(`
      SELECT id, name, name_en as nameEn, altitude, country, continent, difficulty,
             image, type, description, best_season as bestSeason,
             success_rate as successRate, first_ascent as firstAscent, deaths,
             latitude, longitude,
             annual_climbers as annualClimbers, commercial_teams as commercialTeams,
             season_detail as seasonDetail, supplemental_oxygen as supplementalOxygen,
             main_route as mainRoute, operating_company as operatingCompany,
             data_source as dataSource
      FROM peaks
    `);
    res.json(stmt.all());
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/peaks/suggest — 用户提交山峰建议（需要JWT）
// 注意：此路由必须在 /:id 之前注册
router.post('/suggest', auth, (req, res) => {
  try {
    const { name, name_en, altitude, country, continent, difficulty, description, best_season, routes, latitude, longitude, image } = req.body;
    if (!name) return res.status(400).json({ error: '山峰名称不能为空' });
    const routesStr = routes ? JSON.stringify(routes) : null;
    const result = db.prepare(`
      INSERT INTO peak_suggestions (user_id, name, name_en, altitude, country, continent, difficulty, description, best_season, routes, latitude, longitude, image)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.user.id, name, name_en || null, altitude || null, country || null, continent || null,
           difficulty || null, description || null, best_season || null, routesStr,
           latitude || null, longitude || null, image || null);
    const suggestion = db.prepare('SELECT * FROM peak_suggestions WHERE id = ?').get(result.lastInsertRowid);
    res.json(suggestion);
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
             success_rate as successRate, first_ascent as firstAscent, deaths,
             latitude, longitude, routes, camps, technical_grade as technicalGrade,
             permit_required as permitRequired, permit_fee as permitFee,
             annual_climbers as annualClimbers, commercial_teams as commercialTeams,
             season_detail as seasonDetail, supplemental_oxygen as supplementalOxygen,
             main_route as mainRoute, operating_company as operatingCompany,
             data_source as dataSource
      FROM peaks WHERE id = ?
    `).get(req.params.id);
    if (!peak) return res.status(404).json({ error: '山峰不存在' });
    peak.routes = peak.routes ? JSON.parse(peak.routes) : [];
    peak.camps = peak.camps ? JSON.parse(peak.camps) : [];
    res.json(peak);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
