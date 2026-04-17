const express = require('express');
const router = express.Router();
const db = require('../db/database');
const auth = require('../middleware/auth');

// GET /api/routes — 所有线路列表
router.get('/', (req, res) => {
  try {
    const routes = db.prepare(`
      SELECT id, name, peak, difficulty, cover, description,
             altitude, duration_days, best_season, region, status, created_at
      FROM climbing_routes WHERE status = 'active' ORDER BY altitude DESC
    `).all();
    res.json(routes);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/routes/:id — 线路详情
router.get('/:id', (req, res) => {
  try {
    const route = db.prepare(`
      SELECT id, name, peak, difficulty, cover, description,
             altitude, duration_days, best_season, region, status, created_at
      FROM climbing_routes WHERE id = ?
    `).get(req.params.id);
    if (!route) return res.status(404).json({ error: '线路不存在' });
    res.json(route);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/routes/:id/clubs — 该线路下所有报价俱乐部
router.get('/:id/clubs', (req, res) => {
  try {
    const items = db.prepare(`
      SELECT crp.id as pricing_id, crp.club_id, crp.route_id, crp.price, crp.includes,
             crp.duration, crp.max_people,
             c.name as club_name, c.description as club_description,
             c.cover, c.specialty, c.region, c.verified, c.rating,
             c.logo, c.contact, c.wechat, c.website,
             c.members_count as members, c.expeditions
      FROM club_route_pricing crp
      JOIN clubs c ON c.id = crp.club_id
      WHERE crp.route_id = ? AND crp.status = 'active' AND c.status = 'active'
      ORDER BY c.verified DESC, crp.price ASC
    `).all(req.params.id);
    res.json(items);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/routes — 创建线路（管理员）
router.post('/', auth, (req, res) => {
  try {
    const user = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(req.user.id);
    if (!user || !user.is_admin) return res.status(403).json({ error: '无权操作' });
    const { name, peak, difficulty, cover, description, altitude, duration_days, best_season, region } = req.body;
    if (!name) return res.status(400).json({ error: '线路名称不能为空' });
    const result = db.prepare(`
      INSERT INTO climbing_routes (name, peak, difficulty, cover, description, altitude, duration_days, best_season, region)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, peak || '', difficulty || '', cover || '', description || '',
           altitude || 0, duration_days || 0, best_season || '', region || '');
    const route = db.prepare('SELECT * FROM climbing_routes WHERE id = ?').get(result.lastInsertRowid);
    res.json(route);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/routes/:id — 更新线路
router.put('/:id', auth, (req, res) => {
  try {
    const user = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(req.user.id);
    if (!user || !user.is_admin) return res.status(403).json({ error: '无权操作' });
    const { name, peak, difficulty, cover, description, altitude, duration_days, best_season, region, status } = req.body;
    db.prepare(`
      UPDATE climbing_routes SET
        name = COALESCE(?, name), peak = COALESCE(?, peak),
        difficulty = COALESCE(?, difficulty), cover = COALESCE(?, cover),
        description = COALESCE(?, description), altitude = COALESCE(?, altitude),
        duration_days = COALESCE(?, duration_days), best_season = COALESCE(?, best_season),
        region = COALESCE(?, region), status = COALESCE(?, status)
      WHERE id = ?
    `).run(name || null, peak || null, difficulty || null, cover || null,
           description || null, altitude || null, duration_days || null,
           best_season || null, region || null, status || null, req.params.id);
    const route = db.prepare('SELECT * FROM climbing_routes WHERE id = ?').get(req.params.id);
    res.json(route);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/routes/pricing — 设置俱乐部报价
router.post('/pricing', auth, (req, res) => {
  try {
    const { club_id, route_id, price, includes, duration, max_people } = req.body;
    if (!club_id || !route_id || !price) return res.status(400).json({ error: '俱乐部、线路和价格不能为空' });
    // 权限：管理员或该俱乐部创建者
    const user = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(req.user.id);
    const club = db.prepare('SELECT creator_id FROM clubs WHERE id = ?').get(club_id);
    if (!user.is_admin && (!club || club.creator_id !== req.user.id)) {
      return res.status(403).json({ error: '无权操作' });
    }
    const result = db.prepare(`
      INSERT OR REPLACE INTO club_route_pricing (club_id, route_id, price, includes, duration, max_people)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(club_id, route_id, price,
           typeof includes === 'string' ? includes : JSON.stringify(includes || []),
           duration || 0, max_people || 10);
    const pricing = db.prepare('SELECT * FROM club_route_pricing WHERE id = ?').get(result.lastInsertRowid);
    res.json(pricing);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// DELETE /api/routes/:id — 删除线路（管理员）
router.delete('/:id', auth, (req, res) => {
  try {
    const user = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(req.user.id);
    if (!user || !user.is_admin) return res.status(403).json({ error: '无权操作' });
    db.prepare('UPDATE climbing_routes SET status = ? WHERE id = ?').run('deleted', req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
