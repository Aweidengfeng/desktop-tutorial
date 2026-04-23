const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const auth = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

const peakWriteLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false, message: { error: '操作过于频繁，请稍后再试' } });

// Helper: parse JSON fields on a peak object returned from Prisma
function safeJsonParse(str, fallback = []) {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch(e) { return fallback; }
}

function parsePeakJson(peak) {
  if (!peak) return peak;
  peak.routes = safeJsonParse(peak.routeDetails);
  peak.camps = safeJsonParse(peak.campsData);
  peak.categories = safeJsonParse(peak.categories);
  peak.gallery = safeJsonParse(peak.gallery);
  delete peak.routeDetails;
  delete peak.campsData;
  return peak;
}

// GET /api/peaks?category=eight_thousanders|seven_summits|classic|technical
// 同时向后兼容旧的 ?type= 参数
/**
 * @swagger
 * /api/peaks:
 *   get:
 *     tags: [山峰]
 *     summary: 获取山峰列表
 *     description: 返回全部山峰，可按分类过滤
 *     security: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [eight_thousanders, seven_summits, classic, technical]
 *         description: 山峰分类
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: 山峰类型（兼容旧参数）
 *     responses:
 *       200:
 *         description: 山峰数组
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Peak'
 */
router.get('/', async (req, res) => {
  try {
    const { type, category } = req.query;
    const filter = category || type;

    const select = {
      id: true, name: true, nameEn: true, altitude: true, country: true,
      continent: true, difficulty: true, image: true, coverImage: true,
      type: true, category: true, categories: true, description: true,
      bestSeason: true, successRate: true, firstAscent: true, deaths: true,
      latitude: true, longitude: true, region: true, annualClimbers: true,
      commercialTeams: true, seasonDetail: true, supplementalOxygen: true,
      mainRoute: true, operatingCompany: true, dataSource: true,
    };

    let peaks;
    if (filter) {
      // 支持 category 精确匹配或 type 匹配或 categories JSON 数组中包含该值
      peaks = await prisma.$queryRaw`
        SELECT id, name, name_en as "nameEn", altitude, country, continent, difficulty,
               image, cover_image as "coverImage", type, category, categories,
               description, best_season as "bestSeason",
               success_rate as "successRate", first_ascent as "firstAscent", deaths,
               latitude, longitude, region,
               annual_climbers as "annualClimbers", commercial_teams as "commercialTeams",
               season_detail as "seasonDetail", supplemental_oxygen as "supplementalOxygen",
               main_route as "mainRoute", operating_company as "operatingCompany",
               data_source as "dataSource"
        FROM peaks
        WHERE category = ${filter}
           OR type = ${filter}
           OR (categories IS NOT NULL AND categories LIKE ${'%"' + filter + '"%'})
        ORDER BY altitude DESC
      `;
    } else {
      peaks = await prisma.peak.findMany({
        select,
        orderBy: { altitude: 'desc' },
      });
    }

    res.json(peaks);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/peaks/suggest — 用户提交山峰建议（需要JWT）
// 注意：此路由必须在 /:id 之前注册
/**
 * @swagger
 * /api/peaks/suggest:
 *   post:
 *     tags: [山峰]
 *     summary: 提交山峰建议
 *     description: 登录用户可提交新山峰信息建议，待管理员审核
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, description: 山峰中文名 }
 *               name_en: { type: string }
 *               altitude: { type: integer, description: 海拔（米）}
 *               country: { type: string }
 *               continent: { type: string }
 *               difficulty: { type: string }
 *               description: { type: string }
 *               best_season: { type: string }
 *               latitude: { type: number }
 *               longitude: { type: number }
 *     responses:
 *       200:
 *         description: 建议已提交
 *       400:
 *         description: 山峰名称不能为空
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: 未登录
 */
router.post('/suggest', peakWriteLimiter, auth, async (req, res) => {
  try {
    const { name, name_en, altitude, country, continent, difficulty, description, best_season, routes, latitude, longitude, image } = req.body;
    if (!name) return res.status(400).json({ error: '山峰名称不能为空' });
    const suggestion = await prisma.peakSuggestion.create({
      data: {
        userId: req.user.id,
        name,
        nameEn: name_en || null,
        altitude: altitude ? parseInt(altitude) : null,
        country: country || null,
        continent: continent || null,
        difficulty: difficulty || null,
        description: description || null,
        bestSeason: best_season || null,
        routes: routes ? JSON.stringify(routes) : null,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        image: image || null,
      },
    });
    res.json(suggestion);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/peaks/:id/weather — 代理返回该山峰的天气
// 注意：此路由必须在 /:id 之前注册
/**
 * @swagger
 * /api/peaks/{id}/weather:
 *   get:
 *     tags: [山峰]
 *     summary: 获取山峰天气
 *     description: 根据山峰坐标代理获取当前天气数据
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: 山峰 ID
 *     responses:
 *       200:
 *         description: 天气数据
 *       404:
 *         description: 山峰不存在或暂无坐标
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id/weather', async (req, res) => {
  try {
    const peak = await prisma.peak.findUnique({
      where: { id: parseInt(req.params.id) },
      select: { name: true, latitude: true, longitude: true },
    });
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
        if (res.headersSent) return;
        try {
          const json = JSON.parse(data);
          res.json(json);
        } catch (e) {
          res.status(502).json({ error: '天气数据解析失败' });
        }
      });
    });
    request.on('error', () => {
      if (!res.headersSent) res.status(502).json({ error: '天气服务暂时不可用' });
    });
    request.setTimeout(8000, () => {
      request.destroy();
      if (!res.headersSent) res.status(504).json({ error: '天气服务超时' });
    });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/peaks/:id
/**
 * @swagger
 * /api/peaks/{id}:
 *   get:
 *     tags: [山峰]
 *     summary: 获取山峰详情
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: 山峰 ID
 *     responses:
 *       200:
 *         description: 山峰详情
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Peak'
 *       404:
 *         description: 山峰不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id', async (req, res) => {
  try {
    const peak = await prisma.peak.findUnique({
      where: { id: parseInt(req.params.id) },
    });
    if (!peak) return res.status(404).json({ error: '山峰不存在' });
    parsePeakJson(peak);
    res.json(peak);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
