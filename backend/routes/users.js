const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const auth = require('../middleware/auth');
const rateLimit = require('express-rate-limit');
const { decryptPII } = require('../utils/crypto');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const usersReadLimiter = rateLimit({
  windowMs: 60 * 1000, max: 60,
  message: { error: '请求过于频繁' }, standardHeaders: true, legacyHeaders: false,
});
const usersWriteLimiter = rateLimit({
  windowMs: 60 * 1000, max: 20,
  message: { error: '操作过于频繁' }, standardHeaders: true, legacyHeaders: false,
});

const avatarUploadDir = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(process.cwd(), 'backend', 'uploads');
if (!fs.existsSync(avatarUploadDir)) fs.mkdirSync(avatarUploadDir, { recursive: true });

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, avatarUploadDir),
    filename: (_req, file, cb) => cb(null, `${crypto.randomUUID()}${path.extname(file.originalname || '.jpg')}`),
  }),
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('只允许上传图片文件'));
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.post('/avatar', usersWriteLimiter, auth, (req, res) => {
  avatarUpload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message || '上传失败' });
    if (!req.file) return res.status(400).json({ error: '未收到文件' });
    try {
      const url = `/uploads/${req.file.filename}`;
      await prisma.user.update({ where: { id: req.user.id }, data: { avatar: url } });
      res.json({ url, filename: req.file.filename });
    } catch (e) {
      res.status(500).json({ error: '服务器错误' });
    }
  });
});

