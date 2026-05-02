const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const auth = require('../middleware/auth');
const rateLimit = require('express-rate-limit');
const { askCoach, AI_ENABLED } = require('../middleware/aiCoach');

const coachLimiter = rateLimit({
  windowMs: 60 * 1000, max: 20,
  message: { error: 'AI 教练请求过于频繁，请稍后再试' },
  standardHeaders: true, legacyHeaders: false,
});

// GET /api/coach/status — AI 教练状态
router.get('/status', (req, res) => {
  res.json({ enabled: true, ai_online: AI_ENABLED, name: '峰岭', version: '1.0' });
});

// POST /api/coach/chat — 与 AI 教练对话
router.post('/chat', coachLimiter, auth, async (req, res) => {
  try {
    const { messages, peak_id } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: '消息不能为空' });
    }
    if (messages.length > 20) {
      return res.status(400).json({ error: '对话过长，请开始新对话' });
    }

    // 构建用户上下文（容错处理）
    let context = '';
    try {
      const [user] = await prisma.$queryRaw`
        SELECT name, level, summits, expeditions FROM users WHERE id = ${req.user.id}
      `;
      if (user) {
        context = `用户：${user.name}，等级：${user.level}，登顶次数：${user.summits}，远征次数：${user.expeditions}`;
      }
    } catch (dbErr) {
      // 上下文获取失败时降级（不影响 AI 回复）
    }
    if (peak_id) {
      try {
        const [peak] = await prisma.$queryRaw`
          SELECT name, altitude, difficulty, country FROM peaks WHERE id = ${parseInt(peak_id)}
        `;
        if (peak) context += `，目标山峰：${peak.name}（${peak.altitude}m，${peak.difficulty}，${peak.country}）`;
      } catch (dbErr) {
        // 忽略
      }
    }

    const { reply, engine } = await askCoach(messages, context);
    res.json({ reply, engine, timestamp: new Date().toISOString() });
  } catch (e) {
    console.error('[coach]', e.message);
    res.status(500).json({ error: 'AI 教练暂时不可用，请稍后重试' });
  }
});

// GET /api/coach/tips — 每日训练提示（无需登录）
router.get('/tips', async (req, res) => {
  const tips = [
    { category: '力量训练', tip: '深蹲是登山训练的核心动作，每周3组×12次，逐步增加负重。', icon: '💪' },
    { category: '有氧耐力', tip: '每周进行2次长距离有氧（≥60分钟），模拟登山持续运动强度。', icon: '🏃' },
    { category: '高海拔适应', tip: '提前4-6周开始海拔适应训练，"爬高睡低"原则至关重要。', icon: '🏔️' },
    { category: '装备检查', tip: '出发前48小时完成全套装备检查，确保冰爪与登山靴匹配。', icon: '🎒' },
    { category: '营养补给', tip: '高海拔活动时碳水比例提升到60%，保持每小时补充200ml水分。', icon: '🍎' },
    { category: '心理训练', tip: '可视化训练：每天花10分钟在脑中完整模拟登顶路线。', icon: '🧠' },
  ];
  const today = new Date().getDate() % tips.length;
  res.json({ tip: tips[today], all: tips });
});

module.exports = router;
