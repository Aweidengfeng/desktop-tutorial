const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const auth = require('../middleware/auth');
const { sendPushNotification, PUSH_ENABLED } = require('../middleware/webPush');

// GET /api/push/vapid-public-key — 返回 VAPID 公钥
router.get('/vapid-public-key', (req, res) => {
  if (!PUSH_ENABLED) return res.json({ enabled: false });
  res.json({ enabled: true, publicKey: process.env.VAPID_PUBLIC_KEY });
});

// POST /api/push/subscribe — 保存订阅
router.post('/subscribe', auth, async (req, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription?.endpoint) return res.status(400).json({ error: '无效订阅' });
    const subJson = JSON.stringify(subscription);
    // 存入 users 表的 settings JSON 字段
    const [user] = await prisma.$queryRaw`SELECT settings FROM users WHERE id = ${req.user.id}`;
    const settings = JSON.parse(user?.settings || '{}');
    settings.pushSubscription = subJson;
    await prisma.$executeRaw`UPDATE users SET settings = ${JSON.stringify(settings)} WHERE id = ${req.user.id}`;
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '订阅保存失败' });
  }
});

// POST /api/push/unsubscribe — 取消订阅
router.post('/unsubscribe', auth, async (req, res) => {
  try {
    const [user] = await prisma.$queryRaw`SELECT settings FROM users WHERE id = ${req.user.id}`;
    const settings = JSON.parse(user?.settings || '{}');
    delete settings.pushSubscription;
    await prisma.$executeRaw`UPDATE users SET settings = ${JSON.stringify(settings)} WHERE id = ${req.user.id}`;
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '取消订阅失败' });
  }
});

// POST /api/push/test — 发送测试推送（仅开发/测试用）
router.post('/test', auth, async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') return res.status(403).json({ error: '生产环境不可用' });
    const [user] = await prisma.$queryRaw`SELECT settings FROM users WHERE id = ${req.user.id}`;
    const settings = JSON.parse(user?.settings || '{}');
    if (!settings.pushSubscription) return res.status(400).json({ error: '未订阅推送' });
    const result = await sendPushNotification(JSON.parse(settings.pushSubscription), {
      title: '🏔️ SummitLink 测试推送',
      body: '推送通知工作正常！',
      url: '/',
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: '发送失败' });
  }
});

module.exports = router;
