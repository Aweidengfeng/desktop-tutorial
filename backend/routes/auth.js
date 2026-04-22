const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const db = require('../db/database');
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
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { error: '注册请求过于频繁，请稍后再试' },
});

function makeToken(id) {
  return jwt.sign({ id }, JWT_SECRET, { expiresIn: '30d' });
}

function safeUser(user) {
  // Check if user is an approved guide or club admin
  let isGuide = false;
  let isClubAdmin = false;
  try {
    const guide = db.prepare("SELECT id FROM guides WHERE user_id = ? AND status = 'approved'").get(user.id);
    if (guide) isGuide = true;
    const club = db.prepare("SELECT id FROM club_members WHERE user_id = ? AND role IN ('founder','admin')").get(user.id);
    if (club) isClubAdmin = true;
  } catch(e) {}

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
    is_admin: user.is_admin || 0,
    is_guide: isGuide ? 1 : 0,
    is_club_admin: isClubAdmin ? 1 : 0,
  };
}

// POST /api/auth/register
router.post('/register', registerLimiter, (req, res) => {
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
    const existingUser = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone);
    if (existingUser) {
      return res.status(400).json({ error: '手机号已注册' });
    }
    if (!agreedPrivacy || !agreedTerms || !policyVersion || policyVersion !== POLICY_VERSION) {
      return res.status(422).json({ error: '请阅读并同意最新版隐私政策和用户协议' });
    }
    const username = '@' + name.toLowerCase().replace(/\s+/g, '') + '_' + phone.slice(-4);
    const avatar = 'https://i.pravatar.cc/150?u=' + phone;
    const hash = bcrypt.hashSync(password, 10);
    const stmt = db.prepare(`
      INSERT INTO users (name, username, phone, password, avatar, policy_version, policy_agreed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(name, username, phone, hash, avatar, policyVersion, new Date().toISOString());
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    res.json({ token: makeToken(user.id), user: safeUser(user) });
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) {
      if (e.message.includes('phone')) {
        return res.status(400).json({ error: '手机号已注册' });
      }
      return res.status(400).json({ error: '注册失败，请稍后重试' });
    }
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/auth/login
router.post('/login', loginLimiter, (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ error: '手机号格式不正确' });
    }
    const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
    if (!user) return res.status(401).json({ error: '手机号或密码错误' });
    const ok = bcrypt.compareSync(password, user.password);
    if (!ok) return res.status(401).json({ error: '手机号或密码错误' });
    res.json({ token: makeToken(user.id), user: safeUser(user) });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/auth/me
router.get('/me', auth, (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: '用户不存在' });
    res.json(safeUser(user));
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/auth/profile
router.put('/profile', auth, (req, res) => {
  try {
    const { name, avatar } = req.body;
    db.prepare('UPDATE users SET name = COALESCE(?, name), avatar = COALESCE(?, avatar) WHERE id = ?')
      .run(name || null, avatar || null, req.user.id);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    res.json(safeUser(user));
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/auth/settings — 保存用户设置（单位、语言等）
router.put('/settings', auth, (req, res) => {
  try {
    const settings = JSON.stringify(req.body || {});
    db.prepare('UPDATE users SET settings = ? WHERE id = ?').run(settings, req.user.id);
    res.json({ success: true, settings: req.body });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/auth/privacy — 保存隐私设置
router.put('/privacy', auth, (req, res) => {
  try {
    const privacy = JSON.stringify(req.body || {});
    db.prepare('UPDATE users SET privacy = ? WHERE id = ?').run(privacy, req.user.id);
    res.json({ success: true, privacy: req.body });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/auth/settings — 读取用户设置
router.get('/settings', auth, (req, res) => {
  try {
    const user = db.prepare('SELECT settings FROM users WHERE id = ?').get(req.user.id);
    let settings = {};
    try { settings = JSON.parse(user.settings || '{}'); } catch(e) {}
    res.json(settings);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/auth/privacy — 读取隐私设置
router.get('/privacy', auth, (req, res) => {
  try {
    const user = db.prepare('SELECT privacy FROM users WHERE id = ?').get(req.user.id);
    let privacy = {};
    try { privacy = JSON.parse(user.privacy || '{}'); } catch(e) {}
    res.json(privacy);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/auth/change-password — 修改密码（需登录 + 旧密码验证）
router.put('/change-password', auth, (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: '请填写旧密码和新密码' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: '新密码至少6位' });
    }
    const user = db.prepare('SELECT password FROM users WHERE id = ?').get(req.user.id);
    if (!user || !user.password) return res.status(400).json({ error: '此账号未设置密码（请使用短信验证码登录后设置）' });
    const ok = bcrypt.compareSync(oldPassword, user.password);
    if (!ok) return res.status(401).json({ error: '旧密码不正确' });
    const hash = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, req.user.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/auth/change-phone — 更换手机号（需登录 + 新手机短信验证码）
router.put('/change-phone', auth, (req, res) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) return res.status(400).json({ error: '请填写新手机号和验证码' });
    if (!/^1[3-9]\d{9}$/.test(phone)) return res.status(400).json({ error: '手机号格式不正确' });
    const existing = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone);
    if (existing && existing.id !== req.user.id) return res.status(400).json({ error: '该手机号已被其他账号使用' });
    const record = db.prepare(
      'SELECT * FROM sms_codes WHERE phone = ? AND code = ? AND used = 0 ORDER BY id DESC LIMIT 1'
    ).get(phone, code);
    if (!record || Date.now() > record.expires_at) return res.status(401).json({ error: '验证码无效或已过期' });
    db.prepare('UPDATE sms_codes SET used = 1 WHERE id = ?').run(record.id);
    db.prepare('UPDATE users SET phone = ? WHERE id = ?').run(phone, req.user.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/auth/request-deletion — 申请注销账号（24小时冷静期）
router.post('/request-deletion', auth, (req, res) => {
  try {
    const scheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    db.prepare('UPDATE users SET deleted_at = ? WHERE id = ?').run(scheduledAt, req.user.id);
    res.json({ success: true, deletedAt: scheduledAt, message: '注销申请已提交，账号将在24小时后删除。在此期间您可以登录取消注销。' });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/auth/cancel-deletion — 取消注销申请
router.post('/cancel-deletion', auth, (req, res) => {
  try {
    db.prepare('UPDATE users SET deleted_at = NULL WHERE id = ?').run(req.user.id);
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

router.post('/sms/send', (req, res) => {
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
    // 生成6位验证码
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5分钟有效
    // 使旧验证码失效
    db.prepare('UPDATE sms_codes SET used = 1 WHERE phone = ? AND used = 0').run(phone);
    db.prepare('INSERT INTO sms_codes (phone, code, expires_at) VALUES (?, ?, ?)').run(phone, code, expiresAt);
    // 记录发送时间
    smsSendCooldown.set(phone, Date.now());
    // 发送（mock：打印到控制台）
    smsProvider.send(phone, code).catch(e => console.error('[SMS]', e.message));
    res.json({ success: true, message: '验证码已发送（当前为内测阶段，验证码可在管理员后台查看；正式版将对接阿里云短信）' });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/auth/sms/verify — 验证码登录/注册
router.post('/sms/verify', (req, res) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) return res.status(400).json({ error: '请填写手机号和验证码' });
    // 锁定检查（失败三次锁定10分钟）
    const failInfo = smsFailCount.get(phone);
    if (failInfo && failInfo.lockedUntil && Date.now() < failInfo.lockedUntil) {
      const wait = Math.ceil((failInfo.lockedUntil - Date.now()) / 60000);
      return res.status(429).json({ error: `验证码错误次数过多，请 ${wait} 分钟后再试` });
    }
    const record = db.prepare(
      'SELECT * FROM sms_codes WHERE phone = ? AND code = ? AND used = 0 ORDER BY id DESC LIMIT 1'
    ).get(phone, code);
    if (!record) {
      // 记录失败次数
      const current = smsFailCount.get(phone) || { count: 0 };
      current.count += 1;
      if (current.count >= 3) {
        current.lockedUntil = Date.now() + 10 * 60 * 1000;
        current.count = 0;
      }
      smsFailCount.set(phone, current);
      return res.status(401).json({ error: '验证码错误' });
    }
    if (Date.now() > record.expires_at) {
      return res.status(401).json({ error: '验证码已过期，请重新获取' });
    }
    db.prepare('UPDATE sms_codes SET used = 1 WHERE id = ?').run(record.id);
    // 验证成功，清除失败计数
    smsFailCount.delete(phone);
    // 查找或创建用户
    let user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
    if (!user) {
      const name = '攀登者' + phone.slice(-4);
      const username = '@climber' + phone.slice(-6);
      const avatar = 'https://i.pravatar.cc/150?u=' + phone;
      const result = db.prepare(`
        INSERT INTO users (name, username, phone, avatar) VALUES (?, ?, ?, ?)
      `).run(name, username, phone, avatar);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    }
    res.json({ token: makeToken(user.id), user: safeUser(user) });
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) {
      return res.status(400).json({ error: '账号已存在，请直接登录' });
    }
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/auth/wechat — 微信登录（mock）
router.post('/wechat', (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: '缺少 code 参数' });
    // Mock: 生成假 openid
    const fakeOpenid = 'wx_mock_' + code + '_' + Date.now();
    let user = db.prepare('SELECT * FROM users WHERE wechat_openid = ?').get(fakeOpenid);
    if (!user) {
      // 新用户
      const name = '微信用户' + Math.floor(Math.random() * 9999);
      const username = '@wx' + Date.now().toString(36);
      const avatar = 'https://i.pravatar.cc/150?u=wx' + fakeOpenid;
      let result;
      try {
        result = db.prepare(`
          INSERT INTO users (name, username, avatar, wechat_openid) VALUES (?, ?, ?, ?)
        `).run(name, username, avatar, fakeOpenid);
      } catch(e) {
        // username 冲突则随机后缀
        const username2 = '@wx' + Math.random().toString(36).slice(2);
        result = db.prepare(`
          INSERT INTO users (name, username, avatar, wechat_openid) VALUES (?, ?, ?, ?)
        `).run(name, username2, avatar, fakeOpenid);
      }
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    }
    res.json({ token: makeToken(user.id), user: safeUser(user) });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/auth/apple — Apple 登录（mock）
router.post('/apple', (req, res) => {
  try {
    const { identityToken } = req.body;
    if (!identityToken) return res.status(400).json({ error: '缺少 identityToken 参数' });
    // Mock: 解析假 sub
    const fakeSub = 'apple_mock_' + identityToken.slice(0, 16) + '_' + Date.now();
    let user = db.prepare('SELECT * FROM users WHERE apple_sub = ?').get(fakeSub);
    if (!user) {
      const name = 'Apple用户' + Math.floor(Math.random() * 9999);
      const username = '@apple' + Date.now().toString(36);
      const avatar = 'https://i.pravatar.cc/150?u=ap' + fakeSub;
      let result;
      try {
        result = db.prepare(`
          INSERT INTO users (name, username, avatar, apple_sub) VALUES (?, ?, ?, ?)
        `).run(name, username, avatar, fakeSub);
      } catch(e) {
        const username2 = '@apple' + Math.random().toString(36).slice(2);
        result = db.prepare(`
          INSERT INTO users (name, username, avatar, apple_sub) VALUES (?, ?, ?, ?)
        `).run(name, username2, avatar, fakeSub);
      }
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    }
    res.json({ token: makeToken(user.id), user: safeUser(user) });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
