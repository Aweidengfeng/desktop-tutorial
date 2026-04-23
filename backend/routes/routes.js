const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const auth = require('../middleware/auth');

// GET /api/routes — 所有线路列表
router.get('/', async (req, res) => {
  try {
    const routes = await prisma.$queryRaw`
      SELECT id, name, peak, difficulty, cover, description,
             altitude, duration_days, best_season, region, status, created_at
      FROM climbing_routes WHERE status = 'active' ORDER BY altitude DESC
    `;
    res.json(routes);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/routes/:id — 线路详情
router.get('/:id', async (req, res) => {
  try {
    const route = (await prisma.$queryRaw`
      SELECT id, name, peak, difficulty, cover, description,
             altitude, duration_days, best_season, region, status, created_at
      FROM climbing_routes WHERE id = ${Number(req.params.id)}
    `)[0];
    if (!route) return res.status(404).json({ error: '线路不存在' });
    res.json(route);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/routes/:id/clubs — 该线路下所有报价俱乐部
router.get('/:id/clubs', async (req, res) => {
  try {
    const items = await prisma.$queryRaw`
      SELECT crp.id as pricing_id, crp.club_id, crp.route_id, crp.price, crp.includes,
             crp.duration, crp.max_people,
             c.name as club_name, c.description as club_description,
             c.cover, c.specialty, c.region, c.verified, c.rating,
             c.logo, c.contact, c.wechat, c.website,
             c.members_count as members, c.expeditions
      FROM club_route_pricing crp
      JOIN clubs c ON c.id = crp.club_id
      WHERE crp.route_id = ${Number(req.params.id)} AND crp.status = 'active' AND c.status = 'active'
      ORDER BY c.verified DESC, crp.price ASC
    `;
    res.json(items);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/routes — 创建线路（管理员）
router.post('/', auth, async (req, res) => {
  try {
    const user = (await prisma.$queryRaw`SELECT is_admin FROM users WHERE id = ${req.user.id}`)[0];
    if (!user || !user.is_admin) return res.status(403).json({ error: '无权操作' });
    const { name, peak, difficulty, cover, description, altitude, duration_days, best_season, region } = req.body;
    if (!name) return res.status(400).json({ error: '线路名称不能为空' });
    const inserted = await prisma.$queryRaw`
      INSERT INTO climbing_routes (name, peak, difficulty, cover, description, altitude, duration_days, best_season, region)
      VALUES (${name}, ${peak || ''}, ${difficulty || ''}, ${cover || ''}, ${description || ''},
              ${altitude || 0}, ${duration_days || 0}, ${best_season || ''}, ${region || ''})
      RETURNING id
    `;
    const route = (await prisma.$queryRaw`SELECT * FROM climbing_routes WHERE id = ${inserted[0].id}`)[0];
    res.json(route);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/routes/:id — 更新线路
router.put('/:id', auth, async (req, res) => {
  try {
    const user = (await prisma.$queryRaw`SELECT is_admin FROM users WHERE id = ${req.user.id}`)[0];
    if (!user || !user.is_admin) return res.status(403).json({ error: '无权操作' });
    const { name, peak, difficulty, cover, description, altitude, duration_days, best_season, region, status } = req.body;
    await prisma.$executeRaw`
      UPDATE climbing_routes SET
        name = COALESCE(${name || null}, name), peak = COALESCE(${peak || null}, peak),
        difficulty = COALESCE(${difficulty || null}, difficulty), cover = COALESCE(${cover || null}, cover),
        description = COALESCE(${description || null}, description), altitude = COALESCE(${altitude || null}, altitude),
        duration_days = COALESCE(${duration_days || null}, duration_days), best_season = COALESCE(${best_season || null}, best_season),
        region = COALESCE(${region || null}, region), status = COALESCE(${status || null}, status)
      WHERE id = ${Number(req.params.id)}
    `;
    const route = (await prisma.$queryRaw`SELECT * FROM climbing_routes WHERE id = ${Number(req.params.id)}`)[0];
    res.json(route);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/routes/pricing — 设置俱乐部报价
router.post('/pricing', auth, async (req, res) => {
  try {
    const { club_id, route_id, price, includes, duration, max_people } = req.body;
    if (!club_id || !route_id || !price) return res.status(400).json({ error: '俱乐部、线路和价格不能为空' });
    // 权限：管理员或该俱乐部创建者
    const user = (await prisma.$queryRaw`SELECT is_admin FROM users WHERE id = ${req.user.id}`)[0];
    const club = (await prisma.$queryRaw`SELECT creator_id FROM clubs WHERE id = ${Number(club_id)}`)[0];
    if (!user.is_admin && (!club || club.creator_id !== req.user.id)) {
      return res.status(403).json({ error: '无权操作' });
    }
    const includesStr = typeof includes === 'string' ? includes : JSON.stringify(includes || []);
    const inserted = await prisma.$queryRaw`
      INSERT OR REPLACE INTO club_route_pricing (club_id, route_id, price, includes, duration, max_people)
      VALUES (${Number(club_id)}, ${Number(route_id)}, ${price}, ${includesStr}, ${duration || 0}, ${max_people || 10})
      RETURNING id
    `;
    const pricing = (await prisma.$queryRaw`SELECT * FROM club_route_pricing WHERE id = ${inserted[0].id}`)[0];
    res.json(pricing);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// DELETE /api/routes/:id — 删除线路（管理员）
router.delete('/:id', auth, async (req, res) => {
  try {
    const user = (await prisma.$queryRaw`SELECT is_admin FROM users WHERE id = ${req.user.id}`)[0];
    if (!user || !user.is_admin) return res.status(403).json({ error: '无权操作' });
    await prisma.$executeRaw`UPDATE climbing_routes SET status = 'deleted' WHERE id = ${Number(req.params.id)}`;
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
