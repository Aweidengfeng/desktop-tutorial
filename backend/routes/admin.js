const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const db = require('../db/database');
const adminAuth = require('../middleware/adminAuth');

const JWT_SECRET = process.env.JWT_SECRET || 'summitlink_dev_secret_do_not_use_in_production';

const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: '登录尝试次数过多，请15分钟后再试' },
});

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) {
    // Still run timingSafeEqual to avoid early-exit timing leak
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

// POST /api/admin/login
router.post('/login', adminLoginLimiter, (req, res) => {
  try {
    const { username, password } = req.body;
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      return res.status(500).json({ error: '管理员账号未配置' });
    }
    const userOk = timingSafeEqual(username, adminUsername);
    const passOk = timingSafeEqual(password, adminPassword);
    if (!userOk || !passOk) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }
    const token = jwt.sign({ isAdmin: true, username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/admin/stats
router.get('/stats', adminAuth, (req, res) => {
  try {
    const totalUsers = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
    const totalPosts = db.prepare('SELECT COUNT(*) as c FROM posts').get().c;
    const totalOrders = db.prepare('SELECT COUNT(*) as c FROM orders').get().c;
    const totalClubs = db.prepare('SELECT COUNT(*) as c FROM clubs').get().c;
    const totalBookings = db.prepare('SELECT COUNT(*) as c FROM bookings').get().c;
    const today = new Date().toISOString().slice(0, 10);
    const newUsersToday = db.prepare(
      "SELECT COUNT(*) as c FROM users WHERE date(created_at) = ?"
    ).get(today).c;
    const pendingPosts = db.prepare(
      "SELECT COUNT(*) as c FROM posts WHERE status = 'pending'"
    ).get().c;
    const pendingGuides = db.prepare(
      "SELECT COUNT(*) as c FROM guide_applications WHERE status = 'pending'"
    ).get().c;
    const pendingBookings = db.prepare(
      "SELECT COUNT(*) as c FROM bookings WHERE status = 'pending'"
    ).get().c;
    res.json({ totalUsers, totalPosts, totalOrders, totalClubs, totalBookings, newUsersToday, pendingPosts, pendingGuides, pendingBookings });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/admin/users
router.get('/users', adminAuth, (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let sql = 'SELECT id, name, username, phone, avatar, level, is_banned, is_admin, created_at FROM users';
    const params = [];
    if (search) {
      sql += ' WHERE name LIKE ? OR phone LIKE ? OR username LIKE ?';
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);
    const users = db.prepare(sql).all(...params);
    const countSql = search
      ? 'SELECT COUNT(*) as c FROM users WHERE name LIKE ? OR phone LIKE ? OR username LIKE ?'
      : 'SELECT COUNT(*) as c FROM users';
    const countParams = search ? [`%${search}%`, `%${search}%`, `%${search}%`] : [];
    const total = db.prepare(countSql).get(...countParams).c;
    res.json({ users, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/admin/users/:id/ban
router.put('/users/:id/ban', adminAuth, (req, res) => {
  try {
    const user = db.prepare('SELECT id, is_banned FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ error: '用户不存在' });
    const newBanned = user.is_banned ? 0 : 1;
    db.prepare('UPDATE users SET is_banned = ? WHERE id = ?').run(newBanned, user.id);
    res.json({ success: true, is_banned: newBanned });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/admin/posts
router.get('/posts', adminAuth, (req, res) => {
  try {
    const { page = 1, limit = 20, status = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let sql = 'SELECT id, user_id, author_name, content, image, location, status, created_at FROM posts';
    const params = [];
    if (status) {
      sql += ' WHERE status = ?';
      params.push(status);
    }
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);
    const posts = db.prepare(sql).all(...params);
    const countSql = status
      ? 'SELECT COUNT(*) as c FROM posts WHERE status = ?'
      : 'SELECT COUNT(*) as c FROM posts';
    const countParams = status ? [status] : [];
    const total = db.prepare(countSql).get(...countParams).c;
    res.json({ posts, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/admin/posts/:id/approve
router.put('/posts/:id/approve', adminAuth, (req, res) => {
  try {
    const result = db.prepare("UPDATE posts SET status = 'approved' WHERE id = ?").run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: '帖子不存在' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/admin/posts/:id/reject
router.put('/posts/:id/reject', adminAuth, (req, res) => {
  try {
    const result = db.prepare("UPDATE posts SET status = 'rejected' WHERE id = ?").run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: '帖子不存在' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/admin/guides
router.get('/guides', adminAuth, (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const guides = db.prepare(
      'SELECT id, user_id, name, cert, specialty, languages, day_rate, region, status, created_at FROM guide_applications ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).all(parseInt(limit), offset);
    const total = db.prepare('SELECT COUNT(*) as c FROM guide_applications').get().c;
    res.json({ guides, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/admin/guides/:id/approve
router.put('/guides/:id/approve', adminAuth, (req, res) => {
  try {
    const app = db.prepare('SELECT * FROM guide_applications WHERE id = ?').get(req.params.id);
    if (!app) return res.status(404).json({ error: '申请不存在' });
    db.prepare("UPDATE guide_applications SET status = 'approved' WHERE id = ?").run(req.params.id);
    // Also update the guides table so the guide appears in front-end listings
    db.prepare("UPDATE guides SET status = 'approved' WHERE user_id = ? AND status = 'pending'").run(app.user_id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/admin/guides/:id/reject
router.put('/guides/:id/reject', adminAuth, (req, res) => {
  try {
    const app = db.prepare('SELECT * FROM guide_applications WHERE id = ?').get(req.params.id);
    if (!app) return res.status(404).json({ error: '申请不存在' });
    db.prepare("UPDATE guide_applications SET status = 'rejected' WHERE id = ?").run(req.params.id);
    db.prepare("UPDATE guides SET status = 'rejected' WHERE user_id = ? AND status = 'pending'").run(app.user_id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/admin/orders
router.get('/orders', adminAuth, (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const orders = db.prepare(
      'SELECT id, user_id, order_no, amount, method, status, created_at FROM orders ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).all(parseInt(limit), offset);
    const total = db.prepare('SELECT COUNT(*) as c FROM orders').get().c;
    res.json({ orders, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/admin/clubs
router.get('/clubs', adminAuth, (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const clubs = db.prepare(
      'SELECT id, name, description, specialty, region, members_count, expeditions, verified, status, created_at FROM clubs ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).all(parseInt(limit), offset);
    const total = db.prepare('SELECT COUNT(*) as c FROM clubs').get().c;
    res.json({ clubs, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/admin/clubs/:id/verify
router.put('/clubs/:id/verify', adminAuth, (req, res) => {
  try {
    const club = db.prepare('SELECT id, verified FROM clubs WHERE id = ?').get(req.params.id);
    if (!club) return res.status(404).json({ error: '俱乐部不存在' });
    const newVerified = club.verified ? 0 : 1;
    db.prepare('UPDATE clubs SET verified = ? WHERE id = ?').run(newVerified, club.id);
    res.json({ success: true, verified: newVerified });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/admin/bookings
router.get('/bookings', adminAuth, (req, res) => {
  try {
    const { page = 1, limit = 20, status = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let sql = `SELECT b.id, b.user_id, u.name as user_name, b.mountain,
               b.guide_name, b.date, b.members, b.amount, b.status, b.created_at
               FROM bookings b LEFT JOIN users u ON u.id = b.user_id`;
    const params = [];
    if (status) { sql += ' WHERE b.status = ?'; params.push(status); }
    sql += ' ORDER BY b.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);
    const bookings = db.prepare(sql).all(...params);
    const countSql = status ? 'SELECT COUNT(*) as c FROM bookings WHERE status = ?' : 'SELECT COUNT(*) as c FROM bookings';
    const countParams = status ? [status] : [];
    const total = db.prepare(countSql).get(...countParams).c;
    res.json({ bookings, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/admin/bookings/:id/status
router.put('/bookings/:id/status', adminAuth, (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending', 'confirmed', 'cancelled', 'completed'].includes(status)) {
      return res.status(400).json({ error: '无效状态' });
    }
    const result = db.prepare('UPDATE bookings SET status = ? WHERE id = ?').run(status, req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: '预约不存在' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/admin/gear
router.get('/gear', adminAuth, (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const items = db.prepare(
      `SELECT g.id, g.name, g.brand, g.price, g.condition_text, g.mode, g.category,
              u.name as seller_name, g.created_at
       FROM gear g LEFT JOIN users u ON u.id = g.seller_id
       ORDER BY g.created_at DESC LIMIT ? OFFSET ?`
    ).all(parseInt(limit), offset);
    const total = db.prepare('SELECT COUNT(*) as c FROM gear').get().c;
    res.json({ items, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// DELETE /api/admin/gear/:id
router.delete('/gear/:id', adminAuth, (req, res) => {
  try {
    const result = db.prepare('DELETE FROM gear WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: '装备不存在' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
