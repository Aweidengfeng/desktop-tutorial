const express = require('express');
const router = express.Router();
const db = require('../db/database');
const auth = require('../middleware/auth');

// GET /api/peaks?category=eight_thousanders|seven_summits|classic|technical
// 同时向后兼容旧的 ?type= 参数
router.get('/', (req, res) => {
  try {
    const { type, category } = req.query;
    const filter = category || type;
    let stmt;
    if (filter) {
      // 支持 category 精确匹配或 categories JSON 数组中包含该值
      stmt = db.prepare(`
        SELECT id, name, name_en as nameEn, altitude, country, continent, difficulty,
               image, cover_image as coverImage, type, category, categories,
               description, best_season as bestSeason,
               success_rate as successRate, first_ascent as firstAscent, deaths,
               latitude, longitude, region,
               annual_climbers as annualClimbers, commercial_teams as commercialTeams,
               season_detail as seasonDetail, supplemental_oxygen as supplementalOxygen,
               main_route as mainRoute, operating_company as operatingCompany,
               data_source as dataSource
        FROM peaks
        WHERE category = ?
           OR type = ?
           OR (categories IS NOT NULL AND categories LIKE ?)
        ORDER BY altitude DESC
      `);
      return res.json(stmt.all(filter, filter, `%"${filter}"%`));
    }
    stmt = db.prepare(`
      SELECT id, name, name_en as nameEn, altitude, country, continent, difficulty,
             image, cover_image as coverImage, type, category, categories,
             description, best_season as bestSeason,
             success_rate as successRate, first_ascent as firstAscent, deaths,
             latitude, longitude, region,
             annual_climbers as annualClimbers, commercial_teams as commercialTeams,
             season_detail as seasonDetail, supplemental_oxygen as supplementalOxygen,
             main_route as mainRoute, operating_company as operatingCompany,
             data_source as dataSource
      FROM peaks
      ORDER BY altitude DESC
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

// GET /api/peaks/:id/weather — 代理返回该山峰的天气
// 注意：此路由必须在 /:id 之前注册
router.get('/:id/weather', (req, res) => {
  try {
    const peak = db.prepare('SELECT name, latitude, longitude FROM peaks WHERE id = ?').get(req.params.id);
    if (!peak) return res.status(404).json({ error: '山峰不存在' });
    const { latitude, longitude } = peak;
    if (!latitude || !longitude) {
      return res.status(404).json({ error: '该山峰暂无坐标数据，无法获取天气' });
    }
    // 内部代理到 /api/weather
    const http = require('http');
    const port = process.env.PORT || 8080;
    const weatherUrl = `http://localhost:${port}/api/weather?lat=${latitude}&lon=${longitude}`;
    const request = http.get(weatherUrl, (resp) => {
      let data = '';
      resp.on('data', chunk => { data += chunk; });
      resp.on('end', () => {
        try {
          const json = JSON.parse(data);
          res.json(json);
        } catch (e) {
          res.status(502).json({ error: '天气数据解析失败' });
        }
      });
    });
    request.on('error', () => res.status(502).json({ error: '天气服务暂时不可用' }));
    request.setTimeout(8000, () => { request.destroy(); res.status(504).json({ error: '天气服务超时' }); });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/peaks/:id
router.get('/:id', (req, res) => {
  try {
    const peak = db.prepare(`
      SELECT id, name, name_en as nameEn, altitude, country, continent, difficulty,
             image, cover_image as coverImage, type, category, categories,
             description, best_season as bestSeason,
             success_rate as successRate, first_ascent as firstAscent, deaths,
             latitude, longitude, routes, camps, technical_grade as technicalGrade,
             permit_required as permitRequired, permit_fee as permitFee,
             annual_climbers as annualClimbers, commercial_teams as commercialTeams,
             season_detail as seasonDetail, supplemental_oxygen as supplementalOxygen,
             main_route as mainRoute, operating_company as operatingCompany,
             data_source as dataSource, region, first_ascent_year as firstAscentYear,
             first_ascent_by as firstAscentBy, technical_notes as technicalNotes,
             gallery
      FROM peaks WHERE id = ?
    `).get(req.params.id);
    if (!peak) return res.status(404).json({ error: '山峰不存在' });
    peak.routes = peak.routes ? JSON.parse(peak.routes) : [];
    peak.camps = peak.camps ? JSON.parse(peak.camps) : [];
    if (peak.categories) {
      try { peak.categories = JSON.parse(peak.categories); } catch (e) { peak.categories = []; }
    } else {
      peak.categories = [];
    }
    if (peak.gallery) {
      try { peak.gallery = JSON.parse(peak.gallery); } catch (e) { peak.gallery = []; }
    } else {
      peak.gallery = [];
    }
    res.json(peak);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
