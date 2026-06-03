const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const prisma = require('../db/prisma');
const db = require('../db/database');
const auth = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimits');
const { encryptPII, decryptPII } = require('../utils/crypto');
const { INVITE_REWARD_POINTS, normalizeInviteCode, ensureUserInviteCode } = require('../utils/invite');

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

// ── Google OAuth ─────────────────────────────────────────────────────────────
// 仅当 GOOGLE_CLIENT_ID 配置时加载 google-auth-library
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

// ── Apple Sign In JWKS 验证 ──────────────────────────────────────────────────
// 缓存 Apple 公钥集合，避免每次请求都调用 Apple API（TTL 1 小时）
let _appleJwks = null;
let _appleJwksCachedAt = 0;
let _appleJwksFetchPromise = null; // 防止并发重复 fetch
const APPLE_JWKS_TTL_MS = 60 * 60 * 1000; // 1h

/**
 * 内部辅助：发起一次 Apple JWKS fetch（并发安全，多个请求共享同一个 Promise）。
 */
function _fetchAppleJwks() {
  if (_appleJwksFetchPromise) return _appleJwksFetchPromise;
  _appleJwksFetchPromise = fetch('https://appleid.apple.com/auth/keys')
    .then(r => { if (!r.ok) throw new Error('获取 Apple JWKS 失败，HTTP ' + r.status); return r.json(); })
    .then(data => {
      _appleJwks = data;
      _appleJwksCachedAt = Date.now();
    })
    .finally(() => { _appleJwksFetchPromise = null; });
  return _appleJwksFetchPromise;
}

/**
 * 从 Apple JWKS 端点取出与 kid 匹配的 Node.js KeyObject。
 * 内置并发安全缓存：多个并发请求共享同一个 fetch Promise，避免重复调用 Apple API。
 * kid 不命中时自动刷新一次缓存。
 */
async function getApplePublicKey(kid) {
  const needRefresh = !_appleJwks || Date.now() - _appleJwksCachedAt > APPLE_JWKS_TTL_MS;
  if (needRefresh) await _fetchAppleJwks();
  if (!_appleJwks) throw new Error('Apple JWKS 数据不可用');
  let keyData = _appleJwks.keys.find(k => k.kid === kid);
  if (!keyData) {
    // kid 可能是新轮换的，强制刷新缓存再试一次
    _appleJwksCachedAt = 0; // 让下次 _fetchAppleJwks 重新拉取
    await _fetchAppleJwks();
    if (!_appleJwks) throw new Error('Apple JWKS 数据不可用');
    keyData = _appleJwks.keys.find(k => k.kid === kid);
    if (!keyData) throw new Error('Apple JWKS 中未找到 kid: ' + kid);
  }
  return crypto.createPublicKey({ key: keyData, format: 'jwk' });
}

/**
 * 完整验证 Apple identityToken：
 *   1. 从 Apple JWKS 端点获取对应公钥
 *   2. 用 jsonwebtoken.verify() 验证 RS256 签名、iss、aud、exp
 * @param {string} identityToken - Apple Sign In 返回的 JWT
 * @returns {Promise<object>} 已验证的 payload（含 sub / email 等）
 * @throws 验证失败时抛出错误
 */
async function verifyAppleToken(identityToken) {
  const decoded = jwt.decode(identityToken, { complete: true });
  if (!decoded || !decoded.header || !decoded.header.kid) {
    throw new Error('identityToken 格式无效（缺少 header.kid）');
  }
  const publicKey = await getApplePublicKey(decoded.header.kid);
  // jwt.verify 同时验证：RS256 签名 + iss + aud + exp
  const payload = jwt.verify(identityToken, publicKey, {
    algorithms: ['RS256'],
    issuer: 'https://appleid.apple.com',
    audience: process.env.APPLE_CLIENT_ID,
  });
  return payload;
}

