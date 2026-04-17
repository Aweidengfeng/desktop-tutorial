const express = require('express');
const router = express.Router();
const db = require('../db/database');
const auth = require('../middleware/auth');

// POST /api/customs — 提交定制攀登申请（需登录）
router.post('/', auth, (req, res) => {
  try {
    const { peak_name, preferred_date, group_size, notes, contact_phone } = req.body;
    if (!peak_name || !contact_phone) {
      return res.status(400).json({ error: '山峰名称和联系电话不能为空' });
    }
    const result = db.prepare(`
      INSERT INTO custom_orders (user_id, peak_name, preferred_date, group_size, notes, contact_phone)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(req.user.id, peak_name, preferred_date || null, group_size || 1, notes || null, contact_phone);
    const order = db.prepare('SELECT * FROM custom_orders WHERE id = ?').get(result.lastInsertRowid);
    res.json(order);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/customs — 获取当前用户的定制申请列表（需登录）
router.get('/', auth, (req, res) => {
  try {
    const orders = db.prepare(`
      SELECT * FROM custom_orders WHERE user_id = ? ORDER BY created_at DESC
    `).all(req.user.id);
    res.json(orders);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/customs/:id — 获取定制申请详情（需登录）
router.get('/:id', auth, (req, res) => {
  try {
    const order = db.prepare(`
      SELECT * FROM custom_orders WHERE id = ? AND user_id = ?
    `).get(req.params.id, req.user.id);
    if (!order) return res.status(404).json({ error: '申请不存在' });
    res.json(order);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/customs/:id/cancel — 取消定制申请（需登录）
router.put('/:id/cancel', auth, (req, res) => {
  try {
    const order = db.prepare(`
      SELECT * FROM custom_orders WHERE id = ? AND user_id = ?
    `).get(req.params.id, req.user.id);
    if (!order) return res.status(404).json({ error: '申请不存在' });
    if (order.status === 'cancelled') {
      return res.status(400).json({ error: '申请已取消' });
    }
    db.prepare(`UPDATE custom_orders SET status = 'cancelled' WHERE id = ?`).run(req.params.id);
    res.json({ success: true, message: '申请已取消' });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
