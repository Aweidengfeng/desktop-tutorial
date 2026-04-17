const express = require('express');
const router = express.Router();
const db = require('../db/database');

// POST /api/pay/create
router.post('/create', (req, res) => {
  try {
    const { amount, method } = req.body;
    const orderNo = 'SL' + Date.now();
    let userId = null;
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const jwt = require('jsonwebtoken');
        const secret = process.env.JWT_SECRET || 'summitlink_dev_secret_do_not_use_in_production';
        const decoded = jwt.verify(authHeader.split(' ')[1], secret);
        userId = decoded.id;
      } catch (e) { /* no-op */ }
    }
    db.prepare(`
      INSERT INTO orders (user_id, order_no, amount, method, status)
      VALUES (?, ?, ?, ?, 'pending')
    `).run(userId, orderNo, amount, method || 'alipay');
    res.json({
      success: true,
      orderNo,
      message: '订单创建成功（演示模式，实际支付需对接SDK）',
    });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/pay/status/:orderNo
router.get('/status/:orderNo', (req, res) => {
  try {
    const order = db.prepare('SELECT * FROM orders WHERE order_no = ?').get(req.params.orderNo);
    if (!order) return res.status(404).json({ error: '订单不存在' });
    res.json({ orderNo: order.order_no, amount: order.amount, status: order.status });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
