const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const prisma = require('../db/prisma');
const auth = require('../middleware/auth');

// 举报合规：满足 Apple App Store Guideline 1.2（UGC 举报机制）
// 允许的举报对象类型与原因（白名单校验，防止注入脏数据）
const TARGET_TYPES = new Set(['post', 'comment', 'user', 'guide', 'club', 'expedition', 'message', 'review']);
const REASONS = new Set(['spam', 'abuse', 'sexual', 'violence', 'illegal', 'harassment', 'hate', 'fraud', 'other']);

const reportLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '举报过于频繁，请稍后再试' },
});

// POST /api/reports — 提交举报（需登录）
router.post('/', reportLimiter, auth, async (req, res) => {
  const { targetType, targetId, reason, detail } = req.body || {};

  if (!targetType || !TARGET_TYPES.has(String(targetType))) {
    return res.status(400).json({ error: '举报对象类型无效' });
  }
  const tid = parseInt(targetId, 10);
  if (!Number.isInteger(tid) || tid <= 0) {
    return res.status(400).json({ error: '举报对象 ID 无效' });
  }
  if (!reason || !REASONS.has(String(reason))) {
    return res.status(400).json({ error: '举报原因无效' });
  }
  if (detail != null && String(detail).length > 1000) {
    return res.status(400).json({ error: '补充说明过长（最多 1000 字）' });
  }

  try {
    const record = await prisma.report.create({
      data: {
        reporterId: req.user.id,
        targetType: String(targetType),
        targetId: tid,
        reason: String(reason),
        detail: detail ? String(detail).trim() : null,
        status: 'pending',
      },
    });
    return res.json({ success: true, id: record.id, status: record.status });
  } catch (e) {
    console.error('[reports] insert error:', e.message);
    return res.status(500).json({ error: '提交失败，请稍后重试' });
  }
});

// GET /api/reports/mine — 查看自己提交的举报及处理状态（需登录）
router.get('/mine', auth, async (req, res) => {
  try {
    const reports = await prisma.report.findMany({
      where: { reporterId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        targetType: true,
        targetId: true,
        reason: true,
        status: true,
        createdAt: true,
        handledAt: true,
      },
    });
    return res.json({ reports });
  } catch (e) {
    console.error('[reports] list mine error:', e.message);
    return res.status(500).json({ error: '获取失败，请稍后重试' });
  }
});

module.exports = router;
