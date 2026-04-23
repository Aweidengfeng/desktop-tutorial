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
    is_admin: user.isAdmin ? 1 : 0,
    is_guide: isGuide ? 1 : 0,
    is_club_admin: isClubAdmin ? 1 : 0,
  };
}

// POST /api/auth/register
router.post('/register', registerLimiter, async (req, res) => {
  try {
    const { name, phone, password, policyVersion, agreedPrivacy, agreedTerms } = req.body;
    if (!name || !phone || !password) {
      return res.status(400).json({ error: '请填写姓名、手机号和密码' });
    }
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ error: '手机号格式不正确' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: '密码至少6位' });
    }
    if (!agreedPrivacy || !agreedTerms || !policyVersion || policyVersion !== POLICY_VERSION) {
      return res.status(422).json({ error: '请阅读并同意最新版隐私政策和用户协议' });
    }
    const existingUser = await prisma.user.findUnique({ where: { phone } });
    if (existingUser) {
      return res.status(400).json({ error: '手机号已注册' });
    }
    const username = '@' + name.toLowerCase().replace(/\s+/g, '') + '_' + phone.slice(-4);
    const avatar = 'https://i.pravatar.cc/150?u=' + phone;
    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name,
        username,
        phone,
        password: hash,
        avatar,
        policyVersion,
        policyAgreedAt: new Date(),
      },
    });
    res.json({ token: makeToken(user.id), user: await safeUser(user) });
  } catch (e) {
    if (e.code === 'P2002') {
      const field = e.meta?.target?.includes('phone') ? 'phone' : 'other';
      if (field === 'phone') return res.status(400).json({ error: '手机号已注册' });
      return res.status(400).json({ error: '注册失败，请稍后重试' });
    }
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ error: '手机号格式不正确' });
    }
    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) return res.status(401).json({ error: '手机号或密码错误' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: '手机号或密码错误' });
    res.json({ token: makeToken(user.id), user: await safeUser(user) });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/auth/me
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
    const { name, avatar } = req.body;
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
    const { oldPassword, newPassword } = req.body;
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
    const { phone, code } = req.body;
    if (!phone || !code) return res.status(400).json({ error: '请填写新手机号和验证码' });
    if (!/^1[3-9]\d{9}$/.test(phone)) return res.status(400).json({ error: '手机号格式不正确' });
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
// 内存限流：同一手机号 60 秒内只能请求一次
const smsSendCooldown = new Map(); // phone → lastSentAt(ms)
// 验证失败计数（失败三次锁定10分钟）
const smsFailCount = new Map(); // phone → {count, lockedUntil}

router.post('/sms/send', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ error: '手机号格式不正确' });
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
    // 发送（mock）
    smsProvider.send(phone, code).catch(e => console.error('[SMS]', e.message));
    res.json({ success: true, message: '验证码已发送（当前为内测阶段，验证码可在管理员后台查看；正式版将对接阿里云短信）' });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/auth/sms/verify — 验证码登录/注册
router.post('/sms/verify', async (req, res) => {
  try {
    const { phone, code } = req.body;
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

// POST /api/auth/wechat — 微信登录（mock）
router.post('/wechat', async (req, res) => {
  try {
    const { code } = req.body;
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

// POST /api/auth/apple — Apple 登录（mock）
router.post('/apple', async (req, res) => {
  try {
    const { identityToken } = req.body;
    if (!identityToken) return res.status(400).json({ error: '缺少 identityToken 参数' });
    const fakeSub = 'apple_mock_' + identityToken.slice(0, 16) + '_' + crypto.randomBytes(8).toString('hex');
    let user = await prisma.user.findFirst({ where: { appleSub: fakeSub } });
    if (!user) {
      const suffix = crypto.randomBytes(4).toString('hex');
      const name = 'Apple用户' + suffix.slice(0, 4);
      const avatar = 'https://i.pravatar.cc/150?u=ap' + fakeSub;
      try {
        const username = '@apple' + Date.now().toString(36) + suffix;
        user = await prisma.user.create({ data: { name, username, avatar, appleSub: fakeSub } });
      } catch (e) {
        if (e.code === 'P2002') {
          const username2 = '@apple' + crypto.randomBytes(6).toString('hex');
          user = await prisma.user.create({ data: { name, username: username2, avatar, appleSub: fakeSub } });
        } else throw e;
      }
    }
    res.json({ token: makeToken(user.id), user: await safeUser(user) });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
