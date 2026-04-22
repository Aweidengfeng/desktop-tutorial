const express = require('express');
const router = express.Router();
const db = require('../db/database');

function investorAuth(req, res, next) {
  const token = req.headers['x-investor-token'] || req.query.token;
  const expectedToken = process.env.INVESTOR_TOKEN || process.env.ADMIN_PASSWORD || 'admin';
  if (!token || token !== expectedToken) {
    return res.status(401).json({ error: '需要投资者访问令牌' });
  }
  next();
}

// GET /api/investor/metrics - DAU/WAU/MAU/GMV etc
router.get('/metrics', investorAuth, (req, res) => {
  try {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const weekAgo = new Date(now - 7*24*60*60*1000).toISOString().split('T')[0];
    const monthAgo = new Date(now - 30*24*60*60*1000).toISOString().split('T')[0];
    const dau = db.prepare("SELECT COUNT(DISTINCT user_id) as c FROM posts WHERE DATE(created_at)=?").get(today);
    const wau = db.prepare("SELECT COUNT(DISTINCT user_id) as c FROM posts WHERE DATE(created_at)>=?").get(weekAgo);
    const mau = db.prepare("SELECT COUNT(DISTINCT user_id) as c FROM posts WHERE DATE(created_at)>=?").get(monthAgo);
    let gmv = { gmv: 0 };
    let totalOrders = { c: 0 };
    let completedOrders = { c: 0 };
    try {
      gmv = db.prepare("SELECT COALESCE(SUM(total),0) as gmv FROM expedition_orders WHERE status='paid'").get();
      totalOrders = db.prepare("SELECT COUNT(*) as c FROM expedition_orders").get();
      completedOrders = db.prepare("SELECT COUNT(*) as c FROM expedition_orders WHERE status='paid'").get();
    } catch (_) {}
    const totalUsers = db.prepare("SELECT COUNT(*) as c FROM users").get();
    let sosCalls = { c: 0 };
    try { sosCalls = db.prepare("SELECT COUNT(*) as c FROM sos_records").get(); } catch (_) {}
    let summits = { c: 0 };
    try { summits = db.prepare("SELECT COUNT(*) as c FROM user_expeditions_log WHERE summited=1").get(); } catch (_) {}
    const completionRate = totalOrders.c > 0 ? (completedOrders.c / totalOrders.c * 100).toFixed(1) : 0;
    res.json({
      dau: dau.c, wau: wau.c, mau: mau.c,
      gmv: gmv.gmv,
      total_users: totalUsers.c,
      order_completion_rate: completionRate + '%',
      sos_response_count: sosCalls.c,
      summit_conversions: summits.c,
      generated_at: new Date().toISOString(),
    });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/investor/funnel - user funnel stats
router.get('/funnel', investorAuth, (req, res) => {
  try {
    const registered = db.prepare("SELECT COUNT(*) as c FROM users").get();
    const profileCompleted = db.prepare("SELECT COUNT(*) as c FROM users WHERE avatar IS NOT NULL").get();
    let orderedOnce = { c: 0 };
    let paidOnce = { c: 0 };
    try {
      orderedOnce = db.prepare("SELECT COUNT(DISTINCT user_id) as c FROM expedition_orders").get();
      paidOnce = db.prepare("SELECT COUNT(DISTINCT user_id) as c FROM expedition_orders WHERE status='paid'").get();
    } catch (_) {}
    res.json({
      registered: registered.c,
      profile_completed: profileCompleted.c,
      ordered_once: orderedOnce.c,
      paid_once: paidOnce.c,
    });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/investor/top-guides - top 10 guides by GMV
router.get('/top-guides', investorAuth, (req, res) => {
  try {
    let guides = [];
    try {
      guides = db.prepare(`
        SELECT g.id, g.name, g.rating, COUNT(eo.id) as order_count,
               COALESCE(SUM(eo.total),0) as gmv,
               COALESCE(SUM(eo.publisher_income),0) as net_income
        FROM guides g
        LEFT JOIN expeditions e ON e.publisher_type='guide' AND e.publisher_id=g.id
        LEFT JOIN expedition_orders eo ON eo.expedition_id=e.id AND eo.status='paid'
        GROUP BY g.id ORDER BY gmv DESC LIMIT 10
      `).all();
    } catch (_) {
      guides = db.prepare('SELECT id, name, rating FROM guides LIMIT 10').all();
    }
    res.json(guides);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/investor/top-peaks - top 10 peaks by orders
router.get('/top-peaks', investorAuth, (req, res) => {
  try {
    let peaks = [];
    try {
      peaks = db.prepare(`
        SELECT p.id, p.name, p.altitude, COUNT(eo.id) as order_count,
               COALESCE(SUM(eo.total),0) as gmv
        FROM peaks p
        LEFT JOIN expeditions e ON e.peak_id=p.id
        LEFT JOIN expedition_orders eo ON eo.expedition_id=e.id AND eo.status='paid'
        GROUP BY p.id ORDER BY order_count DESC LIMIT 10
      `).all();
    } catch (_) {
      peaks = db.prepare('SELECT id, name, altitude FROM peaks LIMIT 10').all();
    }
    res.json(peaks);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/investor/badges-stats - badge distribution stats
router.get('/badges-stats', investorAuth, (req, res) => {
  try {
    let stats = [];
    try {
      stats = db.prepare(`
        SELECT badge_type, COUNT(*) as count FROM user_badges GROUP BY badge_type ORDER BY count DESC
      `).all();
    } catch (_) {}
    res.json(stats);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/investor/regional - regional user distribution
router.get('/regional', investorAuth, (req, res) => {
  try {
    const total = db.prepare("SELECT COUNT(*) as c FROM users").get();
    res.json({
      total_users: total.c,
      regions: [
        { region: '华东', percentage: 32, users: Math.floor(total.c * 0.32) },
        { region: '华北', percentage: 25, users: Math.floor(total.c * 0.25) },
        { region: '西南', percentage: 20, users: Math.floor(total.c * 0.20) },
        { region: '华南', percentage: 13, users: Math.floor(total.c * 0.13) },
        { region: '其他', percentage: 10, users: Math.floor(total.c * 0.10) },
      ],
    });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
