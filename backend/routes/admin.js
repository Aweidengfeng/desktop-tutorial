const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const db = require('../db/database');
const adminAuth = require('../middleware/adminAuth');
const devOnly = require('../middleware/devOnly');

const JWT_SECRET = process.env.JWT_SECRET || 'summitlink_dev_secret_do_not_use_in_production';

const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: '登录尝试次数过多，请15分钟后再试' },
});

// 管理后台操作限流（写操作）：每分钟最多60次
const adminWriteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: '操作过于频繁，请稍后再试' },
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
    // Update or insert guide record so it appears in front-end listings
    const existing = db.prepare('SELECT id FROM guides WHERE user_id = ?').get(app.user_id);
    if (existing) {
      db.prepare("UPDATE guides SET status = 'approved' WHERE user_id = ?").run(app.user_id);
    } else {
      db.prepare(`INSERT INTO guides (user_id, name, cert, specialty, languages, day_rate, region, status)
                  VALUES (?, ?, ?, ?, ?, ?, ?, 'approved')`
      ).run(app.user_id, app.name, app.cert, app.specialty, app.languages, app.day_rate, app.region);
    }
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
               b.guide_name, b.club_name, b.type, b.date, b.members, b.amount, b.status,
               b.confirmed_at, b.rejected_reason, b.created_at
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

