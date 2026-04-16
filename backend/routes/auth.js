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

module.exports = router;
