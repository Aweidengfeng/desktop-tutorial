const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const db = require('../db/database');
const auth = require('../middleware/auth');

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

function makeToken(id) {
  return jwt.sign({ id }, JWT_SECRET, { expiresIn: '30d' });
}

function safeUser(user) {
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
  };
}

// POST /api/auth/register
router.post('/register', (req, res) => {
  try {
    const { name, phone, password } = req.body;
    if (!name || !phone || !password) {
      return res.status(400).json({ error: '请填写姓名、手机号和密码' });
    }
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ error: '手机号格式不正确' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: '密码至少6位' });
    }
    const username = '@' + name.toLowerCase().replace(/\s+/g, '');
    const avatar = 'https://i.pravatar.cc/150?u=' + phone;
    const hash = bcrypt.hashSync(password, 10);
    const stmt = db.prepare(`
      INSERT INTO users (name, username, phone, password, avatar)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(name, username, phone, hash, avatar);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    res.json({ token: makeToken(user.id), user: safeUser(user) });
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) {
      return res.status(400).json({ error: '手机号已注册' });
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

// POST /api/auth/sms/send — 发送短信验证码（mock：打印到控制台）
router.post('/sms/send', (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ error: '手机号格式不正确' });
    }
    // 生成6位验证码
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5分钟有效
    // 使旧验证码失效
    db.prepare('UPDATE sms_codes SET used = 1 WHERE phone = ? AND used = 0').run(phone);
    db.prepare('INSERT INTO sms_codes (phone, code, expires_at) VALUES (?, ?, ?)').run(phone, code, expiresAt);
    // Mock: 打印到控制台（实际接入短信服务商替换此处）
    console.log(`[SMS MOCK] 手机号: ${phone} 验证码: ${code} (5分钟内有效)`);
    res.json({ success: true, message: '验证码已发送（开发模式：查看服务器控制台）', _dev_code: code });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/auth/sms/verify — 验证码登录/注册
router.post('/sms/verify', (req, res) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) return res.status(400).json({ error: '请填写手机号和验证码' });
    const record = db.prepare(
      'SELECT * FROM sms_codes WHERE phone = ? AND code = ? AND used = 0 ORDER BY id DESC LIMIT 1'
    ).get(phone, code);
    if (!record) return res.status(401).json({ error: '验证码错误' });
    if (Date.now() > record.expires_at) return res.status(401).json({ error: '验证码已过期' });
    db.prepare('UPDATE sms_codes SET used = 1 WHERE id = ?').run(record.id);
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
