const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const auth = require('../middleware/auth');
const moderation = require('../utils/moderation');
const { VALID_TRANSITIONS, appendStatusHistory } = require('./orderStateMachine');
const crypto = require('crypto');
const { GUIDE_CERT_LEVELS } = require('../utils/certLevels');
const rateLimit = require('express-rate-limit');

const applyRateLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false, message: { error: '申请频率过高，请稍后再试' } });
const payRateLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false, message: { error: '操作频率过高，请稍后再试' } });
const guideReadLimiter = rateLimit({ windowMs: 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false, message: { error: '请求过于频繁，请稍后再试' } });
const guideWriteLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false, message: { error: '操作过于频繁，请稍后再试' } });

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
      SELECT id, name, avatar, flag, nationality, rating, reviews,
             specialty, day_rate as dayRate
      FROM guides WHERE status = 'approved'
      ORDER BY rating DESC
    `;
    res.json(guides);
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

// GET /api/guides/:id — 向导详情
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [guide] = await prisma.$queryRaw`SELECT * FROM guides WHERE id = ${id} AND status = 'approved'`;
    if (!guide) return res.status(404).json({ error: '向导不存在' });
    res.json(parseGuide(guide));
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

// POST /api/guides/payment — 向导入驻支付（预留，后续完善）
// TODO: 接入真实支付系统（支付宝/微信支付）
router.post('/payment', guideWriteLimiter, auth, async (req, res) => {
  try {
    const { guide_application_id, amount, payment_method } = req.body;
    if (!guide_application_id || !amount) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    // TODO: 调用支付接口，生成订单
    const mockOrderId = 'GUIDE_PAY_' + Date.now() + '_' + req.user.id;
    res.json({
      success: true,
      order_id: mockOrderId,
      amount,
      payment_method: payment_method || 'alipay',
      status: 'pending',
      message: '支付订单已创建，请完成支付',
      // TODO: 返回支付跳转 URL / 二维码
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
    let services;
    if (type) {
      services = await prisma.$queryRaw`
        SELECT * FROM guide_services WHERE guide_id = ${guideId} AND status != 'deleted' AND type = ${type}
        ORDER BY created_at DESC
      `;
    } else {
      services = await prisma.$queryRaw`
        SELECT * FROM guide_services WHERE guide_id = ${guideId} AND status != 'deleted'
        ORDER BY created_at DESC
      `;
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

module.exports = router;