// GET /api/admin/club-activities — 俱乐部活动管理
router.get('/club-activities', adminAuth, (req, res) => {
  try {
    const { page = 1, limit = 20, status = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let sql = `SELECT ca.*, c.name as club_name FROM club_activities ca LEFT JOIN clubs c ON c.id = ca.club_id`;
    const params = [];
    if (status) { sql += ' WHERE ca.status = ?'; params.push(status); }
    sql += ' ORDER BY ca.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);
    const activities = db.prepare(sql).all(...params);
    const countSql = status ? 'SELECT COUNT(*) as c FROM club_activities WHERE status = ?' : 'SELECT COUNT(*) as c FROM club_activities';
    const countParams = status ? [status] : [];
    const total = db.prepare(countSql).get(...countParams).c;
    res.json({ activities, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/admin/club-activities/:id/end — 下架活动
router.put('/club-activities/:id/end', adminAuth, (req, res) => {
  try {
    const result = db.prepare("UPDATE club_activities SET status = 'ended' WHERE id = ?").run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: '活动不存在' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// DELETE /api/admin/club-activities/:id — 删除活动
router.delete('/club-activities/:id', adminAuth, (req, res) => {
  try {
    const result = db.prepare('DELETE FROM club_activities WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: '活动不存在' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/admin/guide-expeditions — 向导带队记录管理
router.get('/guide-expeditions', adminAuth, (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const expeditions = db.prepare(`
      SELECT ge.*, g.name as guide_name
      FROM guide_expeditions ge LEFT JOIN guides g ON g.id = ge.guide_id
      ORDER BY ge.created_at DESC LIMIT ? OFFSET ?
    `).all(parseInt(limit), offset);
    const total = db.prepare('SELECT COUNT(*) as c FROM guide_expeditions').get().c;
    res.json({ expeditions, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/admin/reviews — 评价管理
router.get('/reviews', adminAuth, (req, res) => {
  try {
    const { page = 1, limit = 20, target_type = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let sql = 'SELECT * FROM reviews';
    const params = [];
    if (target_type) { sql += ' WHERE target_type = ?'; params.push(target_type); }
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);
    const reviews = db.prepare(sql).all(...params);
    const countSql = target_type ? 'SELECT COUNT(*) as c FROM reviews WHERE target_type = ?' : 'SELECT COUNT(*) as c FROM reviews';
    const countParams = target_type ? [target_type] : [];
    const total = db.prepare(countSql).get(...countParams).c;
    res.json({ reviews, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// DELETE /api/admin/reviews/:id — 删除评价
router.delete('/reviews/:id', adminAuth, (req, res) => {
  try {
    const result = db.prepare('DELETE FROM reviews WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: '评价不存在' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// ── A6: 俱乐部申请审核 ──────────────────────────────────────────

// GET /api/admin/club-applications?status=pending|approved|rejected
router.get('/club-applications', adminAuth, (req, res) => {
  try {
    const { status = '', page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let sql = 'SELECT * FROM club_applications';
    const params = [];
    if (status) { sql += ' WHERE status = ?'; params.push(status); }
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);
    const applications = db.prepare(sql).all(...params);
    const countSql = status ? 'SELECT COUNT(*) as c FROM club_applications WHERE status = ?' : 'SELECT COUNT(*) as c FROM club_applications';
    const countParams = status ? [status] : [];
    const total = db.prepare(countSql).get(...countParams).c;
    res.json({ applications, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/admin/club-applications/:id/approve — 审核通过俱乐部申请
router.post('/club-applications/:id/approve', adminWriteLimiter, adminAuth, (req, res) => {
  try {
    const app = db.prepare('SELECT * FROM club_applications WHERE id = ?').get(req.params.id);
    if (!app) return res.status(404).json({ error: '申请不存在' });
    const now = new Date().toISOString();
    db.prepare("UPDATE club_applications SET status = 'approved' WHERE id = ?").run(req.params.id);
    // 将俱乐部状态更新为 active/verified
    const existingClub = db.prepare('SELECT id FROM clubs WHERE creator_id = ?').get(app.user_id);
    if (existingClub) {
      db.prepare("UPDATE clubs SET status = 'active', verified = 1, approved_at = ?, approved_by = 'admin' WHERE id = ?")
        .run(now, existingClub.id);
    } else {
      db.prepare(`INSERT INTO clubs (name, description, specialty, region, type, contact, wechat, website, creator_id, status, verified, approved_at, approved_by)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 1, ?, 'admin')`)
        .run(app.club_name, app.description, app.specialty, app.region, app.type || '综合',
             app.contact, app.wechat, app.website, app.user_id, now);
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/admin/club-applications/:id/reject — 拒绝俱乐部申请
router.post('/club-applications/:id/reject', adminWriteLimiter, adminAuth, (req, res) => {
  try {
    const { reason = '' } = req.body;
    const app = db.prepare('SELECT id FROM club_applications WHERE id = ?').get(req.params.id);
    if (!app) return res.status(404).json({ error: '申请不存在' });
    db.prepare("UPDATE club_applications SET status = 'rejected', reject_reason = ? WHERE id = ?")
      .run(reason, req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/admin/guides/:id/config — 管理员设置向导抽成/入驻费
router.put('/guides/:id/config', adminAuth, (req, res) => {
  try {
    const { commission_rate, listing_fee_paid } = req.body;
    const guide = db.prepare('SELECT id FROM guides WHERE id = ?').get(req.params.id);
    if (!guide) return res.status(404).json({ error: '向导不存在' });
    const updates = [];
    const params = [];
    if (commission_rate !== undefined) { updates.push('commission_rate = ?'); params.push(commission_rate); }
    if (listing_fee_paid !== undefined) { updates.push('listing_fee_paid = ?'); params.push(listing_fee_paid ? 1 : 0); }
    if (updates.length === 0) return res.status(400).json({ error: '无有效参数' });
    params.push(req.params.id);
    db.prepare(`UPDATE guides SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/admin/clubs/:id/config — 管理员设置俱乐部抽成/入驻费
router.put('/clubs/:id/config', adminAuth, (req, res) => {
  try {
    const { commission_rate, listing_fee_paid } = req.body;
    const club = db.prepare('SELECT id FROM clubs WHERE id = ?').get(req.params.id);
    if (!club) return res.status(404).json({ error: '俱乐部不存在' });
    const updates = [];
    const params = [];
    if (commission_rate !== undefined) { updates.push('commission_rate = ?'); params.push(commission_rate); }
    if (listing_fee_paid !== undefined) { updates.push('listing_fee_paid = ?'); params.push(listing_fee_paid ? 1 : 0); }
    if (updates.length === 0) return res.status(400).json({ error: '无有效参数' });
    params.push(req.params.id);
    db.prepare(`UPDATE clubs SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// ── A7: 商业攀登审核 ────────────────────────────────────────────

// GET /api/admin/expeditions?status=pending
router.get('/expeditions', adminAuth, (req, res) => {
  try {
    const { status = '', page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let sql = 'SELECT * FROM expeditions';
    const params = [];
    if (status) { sql += ' WHERE status = ?'; params.push(status); }
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);
    const expeditions = db.prepare(sql).all(...params);
    const countSql = status ? 'SELECT COUNT(*) as c FROM expeditions WHERE status = ?' : 'SELECT COUNT(*) as c FROM expeditions';
    const total = db.prepare(countSql).get(...(status ? [status] : [])).c;
    res.json({ expeditions, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/admin/expeditions/:id/approve
router.post('/expeditions/:id/approve', adminWriteLimiter, adminAuth, (req, res) => {
  try {
    const now = new Date().toISOString();
    const result = db.prepare("UPDATE expeditions SET status = 'published', approved_at = ? WHERE id = ?")
      .run(now, req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: '远征不存在' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/admin/expeditions/:id/reject
router.post('/expeditions/:id/reject', adminWriteLimiter, adminAuth, (req, res) => {
  try {
    const { reason = '' } = req.body;
    const result = db.prepare("UPDATE expeditions SET status = 'rejected', reject_reason = ? WHERE id = ?")
      .run(reason, req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: '远征不存在' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// ── A9: 验证码查看器（内测用）────────────────────────────────────

// GET /api/admin/sms-codes — 查看最近50条验证码（仅管理员，内测用）
router.get('/sms-codes', adminLoginLimiter, devOnly, adminAuth, (req, res) => {
  try {
    const codes = db.prepare(`
      SELECT id, phone, code, expires_at, used, created_at
      FROM sms_codes
      ORDER BY id DESC LIMIT 50
    `).all();
    res.json(codes);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

const { VALID_TRANSITIONS, appendStatusHistory } = require('./orderStateMachine');

// GET /api/admin/expedition-orders - 全量订单查询
router.get('/expedition-orders', adminWriteLimiter, adminAuth, (req, res) => {
  try {
    const { status, limit = 50, page = 1 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let sql = 'SELECT * FROM expedition_orders';
    const params = [];
    if (status) { sql += ' WHERE status = ?'; params.push(status); }
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);
    const orders = db.prepare(sql).all(...params);
    const countSql = status ? 'SELECT COUNT(*) c FROM expedition_orders WHERE status=?' : 'SELECT COUNT(*) c FROM expedition_orders';
    const total = db.prepare(countSql).get(...(status ? [status] : [])).c;
    res.json({ orders, total });
  } catch(e) { res.status(500).json({ error: '服务器错误' }); }
});

// POST /api/admin/expedition-orders/:id/transition
router.post('/expedition-orders/:id/transition', adminWriteLimiter, adminAuth, (req, res) => {
  try {
    const { newStatus } = req.body;
    const order = db.prepare('SELECT * FROM expedition_orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: '订单不存在' });
    const allowed = VALID_TRANSITIONS[order.status] || [];
    if (!allowed.includes(newStatus)) {
      return res.status(400).json({ error: `不允许从 ${order.status} 迁移到 ${newStatus}` });
    }
    const newHistory = appendStatusHistory(order.status_history, newStatus);
    db.prepare('UPDATE expedition_orders SET status = ?, status_history = ? WHERE id = ?').run(newStatus, newHistory, order.id);
    try { db.prepare('INSERT INTO notifications (user_id, type, title, body, link) VALUES (?, ?, ?, ?, ?)').run(order.user_id, 'order', '订单状态更新', `您的订单 #${order.id} 状态已更新为 ${newStatus}`, `/orders/${order.id}`); } catch(e) {}
    res.json({ success: true, status: newStatus });
  } catch(e) { res.status(500).json({ error: '服务器错误' }); }
});

// GET /api/admin/tracks?flagged=1
router.get('/tracks', adminWriteLimiter, adminAuth, (req, res) => {
  try {
    const { flagged, limit = 50, page = 1 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let sql = 'SELECT t.*, u.name as user_name FROM tracks t LEFT JOIN users u ON u.id = t.user_id';
    const params = [];
    if (flagged !== undefined) { sql += ' WHERE t.flagged = ?'; params.push(parseInt(flagged)); }
    sql += ' ORDER BY t.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);
    const tracks = db.prepare(sql).all(...params);
    res.json(tracks);
  } catch(e) { res.status(500).json({ error: '服务器错误' }); }
});

// POST /api/admin/tracks/:id/unflag - 解除标记并补发积分
router.post('/tracks/:id/unflag', adminWriteLimiter, adminAuth, (req, res) => {
  try {
    const track = db.prepare('SELECT * FROM tracks WHERE id = ?').get(req.params.id);
    if (!track) return res.status(404).json({ error: '轨迹不存在' });
    db.prepare('UPDATE tracks SET flagged = 0, flag_reason = NULL WHERE id = ?').run(req.params.id);
    // 补发积分
    try { db.prepare('UPDATE users SET points = COALESCE(points,0) + 10 WHERE id = ?').run(track.user_id); } catch(e) {}
    try { db.prepare('INSERT INTO notifications (user_id, type, title, body, link) VALUES (?, ?, ?, ?, ?)').run(track.user_id, 'track', '轨迹标记已解除', `您的轨迹「${track.name || ''}」已通过审核并补发积分`, `/tracks/${track.id}`); } catch(e) {}
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: '服务器错误' }); }
});

// GET /api/admin/moderation-logs
router.get('/moderation-logs', adminWriteLimiter, adminAuth, (req, res) => {
  try {
    const { limit = 50, page = 1 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const logs = db.prepare('SELECT * FROM moderation_logs ORDER BY created_at DESC LIMIT ? OFFSET ?').all(parseInt(limit), offset);
    const total = db.prepare('SELECT COUNT(*) c FROM moderation_logs').get().c;
    res.json({ logs, total });
  } catch(e) { res.status(500).json({ error: '服务器错误' }); }
});

// POST /api/admin/guide-applications/:id/review
router.post('/guide-applications/:id/review', adminWriteLimiter, adminAuth, (req, res) => {
  try {
    const { action, note } = req.body; // action: approve|reject|need_info
    const app = db.prepare('SELECT * FROM guide_applications WHERE id = ?').get(req.params.id);
    if (!app) return res.status(404).json({ error: '申请不存在' });
    const statusMap = { approve: 'approved', reject: 'rejected', need_info: 'need_info' };
    const newStatus = statusMap[action];
    if (!newStatus) return res.status(400).json({ error: '无效操作' });
    db.prepare('UPDATE guide_applications SET status = ?, note = ? WHERE id = ?').run(newStatus, note || null, req.params.id);
    if (newStatus === 'approved') {
      db.prepare("UPDATE guides SET status = 'approved' WHERE user_id = ?").run(app.user_id);
    }
    try { db.prepare('INSERT INTO notifications (user_id, type, title, body, link) VALUES (?, ?, ?, ?, ?)').run(app.user_id, 'guide_review', '向导申请审核结果', `您的向导申请已${newStatus === 'approved' ? '通过' : newStatus === 'rejected' ? '驳回' : '需要补充材料'}`, '/profile'); } catch(e) {}
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: '服务器错误' }); }
});

// POST /api/admin/club-applications/:id/review
router.post('/club-applications/:id/review', adminWriteLimiter, adminAuth, (req, res) => {
  try {
    const { action, note } = req.body;
    const clubApp = db.prepare('SELECT * FROM club_applications WHERE id = ?').get(req.params.id);
    if (!clubApp) return res.status(404).json({ error: '申请不存在' });
    const statusMap = { approve: 'approved', reject: 'rejected', need_info: 'need_info' };
    const newStatus = statusMap[action];
    if (!newStatus) return res.status(400).json({ error: '无效操作' });
    db.prepare('UPDATE club_applications SET status = ?, note = ? WHERE id = ?').run(newStatus, note || null, req.params.id);
    if (newStatus === 'approved' && clubApp.club_id) {
      db.prepare("UPDATE clubs SET verified = 1 WHERE id = ?").run(clubApp.club_id);
    }
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: '服务器错误' }); }
});

// GET /api/admin/clubs/commercial — 俱乐部商业资质审核列表
router.get('/clubs/commercial', adminAuth, (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const clubs = db.prepare(`
      SELECT id, name, specialty, region, commercial_status, commercial_applied_at,
             commercial_reviewed_at, commercial_verified, commercial_reject_reason,
             business_license_url, business_license_no, insurance_cert_url,
             bank_account_name, bank_account_no, bank_name
      FROM clubs WHERE commercial_status != 'none'
      ORDER BY commercial_applied_at DESC LIMIT ? OFFSET ?
    `).all(parseInt(limit), offset);
    const total = db.prepare("SELECT COUNT(*) as c FROM clubs WHERE commercial_status != 'none'").get().c;
    res.json({ clubs, total, page: parseInt(page), limit: parseInt(limit) });
  } catch(e) { res.status(500).json({ error: '服务器错误' }); }
});

// POST /api/admin/clubs/:id/commercial-review — 审核俱乐部商业资质
router.post('/clubs/:id/commercial-review', adminWriteLimiter, adminAuth, (req, res) => {
  try {
    const { action, reason } = req.body;
    const club = db.prepare('SELECT * FROM clubs WHERE id = ?').get(req.params.id);
    if (!club) return res.status(404).json({ error: '俱乐部不存在' });
    if (action === 'approve') {
      db.prepare(`UPDATE clubs SET commercial_verified=1, commercial_status='approved',
        commercial_reviewed_at=CURRENT_TIMESTAMP, commercial_reject_reason=NULL WHERE id=?`)
        .run(req.params.id);
      // 通知俱乐部创建者
      try {
        db.prepare("INSERT INTO notifications (user_id, type, content, related_id) VALUES (?, 'commercial_approved', ?, ?)")
          .run(club.creator_id, `【资质审核通过】您的俱乐部 ${club.name} 商业资质已审核通过，可发布收费活动`, club.id);
      } catch(e) {}
    } else if (action === 'reject') {
      db.prepare(`UPDATE clubs SET commercial_verified=0, commercial_status='rejected',
        commercial_reviewed_at=CURRENT_TIMESTAMP, commercial_reject_reason=? WHERE id=?`)
        .run(reason || '资质不符合要求', req.params.id);
      try {
        db.prepare("INSERT INTO notifications (user_id, type, content, related_id) VALUES (?, 'commercial_rejected', ?, ?)")
          .run(club.creator_id, `【资质审核未通过】您的俱乐部 ${club.name} 商业资质审核未通过：${reason || '资质不符合要求'}`, club.id);
      } catch(e) {}
    } else if (action === 'need_info') {
      db.prepare(`UPDATE clubs SET commercial_status='need_info',
        commercial_reviewed_at=CURRENT_TIMESTAMP, commercial_reject_reason=? WHERE id=?`)
        .run(reason || '需补充材料', req.params.id);
      try {
        db.prepare("INSERT INTO notifications (user_id, type, content, related_id) VALUES (?, 'commercial_need_info', ?, ?)")
          .run(club.creator_id, `【资质补充】您的俱乐部 ${club.name} 商业资质需补充材料：${reason || '请联系管理员'}`, club.id);
      } catch(e) {}
    } else {
      return res.status(400).json({ error: '无效操作，action 应为 approve|reject|need_info' });
    }
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: '服务器错误' }); }
});

// GET /api/admin/guides/commercial — 向导商业资质审核列表
router.get('/guides/commercial', adminAuth, (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const guides = db.prepare(`
      SELECT id, name, specialty, region, commercial_status, commercial_applied_at,
             commercial_reviewed_at, commercial_verified, commercial_reject_reason,
             id_card_url, climbing_cert_url, insurance_cert_url, health_cert_url
      FROM guides WHERE commercial_status != 'none'
      ORDER BY commercial_applied_at DESC LIMIT ? OFFSET ?
    `).all(parseInt(limit), offset);
    const total = db.prepare("SELECT COUNT(*) as c FROM guides WHERE commercial_status != 'none'").get().c;
    res.json({ guides, total, page: parseInt(page), limit: parseInt(limit) });
  } catch(e) { res.status(500).json({ error: '服务器错误' }); }
});

// POST /api/admin/guides/:id/commercial-review — 审核向导商业资质
router.post('/guides/:id/commercial-review', adminWriteLimiter, adminAuth, (req, res) => {
  try {
    const { action, reason } = req.body;
    const guide = db.prepare('SELECT * FROM guides WHERE id = ?').get(req.params.id);
    if (!guide) return res.status(404).json({ error: '向导不存在' });
    if (action === 'approve') {
      db.prepare(`UPDATE guides SET commercial_verified=1, commercial_status='approved',
        commercial_reviewed_at=CURRENT_TIMESTAMP, commercial_reject_reason=NULL WHERE id=?`)
        .run(req.params.id);
      try {
        db.prepare("INSERT INTO notifications (user_id, type, content, related_id) VALUES (?, 'commercial_approved', ?, ?)")
          .run(guide.user_id, `【资质审核通过】您的向导商业资质已审核通过，可发布收费服务`, guide.id);
      } catch(e) {}
    } else if (action === 'reject') {
      db.prepare(`UPDATE guides SET commercial_verified=0, commercial_status='rejected',
        commercial_reviewed_at=CURRENT_TIMESTAMP, commercial_reject_reason=? WHERE id=?`)
        .run(reason || '资质不符合要求', req.params.id);
      try {
        db.prepare("INSERT INTO notifications (user_id, type, content, related_id) VALUES (?, 'commercial_rejected', ?, ?)")
          .run(guide.user_id, `【资质审核未通过】您的向导商业资质审核未通过：${reason || '资质不符合要求'}`, guide.id);
      } catch(e) {}
    } else if (action === 'need_info') {
      db.prepare(`UPDATE guides SET commercial_status='need_info',
        commercial_reviewed_at=CURRENT_TIMESTAMP, commercial_reject_reason=? WHERE id=?`)
        .run(reason || '需补充材料', req.params.id);
      try {
        db.prepare("INSERT INTO notifications (user_id, type, content, related_id) VALUES (?, 'commercial_need_info', ?, ?)")
          .run(guide.user_id, `【资质补充】您的向导商业资质需补充材料：${reason || '请联系管理员'}`, guide.id);
      } catch(e) {}
    } else {
      return res.status(400).json({ error: '无效操作，action 应为 approve|reject|need_info' });
    }
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: '服务器错误' }); }
});

module.exports = router;
