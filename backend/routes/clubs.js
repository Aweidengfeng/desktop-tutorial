const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const auth = require('../middleware/auth');
const moderation = require('../utils/moderation');
const { VALID_TRANSITIONS, appendStatusHistory } = require('./orderStateMachine');
const crypto = require('crypto');
const { CLUB_CERT_LEVELS } = require('../utils/certLevels');
const rateLimit = require('express-rate-limit');

const clubPayRateLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false, message: { error: '操作频率过高，请稍后再试' } });
const clubReadLimiter = rateLimit({ windowMs: 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false, message: { error: '请求过于频繁，请稍后再试' } });
const clubWriteLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false, message: { error: '操作过于频繁，请稍后再试' } });

// POST /api/clubs/apply — 提交俱乐部入驻申请（需要JWT）
router.post('/apply', clubWriteLimiter, auth, async (req, res) => {
  try {
    const { club_name, description, specialty, region, type, contact, wechat, website, cert_url } = req.body;
    if (!club_name || !contact) return res.status(400).json({ error: '俱乐部名称和联系方式不能为空' });
    const [existing] = await prisma.$queryRaw`
      SELECT id FROM club_applications WHERE user_id = ${req.user.id} AND status = 'pending'
    `;
    if (existing) return res.status(400).json({ error: '您已有待审核的申请，请等待审核结果' });
    await prisma.$executeRaw`
      INSERT INTO club_applications (user_id, club_name, description, specialty, region, type, contact, wechat, website, cert_url)
      VALUES (${req.user.id}, ${club_name}, ${description || null}, ${specialty || null}, ${region || null},
              ${type || '综合'}, ${contact}, ${wechat || null}, ${website || null}, ${cert_url || null})
    `;
    const [application] = await prisma.$queryRaw`
      SELECT * FROM club_applications WHERE user_id = ${req.user.id} ORDER BY id DESC LIMIT 1
    `;
    res.json(application);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/clubs/apply/status — 查询当前用户申请状态（需要JWT）
router.get('/apply/status', clubReadLimiter, auth, async (req, res) => {
  try {
    const [application] = await prisma.$queryRaw`
      SELECT * FROM club_applications WHERE user_id = ${req.user.id} ORDER BY created_at DESC LIMIT 1
    `;
    if (!application) return res.json({ status: 'none' });
    res.json(application);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PATCH /api/clubs/reapply — 俱乐部被拒后重新申请（需要JWT）
router.patch('/reapply', clubWriteLimiter, auth, async (req, res) => {
  try {
    const [app] = await prisma.$queryRaw`
      SELECT * FROM club_applications WHERE user_id = ${req.user.id} AND status = 'rejected' ORDER BY id DESC LIMIT 1
    `;
    if (!app) return res.status(404).json({ error: '未找到被拒绝的俱乐部申请' });

    const { club_name, description, specialty, region, contact, wechat, website, cert_url } = req.body;

    await prisma.$executeRaw`
      UPDATE club_applications SET
        status = 'pending',
        reject_reason = NULL,
        club_name = COALESCE(${club_name || null}, club_name),
        description = COALESCE(${description || null}, description),
        specialty = COALESCE(${specialty || null}, specialty),
        region = COALESCE(${region || null}, region),
        contact = COALESCE(${contact || null}, contact),
        wechat = COALESCE(${wechat || null}, wechat),
        website = COALESCE(${website || null}, website),
        cert_url = COALESCE(${cert_url || null}, cert_url)
      WHERE id = ${app.id}
    `;

    const [updated] = await prisma.$queryRaw`SELECT * FROM club_applications WHERE id = ${app.id}`;
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/clubs/me — 查看自己的俱乐部/申请状态（需要JWT）
router.get('/me', clubReadLimiter, auth, async (req, res) => {
  try {
    // 先找已批准的俱乐部
    const [club] = await prisma.$queryRaw`SELECT * FROM clubs WHERE creator_id = ${req.user.id}`;
    if (club) return res.json(club);
    // 再找申请记录
    const [app] = await prisma.$queryRaw`
      SELECT * FROM club_applications WHERE user_id = ${req.user.id} ORDER BY id DESC LIMIT 1
    `;
    if (!app) return res.json({ status: 'none' });
    res.json(app);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/clubs/me — 更新俱乐部资料（仅 pending 申请可改）
router.put('/me', clubWriteLimiter, auth, async (req, res) => {
  try {
    // 已成立俱乐部允许更新基本信息
    const [club] = await prisma.$queryRaw`SELECT * FROM clubs WHERE creator_id = ${req.user.id}`;
    if (club) {
      const { description, contact, wechat, website, cover_image, logo } = req.body;
      await prisma.$executeRaw`
        UPDATE clubs SET
          description = COALESCE(${description || null}, description),
          contact = COALESCE(${contact || null}, contact),
          wechat = COALESCE(${wechat || null}, wechat),
          website = COALESCE(${website || null}, website),
          cover_image = COALESCE(${cover_image || null}, cover_image),
          logo = COALESCE(${logo || null}, logo)
        WHERE creator_id = ${req.user.id}
      `;
      const [updated] = await prisma.$queryRaw`SELECT * FROM clubs WHERE creator_id = ${req.user.id}`;
      return res.json(updated);
    }
    // 还在申请中，允许修改申请信息
    const [app] = await prisma.$queryRaw`
      SELECT * FROM club_applications WHERE user_id = ${req.user.id} AND status = 'pending' ORDER BY id DESC LIMIT 1
    `;
    if (!app) return res.status(404).json({ error: '没有找到待审核的申请' });
    const { club_name, description, specialty, region, contact } = req.body;
    await prisma.$executeRaw`
      UPDATE club_applications SET
        club_name = COALESCE(${club_name || null}, club_name),
        description = COALESCE(${description || null}, description),
        specialty = COALESCE(${specialty || null}, specialty),
        region = COALESCE(${region || null}, region),
        contact = COALESCE(${contact || null}, contact)
      WHERE id = ${app.id}
    `;
    const [updated] = await prisma.$queryRaw`SELECT * FROM club_applications WHERE id = ${app.id}`;
    return res.json(updated);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// ── 俱乐部向导管理（需俱乐部管理员身份）─────────────────────────────────

// GET /api/clubs/my/guides — 返回本俱乐部所有挂靠向导列表
router.get('/my/guides', clubReadLimiter, auth, async (req, res) => {
  try {
    const [club] = await prisma.$queryRaw`SELECT * FROM clubs WHERE creator_id = ${req.user.id}`;
    if (!club) return res.status(403).json({ error: '仅俱乐部管理员可访问' });
    const guides = await prisma.$queryRaw`
      SELECT g.id, g.name, g.avatar, g.rating, g.reviews, g.specialty,
             g.experience_years as experienceYears, g.cert, g.status,
             g.affiliation_type as affiliationType, g.user_id as userId
      FROM guides g
      WHERE g.affiliation_club_id = ${club.id} AND g.status = 'approved'
      ORDER BY g.rating DESC
    `;
    res.json(guides);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/clubs/my/guides/invite — 发送挂靠邀请（通过向导 ID 或邮箱）
router.post('/my/guides/invite', clubWriteLimiter, auth, async (req, res) => {
  try {
    const [club] = await prisma.$queryRaw`SELECT * FROM clubs WHERE creator_id = ${req.user.id}`;
    if (!club) return res.status(403).json({ error: '仅俱乐部管理员可操作' });

    const { guideId, email } = req.body || {};
    if (!guideId && !email) {
      return res.status(400).json({ error: '请提供向导 ID 或邮箱' });
    }

    let guide = null;
    if (guideId) {
      [guide] = await prisma.$queryRaw`SELECT g.*, u.email FROM guides g JOIN users u ON u.id = g.user_id WHERE g.id = ${Number(guideId)}`;
    } else if (email) {
      [guide] = await prisma.$queryRaw`SELECT g.*, u.email FROM guides g JOIN users u ON u.id = g.user_id WHERE u.email = ${String(email)}`;
    }

    if (!guide) return res.status(404).json({ error: '向导不存在' });
    if (guide.status !== 'approved') return res.status(400).json({ error: '向导尚未通过认证' });
    if (guide.affiliation_club_id && guide.affiliation_club_id !== club.id) {
      return res.status(400).json({ error: '该向导已挂靠其他俱乐部' });
    }
    if (guide.affiliation_club_id === club.id) {
      return res.status(400).json({ error: '该向导已是本俱乐部成员' });
    }

    // 直接写入 affiliation_club_id（简单方案，无需独立 invite 表）
    await prisma.$executeRaw`
      UPDATE guides SET affiliation_club_id = ${club.id}, affiliation_type = 'affiliated'
      WHERE id = ${guide.id}
    `;
    // 发送站内通知
    try {
      await prisma.$executeRaw`
        INSERT INTO notifications (user_id, type, title, body, link)
        VALUES (${guide.user_id}, 'club_affiliation_invite', '🤝 俱乐部挂靠通知',
                ${`${club.name} 已将您纳入旗下向导`}, '/guide-portal')
      `;
    } catch (_) {}

    res.json({ success: true, message: '已成功邀请向导挂靠本俱乐部', guideId: guide.id });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// DELETE /api/clubs/my/guides/:guideId — 解除挂靠关系
router.delete('/my/guides/:guideId', clubWriteLimiter, auth, async (req, res) => {
  try {
    const [club] = await prisma.$queryRaw`SELECT * FROM clubs WHERE creator_id = ${req.user.id}`;
    if (!club) return res.status(403).json({ error: '仅俱乐部管理员可操作' });

    const guideId = parseInt(req.params.guideId);
    const [guide] = await prisma.$queryRaw`SELECT * FROM guides WHERE id = ${guideId} AND affiliation_club_id = ${club.id}`;
    if (!guide) return res.status(404).json({ error: '向导不存在或不属于本俱乐部' });

    await prisma.$executeRaw`
      UPDATE guides SET affiliation_club_id = NULL, affiliation_type = NULL
      WHERE id = ${guideId} AND affiliation_club_id = ${club.id}
    `;
    // 发送站内通知
    try {
      await prisma.$executeRaw`
        INSERT INTO notifications (user_id, type, title, body, link)
        VALUES (${guide.user_id}, 'club_affiliation_removed', '📋 俱乐部挂靠已解除',
                ${`您已从 ${club.name} 的旗下向导列表移除`}, '/guide-portal')
      `;
    } catch (_) {}

    res.json({ success: true, message: '已解除挂靠关系' });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/clubs/featured — 精选俱乐部（首页展示，最多6个认证且活跃的俱乐部）
// 注意：此路由必须在 /:id 之前注册
router.get('/featured', async (req, res) => {
  try {
    const clubs = await prisma.$queryRaw`
      SELECT id, name, description, cover, specialty, region, type,
             members_count as members, expeditions, verified, founded, status, created_at
      FROM clubs
      WHERE status = 'active'
      ORDER BY verified DESC, members_count DESC
      LIMIT 6
    `;
    res.json(clubs);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/clubs
/**
 * @swagger
 * /api/clubs:
 *   get:
 *     tags: [俱乐部]
 *     summary: 获取俱乐部列表
 *     description: 返回 status=active 的俱乐部，按成员数降序排列
 *     security: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 100, maximum: 100 }
 *     responses:
 *       200:
 *         description: 俱乐部数组
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Club'
 */
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 100);
    const clubs = await prisma.$queryRaw`
      SELECT id, name, description, cover, specialty, region, type,
             members_count as members, expeditions, verified, founded, status, created_at
      FROM clubs WHERE status = 'active' ORDER BY members_count DESC LIMIT ${limit}
    `;
    res.json(clubs);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/clubs/my/kyc — 俱乐部提交 KYC / 营业执照材料
// 注意：此路由必须注册在 /:id 之前，防止 my 被解析为 id
router.post('/my/kyc', clubWriteLimiter, auth, async (req, res) => {
  try {
    const [club] = await prisma.$queryRaw`SELECT * FROM clubs WHERE creator_id = ${req.user.id}`;
    if (!club) return res.status(403).json({ error: '仅俱乐部管理员可提交 KYC' });
    const { businessLicenseUrl, legalRepIdUrl, bankAccountInfo, insuranceCertUrl } = req.body;
    await prisma.$executeRaw`
      UPDATE clubs SET
        business_license_url = COALESCE(${businessLicenseUrl || null}, business_license_url),
        legal_rep_id_url     = COALESCE(${legalRepIdUrl || null}, legal_rep_id_url),
        bank_account_info    = COALESCE(${bankAccountInfo || null}, bank_account_info),
        insurance_cert_url   = COALESCE(${insuranceCertUrl || null}, insurance_cert_url),
        kyc_status           = 'pending',
        kyc_submitted_at     = CURRENT_TIMESTAMP
      WHERE creator_id = ${req.user.id}
    `;
    try {
      await prisma.$executeRaw`
        INSERT INTO notifications (user_id, type, title, body, link)
        VALUES (${req.user.id}, 'kyc_submitted', '📄 KYC 材料已提交', '您的营业执照/KYC 材料已提交，平台将在 48 小时内完成审核。', '/club-portal')
      `;
    } catch (notificationError) {
      console.error('[clubs/my/kyc][notification]', notificationError);
    }
    res.json({ success: true, message: 'KYC 材料已提交，平台将在 48 小时内审核' });
  } catch (e) {
    console.error('[clubs/my/kyc]', e);
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/clubs/:id — 俱乐部详情
/**
 * @swagger
 * /api/clubs/{id}:
 *   get:
 *     tags: [俱乐部]
 *     summary: 获取俱乐部详情
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: 俱乐部详情
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Club'
 *       404:
 *         description: 俱乐部不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [club] = await prisma.$queryRaw`
      SELECT id, name, description, cover, specialty, region, type,
             members_count as members, expeditions, verified, founded, status, creator_id,
             contact, wechat, website, cover_image, logo, created_at
      FROM clubs WHERE id = ${id}
    `;
    if (!club) return res.status(404).json({ error: '俱乐部不存在' });
    res.json(club);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/clubs/:id/activities — 俱乐部活动/套餐列表
router.get('/:id/activities', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { type } = req.query;
    let activities;
    if (type) {
      activities = await prisma.$queryRaw`
        SELECT * FROM club_activities WHERE club_id = ${id} AND status != 'deleted' AND type = ${type}
        ORDER BY created_at DESC
      `;
    } else {
      activities = await prisma.$queryRaw`
        SELECT * FROM club_activities WHERE club_id = ${id} AND status != 'deleted'
        ORDER BY created_at DESC
      `;
    }
    res.json(activities);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/clubs/:id/members — 俱乐部成员列表
router.get('/:id/members', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const members = await prisma.$queryRaw`
      SELECT cm.id, cm.user_id, cm.role, cm.joined_at,
             u.name, u.avatar, u.level
      FROM club_members cm
      JOIN users u ON u.id = cm.user_id
      WHERE cm.club_id = ${id}
      ORDER BY cm.joined_at ASC LIMIT 20
    `;
    res.json(members);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/clubs/:id/reviews — 俱乐部评价列表
router.get('/:id/reviews', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const reviews = await prisma.$queryRaw`
      SELECT * FROM reviews WHERE target_type = 'club' AND target_id = ${id}
      ORDER BY created_at DESC LIMIT 30
    `;
    res.json(reviews);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/clubs/:id/review — 提交评价（需登录）
router.post('/:id/review', clubWriteLimiter, auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [club] = await prisma.$queryRaw`SELECT * FROM clubs WHERE id = ${id}`;
    if (!club) return res.status(404).json({ error: '俱乐部不存在' });
    const { rating, content } = req.body;
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: '评分必须在1-5之间' });
    const [user] = await prisma.$queryRaw`SELECT name, avatar FROM users WHERE id = ${req.user.id}`;
    await prisma.$executeRaw`
      INSERT INTO reviews (target_type, target_id, user_id, user_name, user_avatar, rating, content)
      VALUES ('club', ${id}, ${req.user.id}, ${user ? user.name : ''}, ${user ? user.avatar : ''}, ${rating}, ${content || ''})
    `;
    res.json({ success: true, message: '评价已提交' });
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) {
      return res.status(400).json({ error: '您已经评价过该俱乐部' });
    }
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/clubs/:id/activity — 俱乐部发布活动/套餐（需是创建者或管理员）
router.post('/:id/activity', clubWriteLimiter, auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [club] = await prisma.$queryRaw`SELECT * FROM clubs WHERE id = ${id}`;
    if (!club) return res.status(404).json({ error: '俱乐部不存在' });
    const [member] = await prisma.$queryRaw`
      SELECT role FROM club_members WHERE club_id = ${id} AND user_id = ${req.user.id}
    `;
    const isCreator = club.creator_id === req.user.id;
    const isAdmin = member && (member.role === 'admin' || member.role === 'founder');
    if (!isCreator && !isAdmin) return res.status(403).json({ error: '无权发布活动，仅俱乐部创建者或管理员可操作' });
    const { title, description, cover, type, mountain, region, price, max_members, start_date, end_date, difficulty, includes, waiver_version } = req.body;
    if (!title) return res.status(400).json({ error: '请填写活动标题' });
    // 内容审核
    const titleCheck = moderation.checkText(title);
    if (!titleCheck.ok) return res.status(422).json({ error: 'content_blocked', reason: titleCheck.reason });
    const descCheck = moderation.checkText(description);
    if (!descCheck.ok) return res.status(422).json({ error: 'content_blocked', reason: descCheck.reason });
    // 商业资质校验
    if (price > 0 && !club.commercial_verified) {
      return res.status(422).json({ error: 'commercial_not_verified' });
    }
    const includesStr = includes ? JSON.stringify(includes) : null;
    await prisma.$executeRaw`
      INSERT INTO club_activities (club_id, title, description, cover, type, mountain, region, price, max_members, start_date, end_date, difficulty, includes)
      VALUES (${id}, ${title}, ${description || ''}, ${cover || ''}, ${type || 'activity'},
              ${mountain || ''}, ${region || ''}, ${price || 0}, ${max_members || 10},
              ${start_date || ''}, ${end_date || ''}, ${difficulty || ''}, ${includesStr})
    `;
    const [activity] = await prisma.$queryRaw`
      SELECT * FROM club_activities WHERE club_id = ${id} ORDER BY id DESC LIMIT 1
    `;
    res.json(activity);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/clubs/:id/activity/:actId — 更新活动
router.put('/:id/activity/:actId', clubWriteLimiter, auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const actId = parseInt(req.params.actId);
    const [club] = await prisma.$queryRaw`SELECT * FROM clubs WHERE id = ${id}`;
    if (!club) return res.status(404).json({ error: '俱乐部不存在' });
    const [member] = await prisma.$queryRaw`
      SELECT role FROM club_members WHERE club_id = ${id} AND user_id = ${req.user.id}
    `;
    const isCreator = club.creator_id === req.user.id;
    const isAdmin = member && (member.role === 'admin' || member.role === 'founder');
    if (!isCreator && !isAdmin) return res.status(403).json({ error: '无权操作' });
    const { title, description, cover, type, mountain, region, price, max_members, start_date, end_date, difficulty, includes, status } = req.body;
    const [act] = await prisma.$queryRaw`
      SELECT * FROM club_activities WHERE id = ${actId} AND club_id = ${id}
    `;
    if (!act) return res.status(404).json({ error: '活动不存在' });
    // 内容审核
    if (title) {
      const titleCheck = moderation.checkText(title);
      if (!titleCheck.ok) return res.status(422).json({ error: 'content_blocked', reason: titleCheck.reason });
    }
    if (description) {
      const descCheck = moderation.checkText(description);
      if (!descCheck.ok) return res.status(422).json({ error: 'content_blocked', reason: descCheck.reason });
    }
    // 商业资质校验
    const newPrice = price !== undefined ? price : act.price;
    if (newPrice > 0 && !club.commercial_verified) {
      return res.status(422).json({ error: 'commercial_not_verified' });
    }
    const includesStr = includes ? JSON.stringify(includes) : act.includes;
    await prisma.$executeRaw`
      UPDATE club_activities SET
        title = ${title || act.title},
        description = ${description !== undefined ? description : act.description},
        cover = ${cover !== undefined ? cover : act.cover},
        type = ${type || act.type},
        mountain = ${mountain !== undefined ? mountain : act.mountain},
        region = ${region !== undefined ? region : act.region},
        price = ${newPrice},
        max_members = ${max_members || act.max_members},
        start_date = ${start_date !== undefined ? start_date : act.start_date},
        end_date = ${end_date !== undefined ? end_date : act.end_date},
        difficulty = ${difficulty !== undefined ? difficulty : act.difficulty},
        includes = ${includesStr},
        status = ${status || act.status}
      WHERE id = ${actId}
    `;
    const [updated] = await prisma.$queryRaw`SELECT * FROM club_activities WHERE id = ${actId}`;
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// DELETE /api/clubs/:id/activity/:actId — 删除活动
router.delete('/:id/activity/:actId', clubWriteLimiter, auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const actId = parseInt(req.params.actId);
    const [club] = await prisma.$queryRaw`SELECT * FROM clubs WHERE id = ${id}`;
    if (!club) return res.status(404).json({ error: '俱乐部不存在' });
    const [member] = await prisma.$queryRaw`
      SELECT role FROM club_members WHERE club_id = ${id} AND user_id = ${req.user.id}
    `;
    const isCreator = club.creator_id === req.user.id;
    const isAdmin = member && (member.role === 'admin' || member.role === 'founder');
    if (!isCreator && !isAdmin) return res.status(403).json({ error: '无权操作' });
    const changes = await prisma.$executeRaw`
      UPDATE club_activities SET status = 'ended' WHERE id = ${actId} AND club_id = ${id}
    `;
    if (changes === 0) return res.status(404).json({ error: '活动不存在' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/clubs/:id/members/:userId — 俱乐部成员详情（需要JWT）
router.get('/:id/members/:userId', clubReadLimiter, auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const userId = parseInt(req.params.userId);
    const [member] = await prisma.$queryRaw`
      SELECT cm.id, cm.club_id, cm.user_id, cm.role, cm.joined_at,
             u.name, u.avatar, u.level
      FROM club_members cm
      JOIN users u ON u.id = cm.user_id
      WHERE cm.club_id = ${id} AND cm.user_id = ${userId}
    `;
    if (!member) return res.status(404).json({ error: '成员不存在' });
    const [climbCount] = await prisma.$queryRaw`SELECT COUNT(*) as cnt FROM tracks WHERE user_id = ${userId}`;
    res.json({ ...member, climb_count: climbCount ? Number(climbCount.cnt) : 0 });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/clubs（需要JWT）
router.post('/', clubWriteLimiter, auth, async (req, res) => {
  try {
    const { name, description, cover, specialty, region, type } = req.body;
    if (!name) return res.status(400).json({ error: '请填写俱乐部名称' });
    await prisma.$executeRaw`
      INSERT INTO clubs (name, description, cover, specialty, region, type, creator_id)
      VALUES (${name}, ${description || ''}, ${cover || ''}, ${specialty || ''}, ${region || ''}, ${type || '综合'}, ${req.user.id})
    `;
    const [created] = await prisma.$queryRaw`
      SELECT * FROM clubs WHERE creator_id = ${req.user.id} ORDER BY id DESC LIMIT 1
    `;
    await prisma.$executeRaw`
      INSERT INTO club_members (club_id, user_id, role) VALUES (${created.id}, ${req.user.id}, 'founder')
    `;
    await prisma.$executeRaw`UPDATE clubs SET members_count = 1 WHERE id = ${created.id}`;
    const [club] = await prisma.$queryRaw`SELECT * FROM clubs WHERE id = ${created.id}`;
    res.json(club);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/clubs/:id — 更新俱乐部信息（需是创建者）
router.put('/:id', clubWriteLimiter, auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [club] = await prisma.$queryRaw`SELECT * FROM clubs WHERE id = ${id}`;
    if (!club) return res.status(404).json({ error: '俱乐部不存在' });
    const [member] = await prisma.$queryRaw`
      SELECT role FROM club_members WHERE club_id = ${id} AND user_id = ${req.user.id}
    `;
    const isCreator = club.creator_id === req.user.id;
    const isAdmin = member && (member.role === 'admin' || member.role === 'founder');
    if (!isCreator && !isAdmin) return res.status(403).json({ error: '无权限修改俱乐部信息' });
    const { name, description, cover, specialty, region, type, contact, wechat, website, cover_image, logo } = req.body;
    await prisma.$executeRaw`
      UPDATE clubs SET
        name = ${name || club.name},
        description = ${description !== undefined ? description : club.description},
        cover = ${cover !== undefined ? cover : club.cover},
        specialty = ${specialty !== undefined ? specialty : club.specialty},
        region = ${region !== undefined ? region : club.region},
        type = ${type || club.type},
        contact = ${contact !== undefined ? contact : club.contact},
        wechat = ${wechat !== undefined ? wechat : club.wechat},
        website = ${website !== undefined ? website : club.website},
        cover_image = ${cover_image !== undefined ? cover_image : club.cover_image},
        logo = ${logo !== undefined ? logo : club.logo}
      WHERE id = ${id}
    `;
    const [updated] = await prisma.$queryRaw`SELECT * FROM clubs WHERE id = ${id}`;
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/clubs/:id/join（需要JWT）
router.post('/:id/join', clubWriteLimiter, auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [club] = await prisma.$queryRaw`SELECT * FROM clubs WHERE id = ${id}`;
    if (!club) return res.status(404).json({ error: '俱乐部不存在' });
    const [existing] = await prisma.$queryRaw`
      SELECT id FROM club_members WHERE club_id = ${id} AND user_id = ${req.user.id}
    `;
    if (existing) return res.status(400).json({ error: '您已是该俱乐部成员' });
    await prisma.$executeRaw`INSERT INTO club_members (club_id, user_id) VALUES (${id}, ${req.user.id})`;
    await prisma.$executeRaw`UPDATE clubs SET members_count = members_count + 1 WHERE id = ${id}`;
    res.json({ success: true, message: '成功加入俱乐部' });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// DELETE /api/clubs/:id/join（退出俱乐部，需要JWT）
router.delete('/:id/join', clubWriteLimiter, auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [member] = await prisma.$queryRaw`
      SELECT * FROM club_members WHERE club_id = ${id} AND user_id = ${req.user.id}
    `;
    if (!member) return res.status(404).json({ error: '您不是该俱乐部成员' });
    if (member.role === 'founder') return res.status(400).json({ error: '创始人不能退出俱乐部' });
    await prisma.$executeRaw`DELETE FROM club_members WHERE club_id = ${id} AND user_id = ${req.user.id}`;
    await prisma.$executeRaw`UPDATE clubs SET members_count = MAX(0, members_count - 1) WHERE id = ${id}`;
    res.json({ success: true, message: '已退出俱乐部' });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/clubs/:id/posts — 俱乐部动态帖子
router.get('/:id/posts', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const posts = await prisma.$queryRaw`
      SELECT * FROM club_posts WHERE club_id = ${id} ORDER BY created_at DESC LIMIT 20
    `;
    res.json(posts);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/clubs/:id/photos — 俱乐部图片相册
router.get('/:id/photos', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const photos = await prisma.$queryRaw`
      SELECT * FROM club_photos WHERE club_id = ${id} ORDER BY created_at DESC LIMIT 30
    `;
    res.json(photos);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/clubs/:id/guides — 俱乐部旗下向导列表
router.get('/:id/guides', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const guides = await prisma.$queryRaw`
      SELECT g.id, g.name, g.avatar, g.flag, g.nationality, g.rating, g.reviews,
             g.specialty, g.day_rate as dayRate, g.affiliation_type as affiliationType,
             g.affiliation_club_id as affiliationClubId, g.experience_years as experienceYears
      FROM guides g
      WHERE g.affiliation_club_id = ${id} AND g.status = 'approved'
      ORDER BY g.rating DESC
    `;
    res.json(guides);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/clubs/payment — 俱乐部入驻支付
// 当 PAYMENTS_ENABLED=true 且 Stripe 已配置时，创建真实 Stripe PaymentIntent（$499 USD）
// 否则保持 mock 行为
router.post('/payment', clubWriteLimiter, auth, async (req, res) => {
  try {
    const { club_application_id, amount, payment_method } = req.body;
    if (!club_application_id || !amount) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const paymentsEnabled = String(process.env.PAYMENTS_ENABLED || '').toLowerCase() === 'true';
    const stripeKey = (process.env.STRIPE_SECRET_KEY || '').trim();
    const stripeDisabled = String(process.env.STRIPE_DISABLED || '').toLowerCase() === 'true';

    if (paymentsEnabled && stripeKey && !stripeDisabled) {
      // 真实 Stripe PaymentIntent（俱乐部上架费默认 $499）
      const listingAmountUsd = Math.floor(Number(process.env.CLUB_LISTING_FEE_USD) || 499);
      try {
        const stripe = require('stripe')(stripeKey);
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(listingAmountUsd * 100),
          currency: 'usd',
          metadata: {
            orderType: 'club_listing',
            orderId: String(club_application_id),
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
        console.error('[clubs/payment] Stripe error:', stripeErr.message);
        return res.status(500).json({ error: '支付创建失败，请稍后重试' });
      }
    }

    // Fallback: mock 模式
    const mockOrderId = 'CLUB_PAY_' + Date.now() + '_' + req.user.id;
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

// POST /api/clubs/pay-listing-fee — 俱乐部支付入驻费
router.post('/pay-listing-fee', clubPayRateLimit, auth, async (req, res) => {
  try {
    const [club] = await prisma.$queryRaw`
      SELECT * FROM clubs WHERE creator_id = ${req.user.id} AND status = 'approved_pending_payment'
      ORDER BY created_at DESC LIMIT 1
    `;
    if (!club) return res.status(404).json({ error: '未找到待付费的俱乐部申请，或申请状态不正确' });
    const certLevel = club.cert_level || 'standard';
    const levelInfo = CLUB_CERT_LEVELS[certLevel] || CLUB_CERT_LEVELS.standard;
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    await prisma.$executeRaw`
      UPDATE clubs SET status = 'active', verified = 1, listing_fee_paid = 1,
        listing_fee_paid_at = CURRENT_TIMESTAMP, cert_expires_at = ${expiresAt.toISOString()}, cert_year_fee = ${levelInfo.yearFee}
      WHERE id = ${club.id}
    `;
    await prisma.$executeRaw`
      UPDATE club_applications SET status = 'approved', listing_fee_paid = 1, listing_fee_paid_at = CURRENT_TIMESTAMP
      WHERE user_id = ${req.user.id} AND status = 'approved_pending_payment'
    `;
    try {
      await prisma.$executeRaw`
        INSERT INTO notifications (user_id, type, title, body, link)
        VALUES (${req.user.id}, 'club_activated', '🎉 俱乐部入驻成功', '恭喜！您的入驻费已支付，俱乐部正式上线，快去发布活动吧！', '/club-portal')
      `;
    } catch(e) {}
    res.json({ success: true, message: '入驻费支付成功，俱乐部已正式上线！', club_id: club.id });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// DELETE /api/clubs/:id — 删除俱乐部（管理员）
router.delete('/:id', clubWriteLimiter, auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [adminUser] = await prisma.$queryRaw`SELECT is_admin FROM users WHERE id = ${req.user.id}`;
    if (!adminUser || !adminUser.is_admin) return res.status(403).json({ error: '无权操作' });
    await prisma.$executeRaw`UPDATE clubs SET status = 'deleted' WHERE id = ${id}`;
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/clubs/:id/commercial-apply — 提交商业资质申请
router.post('/:id/commercial-apply', clubWriteLimiter, auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [club] = await prisma.$queryRaw`SELECT * FROM clubs WHERE id = ${id}`;
    if (!club) return res.status(404).json({ error: '俱乐部不存在' });
    const [member] = await prisma.$queryRaw`
      SELECT role FROM club_members WHERE club_id = ${id} AND user_id = ${req.user.id}
    `;
    const isCreator = club.creator_id === req.user.id;
    const isAdmin = member && (member.role === 'admin' || member.role === 'founder');
    if (!isCreator && !isAdmin) return res.status(403).json({ error: '无权操作' });
    const { business_license_url, business_license_no, insurance_cert_url, bank_account_name, bank_account_no, bank_name } = req.body;
    await prisma.$executeRaw`
      UPDATE clubs SET
        business_license_url = COALESCE(${business_license_url || null}, business_license_url),
        business_license_no = COALESCE(${business_license_no || null}, business_license_no),
        insurance_cert_url = COALESCE(${insurance_cert_url || null}, insurance_cert_url),
        bank_account_name = COALESCE(${bank_account_name || null}, bank_account_name),
        bank_account_no = COALESCE(${bank_account_no || null}, bank_account_no),
        bank_name = COALESCE(${bank_name || null}, bank_name),
        commercial_status = 'pending',
        commercial_applied_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `;
    res.json({ success: true, message: '商业资质申请已提交，请等待审核' });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/clubs/:clubId/activities/:actId/enroll — 活动报名
router.post('/:clubId/activities/:actId/enroll', clubWriteLimiter, auth, async (req, res) => {
  try {
    const clubId = parseInt(req.params.clubId);
    const actId = parseInt(req.params.actId);
    const [club] = await prisma.$queryRaw`SELECT * FROM clubs WHERE id = ${clubId}`;
    if (!club) return res.status(404).json({ error: '俱乐部不存在' });
    const [activity] = await prisma.$queryRaw`
      SELECT * FROM club_activities WHERE id = ${actId} AND club_id = ${clubId} AND status = 'active'
    `;
    if (!activity) return res.status(404).json({ error: '活动不存在或已结束' });
    // 未结束校验
    if (activity.end_date && new Date(activity.end_date) < new Date()) {
      return res.status(400).json({ error: '活动已结束，无法报名' });
    }
    // 满员校验
    if (activity.current_members >= activity.max_members) {
      return res.status(400).json({ error: '活动已满员' });
    }
    // 重复报名校验
    const [existing] = await prisma.$queryRaw`
      SELECT id FROM activity_orders
      WHERE activity_id = ${actId} AND user_id = ${req.user.id}
        AND status NOT IN ('cancelled', 'refunded')
    `;
    if (existing) return res.status(400).json({ error: '您已报名此活动' });
    // 必填字段校验
    const { emergency_contact_name, emergency_contact_phone, agreedWaiver, waiverVersion } = req.body;
    if (!emergency_contact_name || !emergency_contact_phone) {
      return res.status(400).json({ error: '请填写紧急联系人姓名和电话' });
    }
    if (!agreedWaiver) {
      return res.status(400).json({ error: '请同意免责协议' });
    }
    // 创建订单
    const orderNo = 'ACT' + Date.now() + crypto.randomBytes(3).toString('hex').toUpperCase();
    const statusHistory = appendStatusHistory(null, 'pending_payment');
    await prisma.$executeRaw`
      INSERT INTO activity_orders
        (order_no, activity_id, club_id, user_id, amount, status, status_history,
         emergency_contact_name, emergency_contact_phone, agreed_waiver, agreed_waiver_version)
      VALUES (${orderNo}, ${actId}, ${clubId}, ${req.user.id}, ${activity.price || 0},
              'pending_payment', ${statusHistory},
              ${emergency_contact_name}, ${emergency_contact_phone}, 1, ${waiverVersion || ''})
    `;
    // 更新活动当前报名人数
    await prisma.$executeRaw`
      UPDATE club_activities SET current_members = current_members + 1 WHERE id = ${actId}
    `;
    // 通知俱乐部负责人
    try {
      await prisma.$executeRaw`
        INSERT INTO notifications (user_id, type, content, related_id)
        VALUES (${club.creator_id}, 'activity_enroll', ${`【新报名】${activity.title} 有新用户报名，订单号：${orderNo}`}, ${actId})
      `;
    } catch(e) {}
    const [order] = await prisma.$queryRaw`SELECT * FROM activity_orders WHERE order_no = ${orderNo}`;
    res.json(order);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/clubs/:clubId/activities/:actId/enrollments — 查看报名用户列表（管理员）
router.get('/:clubId/activities/:actId/enrollments', clubReadLimiter, auth, async (req, res) => {
  try {
    const clubId = parseInt(req.params.clubId);
    const actId = parseInt(req.params.actId);
    const [club] = await prisma.$queryRaw`SELECT * FROM clubs WHERE id = ${clubId}`;
    if (!club) return res.status(404).json({ error: '俱乐部不存在' });
    const [member] = await prisma.$queryRaw`
      SELECT role FROM club_members WHERE club_id = ${clubId} AND user_id = ${req.user.id}
    `;
    const isCreator = club.creator_id === req.user.id;
    const isAdmin = member && (member.role === 'admin' || member.role === 'founder');
    if (!isCreator && !isAdmin) return res.status(403).json({ error: '无权查看报名列表' });
    const enrollments = await prisma.$queryRaw`
      SELECT ao.*, u.name as user_name, u.avatar as user_avatar, u.phone as user_phone
      FROM activity_orders ao
      LEFT JOIN users u ON u.id = ao.user_id
      WHERE ao.activity_id = ${actId} AND ao.club_id = ${clubId}
      ORDER BY ao.created_at DESC
    `;
    res.json(enrollments);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
