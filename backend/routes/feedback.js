const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const prisma = require('../db/prisma');
const auth = require('../middleware/auth');

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
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'summitlink_dev_secret');
      userId = decoded.id || null;
    }
  } catch (_) {}

  const { type = 'general', content, contact } = req.body || {};
  if (!content || String(content).trim().length === 0) {
    return res.status(400).json({ error: '反馈内容不能为空' });
  }
  if (String(content).length > 2000) {
    return res.status(400).json({ error: '反馈内容过长（最多 2000 字）' });
  }

  try {
    const result = await prisma.$queryRawUnsafe(
      `INSERT INTO feedback (user_id, type, content, contact, created_at) VALUES (?, ?, ?, ?, datetime('now')) RETURNING id`,
      userId,
      String(type).slice(0, 50),
      String(content).trim(),
      contact ? String(contact).slice(0, 200) : null,
    );
    const id = Array.isArray(result) && result.length > 0 ? result[0].id : null;
    return res.json({ success: true, id });
  } catch (e) {
    // SQLite 不支持 RETURNING，fallback
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO feedback (user_id, type, content, contact, created_at) VALUES (?, ?, ?, ?, datetime('now'))`,
        userId,
        String(type).slice(0, 50),
        String(content).trim(),
        contact ? String(contact).slice(0, 200) : null,
      );
      return res.json({ success: true });
    } catch (e2) {
      console.error('[feedback] insert error:', e2.message);
      return res.status(500).json({ error: '提交失败，请稍后重试' });
    }
  }
});

module.exports = router;
