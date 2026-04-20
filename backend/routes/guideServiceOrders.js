/**
 * @file guideServiceOrders.js
 * @description 向导服务预约订单路由
 *
 * 接口概览：
 *   GET  /api/guide-service-orders/my                    当前用户的向导服务订单列表
 *   POST /api/guide-service-orders/:id/pay               模拟支付
 *   POST /api/guide-service-orders/:id/cancel            取消订单
 *   POST /api/guide-service-orders/:id/refund-request    申请退款
 */

const express = require('express');
const router = express.Router();
const db = require('../db/database');
const auth = require('../middleware/auth');
const { VALID_TRANSITIONS, appendStatusHistory } = require('./orderStateMachine');

// GET /api/guide-service-orders/my — 我的向导服务订单
router.get('/my', auth, (req, res) => {
  try {
    const orders = db.prepare(`
      SELECT gso.*, gs.title as service_title, gs.cover as service_cover,
             gs.type as service_type, gs.mountain, gs.region,
             g.name as guide_name, g.avatar as guide_avatar
      FROM guide_service_orders gso
      LEFT JOIN guide_services gs ON gs.id = gso.service_id
      LEFT JOIN guides g ON g.id = gso.guide_id
      WHERE gso.user_id = ?
      ORDER BY gso.created_at DESC
    `).all(req.user.id);
    res.json(orders);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/guide-service-orders/:id/pay — 模拟支付
router.post('/:id/pay', auth, (req, res) => {
  try {
    const order = db.prepare('SELECT * FROM guide_service_orders WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);
    if (!order) return res.status(404).json({ error: '订单不存在' });
    if (order.status !== 'pending_payment') {
      return res.status(400).json({ error: `订单状态为 ${order.status}，无法支付` });
    }
    const newHistory = appendStatusHistory(order.status_history, 'paid');
    db.prepare("UPDATE guide_service_orders SET status='paid', status_history=?, updated_at=CURRENT_TIMESTAMP WHERE id=?")
      .run(newHistory, order.id);
    // 通知向导收到付款
    try {
      const svc = db.prepare('SELECT title, guide_id FROM guide_services WHERE id = ?').get(order.service_id);
      if (svc) {
        const guide = db.prepare('SELECT user_id FROM guides WHERE id = ?').get(svc.guide_id);
        if (guide) {
          db.prepare("INSERT INTO notifications (user_id, type, content, related_id) VALUES (?, 'guide_service_paid', ?, ?)")
            .run(guide.user_id, `【服务付款】${svc.title} 预约费已支付，订单号：${order.order_no}`, order.id);
        }
        db.prepare("INSERT INTO notifications (user_id, type, content, related_id) VALUES (?, 'guide_service_paid', ?, ?)")
          .run(order.user_id, `【支付成功】${svc.title} 预约费已支付，订单号：${order.order_no}`, order.id);
      }
    } catch(e) {}
    res.json({ success: true, status: 'paid', order_no: order.order_no });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/guide-service-orders/:id/cancel — 取消订单
router.post('/:id/cancel', auth, (req, res) => {
  try {
    const order = db.prepare('SELECT * FROM guide_service_orders WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);
    if (!order) return res.status(404).json({ error: '订单不存在' });
    const allowed = VALID_TRANSITIONS[order.status] || [];
    if (!allowed.includes('cancelled')) {
      return res.status(400).json({ error: `当前状态 ${order.status} 不允许取消` });
    }
    const newHistory = appendStatusHistory(order.status_history, 'cancelled');
    db.prepare("UPDATE guide_service_orders SET status='cancelled', status_history=?, updated_at=CURRENT_TIMESTAMP WHERE id=?")
      .run(newHistory, order.id);
    res.json({ success: true, status: 'cancelled' });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/guide-service-orders/:id/refund-request — 申请退款
router.post('/:id/refund-request', auth, (req, res) => {
  try {
    const order = db.prepare('SELECT * FROM guide_service_orders WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);
    if (!order) return res.status(404).json({ error: '订单不存在' });
    const allowed = VALID_TRANSITIONS[order.status] || [];
    if (!allowed.includes('refund_requested')) {
      return res.status(400).json({ error: `当前状态 ${order.status} 不允许申请退款` });
    }
    const { reason } = req.body;
    const newHistory = appendStatusHistory(order.status_history, 'refund_requested');
    db.prepare("UPDATE guide_service_orders SET status='refund_requested', status_history=?, refund_reason=?, updated_at=CURRENT_TIMESTAMP WHERE id=?")
      .run(newHistory, reason || '', order.id);
    res.json({ success: true, status: 'refund_requested' });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