// ── WeChat OAuth ─────────────────────────────────────────────────────────────
/**
 * 用微信 code 换取 openid（及可选 unionid）。
 * 支持两种模式：
 *   - 普通 OAuth（移动/网页）：https://api.weixin.qq.com/sns/oauth2/access_token
 *   - 小程序：通过 WECHAT_MINI_APP=true 切换为 jscode2session
 *
 * @param {string} code - 客户端微信 SDK 返回的临时授权 code
 * @returns {Promise<{ openid: string, accessToken?: string, unionid?: string }>}
 * @throws 换取失败时抛出携带微信 errcode 的 Error
 */
async function exchangeWechatCode(code) {
  const appid  = process.env.WECHAT_APPID;
  const secret = process.env.WECHAT_SECRET;
  if (!appid || !secret) throw new Error('未配置 WECHAT_APPID / WECHAT_SECRET');

  const isMiniApp = process.env.WECHAT_MINI_APP === 'true';
  const url = isMiniApp
    ? `https://api.weixin.qq.com/sns/jscode2session?appid=${appid}&secret=${secret}&js_code=${code}&grant_type=authorization_code`
    : `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${appid}&secret=${secret}&code=${code}&grant_type=authorization_code`;

  const res = await fetch(url);
  if (!res.ok) throw new Error('微信 API 请求失败，HTTP ' + res.status);
  const data = await res.json();
  if (data.errcode) throw new Error(`微信 OAuth 错误 ${data.errcode}: ${data.errmsg}`);
  return {
    openid:      data.openid,
    unionid:     data.unionid || null,
    accessToken: data.access_token || null,
  };
}

/**
 * 获取微信用户基本信息（昵称/头像）。
 * 小程序模式下无法直接获取（需调用前端 getUserProfile），返回 null。
 * @param {string} accessToken
 * @param {string} openid
 * @returns {Promise<{ name: string, avatar: string } | null>}
 */
