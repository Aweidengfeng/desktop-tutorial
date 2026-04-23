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
      await prisma.$executeRaw`
        INSERT INTO expeditions (publisher_type, publisher_id, title, route_name, start_date, max_participants, base_price, currency, status, created_at, updated_at)
        VALUES ('club', ${club.id}, ${title}, ${description || null}, ${date}, ${max_participants || 20}, ${price || 0}, 'CNY', 'published', ${now}, ${now})
      `;
      const idRow = (await prisma.$queryRaw`SELECT last_insert_rowid() as id`)[0];
      resultId = Number(idRow.id);
    } catch (_) {}
    res.json({ id: resultId, title, date, status: 'published' });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/club-console/activities
router.get('/activities', auth, async (req, res) => {
  try {
    const club = await getClub(req.user.id);
    if (!club) return res.status(403).json({ error: '仅俱乐部管理员可访问' });
    let activities = [];
    try {
      activities = await prisma.$queryRaw`SELECT * FROM expeditions WHERE publisher_type='club' AND publisher_id=${club.id} ORDER BY created_at DESC`;
    } catch (_) {}
    res.json(activities);
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

module.exports = router;
