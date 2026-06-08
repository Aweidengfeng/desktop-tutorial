const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const auth = require('../middleware/auth');
const moderation = require('../utils/moderation');
const { VALID_TRANSITIONS, appendStatusHistory } = require('./orderStateMachine');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { GUIDE_CERT_LEVELS } = require('../utils/certLevels');
const rateLimit = require('express-rate-limit');
const { detectRegion } = require('../lib/region');
const wechatPay = require('../lib/payment/wechat-pay');
const stripeConnect = require('../lib/payment/stripe-connect');
const { paymentLimiter } = require('../middleware/rateLimits');

const applyRateLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false, message: { error: '申请频率过高，请稍后再试' } });
const payRateLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false, message: { error: '操作频率过高，请稍后再试' } });
const guideReadLimiter = rateLimit({ windowMs: 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false, message: { error: '请求过于频繁，请稍后再试' } });
const guideWriteLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false, message: { error: '操作过于频繁，请稍后再试' } });
const SERVICE_PUBLISH_IDEMPOTENCY_WINDOW_SECONDS = 30;

// Helper: parse peaks_led JSON field
function parseGuide(guide) {
  if (!guide) return guide;
  if (guide.peaks_led) {
    try { guide.peaks_led = JSON.parse(guide.peaks_led); } catch(e) { guide.peaks_led = []; }
  } else {
    guide.peaks_led = [];
  }
  return guide;
}

// 将向导记录的评分替换为基于 reviews 表的动态均值；无评价时回退到静态 rating 列。
function withDynamicRating(guide) {
  const { review_avg, review_count, ...rest } = guide;
  const count = Number(review_count || 0);
  const rating = count > 0
    ? Math.round(Number(review_avg || 0) * 10) / 10
    : Number(guide.rating || 0);
  return { ...rest, rating, reviews: count, review_count: count };
}

function isValidUploadUrl(url) {
  if (!url) return true;
  return typeof url === 'string' && (
    url.startsWith('/uploads/') ||
    /^https:\/\/[a-z0-9-]+\.(oss-cn|cos\.|obs\.|myqcloud\.com|aliyuncs\.com|summitlink\.app)/.test(url)
  );
}

// GET /api/guides
// GET /api/guides — list approved guides
/**
 * @swagger
 * /api/guides:
 *   get:
 *     tags: [向导]
 *     summary: 获取已审核通过的向导列表
 *     description: 返回 status=approved 的向导，按评分降序排列
 *     security: []
 *     responses:
 *       200:
 *         description: 向导数组
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Guide'
 */
