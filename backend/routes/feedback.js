const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const prisma = require('../db/prisma');
const { getJwtSecret } = require('../utils/jwtSecret');

const feedbackLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '提交过于频繁，请稍后再试' },
});

// POST /api/feedback — 提交反馈（登录可选）
router.post('/', feedbackLimiter, async (req, res) => {
  // 尝试从 JWT 获取当前用户（可选）
  let userId = null;
  try {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const jwt = require('jsonwebtoken');
      const token = authHeader.slice(7);
      const decoded = jwt.verify(token, getJwtSecret());
      userId = decoded.id || null;
    }
  } catch (_) {}

  const { type = 'suggestion', content, contact } = req.body || {};
  if (!content || String(content).trim().length === 0) {
    return res.status(400).json({ error: '反馈内容不能为空' });
  }
  if (String(content).length > 2000) {
    return res.status(400).json({ error: '反馈内容过长（最多 2000 字）' });
  }

  try {
    const record = await prisma.feedback.create({
      data: {
        userId,
        type: String(type).slice(0, 50),
        content: String(content).trim(),
        contact: contact ? String(contact).slice(0, 200) : null,
      },
    });
    return res.json({ success: true, id: record.id });
  } catch (e) {
    console.error('[feedback] insert error:', e.message);
    return res.status(500).json({ error: '提交失败，请稍后重试' });
  }
});

module.exports = router;
