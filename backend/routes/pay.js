const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const db = require('../db/database');

const payLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '操作过于频繁，请稍后再试' },
});

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

// POST /api/pay/escrow — 资金托管（用户付款后资金进入平台托管）
router.post('/escrow', payLimiter, (req, res) => {
  try {
    const { order_type, order_id, order_no, total_amount, owner_type, owner_id, commission_rate = 0.15 } = req.body;
    if (!order_type || !order_id || !total_amount) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    const platform_fee = Math.round(total_amount * commission_rate * 100) / 100;
    const owner_income = Math.round((total_amount - platform_fee) * 100) / 100;

    const existing = db.prepare('SELECT id FROM platform_transactions WHERE order_type = ? AND order_id = ?').get(order_type, order_id);
    if (existing) {
      return res.json({ success: true, message: '已存在托管记录', transaction_id: existing.id });
    }

    const result = db.prepare(`
      INSERT INTO platform_transactions (order_type, order_id, order_no, owner_type, owner_id, total_amount, platform_fee, owner_income, commission_rate, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'held')
    `).run(order_type, order_id, order_no || null, owner_type || null, owner_id || null, total_amount, platform_fee, owner_income, commission_rate);

    res.json({
      success: true,
      transaction_id: result.lastInsertRowid,
      total_amount,
      platform_fee,
      owner_income,
      commission_rate,
      status: 'held',
      message: '资金已托管至平台'
    });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/pay/settle — 平台结算（确认完成后释放资金给商家/向导）
router.post('/settle', payLimiter, (req, res) => {
  try {
    const { transaction_id } = req.body;
    if (!transaction_id) return res.status(400).json({ error: '缺少 transaction_id' });

    const tx = db.prepare('SELECT * FROM platform_transactions WHERE id = ?').get(transaction_id);
    if (!tx) return res.status(404).json({ error: '托管记录不存在' });
    if (tx.status === 'settled') return res.status(400).json({ error: '该笔资金已结算' });

    const now = new Date().toISOString();
    db.prepare('UPDATE platform_transactions SET status = ?, settled_at = ? WHERE id = ?').run('settled', now, transaction_id);

    res.json({
      success: true,
      message: `结算成功，${tx.owner_income} 元将打款至 ${tx.owner_type} (ID: ${tx.owner_id})`,
      owner_income: tx.owner_income,
      platform_fee: tx.platform_fee
    });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/pay/withdraw — 发起提现申请
router.post('/withdraw', payLimiter, (req, res) => {
  try {
    const { owner_type, owner_id, amount, account_type = 'bank', account_info } = req.body;
    if (!owner_type || !owner_id || !amount) return res.status(400).json({ error: '缺少必要参数' });
    if (amount < 100) return res.status(400).json({ error: '最低提现金额为100元' });

    const fee = amount >= 1000 ? 0 : 2;
    const actual_amount = amount - fee;

    const result = db.prepare(`
      INSERT INTO withdrawal_requests (owner_type, owner_id, amount, fee, actual_amount, account_type, account_info, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
    `).run(owner_type, owner_id, amount, fee, actual_amount, account_type, JSON.stringify(account_info || {}));

    res.json({
      success: true,
      request_id: result.lastInsertRowid,
      amount,
      fee,
      actual_amount,
      status: 'pending',
      message: '提现申请已提交，1-3个工作日内处理'
    });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/pay/transactions — 查询资金流水
router.get('/transactions', payLimiter, (req, res) => {
  try {
    const { owner_type, owner_id, status } = req.query;
    if (!owner_type || !owner_id) return res.status(400).json({ error: '缺少 owner_type 和 owner_id' });

    let sql = 'SELECT * FROM platform_transactions WHERE owner_type = ? AND owner_id = ?';
    const params = [owner_type, parseInt(owner_id)];
    if (status) { sql += ' AND status = ?'; params.push(status); }
    sql += ' ORDER BY created_at DESC LIMIT 50';

    const transactions = db.prepare(sql).all(...params);

    const summary = db.prepare(`
      SELECT
        SUM(CASE WHEN status = 'held' THEN owner_income ELSE 0 END) as pending_amount,
        SUM(CASE WHEN status = 'settled' THEN owner_income ELSE 0 END) as settled_amount,
        COUNT(*) as total_orders
      FROM platform_transactions WHERE owner_type = ? AND owner_id = ?
    `).get(owner_type, parseInt(owner_id));

    res.json({ transactions, summary });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
