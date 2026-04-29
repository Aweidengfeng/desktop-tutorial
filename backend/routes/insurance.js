const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const auth = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

const insuranceReadLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false, message: { error: '请求过于频繁' } });
const insuranceWriteLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false, message: { error: '操作过于频繁' } });

// GET /api/insurance/plans
router.get('/plans', insuranceReadLimiter, async (req, res) => {
  try {
    const plans = await prisma.$queryRaw`SELECT * FROM insurance_plans ORDER BY price_cny ASC`;
    res.json(plans);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/insurance/plans/:id
router.get('/plans/:id', insuranceReadLimiter, async (req, res) => {
  try {
    const plan = (await prisma.$queryRaw`SELECT * FROM insurance_plans WHERE id = ${Number(req.params.id)}`)[0];
    if (!plan) return res.status(404).json({ error: '保险方案不存在' });
    res.json(plan);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/insurance/inquire — 提交购买询价
router.post('/inquire', insuranceWriteLimiter, auth, async (req, res) => {
  try {
    const { name, phone, plan_id, peak_name, departure_date } = req.body;
    if (!name || !phone || !plan_id) {
      return res.status(400).json({ error: '请填写姓名、电话和保险方案' });
    }
    const plan = (await prisma.$queryRaw`SELECT * FROM insurance_plans WHERE id = ${plan_id}`)[0];
    if (!plan) return res.status(404).json({ error: '保险方案不存在' });

    const [{ id: newInquiryId }] = await prisma.$queryRaw`
      INSERT INTO insurance_inquiries (user_id, plan_id, plan_name, name, phone, peak_name, departure_date)
      VALUES (${req.user.id}, ${plan_id}, ${plan.name}, ${name}, ${phone}, ${peak_name || ''}, ${departure_date || ''})
      RETURNING id
    `;
    const id = Number(newInquiryId);

    res.json({
      success: true,
      id,
      message: '询价已提交，我们将在24小时内联系您',
    });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