async function getWechatUserInfo(accessToken, openid) {
  if (!accessToken) return null;
  try {
    const res = await fetch(
      `https://api.weixin.qq.com/sns/userinfo?access_token=${accessToken}&openid=${openid}&lang=zh_CN`
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.errcode) return null;
    return {
      name:   data.nickname  || null,
      avatar: data.headimgurl || null,
    };
  } catch {
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
  max: ({
    production: 10,
    test: 1000,
  })[process.env.NODE_ENV] || 100,
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
  return jwt.sign({ id }, JWT_SECRET, { expiresIn: '15m' });
}

function makeRefreshToken(id) {
  return jwt.sign({ id, type: 'refresh' }, JWT_SECRET, { expiresIn: '30d' });
}

async function findInviterByCode(inviteCode) {
  const normalizedCode = normalizeInviteCode(inviteCode);
  if (!normalizedCode) return null;

  const inviterRows = await prisma.$queryRaw`SELECT id FROM users WHERE invite_code = ${normalizedCode} LIMIT 1`;
  if (Array.isArray(inviterRows) && inviterRows.length) {
    return { type: 'user', inviterId: Number(inviterRows[0].id), code: normalizedCode };
  }

  try {
    const platformRows = await prisma.$queryRaw`SELECT code FROM invite_codes WHERE code = ${normalizedCode} LIMIT 1`;
    if (Array.isArray(platformRows) && platformRows.length) {
      try {
        await prisma.$executeRaw`UPDATE invite_codes SET used_count = COALESCE(used_count, 0) + 1 WHERE code = ${normalizedCode}`;
      } catch (_) {}
      return { type: 'platform', code: normalizedCode };
    }
  } catch (e) {
    const msg = String(e?.message || '').toLowerCase();
    if (!msg.includes('no such table') && !msg.includes('does not exist')) throw e;
  }

  return null;
}

async function processInviteOnRegister(inviteCode, newUserId) {
  const inviter = await findInviterByCode(inviteCode);
  if (!inviter || inviter.type !== 'user') return;
  if (!inviter.inviterId || inviter.inviterId === Number(newUserId)) return;

  await prisma.$executeRaw`UPDATE users SET invited_by = ${inviter.inviterId} WHERE id = ${newUserId}`;
  await prisma.$executeRaw`
    INSERT INTO invite_records (inviter_id, invitee_id, invite_code, reward_value)
    VALUES (${inviter.inviterId}, ${newUserId}, ${inviter.code}, ${INVITE_REWARD_POINTS})
  `;

  setImmediate(async () => {
    try {
      await prisma.$executeRaw`
        UPDATE users SET invite_reward_points = COALESCE(invite_reward_points, 0) + ${INVITE_REWARD_POINTS}
        WHERE id = ${inviter.inviterId}
      `;
      await prisma.$executeRaw`
        UPDATE invite_records
        SET rewarded_at = CURRENT_TIMESTAMP
        WHERE inviter_id = ${inviter.inviterId} AND invitee_id = ${newUserId}
      `;
      await prisma.$executeRaw`
        INSERT INTO notifications (user_id, type, title, body)
        VALUES (${inviter.inviterId}, 'invite_reward', '邀请奖励', ${`您邀请的好友已成功注册，获得${INVITE_REWARD_POINTS}积分！`})
      `;
    } catch (e) {
      console.warn('[invite] async reward failed:', e.message);
    }
  });
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
    phone: user.phone ? decryptPII(user.phone) : null,
    email: user.email ? decryptPII(user.email) : null,
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
 *     description: 使用邮箱、姓名和密码注册新账户（手机号可选）
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password, policyVersion, agreedPrivacy, agreedTerms]
 *             properties:
 *               name:
 *                 type: string
 *                 description: 用户姓名
 *               email:
 *                 type: string
 *                 format: email
 *                 description: 邮箱地址（必填）
 *               phone:
 *                 type: string
 *                 description: 手机号（可选，支持中国大陆格式或国际 +区号格式）
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
 *         description: 参数错误或邮箱已注册
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
    const { name, phone, emailCode, password, policyVersion, agreedPrivacy, agreedTerms, invite_code } = req.body || {};
    const email = req.body?.email?.trim() ? req.body.email.trim().toLowerCase() : undefined;
    if (!name || !password) {
      return res.status(400).json({ error: '请填写姓名和密码' });
    }
    if (!email) {
      return res.status(400).json({ error: '请填写邮箱地址' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: '邮箱格式不正确' });
    }
    if (phone && !isValidPhone(phone)) {
      return res.status(400).json({ error: '手机号格式不正确（支持中国大陆格式或国际 +区号格式）' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: '密码至少6位' });
    }
    if (!agreedPrivacy || !agreedTerms || !policyVersion || policyVersion !== POLICY_VERSION) {
      return res.status(422).json({ error: '请阅读并同意最新版隐私政策和用户协议' });
    }
    // 检查手机号/邮箱是否已注册
    if (phone) {
      const existing = await prisma.user.findFirst({ where: { phone: encryptPII(phone) } });
      if (existing) return res.status(400).json({ error: '手机号已注册' });
    }
    if (email) {
      const existing = await prisma.user.findFirst({ where: { email: encryptPII(email) } });
      if (existing) return res.status(400).json({ error: '邮箱已注册' });
    }
    // 验证邮箱验证码
    if (!emailCode) {
      return res.status(400).json({ error: '请输入邮箱验证码' });
    }
    const codeRecord = db.prepare(
      'SELECT id, expires_at FROM email_codes WHERE email = ? AND code = ? AND used = 0 ORDER BY id DESC LIMIT 1'
    ).get(email, emailCode);
    if (!codeRecord || Date.now() > codeRecord.expires_at) {
      return res.status(400).json({ error: '验证码无效或已过期，请重新获取' });
    }
    db.prepare('UPDATE email_codes SET used = 1 WHERE id = ?').run(codeRecord.id);
    // 用4位随机十六进制后缀确保用户名唯一
    const suffix = crypto.randomBytes(2).toString('hex');
    const sanitizedName = name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
    const username = '@' + (sanitizedName || ('user' + crypto.randomBytes(4).toString('hex'))) + '_' + suffix;
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
    if (phone) userData.phone = encryptPII(phone);
    if (email) userData.email = encryptPII(email);
    let user;
    try {
      user = await prisma.user.create({ data: userData });
    } catch (e) {
      if (e.code === 'P2002') {
        const target = e.meta?.target || '';
        if (target.includes('phone')) return res.status(400).json({ error: '手机号已注册' });
        if (target.includes('email')) return res.status(400).json({ error: '邮箱已注册' });
        if (target.includes('username')) {
          // username 冲突时自动追加随机后缀重试一次
          const retryUsername = username + '_' + crypto.randomBytes(3).toString('hex');
          user = await prisma.user.create({ data: { ...userData, username: retryUsername } });
        }
        if (!user) return res.status(400).json({ error: '注册失败，请稍后重试' });
      }
      throw e;
    }
    try { await ensureUserInviteCode(prisma, user.id); } catch (e) { console.warn('[invite] generate code failed:', e.message); }
    if (invite_code) {
      try { await processInviteOnRegister(invite_code, user.id); } catch (e) { console.warn('[invite] process failed:', e.message); }
    }
    res.json({ token: makeToken(user.id), refreshToken: makeRefreshToken(user.id), user: await safeUser(user) });
  } catch (e) {
    // 此处捕获：重新抛出的非 P2002 错误，以及 retryUsername 创建时的 P2002（二次冲突）
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
      user = await prisma.user.findFirst({ where: { email: encryptPII(email) } });
      if (!user) return res.status(401).json({ error: '邮箱或密码错误' });
    } else if (phone) {
      if (!isValidPhone(phone)) {
        return res.status(400).json({ error: '手机号格式不正确（支持中国大陆格式或国际 +区号格式）' });
      }
      user = await prisma.user.findFirst({ where: { phone: encryptPII(phone) } });
      if (!user) return res.status(401).json({ error: '手机号或密码错误' });
    } else {
      return res.status(400).json({ error: '请填写手机号或邮箱' });
    }
    if (!user.password) {
      return res.status(401).json({ error: '此账号未设置密码，请使用验证码或第三方账号登录' });
    }
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: email ? '邮箱或密码错误' : '手机号或密码错误' });
    res.json({ token: makeToken(user.id), refreshToken: makeRefreshToken(user.id), user: await safeUser(user) });
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
    const existing = await prisma.user.findFirst({ where: { phone: encryptPII(phone) } });
    if (existing && existing.id !== req.user.id) return res.status(400).json({ error: '该手机号已被其他账号使用' });
    const record = await prisma.smsCode.findFirst({
      where: { phone, code, used: false },
      orderBy: { id: 'desc' },
    });
    if (!record || Date.now() > record.expiresAt) return res.status(401).json({ error: '验证码无效或已过期' });
    await prisma.smsCode.update({ where: { id: record.id }, data: { used: true } });
    await prisma.user.update({ where: { id: req.user.id }, data: { phone: encryptPII(phone) } });
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

