const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const auth = require('../middleware/auth');

const SECRET = process.env.JWT_SECRET || 'summitlink_secret_change_this_in_production';

function makeToken(id) {
  return jwt.sign({ id }, SECRET, { expiresIn: '30d' });
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
  };
}

// POST /api/auth/register
router.post('/register', (req, res) => {
  try {
    const { name, phone, password } = req.body;
    if (!name || !phone || !password) {
      return res.status(400).json({ error: '请填写姓名、手机号和密码' });
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
router.post('/login', (req, res) => {
  try {
    const { phone, password } = req.body;
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
