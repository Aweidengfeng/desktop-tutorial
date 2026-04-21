/**
 * @file activityOrders.js
 * @description 俱乐部活动报名订单路由
 *
 * 接口概览：
 *   GET  /api/activity-orders/my                    当前用户的活动订单列表
 *   POST /api/activity-orders/:id/pay               模拟支付（pending_payment → paid）
 *   POST /api/activity-orders/:id/cancel            取消订单
 *   POST /api/activity-orders/:id/refund-request    发起退款申请
 */

const express = require('express');
const router = express.Router();
const db = require('../db/database');
const auth = require('../middleware/auth');
const { VALID_TRANSITIONS, appendStatusHistory } = require('./orderStateMachine');

// GET /api/activity-orders/my — 我的活动订单
router.get('/my', auth, (req, res) => {
  try {
    const orders = db.prepare(`
      SELECT ao.*, ca.title as activity_title, ca.cover as activity_cover,
             ca.start_date, ca.end_date, ca.mountain,
             c.name as club_name, c.cover as club_cover
      FROM activity_orders ao
      LEFT JOIN club_activities ca ON ca.id = ao.activity_id
      LEFT JOIN clubs c ON c.id = ao.club_id
      WHERE ao.user_id = ?
      ORDER BY ao.created_at DESC
    `).all(req.user.id);
    res.json(orders);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/activity-orders/:id/pay — 模拟支付
router.post('/:id/pay', auth, (req, res) => {
  try {
    const order = db.prepare('SELECT * FROM activity_orders WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);
    if (!order) return res.status(404).json({ error: '订单不存在' });
    if (order.status !== 'pending_payment') {
      return res.status(400).json({ error: `订单状态为 ${order.status}，无法支付` });
    }
    const newHistory = appendStatusHistory(order.status_history, 'paid');
    db.prepare("UPDATE activity_orders SET status='paid', status_history=?, updated_at=CURRENT_TIMESTAMP WHERE id=?")
      .run(newHistory, order.id);
    // 通知用户付款成功
    try {
      const act = db.prepare('SELECT title FROM club_activities WHERE id = ?').get(order.activity_id);
      if (act) {
        db.prepare("INSERT INTO notifications (user_id, type, content, related_id) VALUES (?, 'activity_paid', ?, ?)")
          .run(order.user_id, `【支付成功】${act.title} 报名费已支付，订单号：${order.order_no}`, order.id);
      }
    } catch(e) {}
    res.json({ success: true, status: 'paid', order_no: order.order_no });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/activity-orders/:id/cancel — 取消订单
router.post('/:id/cancel', auth, (req, res) => {
  try {
    const order = db.prepare('SELECT * FROM activity_orders WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);
    if (!order) return res.status(404).json({ error: '订单不存在' });
    const allowed = VALID_TRANSITIONS[order.status] || [];
    if (!allowed.includes('cancelled')) {
      return res.status(400).json({ error: `当前状态 ${order.status} 不允许取消` });
    }
    const newHistory = appendStatusHistory(order.status_history, 'cancelled');
    db.prepare("UPDATE activity_orders SET status='cancelled', status_history=?, updated_at=CURRENT_TIMESTAMP WHERE id=?")
      .run(newHistory, order.id);
    // 退回名额
    db.prepare('UPDATE club_activities SET current_members = MAX(0, current_members - 1) WHERE id = ?')
      .run(order.activity_id);
    try {
      const act = db.prepare('SELECT title FROM club_activities WHERE id = ?').get(order.activity_id);
      if (act) {
        db.prepare("INSERT INTO notifications (user_id, type, content, related_id) VALUES (?, 'activity_cancelled', ?, ?)")
          .run(order.user_id, `【订单取消】${act.title} 报名订单已取消，订单号：${order.order_no}`, order.id);
      }
    } catch(e) {}
    res.json({ success: true, status: 'cancelled' });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/activity-orders/:id/refund-request — 申请退款
router.post('/:id/refund-request', auth, (req, res) => {
  try {
    const order = db.prepare('SELECT * FROM activity_orders WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);
    if (!order) return res.status(404).json({ error: '订单不存在' });
    const allowed = VALID_TRANSITIONS[order.status] || [];
    if (!allowed.includes('refund_requested')) {
      return res.status(400).json({ error: `当前状态 ${order.status} 不允许申请退款` });
    }
    const { reason } = req.body;
    const newHistory = appendStatusHistory(order.status_history, 'refund_requested');
    db.prepare("UPDATE activity_orders SET status='refund_requested', status_history=?, refund_reason=?, updated_at=CURRENT_TIMESTAMP WHERE id=?")
      .run(newHistory, reason || '', order.id);
    res.json({ success: true, status: 'refund_requested' });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