// POST /api/auth/sms/send — 发送短信验证码
const smsSender = require('../lib/smsSender');
const emailProvider = require('../utils/email');
const { sendMail, emailVerifyCode } = require('../middleware/mailer');
// 内存限流：同一手机号 60 秒内只能请求一次
const smsSendCooldown = new Map(); // phone → lastSentAt(ms)
// 验证失败计数（失败三次锁定10分钟）
const smsFailCount = new Map(); // phone → {count, lockedUntil}
// 邮箱发送冷却（60 秒）
const emailSendCooldown = new Map(); // email → lastSentAt(ms)
// 邮箱验证失败计数
const emailFailCount = new Map(); // email → {count, lockedUntil}

router.post('/sms/send', authLimiter, async (req, res) => {
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
    smsSender.sendSms(phone, process.env.TENCENT_SMS_TEMPLATE_ID, [code])
      .catch(e => console.error('[SMS]', e.message));
    const hasTencentCreds = Boolean(
      (process.env.TENCENT_SMS_SECRET_ID || '').trim() &&
      (process.env.TENCENT_SMS_SECRET_KEY || '').trim() &&
      ((process.env.TENCENT_SMS_APP_ID || process.env.TENCENT_SMS_SDK_APP_ID || '').trim())
    );
    res.json({ success: true, message: hasTencentCreds ? '验证码已发送，请注意查收' : '验证码已发送（开发模式：查看服务器控制台）' });
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
    let user = await prisma.user.findFirst({ where: { phone: encryptPII(phone) } });
    if (!user) {
      const name = '攀登者' + phone.slice(-4);
      const username = '@climber' + phone.slice(-6);
      const avatar = 'https://i.pravatar.cc/150?u=' + phone;
      user = await prisma.user.create({ data: { name, username, phone: encryptPII(phone), avatar } });
    }
    res.json({ token: makeToken(user.id), refreshToken: makeRefreshToken(user.id), user: await safeUser(user) });
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
    // 发送邮件（优先使用 mailer.js，降级到 emailProvider）
    sendMail({ to: email, ...emailVerifyCode({ code, purpose: 'login' }) }).then(result => {
      if (result.skipped) emailProvider.send(email, code).catch(e => console.error('[Email]', e.message));
    }).catch(() => emailProvider.send(email, code).catch(e => console.error('[Email]', e.message)));
    const isDev = !process.env.RESEND_API_KEY;
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
    let user = await prisma.user.findFirst({ where: { email: encryptPII(email) } });
    if (!user) {
      const name = '攀登者' + email.split('@')[0].slice(0, 6);
      let username = '@climber_' + crypto.randomBytes(4).toString('hex');
      const avatar = 'https://i.pravatar.cc/150?u=' + encodeURIComponent(email);
      user = await prisma.user.create({ data: { name, username, email: encryptPII(email), avatar } });
    }
    res.json({ token: makeToken(user.id), refreshToken: makeRefreshToken(user.id), user: await safeUser(user) });
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
    const existing = await prisma.user.findFirst({ where: { email: encryptPII(email) } });
    if (existing && existing.id !== req.user.id) return res.status(400).json({ error: '该邮箱已被其他账号使用' });
    const record = await prisma.emailCode.findFirst({
      where: { email, code, used: false },
      orderBy: { id: 'desc' },
    });
    if (!record || Date.now() > record.expiresAt) return res.status(401).json({ error: '验证码无效或已过期' });
    await prisma.emailCode.update({ where: { id: record.id }, data: { used: true } });
    await prisma.user.update({ where: { id: req.user.id }, data: { email: encryptPII(email) } });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/auth/wechat — 微信登录
// 若已配置 WECHAT_APPID + WECHAT_SECRET，则通过微信 OAuth 换取真实 openid；
// 否则回退到 mock 模式（仅适用于开发/测试）
router.post('/wechat', loginLimiter, async (req, res) => {
  try {
    const { code } = req.body || {};
    if (!code) return res.status(400).json({ error: '缺少 code 参数' });

    let wechatOpenid = null;
    let wechatName   = null;
    let wechatAvatar = null;

    const hasWechatCreds = process.env.WECHAT_APPID && process.env.WECHAT_SECRET;
    if (hasWechatCreds) {
      // 真实微信 OAuth：code → openid
      let wxData;
      try {
        wxData = await exchangeWechatCode(code);
      } catch (wxErr) {
        console.error('[WeChat] code 换取失败:', wxErr.message);
        return res.status(401).json({ error: '微信登录失败：' + wxErr.message });
      }
      wechatOpenid = wxData.openid;
      // 尝试获取微信用户昵称和头像（仅 OAuth 模式有 access_token；小程序模式跳过）
      if (wxData.accessToken) {
        const info = await getWechatUserInfo(wxData.accessToken, wechatOpenid);
        if (info) {
          wechatName   = info.name;
          wechatAvatar = info.avatar;
        }
      }
      console.log('[WeChat] 登录成功，openid:', wechatOpenid.slice(0, 8) + '***');
    } else {
      // Mock 模式：开发/测试专用
      wechatOpenid = 'wx_mock_' + crypto.randomBytes(12).toString('hex');
      console.warn('[WeChat] 使用 mock 模式，配置 WECHAT_APPID + WECHAT_SECRET 启用真实验证');
    }

    let user = await prisma.user.findFirst({ where: { wechatOpenid } });
    if (!user) {
      const suffix = crypto.randomBytes(4).toString('hex');
      const name   = wechatName || ('微信用户' + suffix.slice(0, 4));
      const avatar = wechatAvatar || ('https://i.pravatar.cc/150?u=wx' + wechatOpenid);
      try {
        const username = '@wx' + Date.now().toString(36) + suffix;
        user = await prisma.user.create({ data: { name, username, avatar, wechatOpenid } });
      } catch (e) {
        if (e.code === 'P2002') {
          const username2 = '@wx' + crypto.randomBytes(6).toString('hex');
          user = await prisma.user.create({ data: { name, username: username2, avatar, wechatOpenid } });
        } else throw e;
      }
    }
    res.json({ token: makeToken(user.id), refreshToken: makeRefreshToken(user.id), user: await safeUser(user) });
  } catch (e) {
    console.error('[wechat]', e);
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/auth/apple — Apple 登录
// 若已配置 APPLE_CLIENT_ID，则通过 Apple JWKS 完整验证 identityToken（RS256 签名 + iss + aud + exp）；
// 否则回退到 mock 模式（仅适用于开发/测试）
router.post('/apple', loginLimiter, async (req, res) => {
  try {
    const { identityToken, fullName } = req.body || {};
    if (!identityToken) return res.status(400).json({ error: '缺少 identityToken 参数' });

    let appleSub   = null;
    let appleEmail = null;
    let appleName  = null;

    if (process.env.APPLE_CLIENT_ID) {
      // 真实验证：从 Apple JWKS 端点获取公钥，完整验证 RS256 签名 + iss + aud + exp
      try {
        const payload = await verifyAppleToken(identityToken);
        appleSub   = payload.sub;
        appleEmail = payload.email;
        appleName  = (fullName && (fullName.givenName || fullName.familyName))
          ? `${fullName.givenName || ''} ${fullName.familyName || ''}`.trim()
          : null;
        console.log('[Apple] 验证成功，sub:', appleSub.slice(0, 8) + '***');
      } catch (appleErr) {
        console.error('[Apple] identityToken 验证失败:', appleErr.message);
        return res.status(401).json({ error: 'Apple identityToken 无效：' + appleErr.message });
      }
    } else {
      // Mock 模式：开发/测试专用
      appleSub = 'apple_mock_' + identityToken.slice(0, 16) + '_' + identityToken.length;
      console.warn('[Apple] 使用 mock 模式，配置 APPLE_CLIENT_ID 启用真实 JWKS 验证');
    }

    let user = await prisma.user.findFirst({ where: { appleSub } });
    if (!user) {
      // 若 Apple 返回了已验证邮箱，尝试关联已有账号
      // 安全性：Apple 平台要求邮箱所有权验证，因此此处邮箱关联是安全的
      if (appleEmail) {
        user = await prisma.user.findFirst({ where: { email: encryptPII(appleEmail) } });
        if (user) {
          await prisma.user.update({ where: { id: user.id }, data: { appleSub } });
        }
      }
    }
    if (!user) {
      const suffix = crypto.randomBytes(4).toString('hex');
      const name   = appleName || ('Apple用户' + suffix.slice(0, 4));
      const avatar = 'https://i.pravatar.cc/150?u=ap' + appleSub;
      const userData = { name, avatar, appleSub };
      if (appleEmail) userData.email = encryptPII(appleEmail);
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
    res.json({ token: makeToken(user.id), refreshToken: makeRefreshToken(user.id), user: await safeUser(user) });
  } catch (e) {
    console.error('[apple]', e);
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/auth/google — Google 登录
// 支持两种模式：
// 1) idToken：若已配置 GOOGLE_CLIENT_ID 则做真实验证；未配置时仅在开发/测试走 mock 模式
// 2) accessToken：始终要求配置 GOOGLE_CLIENT_ID，并验证 token 受众（aud/azp）后再拉取 userinfo
router.post('/google', loginLimiter, async (req, res) => {
  try {
    const { idToken, accessToken } = req.body || {};
    if (!idToken && !accessToken) return res.status(400).json({ error: '缺少 idToken 或 accessToken 参数' });

    let googleSub = null;
    let googleEmail = null;
    let googleName = null;
    let googleAvatar = null;

    if (idToken) {
      if (googleOAuthClient) {
        // 真实 Google ID token 验证
        const payload = await verifyGoogleToken(idToken);
        if (!payload) return res.status(401).json({ error: 'Google ID token 验证失败，请重新登录' });
        googleSub = payload.sub;
        googleEmail = payload.email;
        googleName = payload.name;
        googleAvatar = payload.picture;
        console.log('[Google] ID token 验证成功, sub:', (googleSub?.slice(0, 8) ?? 'unknown') + '***');
      } else {
        // Mock 模式：开发/测试专用（每次调用创建一个新的随机 sub；如需持久化测试账号，请配置 GOOGLE_CLIENT_ID）
        googleSub = 'google_mock_' + crypto.randomBytes(12).toString('hex');
        console.warn('[Google] 使用 mock 模式，配置 GOOGLE_CLIENT_ID 启用真实验证');
      }
    } else if (accessToken) {
      if (!process.env.GOOGLE_CLIENT_ID) {
        return res.status(503).json({ error: 'Google 登录未配置' });
      }
      try {
        const tokenInfoRes = await fetch('https://oauth2.googleapis.com/tokeninfo?access_token=' + encodeURIComponent(accessToken));
        if (!tokenInfoRes.ok) return res.status(401).json({ error: 'Google access_token 无效' });
        const tokenInfo = await tokenInfoRes.json();
        const audience = tokenInfo?.azp || tokenInfo?.aud;
        if (!audience || audience !== process.env.GOOGLE_CLIENT_ID) {
          return res.status(401).json({ error: 'Google access_token 受众不匹配' });
        }

        const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: 'Bearer ' + accessToken },
        });
        if (!userInfoRes.ok) return res.status(401).json({ error: 'Google access_token 无效' });
        const userInfo = await userInfoRes.json();
        if (!userInfo.sub) return res.status(401).json({ error: 'Google 用户信息获取失败' });
        googleSub = userInfo.sub;
        const emailVerified = userInfo.email_verified === true;
        googleEmail = emailVerified ? userInfo.email : null;
        googleName = userInfo.name;
        googleAvatar = userInfo.picture;
        console.log('[Google] access_token 验证成功, sub:', (googleSub?.slice(0, 8) ?? 'unknown') + '***');
      } catch (e) {
        console.error('[Google] userinfo 请求失败:', e.message);
        return res.status(401).json({ error: 'Google 登录验证失败' });
      }
    }

    // 查找已绑定此 Google 账号的用户
    let user = await prisma.user.findFirst({ where: { googleSub } });
    if (!user && googleEmail) {
      // 尝试通过邮箱关联已有账号
      // 安全性：Google 平台验证邮箱所有权，因此此处邮箱关联是安全的（仅在真实 token 验证时执行）
      user = await prisma.user.findFirst({ where: { email: encryptPII(googleEmail) } });
      if (user) {
        await prisma.user.update({ where: { id: user.id }, data: { googleSub } });
      }
    }
    if (!user) {
      const suffix = crypto.randomBytes(4).toString('hex');
      const name = googleName || ('Google用户' + suffix.slice(0, 4));
      const avatar = googleAvatar || ('https://i.pravatar.cc/150?u=g' + googleSub);
      const userData = { name, avatar, googleSub };
      if (googleEmail) userData.email = encryptPII(googleEmail);
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
    res.json({ token: makeToken(user.id), refreshToken: makeRefreshToken(user.id), user: await safeUser(user) });
  } catch (e) {
    console.error('[google]', e);
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/auth/refresh — 刷新 Access Token
// 接受 refreshToken，返回新 accessToken（15分钟）+ 新 refreshToken（30天）
router.post('/refresh', authWriteLimiter, async (req, res) => {
  try {
    const { refreshToken } = req.body || {};
    if (!refreshToken) return res.status(400).json({ error: '缺少 refreshToken 参数' });
    let payload;
    try {
      payload = jwt.verify(refreshToken, JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ error: 'refreshToken 无效或已过期' });
    }
    if (payload.type !== 'refresh') {
      return res.status(401).json({ error: 'token 类型错误' });
    }
    const userId = Number(payload.id);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(401).json({ error: '用户不存在' });
    res.json({
      token: makeToken(userId),
      refreshToken: makeRefreshToken(userId),
      user: await safeUser(user),
    });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
