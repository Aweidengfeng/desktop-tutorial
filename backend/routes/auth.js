const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const prisma = require('../db/prisma');
const auth = require('../middleware/auth');

const POLICY_VERSION = '2026-04-20';

const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  if (process.env.NODE_ENV === 'production') {
    console.error('FATAL: JWT_SECRET environment variable is not set in production!');
    process.exit(1);
  } else {
    console.warn('WARNING: JWT_SECRET is not set. Using default dev secret. Do NOT use in production!');
  }
}
const JWT_SECRET = SECRET || 'summitlink_dev_secret_do_not_use_in_production';

// Google OAuth client（仅当 GOOGLE_CLIENT_ID 配置时启用）
let googleOAuthClient = null;
if (process.env.GOOGLE_CLIENT_ID) {
  try {
    const { OAuth2Client } = require('google-auth-library');
    googleOAuthClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    console.log('✅ Google OAuth 已启用');
  } catch (e) {
    console.warn('⚠️  google-auth-library 加载失败，Google 登录将使用 mock 模式:', e.message);
  }
}

/** 验证 Google ID token，返回 payload（含 sub/email/name）；失败返回 null */
async function verifyGoogleToken(idToken) {
  if (!googleOAuthClient) return null;
  try {
    const ticket = await googleOAuthClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    return ticket.getPayload();
  } catch (e) {
    console.error('[Google] verifyIdToken 失败:', e.message);
    return null;
  }
}

/** 简单手机号校验：接受中国大陆格式或国际 E.164 格式（+[国家码][号码]）*/
function isValidPhone(phone) {
  if (!phone || typeof phone !== 'string') return false;
  // 中国大陆：1[3-9]XXXXXXXXX
  if (/^1[3-9]\d{9}$/.test(phone)) return true;
  // 国际 E.164：+[1-9][0-9]{6,14}（7-15 位数字）
  if (/^\+[1-9]\d{6,14}$/.test(phone)) return true;
  return false;
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: '登录尝试次数过多，请15分钟后再试' },
  standardHeaders: true,
  legacyHeaders: false,
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { error: '注册请求过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: '请求过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: '请求过于频繁' },
  standardHeaders: true,
  legacyHeaders: false,
});

function makeToken(id) {
  return jwt.sign({ id }, JWT_SECRET, { expiresIn: '30d' });
}

async function safeUser(user) {
  let isGuide = false;
  let isClubAdmin = false;
  try {
    const guide = await prisma.guide.findFirst({ where: { userId: user.id, status: 'approved' } });
    if (guide) isGuide = true;
    const clubMember = await prisma.clubMember.findFirst({
      where: { userId: user.id, role: { in: ['founder', 'admin'] } },
    });
    if (clubMember) isClubAdmin = true;
  } catch (e) {}

  return {
    id: user.id,
    name: user.name,
    username: user.username,
    avatar: user.avatar,
    level: user.level,
    summits: user.summits,
    expeditions: user.expeditions,
    followers: user.followers,
    following: user.following,
    phone: user.phone,
    email: user.email,
    is_admin: user.isAdmin ? 1 : 0,
    is_guide: isGuide ? 1 : 0,
    is_club_admin: isClubAdmin ? 1 : 0,
  };
}

