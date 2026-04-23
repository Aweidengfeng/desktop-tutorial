const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const prisma = require('../db/prisma');
const auth = require('../middleware/auth');

const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '操作过于频繁，请稍后再试' },
});

function generateGearItems(peak_name, altitude_tier, season, difficulty) {
  const base = ['登山靴', '冰爪', '冰镐', '头盔', '安全带', '绳索', '手套', '太阳镜', '防晒霜', '急救包'];
  const highAlt = ['高山帐篷', '睡袋（-20℃）', '氧气瓶', '高山炉具', '雪铲', '雪锚'];
  const winter = ['羽绒服', '保温内衣', '暖手包', '防冻药膏'];
  const technical = ['上升器', '下降器', '快挂', '岩钉', '岩锤'];
  let items = [...base];
  if (altitude_tier === 'high' || altitude_tier === '8000+') items = items.concat(highAlt);
  if (season === 'winter' || season === '冬季') items = items.concat(winter);
  if (difficulty === 'technical' || difficulty === '技术') items = items.concat(technical);
  return items.map(name => ({ name, checked: false }));
}

// GET /api/climbing-log - user's climbing log
router.get('/', auth, async (req, res) => {
  try {
    const expeditions = await prisma.$queryRaw`SELECT * FROM user_expeditions_log WHERE user_id = ${req.user.id} ORDER BY started_at DESC`;
    res.json(expeditions);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/climbing-log/stats - user stats
router.get('/stats', auth, async (req, res) => {
  try {
    const row = (await prisma.$queryRaw`
      SELECT COUNT(*) as total_expeditions,
             SUM(CASE WHEN summited=1 THEN 1 ELSE 0 END) as total_summits,
             SUM(max_altitude) as total_altitude,
             SUM(duration_sec) as total_duration_sec,
             MAX(max_altitude) as highest_altitude
      FROM user_expeditions_log WHERE user_id = ${req.user.id}
    `)[0];
    res.json({
      total_expeditions: Number(row.total_expeditions),
      total_summits: Number(row.total_summits),
      total_altitude: Number(row.total_altitude),
      total_duration_sec: Number(row.total_duration_sec),
      highest_altitude: row.highest_altitude,
    });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/climbing-log/gear-list - generate smart gear checklist
router.post('/gear-list', writeLimiter, auth, async (req, res) => {
  try {
    const { peak_id, peak_name, altitude_tier, season, difficulty } = req.body;
    if (!peak_name) return res.status(400).json({ error: 'peak_name 不能为空' });
    const items = generateGearItems(peak_name, altitude_tier, season, difficulty);
    const now = new Date().toISOString();
    const inserted = await prisma.$queryRaw`
      INSERT INTO smart_gear_lists (user_id, peak_id, peak_name, altitude_tier, season, difficulty, items, created_at)
      VALUES (${req.user.id}, ${peak_id || null}, ${peak_name}, ${altitude_tier || null}, ${season || null}, ${difficulty || null}, ${JSON.stringify(items)}, ${now})
      RETURNING id
    `;
    const list = (await prisma.$queryRaw`SELECT * FROM smart_gear_lists WHERE id = ${inserted[0].id}`)[0];
    list.items = JSON.parse(list.items);
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/climbing-log/gear-list/:id - update gear list
router.put('/gear-list/:id', auth, async (req, res) => {
  try {
    const list = (await prisma.$queryRaw`SELECT * FROM smart_gear_lists WHERE id = ${Number(req.params.id)} AND user_id = ${req.user.id}`)[0];
    if (!list) return res.status(404).json({ error: '装备清单不存在' });
    const { items } = req.body;
    if (!items) return res.status(400).json({ error: 'items 不能为空' });
    await prisma.$executeRaw`UPDATE smart_gear_lists SET items = ${JSON.stringify(items)} WHERE id = ${list.id}`;
    const updated = (await prisma.$queryRaw`SELECT * FROM smart_gear_lists WHERE id = ${list.id}`)[0];
    updated.items = JSON.parse(updated.items);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/climbing-log/gear-list/:id - get a gear list
router.get('/gear-list/:id', auth, async (req, res) => {
  try {
    const list = (await prisma.$queryRaw`SELECT * FROM smart_gear_lists WHERE id = ${Number(req.params.id)} AND user_id = ${req.user.id}`)[0];
    if (!list) return res.status(404).json({ error: '装备清单不存在' });
    list.items = JSON.parse(list.items);
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/climbing-log/gear-list/:id/export-pdf - placeholder
router.post('/gear-list/:id/export-pdf', auth, async (req, res) => {
  try {
    const list = (await prisma.$queryRaw`SELECT * FROM smart_gear_lists WHERE id = ${Number(req.params.id)} AND user_id = ${req.user.id}`)[0];
    if (!list) return res.status(404).json({ error: '装备清单不存在' });
    res.json({ success: true, message: 'PDF导出功能即将上线', list_id: list.id });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
