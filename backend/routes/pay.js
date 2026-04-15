const express = require('express');
const router = express.Router();
const db = require('../db/database');

// POST /api/pay/create
router.post('/create', (req, res) => {
  try {
    const { amount, method, orderId } = req.body;
    const orderNo = 'SL' + Date.now();
    db.prepare(`
      INSERT INTO orders (order_no, amount, method, status)
      VALUES (?, ?, ?, 'pending')
    `).run(orderNo, amount, method || 'alipay');
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
