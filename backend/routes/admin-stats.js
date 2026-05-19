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
      prisma.$queryRaw`SELECT COUNT(*) as cnt FROM guides WHERE status IN ('active', 'approved')`,
      prisma.$queryRaw`SELECT COUNT(*) as cnt FROM clubs WHERE status = 'active'`,
      prisma.$queryRaw`SELECT COUNT(*) as cnt FROM orders`.catch(() => [{ cnt: 0 }]),
      prisma.$queryRaw`SELECT COALESCE(SUM(amount), 0) as total FROM orders WHERE status = 'paid'`.catch(() => [{ total: 0 }]),
      prisma.$queryRaw`SELECT COUNT(*) as cnt FROM tracks`.catch(() => [{ cnt: 0 }]),
      prisma.$queryRaw`SELECT COUNT(*) as cnt FROM images`.catch(() => [{ cnt: 0 }]),
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
    const daysParam = `-${days} days`;
    const trend = await prisma.$queryRaw`
      SELECT date(created_at) as date, COUNT(*) as count
      FROM users
      WHERE created_at >= date('now', ${daysParam})
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
    const daysParam = `-${days} days`;
    const trend = await prisma.$queryRaw`
      SELECT date(created_at) as date, COUNT(*) as count
      FROM posts
      WHERE created_at >= date('now', ${daysParam})
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
    const daysParam = `-${days} days`;
    const trend = await prisma.$queryRaw`
      SELECT date(created_at) as date,
             COUNT(*) as orders,
             COALESCE(SUM(amount), 0) as revenue
      FROM orders
      WHERE status = 'paid'
        AND created_at >= date('now', ${daysParam})
      GROUP BY date(created_at)
      ORDER BY date ASC
    `;
    res.json(trend.map(r => ({ date: r.date, orders: Number(r.orders), revenue: Number(r.revenue) })));
  } catch (e) {
    res.status(500).json({ error: '获取营收趋势失败' });
  }
});

// GET /api/admin/stats/revenue?period=7d|30d|90d — 按日营收时间序列（含 provider）
router.get('/revenue', adminAuth, async (req, res) => {
  try {
    const periodMap = { '7d': 7, '30d': 30, '90d': 90 };
    const days = periodMap[req.query.period] || 30;
    const daysParam = `-${days} days`;
    const trend = await prisma.$queryRaw`
      SELECT date(created_at) as date,
             COALESCE(SUM(amount), 0) as amount,
             COALESCE(provider, 'unknown') as provider
      FROM orders
      WHERE status = 'paid'
        AND created_at >= date('now', ${daysParam})
      GROUP BY date(created_at), provider
      ORDER BY date ASC
    `.catch(() => []);
    res.json(trend.map(r => ({ date: r.date, amount: Number(r.amount), provider: r.provider })));
  } catch (e) {
    res.status(500).json({ error: '获取营收时间序列失败' });
  }
});

// GET /api/admin/stats/users?period=7d|30d|90d — 按日新增用户数
router.get('/users', adminAuth, async (req, res) => {
  try {
    const periodMap = { '7d': 7, '30d': 30, '90d': 90 };
    const days = periodMap[req.query.period] || 30;
    const daysParam = `-${days} days`;
    const trend = await prisma.$queryRaw`
      SELECT date(created_at) as date, COUNT(*) as count
      FROM users
      WHERE created_at >= date('now', ${daysParam})
        AND deleted_at IS NULL
      GROUP BY date(created_at)
      ORDER BY date ASC
    `.catch(() => []);
    res.json(trend.map(r => ({ date: r.date, count: Number(r.count) })));
  } catch (e) {
    res.status(500).json({ error: '获取用户增长失败' });
  }
});

// GET /api/admin/stats/withdrawals — 提现申请统计（待审批/已审批/拒绝）
router.get('/withdrawals', adminAuth, async (req, res) => {
  try {
    const summary = await prisma.$queryRaw`
      SELECT status, COUNT(*) as count, COALESCE(SUM(amount), 0) as total_amount
      FROM withdrawal_requests
      GROUP BY status
    `.catch(() => []);
    const requests = await prisma.$queryRaw`
      SELECT id, owner_type, owner_id, amount, fee, actual_amount, account_type, status,
             created_at, processed_at, note
      FROM withdrawal_requests
      ORDER BY created_at DESC
      LIMIT 50
    `.catch(() => []);
    const counts = { pending: 0, approved: 0, rejected: 0 };
    const amounts = { pending: 0, approved: 0, rejected: 0 };
    summary.forEach(r => {
      const s = r.status;
      if (counts[s] !== undefined) {
        counts[s] = Number(r.count);
        amounts[s] = Number(r.total_amount);
      }
    });
    res.json({
      pending: counts.pending,
      approved: counts.approved,
      rejected: counts.rejected,
      amounts,
      requests: requests.map(r => ({ ...r, amount: Number(r.amount), fee: Number(r.fee || 0), actual_amount: Number(r.actual_amount || 0) })),
    });
  } catch (e) {
    res.status(500).json({ error: '获取提现统计失败' });
  }
});

// GET /api/admin/stats/sos — SOS 告警统计（按月）
router.get('/sos', adminAuth, async (req, res) => {
  try {
    const monthly = await prisma.$queryRaw`
      SELECT strftime('%Y-%m', created_at) as month,
             COUNT(*) as count,
             status
      FROM sos_alerts
      GROUP BY month, status
      ORDER BY month DESC
    `.catch(() => []);
    const recent = await prisma.$queryRaw`
      SELECT id, user_id, lat, lng, altitude, message, status, created_at
      FROM sos_alerts
      ORDER BY created_at DESC
      LIMIT 20
    `.catch(() => []);
    res.json({ monthly: monthly.map(r => ({ ...r, count: Number(r.count) })), recent });
  } catch (e) {
    res.status(500).json({ error: '获取 SOS 统计失败' });
  }
});

// GET /api/admin/stats/pending — 待处理事项
router.get('/pending', adminAuth, async (req, res) => {
  try {
    const [guideApps, clubApps, reports, bannedUsers] = await Promise.all([
      prisma.$queryRaw`SELECT COUNT(*) as cnt FROM guide_applications WHERE status = 'pending'`,
      prisma.$queryRaw`SELECT COUNT(*) as cnt FROM club_applications WHERE status = 'pending'`,
      prisma.$queryRaw`SELECT COUNT(*) as cnt FROM posts WHERE is_reported = 1`.catch(() => [{ cnt: 0 }]),
      prisma.$queryRaw`SELECT COUNT(*) as cnt FROM users WHERE is_banned = 1 AND deleted_at IS NULL`.catch(() => [{ cnt: 0 }]),
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