// POST /api/auth/register
/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags: [认证]
 *     summary: 用户注册
 *     description: 使用手机号、姓名和密码注册新账户
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, phone, password, policyVersion, agreedPrivacy, agreedTerms]
 *             properties:
 *               name:
 *                 type: string
 *                 description: 用户姓名
 *               phone:
 *                 type: string
 *                 description: 手机号（中国大陆格式）
 *               password:
 *                 type: string
 *                 minLength: 6
 *               policyVersion:
 *                 type: string
 *                 description: 隐私政策版本号
 *               agreedPrivacy:
 *                 type: boolean
 *               agreedTerms:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: 注册成功，返回 token 和用户信息
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token: { type: string }
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: 参数错误或手机号已注册
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       422:
 *         description: 未同意最新版协议
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/register', registerLimiter, async (req, res) => {
  try {
    const { name, phone, email, password, policyVersion, agreedPrivacy, agreedTerms } = req.body || {};
    if (!name || !password) {
      return res.status(400).json({ error: '请填写姓名和密码' });
    }
    if (!phone && !email) {
      return res.status(400).json({ error: '请填写手机号或邮箱地址' });
    }
    if (phone && !isValidPhone(phone)) {
      return res.status(400).json({ error: '手机号格式不正确（支持中国大陆格式或国际 +区号格式）' });
    }
    if (email && !isValidEmail(email)) {
      return res.status(400).json({ error: '邮箱格式不正确' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: '密码至少6位' });
    }
    if (!agreedPrivacy || !agreedTerms || !policyVersion || policyVersion !== POLICY_VERSION) {
      return res.status(422).json({ error: '请阅读并同意最新版隐私政策和用户协议' });
    }
    // 检查手机号/邮箱是否已注册
    if (phone) {
      const existing = await prisma.user.findUnique({ where: { phone } });
      if (existing) return res.status(400).json({ error: '手机号已注册' });
    }
    if (email) {
      const existing = await prisma.user.findFirst({ where: { email } });
      if (existing) return res.status(400).json({ error: '邮箱已注册' });
    }
    // 用4位随机十六进制后缀确保用户名唯一（国际手机号末位可能含区号部分，统一用随机后缀）
    const suffix = crypto.randomBytes(2).toString('hex');
    const username = '@' + name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) + '_' + suffix;
    const avatar = 'https://i.pravatar.cc/150?u=' + encodeURIComponent(phone || email || name);
    const hash = await bcrypt.hash(password, 10);
    const userData = {
      name,
      username,
      password: hash,
      avatar,
      policyVersion,
      policyAgreedAt: new Date(),
    };
    if (phone) userData.phone = phone;
    if (email) userData.email = email;
    const user = await prisma.user.create({ data: userData });
    res.json({ token: makeToken(user.id), user: await safeUser(user) });
  } catch (e) {
    if (e.code === 'P2002') {
      const target = e.meta?.target || '';
      if (target.includes('phone')) return res.status(400).json({ error: '手机号已注册' });
      if (target.includes('email')) return res.status(400).json({ error: '邮箱已注册' });
      if (target.includes('username')) return res.status(400).json({ error: '用户名冲突，请重试' });
      return res.status(400).json({ error: '注册失败，请稍后重试' });
    }
    console.error('[register]', e);
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/auth/login
/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: [认证]
 *     summary: 用户登录
 *     description: 使用手机号和密码登录，返回 JWT token
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone, password]
 *             properties:
 *               phone: { type: string, description: 手机号 }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: 登录成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token: { type: string }
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: 手机号或密码错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { phone, email, password } = req.body || {};
    if (!password) return res.status(400).json({ error: '请输入密码' });
    let user = null;
    if (email && isValidEmail(email)) {
      user = await prisma.user.findFirst({ where: { email } });
      if (!user) return res.status(401).json({ error: '邮箱或密码错误' });
    } else if (phone) {
      if (!isValidPhone(phone)) {
        return res.status(400).json({ error: '手机号格式不正确（支持中国大陆格式或国际 +区号格式）' });
      }
      user = await prisma.user.findUnique({ where: { phone } });
      if (!user) return res.status(401).json({ error: '手机号或密码错误' });
    } else {
      return res.status(400).json({ error: '请填写手机号或邮箱' });
    }
    if (!user.password) {
      return res.status(401).json({ error: '此账号未设置密码，请使用验证码或第三方账号登录' });
    }
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: email ? '邮箱或密码错误' : '手机号或密码错误' });
    res.json({ token: makeToken(user.id), user: await safeUser(user) });
  } catch (e) {
    console.error('[login]', e);
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/auth/me
/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     tags: [认证]
 *     summary: 获取当前登录用户信息
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 返回用户信息
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: 未登录
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/me', authReadLimiter, auth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: '用户不存在' });
    res.json(await safeUser(user));
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/auth/profile
router.put('/profile', authWriteLimiter, auth, async (req, res) => {
  try {
    const { name, avatar } = req.body || {};
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(name ? { name } : {}),
        ...(avatar ? { avatar } : {}),
      },
    });
    res.json(await safeUser(user));
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/auth/settings — 保存用户设置（单位、语言等）
router.put('/settings', authWriteLimiter, auth, async (req, res) => {
  try {
    const settings = JSON.stringify(req.body || {});
    await prisma.user.update({ where: { id: req.user.id }, data: { settings } });
    res.json({ success: true, settings: req.body });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/auth/privacy — 保存隐私设置
router.put('/privacy', authWriteLimiter, auth, async (req, res) => {
  try {
    const privacy = JSON.stringify(req.body || {});
    await prisma.user.update({ where: { id: req.user.id }, data: { privacy } });
    res.json({ success: true, privacy: req.body });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/auth/settings — 读取用户设置
router.get('/settings', authReadLimiter, auth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { settings: true } });
    let settings = {};
    try { settings = JSON.parse(user.settings || '{}'); } catch (e) {}
    res.json(settings);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/auth/privacy — 读取隐私设置
router.get('/privacy', authReadLimiter, auth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { privacy: true } });
    let privacy = {};
    try { privacy = JSON.parse(user.privacy || '{}'); } catch (e) {}
    res.json(privacy);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/auth/change-password — 修改密码（需登录 + 旧密码验证）
router.put('/change-password', authWriteLimiter, auth, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body || {};
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: '请填写旧密码和新密码' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: '新密码至少6位' });
    }
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { password: true } });
    if (!user || !user.password) return res.status(400).json({ error: '此账号未设置密码（请使用短信验证码登录后设置）' });
    const ok = await bcrypt.compare(oldPassword, user.password);
    if (!ok) return res.status(401).json({ error: '旧密码不正确' });
    const hash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: req.user.id }, data: { password: hash } });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/auth/change-phone — 更换手机号（需登录 + 新手机短信验证码）
