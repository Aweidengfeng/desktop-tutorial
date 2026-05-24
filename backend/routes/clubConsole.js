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

async function getClub(userId) {
  return (await prisma.$queryRaw`SELECT * FROM clubs WHERE creator_id = ${userId} AND status = 'active'`)[0];
}

// GET /api/club-console/dashboard
router.get('/dashboard', auth, async (req, res) => {
  try {
    const club = await getClub(req.user.id);
    if (!club) return res.status(403).json({ error: '仅俱乐部管理员可访问' });
    let membersCount = { c: 0 };
    let expeditionsCount = { c: 0 };
    let revenue = { total: 0 };
    try {
      const row = (await prisma.$queryRaw`SELECT COUNT(*) as c FROM club_members WHERE club_id=${club.id}`)[0];
      membersCount = { c: Number(row.c) };
    } catch (_) {}
    try {
      const row = (await prisma.$queryRaw`SELECT COUNT(*) as c FROM expeditions WHERE publisher_type='club' AND publisher_id=${club.id}`)[0];
      expeditionsCount = { c: Number(row.c) };
    } catch (_) {}
    try {
      const row = (await prisma.$queryRaw`SELECT COALESCE(SUM(eo.publisher_income),0) as total FROM expedition_orders eo JOIN expeditions e ON e.id=eo.expedition_id WHERE e.publisher_type='club' AND e.publisher_id=${club.id} AND eo.status='paid'`)[0];
      revenue = { total: Number(row.total) };
    } catch (_) {}
    res.json({
      club_id: club.id,
      club_name: club.name,
      members_count: membersCount.c,
      total_expeditions: expeditionsCount.c,
      total_revenue: revenue.total,
    });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/club-console/members
router.get('/members', auth, async (req, res) => {
  try {
    const club = await getClub(req.user.id);
    if (!club) return res.status(403).json({ error: '仅俱乐部管理员可访问' });
    const { role, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where = ['cm.club_id=?'];
    const params = [club.id];
    if (role) { where.push('cm.role=?'); params.push(role); }
    let members = [];
    try {
      const sql = `
        SELECT cm.*, u.name, u.avatar, u.level
        FROM club_members cm JOIN users u ON u.id=cm.user_id
        WHERE ${where.join(' AND ')}
        ORDER BY cm.joined_at DESC LIMIT ? OFFSET ?
      `;
      members = await prisma.$queryRawUnsafe(sql, ...params, parseInt(limit), offset);
    } catch (_) {}
    res.json(members);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/club-console/activities
router.post('/activities', writeLimiter, auth, async (req, res) => {
  try {
    const club = await getClub(req.user.id);
    if (!club) return res.status(403).json({ error: '仅俱乐部管理员可访问' });
    const { title, description, date, max_participants, price } = req.body;
    if (!title || !date) return res.status(400).json({ error: '标题和日期不能为空' });
    const now = new Date().toISOString();
    let resultId = null;
    try {
      const [{ id: newExpeditionId }] = await prisma.$queryRaw`
        INSERT INTO expeditions (publisher_type, publisher_id, title, route_name, start_date, max_participants, base_price, currency, status, created_at, updated_at)
        VALUES ('club', ${club.id}, ${title}, ${description || null}, ${date}, ${max_participants || 20}, ${price || 0}, 'CNY', 'published', ${now}, ${now})
        RETURNING id
      `;
      resultId = Number(newExpeditionId);
    } catch (_) {}
    res.json({ id: resultId, title, date, status: 'published' });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/club-console/activities — 合并返回：俱乐部短期活动 + 商业远征
router.get('/activities', auth, async (req, res) => {
  try {
    const club = await getClub(req.user.id);
    if (!club) return res.status(403).json({ error: '仅俱乐部管理员可访问' });

    // 从 club_activities 获取短期活动
    let activities = [];
    try {
      const rows = await prisma.$queryRaw`
        SELECT * FROM club_activities WHERE club_id = ${club.id} ORDER BY created_at DESC
      `;
      activities = rows.map(r => ({ ...r, source: 'activity' }));
    } catch (_) {}

    // 从 expeditions 获取俱乐部发布的商业远征（含统计数据）
    let expeditions = [];
    try {
      const rows = await prisma.$queryRaw`
        SELECT e.*,
               (SELECT COUNT(*) FROM expedition_orders eo WHERE eo.expedition_id = e.id) as order_count,
               (SELECT COALESCE(SUM(eo.publisher_income),0) FROM expedition_orders eo WHERE eo.expedition_id = e.id AND eo.status='paid') as total_revenue,
               (SELECT COUNT(*) FROM expedition_orders eo WHERE eo.expedition_id = e.id AND eo.status IN ('paid','confirmed')) as current_participants
        FROM expeditions e
        WHERE e.publisher_type = 'club' AND e.publisher_id = ${club.id}
        ORDER BY e.created_at DESC
      `;
      expeditions = rows.map(r => ({
        ...r,
        source: 'expedition',
        order_count: Number(r.order_count || 0),
        total_revenue: Number(r.total_revenue || 0),
        current_participants: Number(r.current_participants || 0),
        available_spots: Math.max(0, Number(r.max_participants || 0) - Number(r.current_participants || 0)),
      }));
    } catch (_) {}

    res.json({ activities, expeditions });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/club-console/finance
router.get('/finance', auth, async (req, res) => {
  try {
    const club = await getClub(req.user.id);
    if (!club) return res.status(403).json({ error: '仅俱乐部管理员可访问' });
    let monthly = [];
    try {
      const rows = await prisma.$queryRaw`
        SELECT strftime('%Y-%m', eo.created_at) as month,
               COUNT(*) as orders,
               COALESCE(SUM(eo.total),0) as gross,
               COALESCE(SUM(eo.publisher_income),0) as net
        FROM expedition_orders eo
        JOIN expeditions e ON e.id=eo.expedition_id
        WHERE e.publisher_type='club' AND e.publisher_id=${club.id} AND eo.status='paid'
        GROUP BY month ORDER BY month DESC LIMIT 12
      `;
      monthly = rows.map(r => ({ ...r, orders: Number(r.orders), gross: Number(r.gross), net: Number(r.net) }));
    } catch (_) {}
    res.json(monthly);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/club-console/my-expeditions — 俱乐部发布的商业远征列表（含统计）
router.get('/my-expeditions', auth, async (req, res) => {
  try {
    const club = await getClub(req.user.id);
    if (!club) return res.status(403).json({ error: '仅俱乐部管理员可访问' });
    let expeditions = [];
    try {
      const rows = await prisma.$queryRaw`
        SELECT e.id, e.title, e.peak_name, e.start_date, e.end_date, e.base_price, e.currency,
               e.status, e.max_participants, e.cover_image, e.created_at,
               (SELECT COUNT(*) FROM expedition_orders eo WHERE eo.expedition_id = e.id) as order_count,
               (SELECT COALESCE(SUM(eo.publisher_income),0) FROM expedition_orders eo WHERE eo.expedition_id = e.id AND eo.status='paid') as total_revenue,
               (SELECT COUNT(*) FROM expedition_orders eo WHERE eo.expedition_id = e.id AND eo.status IN ('paid','confirmed')) as current_participants
        FROM expeditions e
        WHERE e.publisher_type = 'club' AND e.publisher_id = ${club.id}
        ORDER BY e.created_at DESC
      `;
      expeditions = rows.map(r => ({
        ...r,
        order_count: Number(r.order_count || 0),
        total_revenue: Number(r.total_revenue || 0),
        current_participants: Number(r.current_participants || 0),
        available_spots: Math.max(0, Number(r.max_participants || 0) - Number(r.current_participants || 0)),
      }));
    } catch (_) {}
    res.json({ expeditions, total: expeditions.length });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/club-console/expeditions/:id/status — 俱乐部下架/更新远征状态
router.put('/expeditions/:id/status', writeLimiter, auth, async (req, res) => {
  try {
    const club = await getClub(req.user.id);
    if (!club) return res.status(403).json({ error: '仅俱乐部管理员可访问' });
    const { status } = req.body;
    if (!['closed', 'published', 'pending'].includes(status)) return res.status(400).json({ error: '无效状态' });
    const rows = await prisma.$queryRaw`SELECT id FROM expeditions WHERE id=${Number(req.params.id)} AND publisher_type='club' AND publisher_id=${club.id}`;
    if (!rows || rows.length === 0) return res.status(404).json({ error: '远征不存在或无权限' });
    await prisma.$executeRaw`UPDATE expeditions SET status=${status}, updated_at=${new Date().toISOString()} WHERE id=${Number(req.params.id)}`;
    res.json({ success: true, status });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