// GET /api/users/me/data-export — GDPR 数据导出（需要JWT）
// 注意：phone/email 在数据库中是 AES-256-GCM 密文，导出前必须解密为明文，
// 否则导出文件对当事人不可读，不符合 GDPR 第 15/20 条"可读、可移植"要求。
router.get('/me/data-export', usersReadLimiter, auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const [user] = await prisma.$queryRaw`
      SELECT id, name, username, phone, email, avatar, level, summits, expeditions,
             followers, following, settings, privacy, policy_version, policy_agreed_at, created_at
      FROM users WHERE id = ${userId}
    `;
    if (!user) return res.status(404).json({ error: '用户不存在' });

    // 解密 PII 字段（手机号、邮箱）为可读明文
    const safeDecrypt = (v) => {
      try { return v ? decryptPII(v) : v; } catch { return null; }
    };
    user.phone = safeDecrypt(user.phone);
    user.email = safeDecrypt(user.email);

    const posts = await prisma.$queryRaw`
      SELECT id, content, image, created_at FROM posts WHERE user_id = ${userId} ORDER BY created_at DESC
    `.catch(() => []);
    const tracks = await prisma.$queryRaw`
      SELECT id, name, peak_name, date, distance_km, elevation_gain, duration_minutes, notes, created_at
      FROM tracks WHERE user_id = ${userId} ORDER BY created_at DESC
    `.catch(() => []);
    const orders = await prisma.$queryRaw`
      SELECT id, status, created_at FROM orders WHERE user_id = ${userId} ORDER BY created_at DESC
    `.catch(() => []);
    const comments = await prisma.$queryRaw`
      SELECT id, content, created_at FROM comments WHERE user_id = ${userId} ORDER BY created_at DESC
    `.catch(() => []);
    const emergencyContacts = await prisma.$queryRaw`
      SELECT id, name, phone, relationship, created_at FROM emergency_contacts WHERE user_id = ${userId}
    `.catch(() => []);
    const summits = await prisma.$queryRaw`
      SELECT id, peak_name, altitude, date, notes, created_at FROM user_summits WHERE user_id = ${userId}
    `.catch(() => []);
    const expeditionsRecords = await prisma.$queryRaw`
      SELECT id, name, description, date, created_at FROM user_expeditions WHERE user_id = ${userId}
    `.catch(() => []);

    const exportData = {
      user,
      posts,
      tracks,
      orders,
      comments,
      emergency_contacts: emergencyContacts,
      summits,
      expeditions: expeditionsRecords,
      exportedAt: new Date().toISOString(),
    };

    res.setHeader('Content-Disposition', 'attachment; filename="summitlink-data-export.json"');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json(exportData);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// DELETE /api/users/me — GDPR 账户注销（需要JWT）
// 实现策略：
//   1) 删除当事人产生的 PII 重灾区（emergency_contacts、medical_info、sos_records、
//      sms_codes、email_codes、notifications、messages、follows、收藏等），无法恢复。
//   2) 对必须保留以维持外键完整性的内容（posts、comments、tracks 等），
//      重置可识别字段；具体策略由后续合规需求决定，本次只删除最敏感的关联。
//   3) 最后匿名化 users 行，清空 phone/email/password/avatar/name，并标记 deleted_at。
//
// 注意：表名 / 列名是**冻结的常量白名单**，并在拼接前用 Set 二次断言；
// 没有用户可控输入参与 SQL 字符串构造，因此使用 $executeRawUnsafe 不引入注入风险。
//
// 保留策略（GDPR）：
//   下列表本次不清理，原因：
//   - posts / comments / tracks：被其他用户（点赞、评论、回复）引用，直接 DELETE 会破坏外键完整性，
//     需要由"保留并匿名化作者引用"任务处理（后续 PR）。
//   - orders / expedition_orders / activity_orders / guide_service_orders / stripe_payments：
//     用于税务、风控、退款追溯，按 GDPR 第 17(3)(e) 条"合法义务豁免"保留，
//     由独立的归档任务在到期后清理。
//   - 当事人的金融/支付历史会通过匿名化 user_id（指向 deleted_at 标记的占位 users 行）
//     断开与可识别信息的关联。
const GDPR_PURGE_USER_ID_TABLES = Object.freeze([
  'emergency_contacts',
  'medical_info',
  'sos_records',
  'sms_codes',
  'email_codes',
  'notifications',
  'messages',
  'follows',                // follower_id = userId
  'favorites',
  'comment_likes',
  'likes',
  'user_achievements',
  'user_badges',
  'mountain_wishlists',
  'mountain_footprints',
  'post_saves',
  'message_reads',
  'conversation_members',
  'location_shares',
  'group_chat_members',
  'feed_scores',
  'expedition_subscribers',
]);
const GDPR_PURGE_BIDIRECTIONAL = Object.freeze([
  { table: 'follows', columns: Object.freeze(['follower_id', 'following_id']) },
]);
const GDPR_ALLOWED_TABLES = new Set([
  ...GDPR_PURGE_USER_ID_TABLES,
  ...GDPR_PURGE_BIDIRECTIONAL.map(i => i.table),
]);
const GDPR_ALLOWED_COLUMNS = new Set([
  'user_id',
  ...GDPR_PURGE_BIDIRECTIONAL.flatMap(i => i.columns),
]);

router.delete('/me', usersWriteLimiter, auth, async (req, res) => {
  const userId = req.user.id;
  try {
    for (const table of GDPR_PURGE_USER_ID_TABLES) {
      // 二次防御：拼接前断言表名命中白名单
      if (!GDPR_ALLOWED_TABLES.has(table)) continue;
      await prisma.$executeRawUnsafe(`DELETE FROM ${table} WHERE user_id = ?`, userId)
        .catch(() => { /* 老库 / 缺表，忽略 */ });
    }
    for (const item of GDPR_PURGE_BIDIRECTIONAL) {
      if (!GDPR_ALLOWED_TABLES.has(item.table)) continue;
      for (const col of item.columns) {
        if (!GDPR_ALLOWED_COLUMNS.has(col)) continue;
        await prisma.$executeRawUnsafe(`DELETE FROM ${item.table} WHERE ${col} = ?`, userId)
          .catch(() => {});
      }
    }

    // 2) 匿名化 users 主表（清空 PII、保留 id 以维持外键）
    const anonymizedUsername = `@deleted_${userId}`;
    await prisma.$executeRaw`
      UPDATE users
      SET deleted_at = ${new Date()},
          phone = NULL,
          email = NULL,
          password = NULL,
          name = '[已注销用户]',
          username = ${anonymizedUsername},
          avatar = NULL,
          bio = NULL,
          settings = NULL,
          privacy = NULL
      WHERE id = ${userId}
    `;

    res.clearCookie('token');
    res.json({ success: true, message: '账号已注销' });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/users/:id/achievements — 用户成就
router.get('/:id/achievements', usersReadLimiter, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const achievements = await prisma.$queryRaw`
      SELECT * FROM user_achievements WHERE user_id = ${userId} ORDER BY earned_at DESC
    `;
    if (achievements.length === 0) {
      return res.json([
        { id: 1, name: '初次登顶', description: '完成人生第一次登顶', icon: '🏔️', earned_at: null },
        { id: 2, name: '探索者', description: '加入SummitLink平台', icon: '🧭', earned_at: new Date().toISOString() },
      ]);
    }
    res.json(achievements);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/users/:id/membership — 会员信息
router.get('/:id/membership', usersReadLimiter, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const [user] = await prisma.$queryRaw`
      SELECT id, name, level, summits, expeditions, followers, following, created_at
      FROM users WHERE id = ${userId}
    `;
    if (!user) return res.status(404).json({ error: '用户不存在' });

    const points = (user.summits || 0) * 200 + (user.expeditions || 0) * 100;
    let memberLevel = '探索者';
    let memberColor = '#6b7280';
    let benefits = ['基础功能', '社区动态'];
    if (points >= 10000) {
      memberLevel = '传奇攀登者'; memberColor = '#f59e0b';
      benefits = ['全功能解锁', '专属客服', '优先预约', '折扣权益', '专属徽章'];
    } else if (points >= 5000) {
      memberLevel = '专家攀登者'; memberColor = '#8b5cf6';
      benefits = ['全功能解锁', '优先预约', '部分折扣', '专属徽章'];
    } else if (points >= 2000) {
      memberLevel = '中级攀登者'; memberColor = '#3b82f6';
      benefits = ['大部分功能', '社区优先', '装备折扣'];
    } else if (points >= 500) {
      memberLevel = '初级攀登者'; memberColor = '#10b981';
      benefits = ['基础功能', '社区动态', '攻略阅读'];
    }

    res.json({
      user_id: user.id,
      member_level: memberLevel,
      member_color: memberColor,
      points,
      benefits,
      summits: user.summits || 0,
      expeditions: user.expeditions || 0,
      followers: user.followers || 0,
      following: user.following || 0,
      since: user.created_at,
    });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/users/:id/summits — 用户登顶记录
router.get('/:id/summits', usersReadLimiter, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const summits = await prisma.$queryRaw`
      SELECT id, peak_name, altitude, date, notes, image, created_at
      FROM user_summits WHERE user_id = ${userId} ORDER BY date DESC
    `;
    res.json(summits);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/users/summits — 新增登顶记录
router.post('/summits', usersWriteLimiter, auth, async (req, res) => {
  try {
    const { peak_name, altitude, date, notes, image } = req.body;
    if (!peak_name) return res.status(400).json({ error: '山峰名称不能为空' });
    await prisma.$executeRaw`
      INSERT INTO user_summits (user_id, peak_name, altitude, date, notes, image)
      VALUES (${req.user.id}, ${peak_name}, ${altitude || 0}, ${date || ''}, ${notes || ''}, ${image || ''})
    `;
    // 更新 users.summits 计数
    const [{ cnt }] = await prisma.$queryRaw`SELECT COUNT(*) as cnt FROM user_summits WHERE user_id = ${req.user.id}`;
    await prisma.$executeRaw`UPDATE users SET summits = ${Number(cnt)} WHERE id = ${req.user.id}`;
    const [summit] = await prisma.$queryRaw`
      SELECT * FROM user_summits WHERE user_id = ${req.user.id} ORDER BY id DESC LIMIT 1
    `;
    res.json(summit);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/users/:id/expeditions — 用户远征记录
router.get('/:id/expeditions', usersReadLimiter, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const expeditions = await prisma.$queryRaw`
      SELECT id, name, description, date, image, created_at
      FROM user_expeditions WHERE user_id = ${userId} ORDER BY date DESC
    `;
    res.json(expeditions);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/users/expeditions — 新增远征记录
router.post('/expeditions', usersWriteLimiter, auth, async (req, res) => {
  try {
    const { name, description, date, image } = req.body;
    if (!name) return res.status(400).json({ error: '远征名称不能为空' });
    await prisma.$executeRaw`
      INSERT INTO user_expeditions (user_id, name, description, date, image)
      VALUES (${req.user.id}, ${name}, ${description || ''}, ${date || ''}, ${image || ''})
    `;
    const [{ cnt }] = await prisma.$queryRaw`SELECT COUNT(*) as cnt FROM user_expeditions WHERE user_id = ${req.user.id}`;
    await prisma.$executeRaw`UPDATE users SET expeditions = ${Number(cnt)} WHERE id = ${req.user.id}`;
    const [exp] = await prisma.$queryRaw`
      SELECT * FROM user_expeditions WHERE user_id = ${req.user.id} ORDER BY id DESC LIMIT 1
    `;
    res.json(exp);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/users/:id/followers — 粉丝列表
router.get('/:id/followers', usersReadLimiter, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const followers = await prisma.$queryRaw`
      SELECT u.id, u.name, u.avatar, u.level
      FROM follows f JOIN users u ON u.id = f.follower_id
      WHERE f.following_id = ${userId} ORDER BY f.created_at DESC
    `;
    res.json(followers);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/users/:id/following — 关注列表
router.get('/:id/following', usersReadLimiter, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const following = await prisma.$queryRaw`
      SELECT u.id, u.name, u.avatar, u.level
      FROM follows f JOIN users u ON u.id = f.following_id
      WHERE f.follower_id = ${userId} ORDER BY f.created_at DESC
    `;
    res.json(following);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/users/follow — 关注用户
router.post('/follow', usersWriteLimiter, auth, async (req, res) => {
  try {
    const followee_id = parseInt(req.body.followee_id);
    if (!followee_id) return res.status(400).json({ error: '关注目标不能为空' });
    if (followee_id === req.user.id) return res.status(400).json({ error: '不能关注自己' });
    await prisma.$executeRaw`INSERT INTO follows (follower_id, following_id) VALUES (${req.user.id}, ${followee_id}) ON CONFLICT DO NOTHING`;
    const [{ cnt: followingCnt }] = await prisma.$queryRaw`SELECT COUNT(*) as cnt FROM follows WHERE follower_id = ${req.user.id}`;
    const [{ cnt: followersCnt }] = await prisma.$queryRaw`SELECT COUNT(*) as cnt FROM follows WHERE following_id = ${followee_id}`;
    await prisma.$executeRaw`UPDATE users SET following = ${Number(followingCnt)} WHERE id = ${req.user.id}`;
    await prisma.$executeRaw`UPDATE users SET followers = ${Number(followersCnt)} WHERE id = ${followee_id}`;
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// DELETE /api/users/follow — 取消关注
router.delete('/follow', usersWriteLimiter, auth, async (req, res) => {
  try {
    const followee_id = parseInt(req.body.followee_id);
    await prisma.$executeRaw`DELETE FROM follows WHERE follower_id = ${req.user.id} AND following_id = ${followee_id}`;
    const [{ cnt: followingCnt }] = await prisma.$queryRaw`SELECT COUNT(*) as cnt FROM follows WHERE follower_id = ${req.user.id}`;
    const [{ cnt: followersCnt }] = await prisma.$queryRaw`SELECT COUNT(*) as cnt FROM follows WHERE following_id = ${followee_id}`;
    await prisma.$executeRaw`UPDATE users SET following = ${Number(followingCnt)} WHERE id = ${req.user.id}`;
    await prisma.$executeRaw`UPDATE users SET followers = ${Number(followersCnt)} WHERE id = ${followee_id}`;
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/users/:id — 获取用户基本资料（公开）
router.get('/:id', usersReadLimiter, async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const [user] = await prisma.$queryRaw`
      SELECT id, name, username, avatar, bio, level, summits, expeditions, followers, following, created_at FROM users WHERE id = ${userId}
    `;
    if (!user) return res.status(404).json({ error: '用户不存在' });
    let is_following = false;
    const authHeader = req.headers['authorization'];
    if (authHeader) {
      try {
        const jwt = require('jsonwebtoken');
        const token = authHeader.split(' ')[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
        const [followRow] = await prisma.$queryRaw`SELECT 1 as v FROM follows WHERE follower_id = ${payload.id} AND following_id = ${userId}`;
        is_following = !!followRow;
      } catch(e) {}
    }
    res.json({ ...user, is_following });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/users/:id/posts — 获取用户发布的动态
router.get('/:id/posts', usersReadLimiter, async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const offset = (page - 1) * limit;
    const posts = await prisma.$queryRaw`
      SELECT * FROM posts WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
    `;
    res.json(posts);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/users/me/stats — 当前用户统计数据（需JWT）
router.get('/me/stats', usersReadLimiter, auth, async (req, res) => {
  try {
    const userId = req.user.id;
    // 探险次数：expedition_participants + expedition_orders 聚合
    const [epRow] = await prisma.$queryRaw`
      SELECT COUNT(*) as cnt FROM expedition_orders WHERE user_id = ${userId} AND status IN ('paid', 'completed')
    `.catch(() => [{ cnt: 0 }]);
    const expeditionCount = Number(epRow?.cnt || 0);

    // 轨迹总里程
    const [trackRow] = await prisma.$queryRaw`
      SELECT COALESCE(SUM(distance_km), 0) as total_km, COUNT(*) as track_count
      FROM tracks WHERE user_id = ${userId}
    `.catch(() => [{ total_km: 0, track_count: 0 }]);
    const totalKm = Math.round(Number(trackRow?.total_km || 0) * 10) / 10;
    const trackCount = Number(trackRow?.track_count || 0);

    // 攀登天数：从轨迹表统计唯一日期数
    const [dayRow] = await prisma.$queryRaw`
      SELECT COUNT(DISTINCT date(date)) as days FROM tracks WHERE user_id = ${userId}
    `.catch(() => [{ days: 0 }]);
    const climbingDays = Number(dayRow?.days || 0);

    res.json({ expeditionCount, totalKm, climbingDays, trackCount });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