router.get('/', async (req, res) => {
  try {
    const guides = await prisma.$queryRaw`
      SELECT g.id, g.user_id as userId, g.name, g.avatar, g.flag, g.nationality,
             g.rating,
             g.specialty, g.day_rate as dayRate,
             (SELECT AVG(CAST(r.rating AS REAL)) FROM reviews r WHERE r.target_type = 'guide' AND r.target_id = g.id) AS review_avg,
             (SELECT COUNT(*) FROM reviews r WHERE r.target_type = 'guide' AND r.target_id = g.id) AS review_count
      FROM guides g WHERE g.status = 'approved'
      ORDER BY g.rating DESC
    `;
    res.json(guides.map((guide) => withDynamicRating(guide)));
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/guides/my/profile — 已登录向导查看自己的主页数据
router.get('/my/profile', guideReadLimiter, auth, async (req, res) => {
  try {
    const [guide] = await prisma.$queryRaw`SELECT * FROM guides WHERE user_id = ${req.user.id}`;
    if (!guide) return res.status(404).json({ error: '您尚未成为向导' });
    res.json(parseGuide(guide));
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/guides/withdraw — 向导提现申请（需要JWT）
router.post('/withdraw', guideWriteLimiter, auth, async (req, res) => {
  try {
    const [guide] = await prisma.$queryRaw`SELECT * FROM guides WHERE user_id = ${req.user.id}`;
    if (!guide) return res.status(403).json({ error: '仅向导可申请提现' });

    const amountNum = Number(req.body?.amount);
    const bankAccount = String(req.body?.bank_account || '').trim();
    const bankName = String(req.body?.bank_name || '').trim();
    if (!Number.isFinite(amountNum) || amountNum <= 0) return res.status(400).json({ error: '提现金额无效' });
    if (amountNum < 100) return res.status(400).json({ error: '最低提现金额为100元' });
    if (!bankAccount || !bankName) return res.status(400).json({ error: '请填写银行卡号和开户行' });

    const balance = Number(guide.balance || 0);
    if (amountNum > balance) return res.status(400).json({ error: '提现金额超过可用余额' });
    const balanceChanged = await prisma.$executeRaw`
      UPDATE guides
      SET balance = balance - ${amountNum}
      WHERE id = ${guide.id} AND balance >= ${amountNum}
    `;
    if (balanceChanged === 0) return res.status(400).json({ error: '可用余额不足，请刷新后重试' });

    const accountInfo = JSON.stringify({ bank_account: bankAccount, bank_name: bankName });
    const [inserted] = await prisma.$queryRaw`
      INSERT INTO withdrawal_requests (
        owner_type, owner_id, guide_id, amount, fee, actual_amount, account_type, account_info,
        bank_account, bank_name, status, note
      )
      VALUES (
        'guide', ${guide.id}, ${guide.id}, ${amountNum}, 0, ${amountNum}, 'bank', ${accountInfo},
        ${bankAccount}, ${bankName}, 'pending', NULL
      )
      RETURNING id
    `;

    res.json({
      success: true,
      request_id: Number(inserted?.id || 0),
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

// GET /api/guides/withdrawals — 当前向导提现历史（需要JWT）
router.get('/withdrawals', guideReadLimiter, auth, async (req, res) => {
  try {
    const [guide] = await prisma.$queryRaw`SELECT * FROM guides WHERE user_id = ${req.user.id}`;
    if (!guide) return res.status(403).json({ error: '仅向导可访问' });
    const rows = await prisma.$queryRaw`
      SELECT id, amount, status, note, bank_account, bank_name, account_info, created_at, processed_at
      FROM withdrawal_requests
      WHERE owner_type = 'guide' AND owner_id = ${guide.id}
      ORDER BY created_at DESC
      LIMIT 100
    `;
    const requests = rows.map((r) => {
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
    res.json({ requests, balance: Number(guide.balance || 0) });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/guides/my/profile — 已登录向导更新主页
router.put('/my/profile', guideWriteLimiter, auth, async (req, res) => {
  try {
    const [guide] = await prisma.$queryRaw`SELECT * FROM guides WHERE user_id = ${req.user.id}`;
    if (!guide) return res.status(404).json({ error: '您尚未成为向导' });
    const { bio, peaks_led, cover_image, wechat, experience_years } = req.body;
    const peaksLedStr = peaks_led ? JSON.stringify(peaks_led) : guide.peaks_led;
    await prisma.$executeRaw`
      UPDATE guides SET
        bio = ${bio !== undefined ? bio : guide.bio},
        peaks_led = ${peaksLedStr},
        cover_image = ${cover_image !== undefined ? cover_image : guide.cover_image},
        wechat = ${wechat !== undefined ? wechat : guide.wechat},
        experience_years = ${experience_years !== undefined ? experience_years : guide.experience_years}
      WHERE user_id = ${req.user.id}
    `;
    const [updated] = await prisma.$queryRaw`SELECT * FROM guides WHERE user_id = ${req.user.id}`;
    res.json(parseGuide(updated));
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/guides/me — 查看自己的申请/向导状态（需要JWT）
// 注意：此路由必须在 /:id 之前注册，防止 'me' 被当作 id
router.get('/me', guideReadLimiter, auth, async (req, res) => {
  try {
    const [guide] = await prisma.$queryRaw`SELECT * FROM guides WHERE user_id = ${req.user.id}`;
    if (!guide) {
      const [app] = await prisma.$queryRaw`
        SELECT * FROM guide_applications WHERE user_id = ${req.user.id} ORDER BY id DESC LIMIT 1
      `;
      if (!app) return res.json({ status: 'none' });
      return res.json(app);
    }
    res.json(parseGuide(guide));
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/guides/me — 更新自己的资料（仅 pending 状态可改）
// 注意：此路由必须在 /:id 之前注册
router.put('/me', guideWriteLimiter, auth, async (req, res) => {
  try {
    const [guide] = await prisma.$queryRaw`SELECT * FROM guides WHERE user_id = ${req.user.id}`;
    if (!guide) return res.status(404).json({ error: '您尚未提交向导申请' });
    if (guide.status !== 'pending') {
      return res.status(400).json({ error: '只有待审核状态才能修改资料' });
    }
    const { bio, peaks_led, cover_image, wechat, experience_years, real_name, certifications, specialties } = req.body;
    const peaksLedStr = peaks_led ? JSON.stringify(peaks_led) : guide.peaks_led;
    const certsStr = certifications ? JSON.stringify(certifications) : guide.certifications;
    await prisma.$executeRaw`
      UPDATE guides SET
        bio = COALESCE(${bio || null}, bio),
        peaks_led = COALESCE(${peaksLedStr}, peaks_led),
        cover_image = COALESCE(${cover_image || null}, cover_image),
        wechat = COALESCE(${wechat || null}, wechat),
        experience_years = COALESCE(${experience_years || null}, experience_years),
        real_name = COALESCE(${real_name || null}, real_name),
        certifications = COALESCE(${certsStr}, certifications),
        specialties = COALESCE(${specialties || null}, specialties)
      WHERE user_id = ${req.user.id}
    `;
    const [updated] = await prisma.$queryRaw`SELECT * FROM guides WHERE user_id = ${req.user.id}`;
    res.json(parseGuide(updated));
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/guides/my/routes — 当前向导的路线列表
router.get('/my/routes', guideReadLimiter, auth, async (req, res) => {
  try {
    const [guide] = await prisma.$queryRaw`SELECT id FROM guides WHERE user_id = ${req.user.id}`;
    if (!guide) return res.status(403).json({ error: '仅向导可访问' });
    const routes = await prisma.$queryRaw`
      SELECT * FROM guide_routes WHERE guide_id = ${guide.id} ORDER BY created_at DESC
    `.catch(() => []);
    res.json(routes || []);
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return res.json([]);
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/guides/my/routes — 创建路线草稿
router.post('/my/routes', guideWriteLimiter, auth, async (req, res) => {
  try {
    const [guide] = await prisma.$queryRaw`SELECT id FROM guides WHERE user_id = ${req.user.id}`;
    if (!guide) return res.status(403).json({ error: '仅向导可创建路线' });
    const { title, peakName, description, difficultyRating, durationDays,
            bestSeason, maxParticipants, country, cancellationPolicy,
            priceTiers, itinerary, equipmentList, includedServices, excludedServices } = req.body;
    if (!title) return res.status(400).json({ error: '路线标题不能为空' });
    const titleCheck = moderation.checkText(title);
    if (!titleCheck.ok) return res.status(422).json({ error: 'content_blocked', reason: titleCheck.reason });
    await prisma.$executeRaw`
      INSERT INTO guide_routes
        (guide_id, title, peak_name, description, difficulty_rating, duration_days,
         best_season, max_participants, country, cancellation_policy,
         price_tiers, itinerary, equipment_list, included_services, excluded_services, status)
      VALUES
        (${guide.id}, ${title}, ${peakName || ''}, ${description || ''}, ${difficultyRating || ''},
         ${durationDays || 7}, ${bestSeason || ''}, ${maxParticipants || 10}, ${country || ''},
         ${cancellationPolicy || ''}, ${priceTiers || '[]'}, ${itinerary || ''},
         ${equipmentList || ''}, ${includedServices || ''}, ${excludedServices || ''}, 'draft')
    `.catch(() => {});
    const [route] = await prisma.$queryRaw`
      SELECT * FROM guide_routes WHERE guide_id = ${guide.id} ORDER BY id DESC LIMIT 1
    `.catch(() => [null]);
    res.json(route || { success: true });
  } catch (e) {
    if (e.message && e.message.includes('no such table')) {
      return res.status(503).json({ error: '路线功能数据库尚未初始化，请联系管理员' });
    }
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/guides/my/routes/:routeId — 更新路线草稿
router.put('/my/routes/:routeId', guideWriteLimiter, auth, async (req, res) => {
  try {
    const [guide] = await prisma.$queryRaw`SELECT id FROM guides WHERE user_id = ${req.user.id}`;
    if (!guide) return res.status(403).json({ error: '仅向导可操作' });
    const routeId = parseInt(req.params.routeId);
    const [route] = await prisma.$queryRaw`
      SELECT * FROM guide_routes WHERE id = ${routeId} AND guide_id = ${guide.id}
    `.catch(() => [null]);
    if (!route) return res.status(404).json({ error: '路线不存在' });
    if (!['draft', 'rejected'].includes(route.status)) {
      return res.status(400).json({ error: '只有草稿或被拒绝的路线可以修改' });
    }
    const { title, peakName, description, difficultyRating, durationDays,
            bestSeason, maxParticipants, country, cancellationPolicy,
            priceTiers, itinerary, equipmentList, includedServices, excludedServices } = req.body;
    await prisma.$executeRaw`
      UPDATE guide_routes SET
        title = COALESCE(${title !== undefined ? title : null}, title),
        peak_name = COALESCE(${peakName !== undefined ? peakName : null}, peak_name),
        description = COALESCE(${description !== undefined ? description : null}, description),
        difficulty_rating = COALESCE(${difficultyRating !== undefined ? difficultyRating : null}, difficulty_rating),
        duration_days = COALESCE(${durationDays !== undefined ? durationDays : null}, duration_days),
        best_season = COALESCE(${bestSeason !== undefined ? bestSeason : null}, best_season),
        max_participants = COALESCE(${maxParticipants !== undefined ? maxParticipants : null}, max_participants),
        country = COALESCE(${country !== undefined ? country : null}, country),
        cancellation_policy = COALESCE(${cancellationPolicy !== undefined ? cancellationPolicy : null}, cancellation_policy),
        price_tiers = COALESCE(${priceTiers !== undefined ? priceTiers : null}, price_tiers),
        itinerary = COALESCE(${itinerary !== undefined ? itinerary : null}, itinerary),
        equipment_list = COALESCE(${equipmentList !== undefined ? equipmentList : null}, equipment_list),
        included_services = COALESCE(${includedServices !== undefined ? includedServices : null}, included_services),
        excluded_services = COALESCE(${excludedServices !== undefined ? excludedServices : null}, excluded_services),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${routeId} AND guide_id = ${guide.id}
    `.catch(() => {});
    const [updated] = await prisma.$queryRaw`SELECT * FROM guide_routes WHERE id = ${routeId}`.catch(() => [route]);
    res.json(updated || route);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/guides/routes/:routeId/submit — 提交路线审核
router.post('/routes/:routeId/submit', guideWriteLimiter, auth, async (req, res) => {
  try {
    const [guide] = await prisma.$queryRaw`SELECT id FROM guides WHERE user_id = ${req.user.id}`;
    if (!guide) return res.status(403).json({ error: '仅向导可提交路线' });
    const routeId = parseInt(req.params.routeId);
    const [route] = await prisma.$queryRaw`
      SELECT * FROM guide_routes WHERE id = ${routeId} AND guide_id = ${guide.id}
    `.catch(() => [null]);
    if (!route) return res.status(404).json({ error: '路线不存在' });
    if (!['draft', 'rejected'].includes(route.status)) {
      return res.status(400).json({ error: '只有草稿或被拒绝的路线可以提交审核' });
    }
    await prisma.$executeRaw`
      UPDATE guide_routes SET status = 'pending', submitted_at = CURRENT_TIMESTAMP
      WHERE id = ${routeId} AND guide_id = ${guide.id}
    `.catch(() => {});
    res.json({ success: true, message: '路线已提交审核，预计3个工作日内完成' });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/guides/my/finance — 向导资金数据
router.get('/my/finance', guideReadLimiter, auth, async (req, res) => {
  try {
    const [guide] = await prisma.$queryRaw`SELECT * FROM guides WHERE user_id = ${req.user.id}`;
    if (!guide) return res.status(403).json({ error: '仅向导可访问' });

    const paidRows = await prisma.$queryRaw`
      SELECT COALESCE(SUM(amount), 0) as total FROM withdrawal_requests
      WHERE owner_type = 'guide' AND owner_id = ${guide.id} AND status = 'approved'
    `.catch(() => [{ total: 0 }]);
    const totalPaid = Number(paidRows[0]?.total || 0);

    const pendingRows = await prisma.$queryRaw`
      SELECT COALESCE(SUM(amount), 0) as total FROM guide_service_orders
      WHERE guide_id = ${guide.id} AND status = 'paid'
    `.catch(() => [{ total: 0 }]);
    const pendingBalance = Number(pendingRows[0]?.total || 0);

    res.json({
      currency: 'CNY',
      availableBalance: Number(guide.balance || 0),
      pendingBalance,
      totalPaid,
    });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/guides/my/dashboard — 向导数据看板
router.get('/my/dashboard', guideReadLimiter, auth, async (req, res) => {
  try {
    const [guide] = await prisma.$queryRaw`SELECT id, rating, reviews FROM guides WHERE user_id = ${req.user.id}`;
    if (!guide) return res.status(403).json({ error: '仅向导可访问' });

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const gmvRows = await prisma.$queryRaw`
      SELECT COALESCE(SUM(amount), 0) as gmv FROM guide_service_orders
      WHERE guide_id = ${guide.id} AND status = 'paid' AND paid_at >= ${monthStart}
    `.catch(() => [{ gmv: 0 }]);
    const monthlyGmv = Number(gmvRows[0]?.gmv || 0);

    const viewRows = await prisma.$queryRaw`
      SELECT COALESCE(SUM(view_count), 0) as total FROM guide_services
      WHERE guide_id = ${guide.id} AND status != 'deleted'
    `.catch(() => [{ total: 0 }]);
    const totalViews = Number(viewRows[0]?.total || 0);

    const repeatRows = await prisma.$queryRaw`
      SELECT COUNT(*) as total_users,
             SUM(CASE WHEN order_count >= 2 THEN 1 ELSE 0 END) as repeat_users
      FROM (
        SELECT user_id, COUNT(*) as order_count FROM guide_service_orders
        WHERE guide_id = ${guide.id} AND status = 'paid' GROUP BY user_id
      )
    `.catch(() => [{ total_users: 0, repeat_users: 0 }]);
    const totalUsers = Number(repeatRows[0]?.total_users || 0);
    const repeatUsers = Number(repeatRows[0]?.repeat_users || 0);
    const repeatRate = totalUsers > 0 ? repeatUsers / totalUsers : 0;

    res.json({
      currency: 'CNY',
      monthlyGmv,
      totalViews,
      avgRating: Number(guide.rating || 0),
      repeatRate,
    });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/guides/:id — 向导详情
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [guide] = await prisma.$queryRaw`
      SELECT g.*,
             (SELECT AVG(CAST(r.rating AS REAL)) FROM reviews r WHERE r.target_type = 'guide' AND r.target_id = g.id) AS review_avg,
             (SELECT COUNT(*) FROM reviews r WHERE r.target_type = 'guide' AND r.target_id = g.id) AS review_count
      FROM guides g
      WHERE g.id = ${id} AND g.status = 'approved'
    `;
    if (!guide) return res.status(404).json({ error: '向导不存在' });
    const reviewCount = Number(guide.review_count || 0);
    guide.rating = reviewCount > 0
      ? Math.round(Number(guide.review_avg || 0) * 10) / 10
      : Number(guide.rating || 0);
    delete guide.review_avg;
    guide.review_count = reviewCount;
    guide.reviews = reviewCount;
    res.json(parseGuide(guide));
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/guides/:id/commercial-status — 查询向导商业资质状态（需为本人）
router.get('/:id/commercial-status', guideReadLimiter, auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [guide] = await prisma.$queryRaw`SELECT * FROM guides WHERE id = ${id}`;
    if (!guide) return res.status(404).json({ error: '向导不存在' });
    if (guide.user_id !== req.user.id) return res.status(403).json({ error: '无权查看' });
    res.json({
      status: guide.commercial_status || 'none',
      verified: !!guide.commercial_verified,
      applied_at: guide.commercial_applied_at || null,
      reviewed_at: guide.commercial_reviewed_at || null,
      reject_reason: guide.commercial_reject_reason || null,
      need_info_reason: guide.commercial_need_info_reason || null,
    });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/guides/:id/expeditions — 向导带队记录列表
router.get('/:id/expeditions', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const expeditions = await prisma.$queryRaw`
      SELECT * FROM guide_expeditions WHERE guide_id = ${id}
      ORDER BY date DESC LIMIT 20
    `;
    res.json(expeditions);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/guides/:id/reviews — 向导评价列表
router.get('/:id/reviews', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const reviews = await prisma.$queryRaw`
      SELECT * FROM reviews WHERE target_type = 'guide' AND target_id = ${id}
      ORDER BY created_at DESC LIMIT 30
    `;
    res.json(reviews);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/guides/:id/review — 提交评价（需登录）
router.post('/:id/review', guideWriteLimiter, auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [guide] = await prisma.$queryRaw`SELECT * FROM guides WHERE id = ${id}`;
    if (!guide) return res.status(404).json({ error: '向导不存在' });
    const { rating, content } = req.body;
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: '评分必须在1-5之间' });
    const [user] = await prisma.$queryRaw`SELECT name, avatar FROM users WHERE id = ${req.user.id}`;
    await prisma.$executeRaw`
      INSERT INTO reviews (target_type, target_id, user_id, user_name, user_avatar, rating, content)
      VALUES ('guide', ${id}, ${req.user.id}, ${user ? user.name : ''}, ${user ? user.avatar : ''}, ${rating}, ${content || ''})
    `;
    // 更新向导评分（取所有评价的平均分）
    const [avgResult] = await prisma.$queryRaw`
      SELECT AVG(rating) as avg_rating, COUNT(*) as cnt
      FROM reviews WHERE target_type = 'guide' AND target_id = ${id}
    `;
    if (avgResult) {
      const newRating = Math.round(Number(avgResult.avg_rating) * 10) / 10;
      const reviewCount = Number(avgResult.cnt);
      await prisma.$executeRaw`UPDATE guides SET rating = ${newRating}, reviews = ${reviewCount} WHERE id = ${id}`;
    }
    res.json({ success: true, message: '评价已提交' });
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) {
      return res.status(400).json({ error: '您已经评价过该向导' });
    }
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/guides/apply（需要JWT）
router.post('/apply', applyRateLimit, auth, async (req, res) => {
  try {
    const { name, cert, specialty, languages, dayRate, region,
            id_card_url, climbing_cert_url, insurance_cert_url, health_cert_url,
            passport_url, is_international, nationality, cert_level } = req.body;
    if (!name) return res.status(400).json({ error: '姓名不能为空' });
    const uploadUrls = [id_card_url, climbing_cert_url, insurance_cert_url, health_cert_url, passport_url];
    if (!uploadUrls.every(isValidUploadUrl)) {
      return res.status(400).json({ error: '证件文件地址无效，请通过平台上传' });
    }
    // 检查是否已有申请
    const [existing] = await prisma.$queryRaw`
      SELECT id, status FROM guide_applications WHERE user_id = ${req.user.id}
    `;
    if (existing && existing.status === 'pending') {
      return res.status(400).json({ error: '您已有待审核的申请，请等待审核结果' });
    }
    const level = cert_level || 'basic';
    // 插入申请记录
    await prisma.$executeRaw`
      INSERT INTO guide_applications (user_id, name, cert, specialty, languages, day_rate, region,
        id_card_url, climbing_cert_url, insurance_cert_url, health_cert_url,
        passport_url, is_international, nationality, cert_level)
      VALUES (${req.user.id}, ${name}, ${cert}, ${specialty}, ${languages}, ${dayRate}, ${region},
              ${id_card_url || null}, ${climbing_cert_url || null},
              ${insurance_cert_url || null}, ${health_cert_url || null},
              ${passport_url || null}, ${is_international ? 1 : 0}, ${nationality || null}, ${level})
    `;
    // 同时插入或更新向导表（待审核）
    const [existingGuide] = await prisma.$queryRaw`SELECT id FROM guides WHERE user_id = ${req.user.id}`;
    if (!existingGuide) {
      await prisma.$executeRaw`
        INSERT INTO guides (user_id, name, cert, specialty, languages, day_rate, region, status, cert_level,
          id_card_url, climbing_cert_url, insurance_cert_url, health_cert_url, passport_url, is_international, nationality)
        VALUES (${req.user.id}, ${name}, ${cert}, ${specialty}, ${languages}, ${dayRate}, ${region}, 'pending', ${level},
                ${id_card_url || null}, ${climbing_cert_url || null},
                ${insurance_cert_url || null}, ${health_cert_url || null},
                ${passport_url || null}, ${is_international ? 1 : 0}, ${nationality || null})
      `;
    } else {
      await prisma.$executeRaw`
        UPDATE guides SET status = 'pending', name = ${name}, cert = ${cert}, specialty = ${specialty},
          languages = ${languages}, day_rate = ${dayRate}, region = ${region},
          cert_level = ${level},
          id_card_url = COALESCE(${id_card_url || null}, id_card_url),
          climbing_cert_url = COALESCE(${climbing_cert_url || null}, climbing_cert_url),
          insurance_cert_url = COALESCE(${insurance_cert_url || null}, insurance_cert_url),
          health_cert_url = COALESCE(${health_cert_url || null}, health_cert_url),
          passport_url = COALESCE(${passport_url || null}, passport_url),
          is_international = ${is_international ? 1 : 0},
          nationality = COALESCE(${nationality || null}, nationality)
        WHERE user_id = ${req.user.id}
      `;
    }
    res.json({ success: true, message: '申请已提交，7天内审核完成' });
  } catch (e) {
    console.error('[guides/apply]', e);
    res.status(500).json({ error: '服务器错误' });
  }
});

// PATCH /api/guides/reapply — 向导被拒后重新申请（需要JWT）
router.patch('/reapply', guideWriteLimiter, auth, async (req, res) => {
  try {
    const [guide] = await prisma.$queryRaw`SELECT * FROM guides WHERE user_id = ${req.user.id}`;
    if (!guide) return res.status(404).json({ error: '未找到向导申请记录' });
    if (guide.status !== 'rejected') return res.status(400).json({ error: '只有被拒绝的申请才能重新申请' });

    const { name, cert, specialty, languages, dayRate, region,
            id_card_url, climbing_cert_url, insurance_cert_url, health_cert_url,
            passport_url, is_international, nationality, cert_level } = req.body;

    await prisma.$executeRaw`
      UPDATE guides SET
        status = 'pending',
        reject_reason = NULL,
        name = COALESCE(${name || null}, name),
        cert = COALESCE(${cert || null}, cert),
        specialty = COALESCE(${specialty || null}, specialty),
        languages = COALESCE(${languages || null}, languages),
        day_rate = COALESCE(${dayRate || null}, day_rate),
        region = COALESCE(${region || null}, region),
        cert_level = COALESCE(${cert_level || null}, cert_level),
        id_card_url = COALESCE(${id_card_url || null}, id_card_url),
        climbing_cert_url = COALESCE(${climbing_cert_url || null}, climbing_cert_url),
        insurance_cert_url = COALESCE(${insurance_cert_url || null}, insurance_cert_url),
        health_cert_url = COALESCE(${health_cert_url || null}, health_cert_url),
        passport_url = COALESCE(${passport_url || null}, passport_url),
        is_international = COALESCE(${typeof is_international === 'boolean' ? Number(is_international) : null}, is_international),
        nationality = COALESCE(${nationality || null}, nationality)
      WHERE user_id = ${req.user.id}
    `;

    // 同步更新申请记录
    await prisma.$executeRaw`
      UPDATE guide_applications SET status = 'pending' WHERE user_id = ${req.user.id} AND status = 'rejected'
    `;

    const [updated] = await prisma.$queryRaw`SELECT * FROM guides WHERE user_id = ${req.user.id}`;
    res.json(parseGuide(updated));
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/guides/:id/posts — 向导动态帖子
router.get('/:id/posts', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const posts = await prisma.$queryRaw`
      SELECT * FROM guide_posts WHERE guide_id = ${id} ORDER BY created_at DESC LIMIT 20
    `;
    res.json(posts);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/guides/:id/photos — 向导相册
router.get('/:id/photos', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const photos = await prisma.$queryRaw`
      SELECT * FROM guide_photos WHERE guide_id = ${id} ORDER BY created_at DESC LIMIT 30
    `;
    res.json(photos);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/guides/payment — 向导入驻支付
// 当 PAYMENTS_ENABLED=true 且 Stripe 已配置时，创建真实 Stripe PaymentIntent（$299 USD）
// 否则保持 mock 行为
router.post('/payment', guideWriteLimiter, auth, async (req, res) => {
  try {
    const { guide_application_id, amount, payment_method } = req.body;
    if (!guide_application_id || !amount) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const paymentsEnabled = String(process.env.PAYMENTS_ENABLED || '').toLowerCase() === 'true';
    const stripeKey = (process.env.STRIPE_SECRET_KEY || '').trim();
    const stripeDisabled = String(process.env.STRIPE_DISABLED || '').toLowerCase() === 'true';

    if (paymentsEnabled && stripeKey && !stripeDisabled) {
      // 真实 Stripe PaymentIntent（向导上架费默认 $299）
      const listingAmountUsd = Math.floor(Number(process.env.GUIDE_LISTING_FEE_USD) || 299);
      try {
        const stripe = require('stripe')(stripeKey);
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(listingAmountUsd * 100),
          currency: 'usd',
          metadata: {
            orderType: 'guide_listing',
            orderId: String(guide_application_id),
            userId: String(req.user.id),
          },
        });
        return res.json({
          success: true,
          order_id: paymentIntent.id,
          client_secret: paymentIntent.client_secret,
          amount: listingAmountUsd,
          currency: 'usd',
          payment_method: 'stripe',
          status: 'pending',
          message: '请使用 Stripe 完成支付',
        });
      } catch (stripeErr) {
        console.error('[guides/payment] Stripe error:', stripeErr.message);
        return res.status(500).json({ error: '支付创建失败，请稍后重试' });
      }
    }

    // Fallback: mock 模式
    const mockOrderId = 'GUIDE_PAY_' + Date.now() + '_' + req.user.id;
    res.json({
      success: true,
      order_id: mockOrderId,
      amount,
      payment_method: payment_method || 'alipay',
      status: 'pending',
      message: '支付订单已创建，请完成支付',
      pay_url: null,
    });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/guides/:id/commercial-apply — 向导提交商业资质申请
router.post('/:id/commercial-apply', guideWriteLimiter, auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [guide] = await prisma.$queryRaw`SELECT * FROM guides WHERE id = ${id}`;
    if (!guide) return res.status(404).json({ error: '向导不存在' });
    if (guide.user_id !== req.user.id) return res.status(403).json({ error: '只能提交自己的资质' });
    const { id_card_url, climbing_cert_url, insurance_cert_url, health_cert_url, passport_url } = req.body;
    if (![id_card_url, climbing_cert_url, insurance_cert_url, health_cert_url, passport_url].every(isValidUploadUrl)) {
      return res.status(400).json({ error: '证件文件地址无效，请通过平台上传' });
    }
    await prisma.$executeRaw`
      UPDATE guides SET
        id_card_url = COALESCE(${id_card_url || null}, id_card_url),
        climbing_cert_url = COALESCE(${climbing_cert_url || null}, climbing_cert_url),
        insurance_cert_url = COALESCE(${insurance_cert_url || null}, insurance_cert_url),
        health_cert_url = COALESCE(${health_cert_url || null}, health_cert_url),
        passport_url = COALESCE(${passport_url || null}, passport_url),
        commercial_status = 'pending',
        commercial_applied_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `;
    res.json({ success: true, message: '商业资质申请已提交，请等待审核' });
  } catch (e) {
    console.error('[guides/commercial-apply]', e);
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/guides/pay-listing-fee — 向导支付入驻费
router.post('/pay-listing-fee', payRateLimit, auth, async (req, res) => {
  try {
    const [guide] = await prisma.$queryRaw`
      SELECT * FROM guides WHERE user_id = ${req.user.id} AND status = 'approved_pending_payment'
    `;
    if (!guide) return res.status(404).json({ error: '未找到待付费的向导申请，或申请状态不正确' });
    const certLevel = guide.cert_level || 'basic';
    const levelInfo = GUIDE_CERT_LEVELS[certLevel] || GUIDE_CERT_LEVELS.basic;
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    await prisma.$executeRaw`
      UPDATE guides SET status = 'approved', listing_fee_paid = 1, listing_fee_paid_at = CURRENT_TIMESTAMP,
        cert_expires_at = ${expiresAt.toISOString()}, cert_year_fee = ${levelInfo.yearFee}
      WHERE user_id = ${req.user.id}
    `;
    await prisma.$executeRaw`
      UPDATE guide_applications SET status = 'approved', listing_fee_paid = 1, listing_fee_paid_at = CURRENT_TIMESTAMP
      WHERE user_id = ${req.user.id} AND status = 'approved_pending_payment'
    `;
    try {
      await prisma.$executeRaw`
        INSERT INTO notifications (user_id, type, title, body, link)
        VALUES (${req.user.id}, 'guide_activated', '🎉 向导认证激活成功', '恭喜！您的入驻费已支付，向导资质正式生效，开始接单吧！', '/guide-portal')
      `;
    } catch(e) {}
    res.json({ success: true, message: '入驻费支付成功，向导资质已激活！', guide_id: guide.id });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/guides/:guideId/services — 向导服务列表
router.get('/:guideId/services', async (req, res) => {
  try {
    const guideId = parseInt(req.params.guideId);
    const { type } = req.query;

    let isOwner = false;
    const jwtSecret = process.env.JWT_SECRET;
    const authHeader = req.headers.authorization || '';
    if (jwtSecret && authHeader.startsWith('Bearer ')) {
      try {
        const decoded = jwt.verify(authHeader.slice(7), jwtSecret);
        const [ownerGuide] = await prisma.$queryRaw`SELECT id FROM guides WHERE user_id = ${decoded.id}`;
        if (ownerGuide && ownerGuide.id === guideId) isOwner = true;
      } catch (error) {
        // ignore invalid/expired token for public requests
      }
    }

    let services;
    if (type) {
      if (isOwner) {
        services = await prisma.$queryRaw`
          SELECT * FROM guide_services
          WHERE guide_id = ${guideId} AND status != 'deleted' AND type = ${type}
          ORDER BY created_at DESC
        `;
      } else {
        services = await prisma.$queryRaw`
          SELECT * FROM guide_services
          WHERE guide_id = ${guideId} AND status = 'active' AND type = ${type}
          ORDER BY created_at DESC
        `;
      }
    } else {
      if (isOwner) {
        services = await prisma.$queryRaw`
          SELECT * FROM guide_services
          WHERE guide_id = ${guideId} AND status != 'deleted'
          ORDER BY created_at DESC
        `;
      } else {
        services = await prisma.$queryRaw`
          SELECT * FROM guide_services
          WHERE guide_id = ${guideId} AND status = 'active'
          ORDER BY created_at DESC
        `;
      }
    }
    res.json(services);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/guides/:guideId/services — 向导发布服务
router.post('/:guideId/services', guideWriteLimiter, auth, async (req, res) => {
  try {
    const guideId = parseInt(req.params.guideId);
    const [guide] = await prisma.$queryRaw`SELECT * FROM guides WHERE id = ${guideId}`;
    if (!guide) return res.status(404).json({ error: '向导不存在' });
    if (guide.user_id !== req.user.id) return res.status(403).json({ error: '只能发布自己的服务' });
    const { title, description, cover, type, mountain, region, price, price_unit,
            duration_days, max_clients, difficulty, includes, start_date, end_date } = req.body;
    if (!title) return res.status(400).json({ error: '请填写服务标题' });
    // 内容审核
    const titleCheck = moderation.checkText(title);
    if (!titleCheck.ok) return res.status(422).json({ error: 'content_blocked', reason: titleCheck.reason });
    const descCheck = moderation.checkText(description);
    if (!descCheck.ok) return res.status(422).json({ error: 'content_blocked', reason: descCheck.reason });
    // 商业资质校验
    if (price > 0 && !guide.commercial_verified) {
      return res.status(422).json({ error: 'commercial_not_verified' });
    }
    // 幂等检测：30秒内相同向导+标题+开始日期视为重复提交
    const idempotencyWindow = `-${SERVICE_PUBLISH_IDEMPOTENCY_WINDOW_SECONDS} seconds`;
    const recentDup = (await prisma.$queryRaw`
      SELECT id FROM guide_services
      WHERE guide_id = ${guide.id}
        AND title = ${title}
        AND start_date = ${start_date || ''}
        AND created_at >= datetime('now', ${idempotencyWindow})
    `)[0];
    if (recentDup) return res.status(409).json({ error: '请勿重复提交，服务已创建' });
    const includesStr = includes ? JSON.stringify(includes) : null;
    await prisma.$executeRaw`
      INSERT INTO guide_services
        (guide_id, title, description, cover, type, mountain, region, price, price_unit,
         duration_days, max_clients, difficulty, includes, start_date, end_date)
      VALUES (${guide.id}, ${title}, ${description || ''}, ${cover || ''}, ${type || 'guided_climb'},
              ${mountain || ''}, ${region || ''}, ${price || 0}, ${price_unit || 'per_person'},
              ${duration_days || 1}, ${max_clients || 6}, ${difficulty || ''}, ${includesStr},
              ${start_date || ''}, ${end_date || ''})
    `;
    const [service] = await prisma.$queryRaw`SELECT * FROM guide_services ORDER BY id DESC LIMIT 1`;
    res.json(service);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/guides/:guideId/services/:id — 更新向导服务
router.put('/:guideId/services/:id', guideWriteLimiter, auth, async (req, res) => {
  try {
    const guideId = parseInt(req.params.guideId);
    const svcId = parseInt(req.params.id);
    const [guide] = await prisma.$queryRaw`SELECT * FROM guides WHERE id = ${guideId}`;
    if (!guide) return res.status(404).json({ error: '向导不存在' });
    if (guide.user_id !== req.user.id) return res.status(403).json({ error: '无权操作' });
    const [svc] = await prisma.$queryRaw`
      SELECT * FROM guide_services WHERE id = ${svcId} AND guide_id = ${guideId}
    `;
    if (!svc) return res.status(404).json({ error: '服务不存在' });
    const { title, description, cover, type, mountain, region, price, price_unit,
            duration_days, max_clients, difficulty, includes, start_date, end_date, status } = req.body;
    if (title) {
      const titleCheck = moderation.checkText(title);
      if (!titleCheck.ok) return res.status(422).json({ error: 'content_blocked', reason: titleCheck.reason });
    }
    if (description) {
      const descCheck = moderation.checkText(description);
      if (!descCheck.ok) return res.status(422).json({ error: 'content_blocked', reason: descCheck.reason });
    }
    const newPrice = price !== undefined ? price : svc.price;
    if (newPrice > 0 && !guide.commercial_verified) {
      return res.status(422).json({ error: 'commercial_not_verified' });
    }
    const includesStr = includes ? JSON.stringify(includes) : svc.includes;
    await prisma.$executeRaw`
      UPDATE guide_services SET
        title = ${title || svc.title},
        description = ${description !== undefined ? description : svc.description},
        cover = ${cover !== undefined ? cover : svc.cover},
        type = ${type || svc.type},
        mountain = ${mountain !== undefined ? mountain : svc.mountain},
        region = ${region !== undefined ? region : svc.region},
        price = ${newPrice},
        price_unit = ${price_unit || svc.price_unit},
        duration_days = ${duration_days || svc.duration_days},
        max_clients = ${max_clients || svc.max_clients},
        difficulty = ${difficulty !== undefined ? difficulty : svc.difficulty},
        includes = ${includesStr},
        start_date = ${start_date !== undefined ? start_date : svc.start_date},
        end_date = ${end_date !== undefined ? end_date : svc.end_date},
        status = ${status || svc.status},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${svcId}
    `;
    const [updated] = await prisma.$queryRaw`SELECT * FROM guide_services WHERE id = ${svcId}`;
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// DELETE /api/guides/:guideId/services/:id — 软删向导服务
router.delete('/:guideId/services/:id', guideWriteLimiter, auth, async (req, res) => {
  try {
    const guideId = parseInt(req.params.guideId);
    const svcId = parseInt(req.params.id);
    const [guide] = await prisma.$queryRaw`SELECT * FROM guides WHERE id = ${guideId}`;
    if (!guide) return res.status(404).json({ error: '向导不存在' });
    if (guide.user_id !== req.user.id) return res.status(403).json({ error: '无权操作' });
    const changes = await prisma.$executeRaw`
      UPDATE guide_services SET status = 'deleted', updated_at = CURRENT_TIMESTAMP
      WHERE id = ${svcId} AND guide_id = ${guideId}
    `;
    if (changes === 0) return res.status(404).json({ error: '服务不存在' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/guides/:guideId/services/:id/book — 预约向导服务
router.post('/:guideId/services/:id/book', guideWriteLimiter, auth, async (req, res) => {
  try {
    const guideId = parseInt(req.params.guideId);
    const svcId = parseInt(req.params.id);
    const [guide] = await prisma.$queryRaw`SELECT * FROM guides WHERE id = ${guideId}`;
    if (!guide) return res.status(404).json({ error: '向导不存在' });
    const [service] = await prisma.$queryRaw`
      SELECT * FROM guide_services WHERE id = ${svcId} AND guide_id = ${guideId} AND status = 'active'
    `;
    if (!service) return res.status(404).json({ error: '服务不存在或已下架' });
    // 重复预约校验
    const [existing] = await prisma.$queryRaw`
      SELECT id FROM guide_service_orders
      WHERE service_id = ${svcId} AND user_id = ${req.user.id}
        AND status NOT IN ('cancelled', 'refunded')
    `;
    if (existing) return res.status(400).json({ error: '您已预约此服务' });
    // 必填字段校验
    const { emergency_contact_name, emergency_contact_phone, agreedWaiver, waiverVersion, start_date, client_notes } = req.body;
    if (!emergency_contact_name || !emergency_contact_phone) {
      return res.status(400).json({ error: '请填写紧急联系人姓名和电话' });
    }
    if (!agreedWaiver) {
      return res.status(400).json({ error: '请同意免责协议' });
    }
    const orderNo = 'GSO' + Date.now() + crypto.randomBytes(3).toString('hex').toUpperCase();
    const statusHistory = appendStatusHistory(null, 'pending_payment');
    await prisma.$executeRaw`
      INSERT INTO guide_service_orders
        (order_no, service_id, guide_id, user_id, amount, status, status_history,
         emergency_contact_name, emergency_contact_phone, agreed_waiver, waiver_version,
         start_date, client_notes)
      VALUES (${orderNo}, ${service.id}, ${guide.id}, ${req.user.id}, ${service.price || 0},
              'pending_payment', ${statusHistory},
              ${emergency_contact_name}, ${emergency_contact_phone}, 1, ${waiverVersion || ''},
              ${start_date || ''}, ${client_notes || ''})
    `;
    // 通知向导
    try {
      await prisma.$executeRaw`
        INSERT INTO notifications (user_id, type, content, related_id)
        VALUES (${guide.user_id}, 'guide_service_booked', ${`【新预约】${service.title} 有客户预约，订单号：${orderNo}`}, ${service.id})
      `;
    } catch(e) {}
    const [order] = await prisma.$queryRaw`SELECT * FROM guide_service_orders WHERE order_no = ${orderNo}`;
    res.json(order);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/guides/:guideId/services/:id/bookings — 向导查看预约列表
router.get('/:guideId/services/:id/bookings', guideReadLimiter, auth, async (req, res) => {
  try {
    const guideId = parseInt(req.params.guideId);
    const svcId = parseInt(req.params.id);
    const [guide] = await prisma.$queryRaw`SELECT * FROM guides WHERE id = ${guideId}`;
    if (!guide) return res.status(404).json({ error: '向导不存在' });
    if (guide.user_id !== req.user.id) return res.status(403).json({ error: '无权查看预约列表' });
    const bookings = await prisma.$queryRaw`
      SELECT gso.*, u.name as user_name, u.avatar as user_avatar, u.phone as user_phone
      FROM guide_service_orders gso
      LEFT JOIN users u ON u.id = gso.user_id
      WHERE gso.service_id = ${svcId} AND gso.guide_id = ${guideId}
      ORDER BY gso.created_at DESC
    `;
    res.json(bookings);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/guides/connect-stripe — 向导绑定 Stripe Express 收款账户
router.post('/connect-stripe', guideWriteLimiter, auth, async (req, res) => {
  try {
    const [guide] = await prisma.$queryRaw`SELECT * FROM guides WHERE user_id = ${req.user.id} AND status = 'approved'`;
    if (!guide) return res.status(403).json({ error: '仅已审核通过的向导可绑定收款账户' });
    const [user] = await prisma.$queryRaw`SELECT email FROM users WHERE id = ${req.user.id}`;
    const apiBase = (process.env.API_BASE || 'https://summitlink.app').replace(/\/$/, '');
    const returnUrl = `${apiBase}/guide-portal?stripe=connected`;
    const refreshUrl = `${apiBase}/guide-portal?stripe=refresh`;

    // 若已有 stripeAccountId，直接生成 onboarding 链接（续签或重新入驻）
    let accountId = guide.stripe_account_id || null;
    if (!accountId) {
      const { accountId: newId } = await stripeConnect.createConnectedAccount({
        email: user ? user.email || '' : '',
        country: 'US',
      });
      accountId = newId;
      await prisma.$executeRaw`
        UPDATE guides SET stripe_account_id = ${accountId} WHERE id = ${guide.id}
      `;
    }
    const { url, mock } = await stripeConnect.createAccountLink({ accountId, returnUrl, refreshUrl });
    res.json({ success: true, onboardingUrl: url, mock });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/guides/service-orders/:orderNo/pay — 区域感知支付唤起（向导服务预约）
router.post('/service-orders/:orderNo/pay', paymentLimiter, auth, async (req, res) => {
  try {
    const { orderNo } = req.params;
    const { openid } = req.body || {};
    const [order] = await prisma.$queryRaw`
      SELECT gso.*, gs.title as service_title
      FROM guide_service_orders gso
      LEFT JOIN guide_services gs ON gs.id = gso.service_id
      WHERE gso.order_no = ${orderNo} AND gso.user_id = ${req.user.id}
    `;
    if (!order) return res.status(404).json({ error: '订单不存在' });
    if (order.status === 'paid') return res.json({ provider: 'paid', message: '订单已支付' });
    if (order.status !== 'pending_payment') {
      return res.status(400).json({ error: `订单状态为 ${order.status}，无法发起支付` });
    }
    const description = order.service_title || 'SummitLink 向导服务';
    const amountFen = Math.round(Number(order.amount || 0) * 100);
    const region = detectRegion(req);
    const stripeKey = (process.env.STRIPE_SECRET_KEY || '').trim();
    const stripeDisabled = String(process.env.STRIPE_DISABLED || '').toLowerCase() === 'true';

    if (region === 'cn') {
      const notifyUrl = `${process.env.API_BASE || 'https://summitlink.app'}/api/guides/payment/notify/wechat`;
      const payParams = await wechatPay.createOrder({
        body: description,
        outTradeNo: orderNo,
        totalFee: amountFen,
        notifyUrl,
        openid: openid || null,
      });
      return res.json({ provider: 'wechat', payParams });
    }
    if (stripeKey && !stripeDisabled) {
      try {
        const stripe = require('stripe')(stripeKey);
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amountFen,
          currency: 'cny',
          metadata: { orderNo, userId: String(req.user.id) },
          description,
        });
        return res.json({ provider: 'stripe', clientSecret: paymentIntent.client_secret });
      } catch (stripeErr) {
        console.error('[guides/service-orders/pay] Stripe error:', stripeErr.message);
      }
    }
    return res.json({ provider: 'mock', orderId: 'mock_' + orderNo });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/guides/payment/notify/wechat — 向导服务微信支付回调
router.post('/payment/notify/wechat', async (req, res) => {
  try {
    const rawBody = req.body;
    const signature = req.headers['wechatpay-signature'] || '';
    const timestamp = req.headers['wechatpay-timestamp'] || '';
    const nonce = req.headers['wechatpay-nonce'] || '';
    let verified = false;
    let notifyPayload = {};
    try {
      const result = await wechatPay.verifyNotify(rawBody, signature, timestamp, nonce);
      verified = !!(result && result.valid);
      notifyPayload = (result && result.payload) || {};
    } catch (err) { console.error('[guides/notify/wechat] verifyNotify error:', err.message); verified = false; }
    if (!verified) {
      return res.status(200).send('<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[SIGN_ERROR]]></return_msg></xml>');
    }
    const outTradeNo = notifyPayload.out_trade_no || null;
    if (outTradeNo) {
      const now = new Date().toISOString();
      await prisma.$executeRaw`
        UPDATE guide_service_orders SET status = 'paid', paid_at = ${now}
        WHERE order_no = ${outTradeNo} AND status = 'pending_payment'
      `;
    }
    res.status(200).send('<xml><return_code><![CDATA[SUCCESS]]></return_code><return_msg><![CDATA[OK]]></return_msg></xml>');
  } catch (e) {
    res.status(200).send('<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[SERVER_ERROR]]></return_msg></xml>');
  }
});

module.exports = router;