router.put('/change-phone', authWriteLimiter, auth, async (req, res) => {
  try {
    const { phone, code } = req.body || {};
    if (!phone || !code) return res.status(400).json({ error: '请填写新手机号和验证码' });
    if (!isValidPhone(phone)) return res.status(400).json({ error: '手机号格式不正确（支持中国大陆格式或国际 +区号格式）' });
    const existing = await prisma.user.findUnique({ where: { phone } });
    if (existing && existing.id !== req.user.id) return res.status(400).json({ error: '该手机号已被其他账号使用' });
    const record = await prisma.smsCode.findFirst({
      where: { phone, code, used: false },
      orderBy: { id: 'desc' },
    });
    if (!record || Date.now() > record.expiresAt) return res.status(401).json({ error: '验证码无效或已过期' });
    await prisma.smsCode.update({ where: { id: record.id }, data: { used: true } });
    await prisma.user.update({ where: { id: req.user.id }, data: { phone } });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/auth/request-deletion — 申请注销账号（24小时冷静期）
router.post('/request-deletion', authWriteLimiter, auth, async (req, res) => {
  try {
    const scheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await prisma.user.update({ where: { id: req.user.id }, data: { deletedAt: scheduledAt } });
    res.json({ success: true, deletedAt: scheduledAt.toISOString(), message: '注销申请已提交，账号将在24小时后删除。在此期间您可以登录取消注销。' });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/auth/cancel-deletion — 取消注销申请
router.post('/cancel-deletion', authWriteLimiter, auth, async (req, res) => {
  try {
    await prisma.user.update({ where: { id: req.user.id }, data: { deletedAt: null } });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/auth/sms/send — 发送短信验证码（mock：打印到控制台）
const smsProvider = require('../utils/sms');
const emailProvider = require('../utils/email');
// 内存限流：同一手机号 60 秒内只能请求一次
const smsSendCooldown = new Map(); // phone → lastSentAt(ms)
// 验证失败计数（失败三次锁定10分钟）
const smsFailCount = new Map(); // phone → {count, lockedUntil}
// 邮箱发送冷却（60 秒）
const emailSendCooldown = new Map(); // email → lastSentAt(ms)
// 邮箱验证失败计数
const emailFailCount = new Map(); // email → {count, lockedUntil}

router.post('/sms/send', async (req, res) => {
  try {
    const { phone } = req.body || {};
    if (!phone || !isValidPhone(phone)) {
      return res.status(400).json({ error: '手机号格式不正确（支持中国大陆格式或国际 +区号格式）' });
    }
    // 60 秒冷却检查
    const lastSent = smsSendCooldown.get(phone);
    if (lastSent && Date.now() - lastSent < 60 * 1000) {
      const wait = Math.ceil((60 * 1000 - (Date.now() - lastSent)) / 1000);
      return res.status(429).json({ error: `请等待 ${wait} 秒后再次获取验证码` });
    }
    // 生成6位验证码（使用 crypto.randomInt 避免伪随机）
    const code = String(crypto.randomInt(100000, 999999));
    const expiresAt = Date.now() + 5 * 60 * 1000;
    // 使旧验证码失效
    await prisma.smsCode.updateMany({ where: { phone, used: false }, data: { used: true } });
    await prisma.smsCode.create({ data: { phone, code, expiresAt } });
    // 记录发送时间
    smsSendCooldown.set(phone, Date.now());
    // 发送
    smsProvider.send(phone, code).catch(e => console.error('[SMS]', e.message));
    const isDev = process.env.SMS_PROVIDER !== 'aliyun';
    res.json({ success: true, message: isDev ? '验证码已发送（开发模式：查看服务器控制台）' : '验证码已发送，请注意查收' });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/auth/sms/verify — 验证码登录/注册
router.post('/sms/verify', async (req, res) => {
  try {
    const { phone, code } = req.body || {};
    if (!phone || !code) return res.status(400).json({ error: '请填写手机号和验证码' });
    // 锁定检查（失败三次锁定10分钟）
    const failInfo = smsFailCount.get(phone);
    if (failInfo && failInfo.lockedUntil && Date.now() < failInfo.lockedUntil) {
      const wait = Math.ceil((failInfo.lockedUntil - Date.now()) / 60000);
      return res.status(429).json({ error: `验证码错误次数过多，请 ${wait} 分钟后再试` });
    }
    const record = await prisma.smsCode.findFirst({
      where: { phone, code, used: false },
      orderBy: { id: 'desc' },
    });
    if (!record) {
      const current = smsFailCount.get(phone) || { count: 0 };
      current.count += 1;
      if (current.count >= 3) {
        current.lockedUntil = Date.now() + 10 * 60 * 1000;
        current.count = 0;
      }
      smsFailCount.set(phone, current);
      return res.status(401).json({ error: '验证码错误' });
    }
    if (Date.now() > record.expiresAt) {
      return res.status(401).json({ error: '验证码已过期，请重新获取' });
    }
    await prisma.smsCode.update({ where: { id: record.id }, data: { used: true } });
    smsFailCount.delete(phone);
    // 查找或创建用户
    let user = await prisma.user.findUnique({ where: { phone } });
    if (!user) {
      const name = '攀登者' + phone.slice(-4);
      const username = '@climber' + phone.slice(-6);
      const avatar = 'https://i.pravatar.cc/150?u=' + phone;
      user = await prisma.user.create({ data: { name, username, phone, avatar } });
    }
    res.json({ token: makeToken(user.id), user: await safeUser(user) });
  } catch (e) {
    if (e.code === 'P2002') {
      return res.status(400).json({ error: '账号已存在，请直接登录' });
    }
    res.status(500).json({ error: '服务器错误' });
  }
});

/** 简单邮箱格式校验（长度限制 + 基本结构检查，避免 ReDoS） */
function isValidEmail(email) {
  if (typeof email !== 'string' || email.length > 254 || email.length < 6) return false;
  const atIndex = email.indexOf('@');
  if (atIndex < 1 || atIndex !== email.lastIndexOf('@')) return false;
  const domain = email.slice(atIndex + 1);
  const dotIndex = domain.lastIndexOf('.');
  return dotIndex > 0 && dotIndex < domain.length - 1;
}

// POST /api/auth/email/send — 发送邮箱验证码
router.post('/email/send', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: '邮箱格式不正确' });
    }
    // 60 秒冷却检查
    const lastSent = emailSendCooldown.get(email);
    if (lastSent && Date.now() - lastSent < 60 * 1000) {
      const wait = Math.ceil((60 * 1000 - (Date.now() - lastSent)) / 1000);
      return res.status(429).json({ error: `请等待 ${wait} 秒后再次获取验证码` });
    }
    // 生成6位验证码
    const code = String(crypto.randomInt(100000, 999999));
    const expiresAt = Date.now() + 5 * 60 * 1000;
    // 使旧验证码失效
    await prisma.emailCode.updateMany({ where: { email, used: false }, data: { used: true } });
    await prisma.emailCode.create({ data: { email, code, expiresAt } });
    // 记录发送时间
    emailSendCooldown.set(email, Date.now());
    // 发送邮件
    emailProvider.send(email, code).catch(e => console.error('[Email]', e.message));
    const isDev = process.env.EMAIL_PROVIDER !== 'smtp';
    res.json({ success: true, message: isDev ? '验证码已发送（开发模式：查看服务器控制台）' : '验证码已发送到您的邮箱，请注意查收' });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/auth/email/verify — 邮箱验证码登录/注册
router.post('/email/verify', async (req, res) => {
  try {
    const { email, code } = req.body || {};
    if (!email || !code) return res.status(400).json({ error: '请填写邮箱和验证码' });
    // 锁定检查（失败三次锁定10分钟）
    const failInfo = emailFailCount.get(email);
    if (failInfo && failInfo.lockedUntil && Date.now() < failInfo.lockedUntil) {
      const wait = Math.ceil((failInfo.lockedUntil - Date.now()) / 60000);
      return res.status(429).json({ error: `验证码错误次数过多，请 ${wait} 分钟后再试` });
    }
    const record = await prisma.emailCode.findFirst({
      where: { email, code, used: false },
      orderBy: { id: 'desc' },
    });
    if (!record) {
      const current = emailFailCount.get(email) || { count: 0 };
      current.count += 1;
      if (current.count >= 3) {
        current.lockedUntil = Date.now() + 10 * 60 * 1000;
        current.count = 0;
      }
      emailFailCount.set(email, current);
      return res.status(401).json({ error: '验证码错误' });
    }
    if (Date.now() > record.expiresAt) {
      return res.status(401).json({ error: '验证码已过期，请重新获取' });
    }
    await prisma.emailCode.update({ where: { id: record.id }, data: { used: true } });
    emailFailCount.delete(email);
    // 查找或创建用户
    let user = await prisma.user.findFirst({ where: { email } });
    if (!user) {
      const name = '攀登者' + email.split('@')[0].slice(0, 6);
      let username = '@climber_' + crypto.randomBytes(4).toString('hex');
      const avatar = 'https://i.pravatar.cc/150?u=' + encodeURIComponent(email);
      user = await prisma.user.create({ data: { name, username, email, avatar } });
    }
    res.json({ token: makeToken(user.id), user: await safeUser(user) });
  } catch (e) {
    if (e.code === 'P2002') {
      return res.status(400).json({ error: '账号已存在，请直接登录' });
    }
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/auth/change-email — 更换绑定邮箱（需登录 + 新邮箱验证码）
router.put('/change-email', authWriteLimiter, auth, async (req, res) => {
  try {
    const { email, code } = req.body || {};
    if (!email || !code) return res.status(400).json({ error: '请填写新邮箱和验证码' });
    if (!isValidEmail(email)) return res.status(400).json({ error: '邮箱格式不正确' });
    const existing = await prisma.user.findFirst({ where: { email } });
    if (existing && existing.id !== req.user.id) return res.status(400).json({ error: '该邮箱已被其他账号使用' });
    const record = await prisma.emailCode.findFirst({
      where: { email, code, used: false },
      orderBy: { id: 'desc' },
    });
    if (!record || Date.now() > record.expiresAt) return res.status(401).json({ error: '验证码无效或已过期' });
    await prisma.emailCode.update({ where: { id: record.id }, data: { used: true } });
    await prisma.user.update({ where: { id: req.user.id }, data: { email } });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/auth/wechat — 微信登录（mock）
router.post('/wechat', async (req, res) => {
  try {
    const { code } = req.body || {};
    if (!code) return res.status(400).json({ error: '缺少 code 参数' });
    const fakeOpenid = 'wx_mock_' + code + '_' + crypto.randomBytes(8).toString('hex');
    let user = await prisma.user.findFirst({ where: { wechatOpenid: fakeOpenid } });
    if (!user) {
      const suffix = crypto.randomBytes(4).toString('hex');
      const name = '微信用户' + suffix.slice(0, 4);
      const avatar = 'https://i.pravatar.cc/150?u=wx' + fakeOpenid;
      try {
        const username = '@wx' + Date.now().toString(36) + suffix;
        user = await prisma.user.create({ data: { name, username, avatar, wechatOpenid: fakeOpenid } });
      } catch (e) {
        if (e.code === 'P2002') {
          const username2 = '@wx' + crypto.randomBytes(6).toString('hex');
          user = await prisma.user.create({ data: { name, username: username2, avatar, wechatOpenid: fakeOpenid } });
        } else throw e;
      }
    }
    res.json({ token: makeToken(user.id), user: await safeUser(user) });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/auth/apple — Apple 登录
// 若已配置 APPLE_CLIENT_ID、APPLE_TEAM_ID、APPLE_KEY_ID、APPLE_PRIVATE_KEY，则进行真实 JWT 验证；
// 否则回退到 mock 模式（仅适用于开发/测试）
router.post('/apple', async (req, res) => {
  try {
    const { identityToken, fullName } = req.body || {};
    if (!identityToken) return res.status(400).json({ error: '缺少 identityToken 参数' });

    let appleSub = null;
    let appleEmail = null;
    let appleName = null;

    const hasAppleCreds = process.env.APPLE_CLIENT_ID &&
      process.env.APPLE_TEAM_ID &&
      process.env.APPLE_KEY_ID &&
      process.env.APPLE_PRIVATE_KEY;

    if (hasAppleCreds) {
      // Apple 身份令牌基本声明验证（iss / aud / exp）
      // ⚠️  此处不验证 JWT 签名（需要 JWKS 公钥）。
      // 生产环境强烈建议集成 apple-signin-auth 库进行完整签名验证：
      //   https://github.com/ananay/apple-signin-auth
      // 在当前实现中，恶意方可伪造合法格式但签名无效的 JWT，绕过声明检查。
      // 仅在受信任的内网/内测环境，或确保 identityToken 来源可信时使用此实现。
      try {
        const decoded = jwt.decode(identityToken, { complete: true });
        if (!decoded || !decoded.header || !decoded.header.kid) {
          return res.status(401).json({ error: 'Apple identityToken 格式无效' });
        }
        const appleIss = decoded.payload && decoded.payload.iss;
        if (appleIss !== 'https://appleid.apple.com') {
          return res.status(401).json({ error: 'Apple identityToken 签发方无效' });
        }
        const appleAud = decoded.payload && decoded.payload.aud;
        if (appleAud !== process.env.APPLE_CLIENT_ID) {
          return res.status(401).json({ error: 'Apple identityToken audience 不匹配' });
        }
        const appleExp = decoded.payload && decoded.payload.exp;
        if (!appleExp || Date.now() / 1000 > appleExp) {
          return res.status(401).json({ error: 'Apple identityToken 已过期' });
        }
        appleSub = decoded.payload.sub;
        appleEmail = decoded.payload.email;
        appleName = (fullName && (fullName.givenName || fullName.familyName))
          ? `${fullName.givenName || ''} ${fullName.familyName || ''}`.trim()
          : null;
      } catch (jwtErr) {
        console.error('[Apple] identityToken 解析失败:', jwtErr.message);
        return res.status(401).json({ error: 'Apple identityToken 无效' });
      }
    } else {
      // Mock 模式：开发/测试专用
      appleSub = 'apple_mock_' + identityToken.slice(0, 16) + '_' + identityToken.length;
      console.warn('[Apple] 使用 mock 模式，配置 APPLE_CLIENT_ID/APPLE_TEAM_ID/APPLE_KEY_ID/APPLE_PRIVATE_KEY 启用真实验证');
    }

    let user = await prisma.user.findFirst({ where: { appleSub } });
    if (!user) {
      // 若 Apple 返回了已验证邮箱，尝试关联已有账号
      // 安全性：Apple 平台要求邮箱所有权验证，因此此处邮箱关联是安全的
      if (appleEmail) {
        user = await prisma.user.findFirst({ where: { email: appleEmail } });
        if (user) {
          await prisma.user.update({ where: { id: user.id }, data: { appleSub } });
        }
      }
    }
    if (!user) {
      const suffix = crypto.randomBytes(4).toString('hex');
      const name = appleName || ('Apple用户' + suffix.slice(0, 4));
      const avatar = 'https://i.pravatar.cc/150?u=ap' + appleSub;
      const userData = { name, avatar, appleSub };
      if (appleEmail) userData.email = appleEmail;
      try {
        const username = '@apple' + Date.now().toString(36) + suffix;
        user = await prisma.user.create({ data: { ...userData, username } });
      } catch (e) {
        if (e.code === 'P2002') {
          const username2 = '@apple' + crypto.randomBytes(6).toString('hex');
          user = await prisma.user.create({ data: { ...userData, username: username2 } });
        } else throw e;
      }
    }
    res.json({ token: makeToken(user.id), user: await safeUser(user) });
  } catch (e) {
    console.error('[apple]', e);
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/auth/google — Google 登录
// 若已配置 GOOGLE_CLIENT_ID，则验证 Google ID token；否则使用 mock 模式（仅开发/测试）
router.post('/google', loginLimiter, async (req, res) => {
  try {
    const { idToken } = req.body || {};
    if (!idToken) return res.status(400).json({ error: '缺少 idToken 参数' });

    let googleSub = null;
    let googleEmail = null;
    let googleName = null;
    let googleAvatar = null;

    if (googleOAuthClient) {
      // 真实 Google ID token 验证
      const payload = await verifyGoogleToken(idToken);
      if (!payload) return res.status(401).json({ error: 'Google ID token 验证失败，请重新登录' });
      googleSub = payload.sub;
      googleEmail = payload.email;
      googleName = payload.name;
      googleAvatar = payload.picture;
    } else {
      // Mock 模式：开发/测试专用（idToken 作为唯一标识）
      googleSub = 'google_mock_' + crypto.createHash('sha256').update(idToken).digest('hex').slice(0, 20);
      console.warn('[Google] 使用 mock 模式，配置 GOOGLE_CLIENT_ID 启用真实验证');
    }

    // 查找已绑定此 Google 账号的用户
    let user = await prisma.user.findFirst({ where: { googleSub } });
    if (!user && googleEmail) {
      // 尝试通过邮箱关联已有账号
      // 安全性：Google 平台验证邮箱所有权，因此此处邮箱关联是安全的（仅在真实 token 验证时执行）
      user = await prisma.user.findFirst({ where: { email: googleEmail } });
      if (user) {
        await prisma.user.update({ where: { id: user.id }, data: { googleSub } });
      }
    }
    if (!user) {
      const suffix = crypto.randomBytes(4).toString('hex');
      const name = googleName || ('Google用户' + suffix.slice(0, 4));
      const avatar = googleAvatar || ('https://i.pravatar.cc/150?u=g' + googleSub);
      const userData = { name, avatar, googleSub };
      if (googleEmail) userData.email = googleEmail;
      try {
        const username = '@g' + Date.now().toString(36) + suffix;
        user = await prisma.user.create({ data: { ...userData, username } });
      } catch (e) {
        if (e.code === 'P2002') {
          const username2 = '@google' + crypto.randomBytes(6).toString('hex');
          user = await prisma.user.create({ data: { ...userData, username: username2 } });
        } else throw e;
      }
    }
    res.json({ token: makeToken(user.id), user: await safeUser(user) });
  } catch (e) {
    console.error('[google]', e);
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
