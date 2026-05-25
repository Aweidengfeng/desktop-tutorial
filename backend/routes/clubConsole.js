const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const prisma = require('../db/prisma');
const auth = require('../middleware/auth');

const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '操作过于频繁，请稍后再试' },
});
const MIN_PAYOUT_AMOUNT = 100;

async function getClub(userId) {
  return (await prisma.$queryRaw`SELECT * FROM clubs WHERE creator_id = ${userId} AND status = 'active'`)[0];
}

// GET /api/club-console/dashboard
router.get('/dashboard', auth, async (req, res) => {
  try {
    const club = await getClub(req.user.id);
    if (!club) return res.status(403).json({ error: '仅俱乐部管理员可访问' });
    let membersCount = { c: 0 };
    let expeditionsCount = { c: 0 };
    let paidRevenue = { total: 0 };
    let activityRevenue = { total: 0 };
    let totalViews = { c: 0 };
    let avgRating = { v: 0 };
    let repeatRate = 0;
    try {
      const row = (await prisma.$queryRaw`SELECT COUNT(*) as c FROM club_members WHERE club_id=${club.id}`)[0];
      membersCount = { c: Number(row.c) };
    } catch (_) {}
    try {
      const row = (await prisma.$queryRaw`SELECT COUNT(*) as c FROM expeditions WHERE publisher_type='club' AND publisher_id=${club.id}`)[0];
      expeditionsCount = { c: Number(row.c) };
    } catch (_) {}
    try {
      const row = (await prisma.$queryRaw`SELECT COALESCE(SUM(eo.publisher_income),0) as total FROM expedition_orders eo JOIN expeditions e ON e.id=eo.expedition_id WHERE e.publisher_type='club' AND e.publisher_id=${club.id} AND eo.status='paid'`)[0];
      paidRevenue = { total: Number(row.total) };
    } catch (_) {}
    try {
      const row = (await prisma.$queryRaw`SELECT COALESCE(SUM(amount),0) as total FROM activity_orders WHERE club_id=${club.id} AND status='paid'`)[0];
      activityRevenue = { total: Number(row.total) };
    } catch (_) {}
    try {
      const row = (await prisma.$queryRaw`SELECT COALESCE(SUM(view_count),0) as c FROM expeditions WHERE publisher_type='club' AND publisher_id=${club.id}`)[0];
      totalViews = { c: Number(row.c || 0) };
    } catch (_) {}
    try {
      const row = (await prisma.$queryRaw`SELECT COALESCE(AVG(rating),0) as v FROM reviews WHERE target_type='club' AND target_id=${club.id}`)[0];
      avgRating = { v: Number(row.v || 0) };
    } catch (_) {}
    try {
      const row = (await prisma.$queryRaw`
        SELECT COUNT(*) as total_users,
               COALESCE(SUM(CASE WHEN order_count > 1 THEN 1 ELSE 0 END),0) as repeat_users
        FROM (
          SELECT user_id, COUNT(*) as order_count
          FROM activity_orders
          WHERE club_id=${club.id} AND status='paid'
          GROUP BY user_id
        )
      `)[0];
      const paidUsers = Number(row?.total_users || 0);
      const repeatUsers = Number(row?.repeat_users || 0);
      repeatRate = paidUsers > 0 ? Math.min(1, repeatUsers / paidUsers) : 0;
    } catch (_) {}
    const currentMonth = new Date().toISOString().slice(0, 7);
    let monthExpedition = 0;
    let monthActivity = 0;
    try {
      const row = (await prisma.$queryRaw`
        SELECT COALESCE(SUM(eo.publisher_income),0) as total
        FROM expedition_orders eo
        JOIN expeditions e ON e.id=eo.expedition_id
        WHERE e.publisher_type='club'
          AND e.publisher_id=${club.id}
          AND eo.status='paid'
          AND strftime('%Y-%m', eo.created_at)=${currentMonth}
      `)[0];
      monthExpedition = Number(row?.total || 0);
    } catch (_) {}
    try {
      const row = (await prisma.$queryRaw`
        SELECT COALESCE(SUM(amount),0) as total
        FROM activity_orders
        WHERE club_id=${club.id}
          AND status='paid'
          AND strftime('%Y-%m', created_at)=${currentMonth}
      `)[0];
      monthActivity = Number(row?.total || 0);
    } catch (_) {}
    const monthlyGmv = monthExpedition + monthActivity;
    const totalGmv = Number(paidRevenue.total || 0) + Number(activityRevenue.total || 0);
    res.json({
      club_id: club.id,
      club_name: club.name,
      members_count: membersCount.c,
      total_expeditions: expeditionsCount.c,
      total_revenue: totalGmv,
      monthly_revenue: monthlyGmv,
      totalViews: totalViews.c,
      avgRating: avgRating.v,
      monthlyGmv,
      repeatRate,
      currency: 'CNY',
    });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/club-console/members
router.get('/members', auth, async (req, res) => {
  try {
    const club = await getClub(req.user.id);
    if (!club) return res.status(403).json({ error: '仅俱乐部管理员可访问' });
    const { role, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where = ['cm.club_id=?'];
    const params = [club.id];
    if (role) { where.push('cm.role=?'); params.push(role); }
    let members = [];
    try {
      const sql = `
        SELECT cm.*, u.name, u.avatar, u.level
        FROM club_members cm JOIN users u ON u.id=cm.user_id
        WHERE ${where.join(' AND ')}
        ORDER BY cm.joined_at DESC LIMIT ? OFFSET ?
      `;
      members = await prisma.$queryRawUnsafe(sql, ...params, parseInt(limit), offset);
    } catch (_) {}
    res.json(members);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/club-console/orders
router.get('/orders', auth, async (req, res) => {
  try {
    const club = await getClub(req.user.id);
    if (!club) return res.status(403).json({ error: '仅俱乐部管理员可访问' });
    let orders = [];
    try {
      orders = await prisma.$queryRaw`
        SELECT ao.*,
               u.name as user_name,
               ca.title as activity_title
        FROM activity_orders ao
        LEFT JOIN users u ON u.id = ao.user_id
        LEFT JOIN club_activities ca ON ca.id = ao.activity_id
        WHERE ao.club_id = ${club.id}
        ORDER BY ao.created_at DESC
      `;
    } catch (_) {}
    res.json({ orders });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/club-console/activities
router.post('/activities', writeLimiter, auth, async (req, res) => {
  try {
    const club = await getClub(req.user.id);
    if (!club) return res.status(403).json({ error: '仅俱乐部管理员可访问' });
    const { title, description, date, max_participants, price } = req.body;
    if (!title || !date) return res.status(400).json({ error: '标题和日期不能为空' });
    const now = new Date().toISOString();
    let resultId = null;
    try {
      const [{ id: newExpeditionId }] = await prisma.$queryRaw`
        INSERT INTO expeditions (publisher_type, publisher_id, title, route_name, start_date, max_participants, base_price, currency, status, created_at, updated_at)
        VALUES ('club', ${club.id}, ${title}, ${description || null}, ${date}, ${max_participants || 20}, ${price || 0}, 'CNY', 'published', ${now}, ${now})
        RETURNING id
      `;
      resultId = Number(newExpeditionId);
    } catch (_) {}
    res.json({ id: resultId, title, date, status: 'published' });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/club-console/activities — 合并返回：俱乐部短期活动 + 商业远征
router.get('/activities', auth, async (req, res) => {
  try {
    const club = await getClub(req.user.id);
    if (!club) return res.status(403).json({ error: '仅俱乐部管理员可访问' });

    // 从 club_activities 获取短期活动
    let activities = [];
    try {
      const rows = await prisma.$queryRaw`
        SELECT * FROM club_activities WHERE club_id = ${club.id} ORDER BY created_at DESC
      `;
      activities = rows.map(r => ({ ...r, source: 'activity' }));
    } catch (_) {}

    // 从 expeditions 获取俱乐部发布的商业远征（含统计数据）
    let expeditions = [];
    try {
      const rows = await prisma.$queryRaw`
        SELECT e.*,
               (SELECT COUNT(*) FROM expedition_orders eo WHERE eo.expedition_id = e.id) as order_count,
               (SELECT COALESCE(SUM(eo.publisher_income),0) FROM expedition_orders eo WHERE eo.expedition_id = e.id AND eo.status='paid') as total_revenue,
               (SELECT COUNT(*) FROM expedition_orders eo WHERE eo.expedition_id = e.id AND eo.status IN ('paid','confirmed')) as current_participants
        FROM expeditions e
        WHERE e.publisher_type = 'club' AND e.publisher_id = ${club.id}
        ORDER BY e.created_at DESC
      `;
      expeditions = rows.map(r => ({
        ...r,
        source: 'expedition',
        order_count: Number(r.order_count || 0),
        total_revenue: Number(r.total_revenue || 0),
        current_participants: Number(r.current_participants || 0),
        available_spots: Math.max(0, Number(r.max_participants || 0) - Number(r.current_participants || 0)),
      }));
    } catch (_) {}

    res.json({ activities, expeditions });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/club-console/finance
router.get('/finance', auth, async (req, res) => {
  try {
    const club = await getClub(req.user.id);
    if (!club) return res.status(403).json({ error: '仅俱乐部管理员可访问' });
    let expeditionPaid = { total: 0 };
    let activityPaid = { total: 0 };
    let pendingActivity = { total: 0 };
    let pendingExpedition = { total: 0 };
    let withdrawalStats = { pending: 0, approved: 0 };
    let withdrawalHistory = [];
    let monthly = [];
    try {
      const row = (await prisma.$queryRaw`SELECT COALESCE(SUM(eo.publisher_income),0) as total FROM expedition_orders eo JOIN expeditions e ON e.id=eo.expedition_id WHERE e.publisher_type='club' AND e.publisher_id=${club.id} AND eo.status='paid'`)[0];
      expeditionPaid = { total: Number(row.total || 0) };
    } catch (_) {}
    try {
      const row = (await prisma.$queryRaw`SELECT COALESCE(SUM(amount),0) as total FROM activity_orders WHERE club_id=${club.id} AND status='paid'`)[0];
      activityPaid = { total: Number(row.total || 0) };
    } catch (_) {}
    try {
      const row = (await prisma.$queryRaw`SELECT COALESCE(SUM(amount),0) as total FROM activity_orders WHERE club_id=${club.id} AND status IN ('pending', 'pending_payment')`)[0];
      pendingActivity = { total: Number(row.total || 0) };
    } catch (_) {}
    try {
      const row = (await prisma.$queryRaw`SELECT COALESCE(SUM(eo.publisher_income),0) as total FROM expedition_orders eo JOIN expeditions e ON e.id=eo.expedition_id WHERE e.publisher_type='club' AND e.publisher_id=${club.id} AND eo.status IN ('pending','confirmed')`)[0];
      pendingExpedition = { total: Number(row.total || 0) };
    } catch (_) {}
    try {
      const row = (await prisma.$queryRaw`
        SELECT COALESCE(SUM(CASE WHEN status='pending' THEN amount ELSE 0 END),0) as pending,
               COALESCE(SUM(CASE WHEN status='approved' THEN amount ELSE 0 END),0) as approved
        FROM withdrawal_requests
        WHERE owner_type='club' AND owner_id=${club.id}
      `)[0];
      withdrawalStats = { pending: Number(row.pending || 0), approved: Number(row.approved || 0) };
    } catch (_) {}
    try {
      const rows = await prisma.$queryRaw`
        SELECT id, amount, status, note, bank_account, bank_name, account_info, created_at, processed_at
        FROM withdrawal_requests
        WHERE owner_type='club' AND owner_id=${club.id}
        ORDER BY created_at DESC
        LIMIT 100
      `;
      withdrawalHistory = rows.map((r) => {
        let accountInfo = {};
        try { accountInfo = r.account_info ? JSON.parse(r.account_info) : {}; } catch (_) {}
        return {
          id: r.id,
          amount: Number(r.amount || 0),
          status: r.status,
          note: r.note || '',
          bank_account: r.bank_account || accountInfo.bank_account || '',
          bank_name: r.bank_name || accountInfo.bank_name || '',
          created_at: r.created_at,
          processed_at: r.processed_at,
        };
      });
    } catch (_) {}
    try {
      const rows = await prisma.$queryRaw`
        SELECT strftime('%Y-%m', eo.created_at) as month,
               COUNT(*) as orders,
               COALESCE(SUM(eo.total),0) as gross,
               COALESCE(SUM(eo.publisher_income),0) as net
        FROM expedition_orders eo
        JOIN expeditions e ON e.id=eo.expedition_id
        WHERE e.publisher_type='club' AND e.publisher_id=${club.id} AND eo.status='paid'
        GROUP BY month ORDER BY month DESC LIMIT 12
      `;
      monthly = rows.map(r => ({ ...r, orders: Number(r.orders), gross: Number(r.gross), net: Number(r.net) }));
    } catch (_) {}
    const totalIncome = Number(expeditionPaid.total || 0) + Number(activityPaid.total || 0);
    const availableBalance = Math.max(0, totalIncome - Number(withdrawalStats.pending || 0) - Number(withdrawalStats.approved || 0));
    const pendingBalance = Number(pendingActivity.total || 0) + Number(pendingExpedition.total || 0);
    res.json({
      pendingBalance,
      availableBalance,
      totalPaid: Number(withdrawalStats.approved || 0),
      currency: 'CNY',
      withdrawalHistory,
      monthly,
    });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/club-console/finance/payout
router.post('/finance/payout', writeLimiter, auth, async (req, res) => {
  try {
    const club = await getClub(req.user.id);
    if (!club) return res.status(403).json({ error: '仅俱乐部管理员可访问' });
    const amountNum = Number(req.body?.amount);
    const bankAccount = String(req.body?.bank_account || '').trim();
    const bankName = String(req.body?.bank_name || '').trim();
    if (!Number.isFinite(amountNum) || amountNum <= 0) return res.status(400).json({ error: '提现金额无效' });
    if (amountNum < MIN_PAYOUT_AMOUNT) return res.status(400).json({ error: `最低提现金额为${MIN_PAYOUT_AMOUNT}元` });
    if (!bankAccount || !bankName) return res.status(400).json({ error: '请填写银行卡号和开户行' });

    const [incomeRow] = await prisma.$queryRaw`
      SELECT COALESCE(SUM(eo.publisher_income),0) as expedition_income
      FROM expedition_orders eo
      JOIN expeditions e ON e.id=eo.expedition_id
      WHERE e.publisher_type='club' AND e.publisher_id=${club.id} AND eo.status='paid'
    `;
    const [activityRow] = await prisma.$queryRaw`
      SELECT COALESCE(SUM(amount),0) as activity_income
      FROM activity_orders
      WHERE club_id=${club.id} AND status='paid'
    `;
    const [withdrawRow] = await prisma.$queryRaw`
      SELECT COALESCE(SUM(amount),0) as withdrawn
      FROM withdrawal_requests
      WHERE owner_type='club' AND owner_id=${club.id} AND status IN ('pending','approved')
    `;
    const available = Number(incomeRow?.expedition_income || 0) + Number(activityRow?.activity_income || 0) - Number(withdrawRow?.withdrawn || 0);
    if (amountNum > available) return res.status(400).json({ error: '提现金额超过可用余额' });

    const accountInfo = JSON.stringify({ bank_account: bankAccount, bank_name: bankName });
    const inserted = await prisma.withdrawalRequest.create({
      data: {
        ownerType: 'club',
        ownerId: club.id,
        amount: amountNum,
        fee: 0,
        actualAmount: amountNum,
        accountType: 'bank',
        accountInfo,
        bankAccount,
        bankName,
        status: 'pending',
      },
      select: { id: true },
    });

    res.json({
      success: true,
      request_id: Number(inserted.id || 0),
      status: 'pending',
      amount: amountNum,
      bank_account: bankAccount,
      bank_name: bankName,
      message: '提现申请已提交，等待管理员审核',
    });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/club-console/my-expeditions — 俱乐部发布的商业远征列表（含统计）
router.get('/my-expeditions', auth, async (req, res) => {
  try {
    const club = await getClub(req.user.id);
    if (!club) return res.status(403).json({ error: '仅俱乐部管理员可访问' });
    let expeditions = [];
    try {
      const rows = await prisma.$queryRaw`
        SELECT e.id, e.title, e.peak_name, e.start_date, e.end_date, e.base_price, e.currency,
               e.status, e.max_participants, e.cover_image, e.created_at,
               (SELECT COUNT(*) FROM expedition_orders eo WHERE eo.expedition_id = e.id) as order_count,
               (SELECT COALESCE(SUM(eo.publisher_income),0) FROM expedition_orders eo WHERE eo.expedition_id = e.id AND eo.status='paid') as total_revenue,
               (SELECT COUNT(*) FROM expedition_orders eo WHERE eo.expedition_id = e.id AND eo.status IN ('paid','confirmed')) as current_participants
        FROM expeditions e
        WHERE e.publisher_type = 'club' AND e.publisher_id = ${club.id}
        ORDER BY e.created_at DESC
      `;
      expeditions = rows.map(r => ({
        ...r,
        order_count: Number(r.order_count || 0),
        total_revenue: Number(r.total_revenue || 0),
        current_participants: Number(r.current_participants || 0),
        available_spots: Math.max(0, Number(r.max_participants || 0) - Number(r.current_participants || 0)),
      }));
    } catch (_) {}
    res.json({ expeditions, total: expeditions.length });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/club-console/expeditions/:id/status — 俱乐部下架/更新远征状态
router.put('/expeditions/:id/status', writeLimiter, auth, async (req, res) => {
  try {
    const club = await getClub(req.user.id);
    if (!club) return res.status(403).json({ error: '仅俱乐部管理员可访问' });
    const { status } = req.body;
    if (!['closed', 'published', 'pending'].includes(status)) return res.status(400).json({ error: '无效状态' });
    const rows = await prisma.$queryRaw`SELECT id FROM expeditions WHERE id=${Number(req.params.id)} AND publisher_type='club' AND publisher_id=${club.id}`;
    if (!rows || rows.length === 0) return res.status(404).json({ error: '远征不存在或无权限' });
    await prisma.$executeRaw`UPDATE expeditions SET status=${status}, updated_at=${new Date().toISOString()} WHERE id=${Number(req.params.id)}`;
    res.json({ success: true, status });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
