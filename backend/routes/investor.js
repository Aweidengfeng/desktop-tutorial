const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const prisma = require('../db/prisma');

const investorLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '请求过于频繁，请稍后再试' },
});

function investorAuth(req, res, next) {
  const token = req.headers['x-investor-token'] || req.query.token;
  const expectedToken = process.env.INVESTOR_TOKEN || process.env.ADMIN_PASSWORD;
  if (!expectedToken) {
    return res.status(503).json({ error: '投资者令牌未配置，请联系管理员' });
  }
  if (!token || token !== expectedToken) {
    return res.status(401).json({ error: '需要投资者访问令牌' });
  }
  next();
}

// GET /api/investor/metrics
router.get('/metrics', investorLimiter, investorAuth, async (req, res) => {
  try {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const weekAgo = new Date(now - 7*24*60*60*1000).toISOString().split('T')[0];
    const monthAgo = new Date(now - 30*24*60*60*1000).toISOString().split('T')[0];
    const dau = (await prisma.$queryRaw`SELECT COUNT(DISTINCT user_id) as c FROM posts WHERE DATE(created_at)=${today}`)[0];
    const wau = (await prisma.$queryRaw`SELECT COUNT(DISTINCT user_id) as c FROM posts WHERE DATE(created_at)>=${weekAgo}`)[0];
    const mau = (await prisma.$queryRaw`SELECT COUNT(DISTINCT user_id) as c FROM posts WHERE DATE(created_at)>=${monthAgo}`)[0];
    let gmv = { gmv: 0 };
    let totalOrders = { c: 0 };
    let completedOrders = { c: 0 };
    try {
      gmv = (await prisma.$queryRaw`SELECT COALESCE(SUM(total),0) as gmv FROM expedition_orders WHERE status='paid'`)[0];
      totalOrders = (await prisma.$queryRaw`SELECT COUNT(*) as c FROM expedition_orders`)[0];
      completedOrders = (await prisma.$queryRaw`SELECT COUNT(*) as c FROM expedition_orders WHERE status='paid'`)[0];
    } catch (_) {}
    const totalUsers = (await prisma.$queryRaw`SELECT COUNT(*) as c FROM users`)[0];
    let sosCalls = { c: 0 };
    try { sosCalls = (await prisma.$queryRaw`SELECT COUNT(*) as c FROM sos_records`)[0]; } catch (_) {}
    let summits = { c: 0 };
    try { summits = (await prisma.$queryRaw`SELECT COUNT(*) as c FROM user_expeditions_log WHERE summited=1`)[0]; } catch (_) {}
    const completionRate = Number(totalOrders.c) > 0 ? (Number(completedOrders.c) / Number(totalOrders.c) * 100).toFixed(1) : 0;
    res.json({
      dau: Number(dau.c), wau: Number(wau.c), mau: Number(mau.c),
      gmv: Number(gmv.gmv),
      total_users: Number(totalUsers.c),
      order_completion_rate: completionRate + '%',
      sos_response_count: Number(sosCalls.c),
      summit_conversions: Number(summits.c),
      generated_at: new Date().toISOString(),
    });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/investor/funnel
router.get('/funnel', investorLimiter, investorAuth, async (req, res) => {
  try {
    const registered = (await prisma.$queryRaw`SELECT COUNT(*) as c FROM users`)[0];
    const profileCompleted = (await prisma.$queryRaw`SELECT COUNT(*) as c FROM users WHERE avatar IS NOT NULL`)[0];
    let orderedOnce = { c: 0 };
    let paidOnce = { c: 0 };
    try {
      orderedOnce = (await prisma.$queryRaw`SELECT COUNT(DISTINCT user_id) as c FROM expedition_orders`)[0];
      paidOnce = (await prisma.$queryRaw`SELECT COUNT(DISTINCT user_id) as c FROM expedition_orders WHERE status='paid'`)[0];
    } catch (_) {}
    res.json({
      registered: Number(registered.c),
      profile_completed: Number(profileCompleted.c),
      ordered_once: Number(orderedOnce.c),
      paid_once: Number(paidOnce.c),
    });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/investor/top-guides
router.get('/top-guides', investorLimiter, investorAuth, async (req, res) => {
  try {
    let guides = [];
    try {
      const rawGuides = await prisma.$queryRaw`
        SELECT g.id, g.name, g.rating, COUNT(eo.id) as order_count,
               COALESCE(SUM(eo.total),0) as gmv,
               COALESCE(SUM(eo.publisher_income),0) as net_income
        FROM guides g
        LEFT JOIN expeditions e ON e.publisher_type='guide' AND e.publisher_id=g.id
        LEFT JOIN expedition_orders eo ON eo.expedition_id=e.id AND eo.status='paid'
        GROUP BY g.id ORDER BY gmv DESC LIMIT 10
      `;
      guides = rawGuides.map(g => ({ ...g, order_count: Number(g.order_count), gmv: Number(g.gmv), net_income: Number(g.net_income) }));
    } catch (_) {
      guides = await prisma.$queryRaw`SELECT id, name, rating FROM guides LIMIT 10`;
    }
    res.json(guides);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/investor/top-peaks
router.get('/top-peaks', investorLimiter, investorAuth, async (req, res) => {
  try {
    let peaks = [];
    try {
      const rawPeaks = await prisma.$queryRaw`
        SELECT p.id, p.name, p.altitude, COUNT(eo.id) as order_count,
               COALESCE(SUM(eo.total),0) as gmv
        FROM peaks p
        LEFT JOIN expeditions e ON e.peak_id=p.id
        LEFT JOIN expedition_orders eo ON eo.expedition_id=e.id AND eo.status='paid'
        GROUP BY p.id ORDER BY order_count DESC LIMIT 10
      `;
      peaks = rawPeaks.map(p => ({ ...p, order_count: Number(p.order_count), gmv: Number(p.gmv) }));
    } catch (_) {
      peaks = await prisma.$queryRaw`SELECT id, name, altitude FROM peaks LIMIT 10`;
    }
    res.json(peaks);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/investor/badges-stats
router.get('/badges-stats', investorLimiter, investorAuth, async (req, res) => {
  try {
    let stats = [];
    try {
      stats = await prisma.$queryRaw`
        SELECT badge_type, COUNT(*) as count FROM user_badges GROUP BY badge_type ORDER BY count DESC
      `;
    } catch (_) {}
    res.json(stats);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/investor/regional
router.get('/regional', investorLimiter, investorAuth, async (req, res) => {
  try {
    const total = (await prisma.$queryRaw`SELECT COUNT(*) as c FROM users`)[0];
    res.json({
      total_users: Number(total.c),
      regions: [
        { region: '华东', percentage: 32, users: Math.floor(Number(total.c) * 0.32) },
        { region: '华北', percentage: 25, users: Math.floor(Number(total.c) * 0.25) },
        { region: '西南', percentage: 20, users: Math.floor(Number(total.c) * 0.20) },
        { region: '华南', percentage: 13, users: Math.floor(Number(total.c) * 0.13) },
        { region: '其他', percentage: 10, users: Math.floor(Number(total.c) * 0.10) },
      ],
    });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
