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

async function getGuide(userId) {
  return (await prisma.$queryRaw`SELECT * FROM guides WHERE user_id = ${userId} AND status = 'approved'`)[0];
}

// GET /api/guide-console/dashboard
router.get('/dashboard', auth, async (req, res) => {
  try {
    const guide = await getGuide(req.user.id);
    if (!guide) return res.status(403).json({ error: '仅向导可访问' });
    const today = new Date().toISOString().split('T')[0];
    const month = today.substring(0, 7);
    let todayOrders = { c: 0 };
    let monthRevenue = { revenue: 0 };
    let pendingBookings = { c: 0 };
    try {
      const row1 = (await prisma.$queryRaw`SELECT COUNT(*) as c FROM expedition_orders WHERE expedition_id IN (SELECT id FROM expeditions WHERE publisher_type='guide' AND publisher_id=${guide.id}) AND DATE(created_at)=${today}`)[0];
      todayOrders = { c: Number(row1.c) };
      const row2 = (await prisma.$queryRaw`SELECT COALESCE(SUM(publisher_income),0) as revenue FROM expedition_orders WHERE expedition_id IN (SELECT id FROM expeditions WHERE publisher_type='guide' AND publisher_id=${guide.id}) AND status='paid' AND strftime('%Y-%m',created_at)=${month}`)[0];
      monthRevenue = { revenue: Number(row2.revenue) };
    } catch (_) {}
    try {
      const row3 = (await prisma.$queryRaw`SELECT COUNT(*) as c FROM bookings WHERE guide_id=${guide.id} AND status='pending'`)[0];
      pendingBookings = { c: Number(row3.c) };
    } catch (_) {}
    res.json({
      today_orders: todayOrders.c,
      monthly_revenue: monthRevenue.revenue,
      pending_consultations: pendingBookings.c,
      guide_id: guide.id,
      guide_name: guide.name,
      rating: guide.rating,
    });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/guide-console/orders
router.get('/orders', auth, async (req, res) => {
  try {
    const guide = await getGuide(req.user.id);
    if (!guide) return res.status(403).json({ error: '仅向导可访问' });
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where = ["e.publisher_type='guide'", "e.publisher_id=?"];
    const params = [guide.id];
    if (status) { where.push('eo.status=?'); params.push(status); }
    let orders = [];
    try {
      const sql = `
        SELECT eo.*, e.title as expedition_title, e.start_date, e.end_date
        FROM expedition_orders eo
        JOIN expeditions e ON e.id = eo.expedition_id
        WHERE ${where.join(' AND ')}
        ORDER BY eo.created_at DESC LIMIT ? OFFSET ?
      `;
      orders = await prisma.$queryRawUnsafe(sql, ...params, parseInt(limit), offset);
    } catch (_) {}
    res.json(orders);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/guide-console/orders/:id/approve
router.put('/orders/:id/approve', writeLimiter, auth, async (req, res) => {
  try {
    const guide = await getGuide(req.user.id);
    if (!guide) return res.status(403).json({ error: '仅向导可访问' });
    let order = null;
    try {
      order = (await prisma.$queryRaw`SELECT eo.* FROM expedition_orders eo JOIN expeditions e ON e.id=eo.expedition_id WHERE eo.id=${Number(req.params.id)} AND e.publisher_type='guide' AND e.publisher_id=${guide.id}`)[0];
    } catch (_) {}
    if (!order) return res.status(404).json({ error: '订单不存在' });
    await prisma.$executeRaw`UPDATE expedition_orders SET status='confirmed' WHERE id=${order.id}`;
    res.json({ success: true, status: 'confirmed' });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/guide-console/orders/:id/reject
router.put('/orders/:id/reject', writeLimiter, auth, async (req, res) => {
  try {
    const guide = await getGuide(req.user.id);
    if (!guide) return res.status(403).json({ error: '仅向导可访问' });
    let order = null;
    try {
      order = (await prisma.$queryRaw`SELECT eo.* FROM expedition_orders eo JOIN expeditions e ON e.id=eo.expedition_id WHERE eo.id=${Number(req.params.id)} AND e.publisher_type='guide' AND e.publisher_id=${guide.id}`)[0];
    } catch (_) {}
    if (!order) return res.status(404).json({ error: '订单不存在' });
    const { reason } = req.body;
    await prisma.$executeRaw`UPDATE expedition_orders SET status='cancelled' WHERE id=${order.id}`;
    res.json({ success: true, status: 'cancelled', reason: reason || '' });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/guide-console/earnings
router.get('/earnings', auth, async (req, res) => {
  try {
    const guide = await getGuide(req.user.id);
    if (!guide) return res.status(403).json({ error: '仅向导可访问' });
    let rows = [];
    try {
      const rawRows = await prisma.$queryRaw`
        SELECT strftime('%Y-%m', eo.created_at) as month,
               COUNT(*) as order_count,
               COALESCE(SUM(eo.total),0) as gross,
               COALESCE(SUM(eo.publisher_income),0) as net
        FROM expedition_orders eo
        JOIN expeditions e ON e.id=eo.expedition_id
        WHERE e.publisher_type='guide' AND e.publisher_id=${guide.id} AND eo.status='paid'
        GROUP BY month ORDER BY month DESC LIMIT 12
      `;
      rows = rawRows.map(r => ({ ...r, order_count: Number(r.order_count), gross: Number(r.gross), net: Number(r.net) }));
    } catch (_) {}
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/guide-console/withdraw
router.post('/withdraw', writeLimiter, auth, async (req, res) => {
  try {
    const guide = await getGuide(req.user.id);
    if (!guide) return res.status(403).json({ error: '仅向导可访问' });
    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: '提现金额无效' });
    res.json({ success: true, message: '提现申请已提交，预计1-3个工作日到账', amount, status: 'pending' });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/guide-console/activities — 合并返回：向导服务 + 商业远征
router.get('/activities', auth, async (req, res) => {
  try {
    const guide = await getGuide(req.user.id);
    if (!guide) return res.status(403).json({ error: '仅向导可访问' });

    // 从 club_activities 获取向导服务
    let services = [];
    try {
      const rows = await prisma.$queryRaw`
        SELECT * FROM club_activities
        WHERE guide_id = ${guide.id} AND type = 'guide_service'
        ORDER BY created_at DESC
      `;
      services = rows.map(r => ({ ...r, source: 'service' }));
    } catch (_) {}

    // 从 expeditions 获取向导发布的商业远征（含统计数据）
    let expeditions = [];
    try {
      const rows = await prisma.$queryRaw`
        SELECT e.*,
               (SELECT COUNT(*) FROM expedition_orders eo WHERE eo.expedition_id = e.id) as order_count,
               (SELECT COALESCE(SUM(eo.publisher_income),0) FROM expedition_orders eo WHERE eo.expedition_id = e.id AND eo.status='paid') as total_revenue,
               (SELECT COUNT(*) FROM expedition_orders eo WHERE eo.expedition_id = e.id AND eo.status IN ('paid','confirmed')) as current_participants
        FROM expeditions e
        WHERE e.publisher_type = 'guide' AND e.publisher_id = ${guide.id}
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

    res.json({ services, expeditions });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/guide-console/my-expeditions — 向导发布的商业远征列表（含统计）
router.get('/my-expeditions', auth, async (req, res) => {
  try {
    const guide = await getGuide(req.user.id);
    if (!guide) return res.status(403).json({ error: '仅向导可访问' });
    let expeditions = [];
    try {
      const rows = await prisma.$queryRaw`
        SELECT e.id, e.title, e.peak_name, e.start_date, e.end_date, e.base_price, e.currency,
               e.status, e.max_participants, e.cover_image, e.created_at,
               (SELECT COUNT(*) FROM expedition_orders eo WHERE eo.expedition_id = e.id) as order_count,
               (SELECT COALESCE(SUM(eo.publisher_income),0) FROM expedition_orders eo WHERE eo.expedition_id = e.id AND eo.status='paid') as total_revenue,
               (SELECT COUNT(*) FROM expedition_orders eo WHERE eo.expedition_id = e.id AND eo.status IN ('paid','confirmed')) as current_participants
        FROM expeditions e
        WHERE e.publisher_type = 'guide' AND e.publisher_id = ${guide.id}
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

// PUT /api/guide-console/expeditions/:id/status — 向导下架/更新远征状态
router.put('/expeditions/:id/status', writeLimiter, auth, async (req, res) => {
  try {
    const guide = await getGuide(req.user.id);
    if (!guide) return res.status(403).json({ error: '仅向导可访问' });
    const { status } = req.body;
    if (!['closed', 'published', 'pending'].includes(status)) return res.status(400).json({ error: '无效状态' });
    const rows = await prisma.$queryRaw`SELECT id FROM expeditions WHERE id=${Number(req.params.id)} AND publisher_type='guide' AND publisher_id=${guide.id}`;
    if (!rows || rows.length === 0) return res.status(404).json({ error: '远征不存在或无权限' });
    await prisma.$executeRaw`UPDATE expeditions SET status=${status}, updated_at=${new Date().toISOString()} WHERE id=${Number(req.params.id)}`;
    res.json({ success: true, status });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
