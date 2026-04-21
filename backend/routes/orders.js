const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const db = require('../db/database');
const auth = require('../middleware/auth');
const { VALID_TRANSITIONS, appendStatusHistory } = require('./orderStateMachine');

const ordersLimiter = rateLimit({ windowMs: 60*1000, max: 60 });
const orderWriteLimiter = rateLimit({ windowMs: 60*1000, max: 20 });

function createNotification(userId, type, title, body, link) {
  try {
    db.prepare('INSERT INTO notifications (user_id, type, title, body, link) VALUES (?, ?, ?, ?, ?)').run(userId, type, title, body, link);
  } catch(e) {}
}

// GET /api/orders - 我的订单
router.get('/', ordersLimiter, auth, (req, res) => {
  try {
    const { status } = req.query;
    let sql = 'SELECT * FROM expedition_orders WHERE user_id = ?';
    const params = [req.user.id];
    if (status) { sql += ' AND status = ?'; params.push(status); }
    sql += ' ORDER BY created_at DESC';
    res.json(db.prepare(sql).all(...params));
  } catch(e) { res.status(500).json({ error: '服务器错误' }); }
});

// GET /api/orders/:id
router.get('/:id', ordersLimiter, auth, (req, res) => {
  try {
    const order = db.prepare('SELECT * FROM expedition_orders WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!order) return res.status(404).json({ error: '订单不存在' });
    res.json(order);
  } catch(e) { res.status(500).json({ error: '服务器错误' }); }
});

// POST /api/orders/:id/pay
router.post('/:id/pay', orderWriteLimiter, auth, (req, res) => {
  try {
    const order = db.prepare('SELECT * FROM expedition_orders WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!order) return res.status(404).json({ error: '订单不存在' });
    if (order.status !== 'pending_payment') return res.status(400).json({ error: '订单状态不允许支付' });
    const newHistory = appendStatusHistory(order.status_history, 'paid');
    db.prepare('UPDATE expedition_orders SET status = ?, status_history = ? WHERE id = ?').run('paid', newHistory, order.id);
    createNotification(req.user.id, 'order', '支付成功', `订单 #${order.id} 已支付`, `/orders/${order.id}`);
    res.json({ success: true, status: 'paid' });
  } catch(e) { res.status(500).json({ error: '服务器错误' }); }
});

// POST /api/orders/:id/cancel
router.post('/:id/cancel', orderWriteLimiter, auth, (req, res) => {
  try {
    const order = db.prepare('SELECT * FROM expedition_orders WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!order) return res.status(404).json({ error: '订单不存在' });
    if (!VALID_TRANSITIONS[order.status] || !VALID_TRANSITIONS[order.status].includes('cancelled')) {
      return res.status(400).json({ error: '当前状态不允许取消' });
    }
    const newHistory = appendStatusHistory(order.status_history, 'cancelled');
    db.prepare('UPDATE expedition_orders SET status = ?, status_history = ? WHERE id = ?').run('cancelled', newHistory, order.id);
    res.json({ success: true, status: 'cancelled' });
  } catch(e) { res.status(500).json({ error: '服务器错误' }); }
});

// POST /api/orders/:id/refund-request
router.post('/:id/refund-request', orderWriteLimiter, auth, (req, res) => {
  try {
    const { reason } = req.body;
    const order = db.prepare('SELECT * FROM expedition_orders WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!order) return res.status(404).json({ error: '订单不存在' });
    if (!VALID_TRANSITIONS[order.status] || !VALID_TRANSITIONS[order.status].includes('refund_requested')) {
      return res.status(400).json({ error: '当前状态不允许申请退款' });
    }
    const newHistory = appendStatusHistory(order.status_history, 'refund_requested');
    db.prepare('UPDATE expedition_orders SET status = ?, status_history = ?, refund_reason = ? WHERE id = ?').run('refund_requested', newHistory, reason || '', order.id);
    res.json({ success: true, status: 'refund_requested' });
  } catch(e) { res.status(500).json({ error: '服务器错误' }); }
});

module.exports = router;
