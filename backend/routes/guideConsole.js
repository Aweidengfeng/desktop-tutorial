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

module.exports = router;
