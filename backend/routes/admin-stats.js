/**
 * admin-stats.js — 管理后台数据大屏 API
 * 全部需要管理员权限
 */
const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const auth = require('../middleware/auth');

// 管理员鉴权中间件
const adminAuth = [auth, (req, res, next) => {
  if (!req.user?.isAdmin && !req.user?.is_admin) {
    return res.status(403).json({ error: '需要管理员权限' });
  }
  next();
}];

// GET /api/admin/stats/overview — 总览数据
router.get('/overview', adminAuth, async (req, res) => {
  try {
    const [
      usersTotal, usersToday, postsTotal, postsToday,
      peaksTotal, guidesTotal, clubsTotal, ordersTotal,
      revenueTotal, tracksTotal, imagesTotal
    ] = await Promise.all([
      prisma.$queryRaw`SELECT COUNT(*) as cnt FROM users WHERE deleted_at IS NULL`,
      prisma.$queryRaw`SELECT COUNT(*) as cnt FROM users WHERE date(created_at) = date('now') AND deleted_at IS NULL`,
      prisma.$queryRaw`SELECT COUNT(*) as cnt FROM posts`,
      prisma.$queryRaw`SELECT COUNT(*) as cnt FROM posts WHERE date(created_at) = date('now')`,
      prisma.$queryRaw`SELECT COUNT(*) as cnt FROM peaks`,
      prisma.$queryRaw`SELECT COUNT(*) as cnt FROM guides WHERE status = 'active'`,
      prisma.$queryRaw`SELECT COUNT(*) as cnt FROM clubs WHERE status = 'active'`,
      prisma.$queryRaw`SELECT COUNT(*) as cnt FROM orders`,
      prisma.$queryRaw`SELECT COALESCE(SUM(amount), 0) as total FROM orders WHERE status = 'paid'`,
      prisma.$queryRaw`SELECT COUNT(*) as cnt FROM tracks`,
      prisma.$queryRaw`SELECT COUNT(*) as cnt FROM images`,
    ]);

    res.json({
      users: { total: Number(usersTotal[0].cnt), today: Number(usersToday[0].cnt) },
      posts: { total: Number(postsTotal[0].cnt), today: Number(postsToday[0].cnt) },
      peaks: Number(peaksTotal[0].cnt),
      guides: Number(guidesTotal[0].cnt),
      clubs: Number(clubsTotal[0].cnt),
      orders: Number(ordersTotal[0].cnt),
      revenue: Number(revenueTotal[0].total),
      tracks: Number(tracksTotal[0].cnt),
      images: Number(imagesTotal[0].cnt),
      generated_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[admin-stats/overview]', e.message);
    res.status(500).json({ error: '获取统计数据失败' });
  }
});

// GET /api/admin/stats/users/trend?days=30 — 用户增长趋势
router.get('/users/trend', adminAuth, async (req, res) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 90);
    const trend = await prisma.$queryRaw`
      SELECT date(created_at) as date, COUNT(*) as count
      FROM users
      WHERE created_at >= date('now', ${'-' + days + ' days'})
        AND deleted_at IS NULL
      GROUP BY date(created_at)
      ORDER BY date ASC
    `;
    res.json(trend.map(r => ({ date: r.date, count: Number(r.count) })));
  } catch (e) {
    res.status(500).json({ error: '获取用户趋势失败' });
  }
});

// GET /api/admin/stats/posts/trend?days=30 — 内容发布趋势
router.get('/posts/trend', adminAuth, async (req, res) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 90);
    const trend = await prisma.$queryRaw`
      SELECT date(created_at) as date, COUNT(*) as count
      FROM posts
      WHERE created_at >= date('now', ${'-' + days + ' days'})
      GROUP BY date(created_at)
      ORDER BY date ASC
    `;
    res.json(trend.map(r => ({ date: r.date, count: Number(r.count) })));
  } catch (e) {
    res.status(500).json({ error: '获取内容趋势失败' });
  }
});

// GET /api/admin/stats/peaks/top — 热门山峰（按登顶记录）
router.get('/peaks/top', adminAuth, async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
    const tops = await prisma.$queryRaw`
      SELECT p.id, p.name, p.altitude, p.country, COUNT(us.id) as summit_count
      FROM peaks p
      LEFT JOIN user_summits us ON us.peak_name = p.name
      GROUP BY p.id, p.name, p.altitude, p.country
      ORDER BY summit_count DESC
      LIMIT ${limit}
    `;
    res.json(tops.map(r => ({ ...r, summit_count: Number(r.summit_count) })));
  } catch (e) {
    res.status(500).json({ error: '获取热门山峰失败' });
  }
});

// GET /api/admin/stats/revenue/trend?days=30 — 营收趋势
router.get('/revenue/trend', adminAuth, async (req, res) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 90);
    const trend = await prisma.$queryRaw`
      SELECT date(created_at) as date,
             COUNT(*) as orders,
             COALESCE(SUM(amount), 0) as revenue
      FROM orders
      WHERE status = 'paid'
        AND created_at >= date('now', ${'-' + days + ' days'})
      GROUP BY date(created_at)
      ORDER BY date ASC
    `;
    res.json(trend.map(r => ({ date: r.date, orders: Number(r.orders), revenue: Number(r.revenue) })));
  } catch (e) {
    res.status(500).json({ error: '获取营收趋势失败' });
  }
});

// GET /api/admin/stats/pending — 待处理事项
router.get('/pending', adminAuth, async (req, res) => {
  try {
    const [guideApps, clubApps, reports, bannedUsers] = await Promise.all([
      prisma.$queryRaw`SELECT COUNT(*) as cnt FROM guide_applications WHERE status = 'pending'`,
      prisma.$queryRaw`SELECT COUNT(*) as cnt FROM club_applications WHERE status = 'pending'`,
      prisma.$queryRaw`SELECT COUNT(*) as cnt FROM posts WHERE is_reported = 1`.catch(() => [{ cnt: 0 }]),
      prisma.$queryRaw`SELECT COUNT(*) as cnt FROM users WHERE is_banned = 1 AND deleted_at IS NULL`,
    ]);
    res.json({
      guide_applications: Number(guideApps[0].cnt),
      club_applications: Number(clubApps[0].cnt),
      reported_posts: Number(reports[0]?.cnt || 0),
      banned_users: Number(bannedUsers[0].cnt),
    });
  } catch (e) {
    res.status(500).json({ error: '获取待处理事项失败' });
  }
});

module.exports = router;
