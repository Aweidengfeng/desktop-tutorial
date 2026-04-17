const express = require('express');
const router = express.Router();
const db = require('../db/database');
const auth = require('../middleware/auth');

// GET /api/insurance/plans
router.get('/plans', (req, res) => {
  try {
    const plans = db.prepare(`SELECT * FROM insurance_plans ORDER BY price_cny ASC`).all();
    res.json(plans);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/insurance/plans/:id
router.get('/plans/:id', (req, res) => {
  try {
    const plan = db.prepare(`SELECT * FROM insurance_plans WHERE id = ?`).get(req.params.id);
    if (!plan) return res.status(404).json({ error: '保险方案不存在' });
    res.json(plan);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/insurance/inquire — 提交购买询价
router.post('/inquire', auth, (req, res) => {
  try {
    const { name, phone, plan_id, peak_name, departure_date } = req.body;
    if (!name || !phone || !plan_id) {
      return res.status(400).json({ error: '请填写姓名、电话和保险方案' });
    }
    const plan = db.prepare('SELECT * FROM insurance_plans WHERE id = ?').get(plan_id);
    if (!plan) return res.status(404).json({ error: '保险方案不存在' });

    const result = db.prepare(`
      INSERT INTO insurance_inquiries (user_id, plan_id, plan_name, name, phone, peak_name, departure_date)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(req.user.id, plan_id, plan.name, name, phone, peak_name || '', departure_date || '');

    res.json({
      success: true,
      id: result.lastInsertRowid,
      message: '询价已提交，我们将在24小时内联系您',
    });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
