const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const auth = require('../middleware/auth');
const rateLimit = require('express-rate-limit');
const { VALID_TRANSITIONS, appendStatusHistory } = require('./orderStateMachine');
const { paymentsEnabled, paymentsDisabledResponse } = require('../utils/payments');

const gsoReadLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false, message: { error: '请求过于频繁' } });
const gsoWriteLimiter = rateLimit({ windowMs: 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false, message: { error: '操作过于频繁' } });

// GET /api/guide-service-orders/my
router.get('/my', gsoReadLimiter, auth, async (req, res) => {
  try {
    const orders = await prisma.$queryRaw`
      SELECT gso.*, gs.title as service_title, gs.cover as service_cover,
             gs.type as service_type, gs.mountain, gs.region,
             g.name as guide_name, g.avatar as guide_avatar
      FROM guide_service_orders gso
      LEFT JOIN guide_services gs ON gs.id = gso.service_id
      LEFT JOIN guides g ON g.id = gso.guide_id
      WHERE gso.user_id = ${req.user.id}
      ORDER BY gso.created_at DESC
    `;
    res.json(orders);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/guide-service-orders/:id/pay
router.post('/:id/pay', gsoWriteLimiter, auth, async (req, res) => {
  if (!paymentsEnabled()) return paymentsDisabledResponse(res);
  try {
    const order = (await prisma.$queryRaw`SELECT * FROM guide_service_orders WHERE id = ${Number(req.params.id)} AND user_id = ${req.user.id}`)[0];
    if (!order) return res.status(404).json({ error: '订单不存在' });
    if (order.status !== 'pending_payment') {
      return res.status(400).json({ error: `订单状态为 ${order.status}，无法支付` });
    }
    const newHistory = appendStatusHistory(order.status_history, 'paid');
    await prisma.$executeRaw`UPDATE guide_service_orders SET status='paid', status_history=${newHistory}, updated_at=CURRENT_TIMESTAMP WHERE id=${order.id}`;
    try {
      const svc = (await prisma.$queryRaw`SELECT title, guide_id FROM guide_services WHERE id = ${order.service_id}`)[0];
      if (svc) {
        const guide = (await prisma.$queryRaw`SELECT user_id FROM guides WHERE id = ${svc.guide_id}`)[0];
        if (guide) {
          await prisma.$executeRaw`INSERT INTO notifications (user_id, type, content, related_id) VALUES (${guide.user_id}, 'guide_service_paid', ${`【服务付款】${svc.title} 预约费已支付，订单号：${order.order_no}`}, ${order.id})`;
        }
        await prisma.$executeRaw`INSERT INTO notifications (user_id, type, content, related_id) VALUES (${order.user_id}, 'guide_service_paid', ${`【支付成功】${svc.title} 预约费已支付，订单号：${order.order_no}`}, ${order.id})`;
      }
    } catch(e) {}
    res.json({ success: true, status: 'paid', order_no: order.order_no });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/guide-service-orders/:id/cancel
router.post('/:id/cancel', gsoWriteLimiter, auth, async (req, res) => {
  try {
    const order = (await prisma.$queryRaw`SELECT * FROM guide_service_orders WHERE id = ${Number(req.params.id)} AND user_id = ${req.user.id}`)[0];
    if (!order) return res.status(404).json({ error: '订单不存在' });
    const allowed = VALID_TRANSITIONS[order.status] || [];
    if (!allowed.includes('cancelled')) {
      return res.status(400).json({ error: `当前状态 ${order.status} 不允许取消` });
    }
    const newHistory = appendStatusHistory(order.status_history, 'cancelled');
    await prisma.$executeRaw`UPDATE guide_service_orders SET status='cancelled', status_history=${newHistory}, updated_at=CURRENT_TIMESTAMP WHERE id=${order.id}`;
    res.json({ success: true, status: 'cancelled' });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/guide-service-orders/:id/refund-request
router.post('/:id/refund-request', gsoWriteLimiter, auth, async (req, res) => {
  try {
    const order = (await prisma.$queryRaw`SELECT * FROM guide_service_orders WHERE id = ${Number(req.params.id)} AND user_id = ${req.user.id}`)[0];
    if (!order) return res.status(404).json({ error: '订单不存在' });
    const allowed = VALID_TRANSITIONS[order.status] || [];
    if (!allowed.includes('refund_requested')) {
      return res.status(400).json({ error: `当前状态 ${order.status} 不允许申请退款` });
    }
    const { reason } = req.body;
    const newHistory = appendStatusHistory(order.status_history, 'refund_requested');
    await prisma.$executeRaw`UPDATE guide_service_orders SET status='refund_requested', status_history=${newHistory}, refund_reason=${reason || ''}, updated_at=CURRENT_TIMESTAMP WHERE id=${order.id}`;
    res.json({ success: true, status: 'refund_requested' });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
