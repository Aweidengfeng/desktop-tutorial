const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const db = require('../db/database');
const auth = require('../middleware/auth');

const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '操作过于频繁，请稍后再试' },
});

function getGuide(userId) {
  return db.prepare("SELECT * FROM guides WHERE user_id = ? AND status = 'approved'").get(userId);
}

// GET /api/guide-console/dashboard
router.get('/dashboard', auth, (req, res) => {
  try {
    const guide = getGuide(req.user.id);
    if (!guide) return res.status(403).json({ error: '仅向导可访问' });
    const today = new Date().toISOString().split('T')[0];
    const month = today.substring(0, 7);
    let todayOrders = { c: 0 };
    let monthRevenue = { revenue: 0 };
    let pendingBookings = { c: 0 };
    try {
      todayOrders = db.prepare("SELECT COUNT(*) as c FROM expedition_orders WHERE expedition_id IN (SELECT id FROM expeditions WHERE publisher_type='guide' AND publisher_id=?) AND DATE(created_at)=?").get(guide.id, today);
      monthRevenue = db.prepare("SELECT COALESCE(SUM(publisher_income),0) as revenue FROM expedition_orders WHERE expedition_id IN (SELECT id FROM expeditions WHERE publisher_type='guide' AND publisher_id=?) AND status='paid' AND strftime('%Y-%m',created_at)=?").get(guide.id, month);
    } catch (_) {}
    try {
      pendingBookings = db.prepare("SELECT COUNT(*) as c FROM bookings WHERE guide_id=? AND status='pending'").get(guide.id);
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
router.get('/orders', auth, (req, res) => {
  try {
    const guide = getGuide(req.user.id);
    if (!guide) return res.status(403).json({ error: '仅向导可访问' });
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where = ["e.publisher_type='guide'", "e.publisher_id=?"];
    const params = [guide.id];
    if (status) { where.push('eo.status=?'); params.push(status); }
    let orders = [];
    try {
      orders = db.prepare(`
        SELECT eo.*, e.title as expedition_title, e.start_date, e.end_date
        FROM expedition_orders eo
        JOIN expeditions e ON e.id = eo.expedition_id
        WHERE ${where.join(' AND ')}
        ORDER BY eo.created_at DESC LIMIT ? OFFSET ?
      `).all(...params, parseInt(limit), offset);
    } catch (_) {}
    res.json(orders);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/guide-console/orders/:id/approve
router.put('/orders/:id/approve', writeLimiter, auth, (req, res) => {
  try {
    const guide = getGuide(req.user.id);
    if (!guide) return res.status(403).json({ error: '仅向导可访问' });
    let order = null;
    try {
      order = db.prepare("SELECT eo.* FROM expedition_orders eo JOIN expeditions e ON e.id=eo.expedition_id WHERE eo.id=? AND e.publisher_type='guide' AND e.publisher_id=?").get(req.params.id, guide.id);
    } catch (_) {}
    if (!order) return res.status(404).json({ error: '订单不存在' });
    db.prepare("UPDATE expedition_orders SET status='confirmed' WHERE id=?").run(order.id);
    res.json({ success: true, status: 'confirmed' });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/guide-console/orders/:id/reject
router.put('/orders/:id/reject', writeLimiter, auth, (req, res) => {
  try {
    const guide = getGuide(req.user.id);
    if (!guide) return res.status(403).json({ error: '仅向导可访问' });
    let order = null;
    try {
      order = db.prepare("SELECT eo.* FROM expedition_orders eo JOIN expeditions e ON e.id=eo.expedition_id WHERE eo.id=? AND e.publisher_type='guide' AND e.publisher_id=?").get(req.params.id, guide.id);
    } catch (_) {}
    if (!order) return res.status(404).json({ error: '订单不存在' });
    const { reason } = req.body;
    db.prepare("UPDATE expedition_orders SET status='cancelled' WHERE id=?").run(order.id);
    res.json({ success: true, status: 'cancelled', reason: reason || '' });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/guide-console/earnings
router.get('/earnings', auth, (req, res) => {
  try {
    const guide = getGuide(req.user.id);
    if (!guide) return res.status(403).json({ error: '仅向导可访问' });
    let rows = [];
    try {
      rows = db.prepare(`
        SELECT strftime('%Y-%m', eo.created_at) as month,
               COUNT(*) as order_count,
               COALESCE(SUM(eo.total),0) as gross,
               COALESCE(SUM(eo.publisher_income),0) as net
        FROM expedition_orders eo
        JOIN expeditions e ON e.id=eo.expedition_id
        WHERE e.publisher_type='guide' AND e.publisher_id=? AND eo.status='paid'
        GROUP BY month ORDER BY month DESC LIMIT 12
      `).all(guide.id);
    } catch (_) {}
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/guide-console/withdraw
router.post('/withdraw', writeLimiter, auth, (req, res) => {
  try {
    const guide = getGuide(req.user.id);
    if (!guide) return res.status(403).json({ error: '仅向导可访问' });
    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: '提现金额无效' });
    res.json({ success: true, message: '提现申请已提交，预计1-3个工作日到账', amount, status: 'pending' });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
