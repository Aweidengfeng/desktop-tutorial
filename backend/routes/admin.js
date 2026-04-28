const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const prisma = require('../db/prisma');
const adminAuth = require('../middleware/adminAuth');
const devOnly = require('../middleware/devOnly');
const { GUIDE_CERT_LEVELS, CLUB_CERT_LEVELS } = require('../utils/certLevels');

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
router.post('/login', adminLoginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body || {};
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
    res.cookie('adminToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/admin/logout
router.post('/logout', async (req, res) => {
  res.clearCookie('adminToken');
  res.json({ success: true });
});

// GET /api/admin/check
router.get('/check', adminAuth, async (req, res) => res.json({ ok: true }));

// GET /api/admin/stats
router.get('/stats', adminWriteLimiter, adminAuth, async (req, res) => {
  try {
    const totalUsers = Number((await prisma.$queryRaw`SELECT COUNT(*) as c FROM users`)[0].c);
    const totalPosts = Number((await prisma.$queryRaw`SELECT COUNT(*) as c FROM posts`)[0].c);
    const totalOrders = Number((await prisma.$queryRaw`SELECT COUNT(*) as c FROM orders`)[0].c);
    const totalClubs = Number((await prisma.$queryRaw`SELECT COUNT(*) as c FROM clubs`)[0].c);
    const totalBookings = Number((await prisma.$queryRaw`SELECT COUNT(*) as c FROM bookings`)[0].c);
    const today = new Date().toISOString().slice(0, 10);
    const newUsersToday = Number((await prisma.$queryRaw`SELECT COUNT(*) as c FROM users WHERE date(created_at) = ${today}`)[0].c);
    const pendingPosts = Number((await prisma.$queryRaw`SELECT COUNT(*) as c FROM posts WHERE status = 'pending'`)[0].c);
    const pendingGuides = Number((await prisma.$queryRaw`SELECT COUNT(*) as c FROM guide_applications WHERE status = 'pending'`)[0].c);
    const pendingBookings = Number((await prisma.$queryRaw`SELECT COUNT(*) as c FROM bookings WHERE status = 'pending'`)[0].c);
    let pendingSos = 0;
    let pendingWithdrawals = 0;
    try { pendingSos = Number((await prisma.$queryRaw`SELECT COUNT(*) as c FROM sos_records WHERE status = 'pending'`)[0].c); } catch(e) {}
    try { pendingWithdrawals = Number((await prisma.$queryRaw`SELECT COUNT(*) as c FROM withdrawal_requests WHERE status = 'pending'`)[0].c); } catch(e) {}
    res.json({ totalUsers, totalPosts, totalOrders, totalClubs, totalBookings, newUsersToday, pendingPosts, pendingGuides, pendingBookings, pendingSos, pendingWithdrawals });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/admin/users
router.get('/users', adminAuth, async (req, res) => {
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
    const users = await prisma.$queryRawUnsafe(sql, ...params);
    const countSql = search
      ? 'SELECT COUNT(*) as c FROM users WHERE name LIKE ? OR phone LIKE ? OR username LIKE ?'
      : 'SELECT COUNT(*) as c FROM users';
    const countParams = search ? [`%${search}%`, `%${search}%`, `%${search}%`] : [];
    const total = Number((await prisma.$queryRawUnsafe(countSql, ...countParams))[0].c);
    res.json({ users, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/admin/users/:id/ban
router.put('/users/:id/ban', adminAuth, async (req, res) => {
  try {
    const user = (await prisma.$queryRaw`SELECT id, is_banned FROM users WHERE id = ${req.params.id}`)[0];
    if (!user) return res.status(404).json({ error: '用户不存在' });
    const newBanned = user.is_banned ? 0 : 1;
    await prisma.$executeRaw`UPDATE users SET is_banned = ${newBanned} WHERE id = ${user.id}`;
    res.json({ success: true, is_banned: newBanned });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/admin/posts
router.get('/posts', adminAuth, async (req, res) => {
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
    const posts = await prisma.$queryRawUnsafe(sql, ...params);
    const countSql = status
      ? 'SELECT COUNT(*) as c FROM posts WHERE status = ?'
      : 'SELECT COUNT(*) as c FROM posts';
    const countParams = status ? [status] : [];
    const total = Number((await prisma.$queryRawUnsafe(countSql, ...countParams))[0].c);
    res.json({ posts, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/admin/posts/:id/approve
router.put('/posts/:id/approve', adminAuth, async (req, res) => {
  try {
    const affected = await prisma.$executeRaw`UPDATE posts SET status = 'approved' WHERE id = ${req.params.id}`;
    if (affected === 0) return res.status(404).json({ error: '帖子不存在' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/admin/posts/:id/reject
router.put('/posts/:id/reject', adminAuth, async (req, res) => {
  try {
    const affected = await prisma.$executeRaw`UPDATE posts SET status = 'rejected' WHERE id = ${req.params.id}`;
    if (affected === 0) return res.status(404).json({ error: '帖子不存在' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/admin/guides
router.get('/guides', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const guides = await prisma.$queryRaw`
      SELECT id, user_id, name, cert, specialty, languages, day_rate, region, status, created_at,
              id_card_url, climbing_cert_url, insurance_cert_url, health_cert_url,
              passport_url, is_international, nationality, cert_level
       FROM guide_applications ORDER BY created_at DESC LIMIT ${parseInt(limit)} OFFSET ${offset}`;
    const total = Number((await prisma.$queryRaw`SELECT COUNT(*) as c FROM guide_applications`)[0].c);
    res.json({ guides, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/admin/guides/:id/approve
router.put('/guides/:id/approve', adminWriteLimiter, adminAuth, async (req, res) => {
  try {
    const app = (await prisma.$queryRaw`SELECT * FROM guide_applications WHERE id = ${req.params.id}`)[0];
    if (!app) return res.status(404).json({ error: '申请不存在' });
    await prisma.$executeRaw`UPDATE guide_applications SET status = 'approved_pending_payment' WHERE id = ${req.params.id}`;
    // Update or insert guide record with pending_payment status
    const existing = (await prisma.$queryRaw`SELECT id FROM guides WHERE user_id = ${app.user_id}`)[0];
    if (existing) {
      await prisma.$executeRaw`UPDATE guides SET status = 'approved_pending_payment' WHERE user_id = ${app.user_id}`;
    } else {
      await prisma.$executeRaw`INSERT INTO guides (user_id, name, cert, specialty, languages, day_rate, region, status)
                  VALUES (${app.user_id}, ${app.name}, ${app.cert}, ${app.specialty}, ${app.languages}, ${app.day_rate}, ${app.region}, 'approved_pending_payment')`;
    }
    try { await prisma.$executeRaw`INSERT INTO notifications (user_id, type, title, body, link) VALUES (${app.user_id}, 'guide_review', '向导申请审核通过，请完成付费', '您的向导申请已审核通过，请支付入驻费后正式入驻平台', '/guide-portal')`; } catch(e) {}
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/admin/guides/:id/reject
router.put('/guides/:id/reject', adminAuth, async (req, res) => {
  try {
    const app = (await prisma.$queryRaw`SELECT * FROM guide_applications WHERE id = ${req.params.id}`)[0];
    if (!app) return res.status(404).json({ error: '申请不存在' });
    await prisma.$executeRaw`UPDATE guide_applications SET status = 'rejected' WHERE id = ${req.params.id}`;
    await prisma.$executeRaw`UPDATE guides SET status = 'rejected' WHERE user_id = ${app.user_id} AND status = 'pending'`;
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/admin/orders
router.get('/orders', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const orders = await prisma.$queryRaw`SELECT id, user_id, order_no, amount, method, status, created_at FROM orders ORDER BY created_at DESC LIMIT ${parseInt(limit)} OFFSET ${offset}`;
    const total = Number((await prisma.$queryRaw`SELECT COUNT(*) as c FROM orders`)[0].c);
    res.json({ orders, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/admin/clubs
router.get('/clubs', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const clubs = await prisma.$queryRaw`SELECT id, name, description, specialty, region, members_count, expeditions, verified, status, created_at FROM clubs ORDER BY created_at DESC LIMIT ${parseInt(limit)} OFFSET ${offset}`;
    const total = Number((await prisma.$queryRaw`SELECT COUNT(*) as c FROM clubs`)[0].c);
    res.json({ clubs, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/admin/clubs — 管理员新建俱乐部
router.post('/clubs', adminWriteLimiter, adminAuth, async (req, res) => {
  try {
    const { name, region, specialty, description, contact, verified } = req.body;
    if (!name) return res.status(400).json({ error: '俱乐部名称不能为空' });
    const verifiedVal = verified ? 1 : 0;
    const [{ id: newClubId }] = await prisma.$queryRaw`
      INSERT INTO clubs (name, region, specialty, description, contact, verified, status)
      VALUES (${name}, ${region || null}, ${specialty || null}, ${description || null}, ${contact || null}, ${verifiedVal}, 'active')
      RETURNING id
    `;
    const club = (await prisma.$queryRaw`SELECT id, name, description, specialty, region, members_count, expeditions, verified, status, created_at FROM clubs WHERE id = ${newClubId}`)[0];
    res.json(club);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/admin/clubs/:id — 管理员编辑俱乐部信息
router.put('/clubs/:id', adminWriteLimiter, adminAuth, async (req, res) => {
  try {
    const club = (await prisma.$queryRaw`SELECT id, name, region, specialty, description, contact, verified FROM clubs WHERE id = ${req.params.id}`)[0];
    if (!club) return res.status(404).json({ error: '俱乐部不存在' });
    const body = req.body;
    const name = 'name' in body ? (body.name || null) : club.name;
    if ('name' in body && !body.name) return res.status(400).json({ error: '俱乐部名称不能为空' });
    const region = 'region' in body ? (body.region || null) : club.region;
    const specialty = 'specialty' in body ? (body.specialty || null) : club.specialty;
    const description = 'description' in body ? (body.description || null) : club.description;
    const contact = 'contact' in body ? (body.contact || null) : club.contact;
    const verifiedVal = 'verified' in body ? (body.verified ? 1 : 0) : club.verified;
    await prisma.$executeRaw`
      UPDATE clubs SET
        name = ${name},
        region = ${region},
        specialty = ${specialty},
        description = ${description},
        contact = ${contact},
        verified = ${verifiedVal}
      WHERE id = ${req.params.id}
    `;
    const updated = (await prisma.$queryRaw`SELECT id, name, description, specialty, region, members_count, expeditions, verified, status, created_at FROM clubs WHERE id = ${req.params.id}`)[0];
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/admin/clubs/:id/verify
router.put('/clubs/:id/verify', adminAuth, async (req, res) => {
  try {
    const club = (await prisma.$queryRaw`SELECT id, verified FROM clubs WHERE id = ${req.params.id}`)[0];
    if (!club) return res.status(404).json({ error: '俱乐部不存在' });
    const newVerified = club.verified ? 0 : 1;
    await prisma.$executeRaw`UPDATE clubs SET verified = ${newVerified} WHERE id = ${club.id}`;
    res.json({ success: true, verified: newVerified });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// DELETE /api/admin/clubs/:id — 软删除俱乐部
router.delete('/clubs/:id', adminWriteLimiter, adminAuth, async (req, res) => {
  try {
    const club = (await prisma.$queryRaw`SELECT id FROM clubs WHERE id = ${req.params.id}`)[0];
    if (!club) return res.status(404).json({ error: '俱乐部不存在' });
    await prisma.$executeRaw`UPDATE clubs SET status = 'deleted' WHERE id = ${req.params.id}`;
    try { await prisma.$executeRaw`UPDATE club_applications SET status = 'deleted' WHERE club_id = ${req.params.id} AND status NOT IN ('rejected','deleted')`; } catch(e) {}
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/admin/clubs/:id/revoke-certification — 撤销俱乐部认证
router.post('/clubs/:id/revoke-certification', adminWriteLimiter, adminAuth, async (req, res) => {
  try {
    const { reason = '' } = req.body;
    const club = (await prisma.$queryRaw`SELECT id, creator_id, name, status FROM clubs WHERE id = ${req.params.id}`)[0];
    if (!club) return res.status(404).json({ error: '俱乐部不存在' });
    await prisma.$executeRaw`UPDATE clubs SET status = 'revoked', verified = 0, cert_expires_at = NULL, listing_fee_paid = 0 WHERE id = ${req.params.id}`;
    try {
      const notifBody = `您的俱乐部「${club.name}」认证已被管理员撤销${reason ? '，原因：' + reason : ''}，如有疑问请联系客服。`;
      await prisma.$executeRaw`INSERT INTO notifications (user_id, type, title, body, link) VALUES (${club.creator_id}, 'club_revoked', '俱乐部认证已撤销', ${notifBody}, '/club-portal')`;
    } catch(e) {}
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/admin/guides/:id/revoke-certification — 撤销向导认证
router.post('/guides/:id/revoke-certification', adminWriteLimiter, adminAuth, async (req, res) => {
  try {
    const { reason = '' } = req.body;
    const guide = (await prisma.$queryRaw`SELECT id, user_id, name, status FROM guides WHERE id = ${req.params.id}`)[0];
    if (!guide) return res.status(404).json({ error: '向导不存在' });
    await prisma.$executeRaw`UPDATE guides SET status = 'revoked', cert_expires_at = NULL, listing_fee_paid = 0 WHERE id = ${req.params.id}`;
    try {
      const notifBody = `您的向导「${guide.name}」认证已被管理员撤销${reason ? '，原因：' + reason : ''}，如有疑问请联系客服。`;
      await prisma.$executeRaw`INSERT INTO notifications (user_id, type, title, body, link) VALUES (${guide.user_id}, 'guide_revoked', '向导认证已撤销', ${notifBody}, '/guide-portal')`;
    } catch(e) {}
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/admin/bookings
router.get('/bookings', adminAuth, async (req, res) => {
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
    const bookings = await prisma.$queryRawUnsafe(sql, ...params);
    const countSql = status ? 'SELECT COUNT(*) as c FROM bookings WHERE status = ?' : 'SELECT COUNT(*) as c FROM bookings';
    const countParams = status ? [status] : [];
    const total = Number((await prisma.$queryRawUnsafe(countSql, ...countParams))[0].c);
    res.json({ bookings, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/admin/bookings/:id/status
router.put('/bookings/:id/status', adminAuth, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending', 'confirmed', 'cancelled', 'completed'].includes(status)) {
      return res.status(400).json({ error: '无效状态' });
    }
    const affected = await prisma.$executeRaw`UPDATE bookings SET status = ${status} WHERE id = ${req.params.id}`;
    if (affected === 0) return res.status(404).json({ error: '预约不存在' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/admin/gear
router.get('/gear', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const items = await prisma.$queryRaw`
      SELECT g.id, g.name, g.brand, g.price, g.condition_text, g.mode, g.category,
              u.name as seller_name, g.created_at
       FROM gear g LEFT JOIN users u ON u.id = g.seller_id
       ORDER BY g.created_at DESC LIMIT ${parseInt(limit)} OFFSET ${offset}`;
    const total = Number((await prisma.$queryRaw`SELECT COUNT(*) as c FROM gear`)[0].c);
    res.json({ items, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// DELETE /api/admin/gear/:id
router.delete('/gear/:id', adminAuth, async (req, res) => {
  try {
    const affected = await prisma.$executeRaw`DELETE FROM gear WHERE id = ${req.params.id}`;
    if (affected === 0) return res.status(404).json({ error: '装备不存在' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/admin/club-activities — 俱乐部活动管理
router.get('/club-activities', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, status = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let sql = `SELECT ca.*, c.name as club_name FROM club_activities ca LEFT JOIN clubs c ON c.id = ca.club_id`;
    const params = [];
    if (status) { sql += ' WHERE ca.status = ?'; params.push(status); }
    sql += ' ORDER BY ca.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);
    const activities = await prisma.$queryRawUnsafe(sql, ...params);
    const countSql = status ? 'SELECT COUNT(*) as c FROM club_activities WHERE status = ?' : 'SELECT COUNT(*) as c FROM club_activities';
    const countParams = status ? [status] : [];
    const total = Number((await prisma.$queryRawUnsafe(countSql, ...countParams))[0].c);
    res.json({ activities, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/admin/club-activities/:id/end — 下架活动
router.put('/club-activities/:id/end', adminAuth, async (req, res) => {
  try {
    const affected = await prisma.$executeRaw`UPDATE club_activities SET status = 'ended' WHERE id = ${req.params.id}`;
    if (affected === 0) return res.status(404).json({ error: '活动不存在' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// DELETE /api/admin/club-activities/:id — 删除活动
router.delete('/club-activities/:id', adminAuth, async (req, res) => {
  try {
    const affected = await prisma.$executeRaw`DELETE FROM club_activities WHERE id = ${req.params.id}`;
    if (affected === 0) return res.status(404).json({ error: '活动不存在' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/admin/guide-expeditions — 向导带队记录管理
router.get('/guide-expeditions', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const expeditions = await prisma.$queryRaw`
      SELECT ge.*, g.name as guide_name
      FROM guide_expeditions ge LEFT JOIN guides g ON g.id = ge.guide_id
      ORDER BY ge.created_at DESC LIMIT ${parseInt(limit)} OFFSET ${offset}
    `;
    const total = Number((await prisma.$queryRaw`SELECT COUNT(*) as c FROM guide_expeditions`)[0].c);
    res.json({ expeditions, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/admin/reviews — 评价管理
router.get('/reviews', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, target_type = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let sql = 'SELECT * FROM reviews';
    const params = [];
    if (target_type) { sql += ' WHERE target_type = ?'; params.push(target_type); }
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);
    const reviews = await prisma.$queryRawUnsafe(sql, ...params);
    const countSql = target_type ? 'SELECT COUNT(*) as c FROM reviews WHERE target_type = ?' : 'SELECT COUNT(*) as c FROM reviews';
    const countParams = target_type ? [target_type] : [];
    const total = Number((await prisma.$queryRawUnsafe(countSql, ...countParams))[0].c);
    res.json({ reviews, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// DELETE /api/admin/reviews/:id — 删除评价
router.delete('/reviews/:id', adminAuth, async (req, res) => {
  try {
    const affected = await prisma.$executeRaw`DELETE FROM reviews WHERE id = ${req.params.id}`;
    if (affected === 0) return res.status(404).json({ error: '评价不存在' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// ── A6: 俱乐部申请审核 ──────────────────────────────────────────

// GET /api/admin/guide-applications
router.get('/guide-applications', adminWriteLimiter, adminAuth, async (req, res) => {
  try {
    const { status = '', page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let sql = `SELECT ga.*, u.name as applicant_name, u.phone as applicant_phone
               FROM guide_applications ga
               LEFT JOIN users u ON u.id = ga.user_id`;
    const params = [];
    if (status) { sql += ' WHERE ga.status = ?'; params.push(status); }
    sql += ' ORDER BY ga.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);
    const applications = await prisma.$queryRawUnsafe(sql, ...params);
    const countSql = status
      ? 'SELECT COUNT(*) as c FROM guide_applications WHERE status = ?'
      : 'SELECT COUNT(*) as c FROM guide_applications';
    const total = Number((await prisma.$queryRawUnsafe(countSql, ...(status ? [status] : [])))[0].c);
    res.json({ applications, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/admin/club-applications?status=pending|approved|rejected
router.get('/club-applications', adminAuth, async (req, res) => {
  try {
    const { status = '', page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let sql = 'SELECT * FROM club_applications';
    const params = [];
    if (status) { sql += ' WHERE status = ?'; params.push(status); }
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);
    const applications = await prisma.$queryRawUnsafe(sql, ...params);
    const countSql = status ? 'SELECT COUNT(*) as c FROM club_applications WHERE status = ?' : 'SELECT COUNT(*) as c FROM club_applications';
    const countParams = status ? [status] : [];
    const total = Number((await prisma.$queryRawUnsafe(countSql, ...countParams))[0].c);
    res.json({ applications, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/admin/club-applications/:id/approve — 审核通过俱乐部申请
router.post('/club-applications/:id/approve', adminWriteLimiter, adminAuth, async (req, res) => {
  try {
    const app = (await prisma.$queryRaw`SELECT * FROM club_applications WHERE id = ${req.params.id}`)[0];
    if (!app) return res.status(404).json({ error: '申请不存在' });
    const now = new Date().toISOString();
    await prisma.$executeRaw`UPDATE club_applications SET status = 'approved_pending_payment' WHERE id = ${req.params.id}`;
    // Create or update club record with pending_payment status
    const existingClub = app.club_id
      ? (await prisma.$queryRaw`SELECT id FROM clubs WHERE id = ${app.club_id}`)[0]
      : (await prisma.$queryRaw`SELECT id FROM clubs WHERE creator_id = ${app.user_id}`)[0];
    if (existingClub) {
      await prisma.$executeRaw`UPDATE clubs SET status = 'approved_pending_payment', approved_at = ${now}, approved_by = 'admin' WHERE id = ${existingClub.id}`;
    } else {
      const clubName = app.club_name || app.name;
      const clubType = app.type || '综合';
      const certUrl = app.cert_url || null;
      const [{ id: newClubId }] = await prisma.$queryRaw`INSERT INTO clubs (name, description, specialty, region, type, contact, wechat, website, business_license_url, creator_id, status, approved_at, approved_by)
                  VALUES (${clubName}, ${app.description}, ${app.specialty}, ${app.region}, ${clubType},
                         ${app.contact}, ${app.wechat}, ${app.website}, ${certUrl}, ${app.user_id}, 'approved_pending_payment', ${now}, 'admin')
                  RETURNING id`;
      await prisma.$executeRaw`UPDATE club_applications SET club_id = ${newClubId} WHERE id = ${app.id}`;
    }
    try { await prisma.$executeRaw`INSERT INTO notifications (user_id, type, title, body, link) VALUES (${app.user_id}, 'club_review', '俱乐部申请审核通过，请完成付费', '您的俱乐部申请已审核通过，请支付入驻费后正式入驻平台', '/club-portal')`; } catch(e) {}
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/admin/club-applications/:id/reject — 拒绝俱乐部申请
router.post('/club-applications/:id/reject', adminWriteLimiter, adminAuth, async (req, res) => {
  try {
    const { reason = '' } = req.body;
    const app = (await prisma.$queryRaw`SELECT id FROM club_applications WHERE id = ${req.params.id}`)[0];
    if (!app) return res.status(404).json({ error: '申请不存在' });
    await prisma.$executeRaw`UPDATE club_applications SET status = 'rejected', reject_reason = ${reason} WHERE id = ${req.params.id}`;
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/admin/guides/:id/config — 管理员设置向导抽成/入驻费
router.put('/guides/:id/config', adminAuth, async (req, res) => {
  try {
    const { commission_rate, listing_fee_paid } = req.body;
    const guide = (await prisma.$queryRaw`SELECT id FROM guides WHERE id = ${req.params.id}`)[0];
    if (!guide) return res.status(404).json({ error: '向导不存在' });
    const updates = [];
    const params = [];
    if (commission_rate !== undefined) { updates.push('commission_rate = ?'); params.push(commission_rate); }
    if (listing_fee_paid !== undefined) { updates.push('listing_fee_paid = ?'); params.push(listing_fee_paid ? 1 : 0); }
    if (updates.length === 0) return res.status(400).json({ error: '无有效参数' });
    params.push(req.params.id);
    await prisma.$executeRawUnsafe(`UPDATE guides SET ${updates.join(', ')} WHERE id = ?`, ...params);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/admin/clubs/:id/config — 管理员设置俱乐部抽成/入驻费
router.put('/clubs/:id/config', adminAuth, async (req, res) => {
  try {
    const { commission_rate, listing_fee_paid } = req.body;
    const club = (await prisma.$queryRaw`SELECT id FROM clubs WHERE id = ${req.params.id}`)[0];
    if (!club) return res.status(404).json({ error: '俱乐部不存在' });
    const updates = [];
    const params = [];
    if (commission_rate !== undefined) { updates.push('commission_rate = ?'); params.push(commission_rate); }
    if (listing_fee_paid !== undefined) { updates.push('listing_fee_paid = ?'); params.push(listing_fee_paid ? 1 : 0); }
    if (updates.length === 0) return res.status(400).json({ error: '无有效参数' });
    params.push(req.params.id);
    await prisma.$executeRawUnsafe(`UPDATE clubs SET ${updates.join(', ')} WHERE id = ?`, ...params);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// ── A7: 商业攀登审核 ────────────────────────────────────────────

// GET /api/admin/expeditions?status=pending
router.get('/expeditions', adminAuth, async (req, res) => {
  try {
    const { status = '', page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let sql = 'SELECT * FROM expeditions';
    const params = [];
    if (status) { sql += ' WHERE status = ?'; params.push(status); }
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);
    const expeditions = await prisma.$queryRawUnsafe(sql, ...params);
    const countSql = status ? 'SELECT COUNT(*) as c FROM expeditions WHERE status = ?' : 'SELECT COUNT(*) as c FROM expeditions';
    const total = Number((await prisma.$queryRawUnsafe(countSql, ...(status ? [status] : [])))[0].c);
    res.json({ expeditions, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/admin/expeditions/:id/approve
router.post('/expeditions/:id/approve', adminWriteLimiter, adminAuth, async (req, res) => {
  try {
    const now = new Date().toISOString();
    const affected = await prisma.$executeRaw`UPDATE expeditions SET status = 'published', approved_at = ${now} WHERE id = ${req.params.id}`;
    if (affected === 0) return res.status(404).json({ error: '远征不存在' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/admin/expeditions/:id/reject
router.post('/expeditions/:id/reject', adminWriteLimiter, adminAuth, async (req, res) => {
  try {
    const { reason = '' } = req.body;
    const affected = await prisma.$executeRaw`UPDATE expeditions SET status = 'rejected', reject_reason = ${reason} WHERE id = ${req.params.id}`;
    if (affected === 0) return res.status(404).json({ error: '远征不存在' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// ── A9: 验证码查看器（内测用）────────────────────────────────────

// GET /api/admin/sms-codes — 查看最近50条验证码（仅管理员，内测用）
router.get('/sms-codes', adminLoginLimiter, devOnly, adminAuth, async (req, res) => {
  try {
    const codes = await prisma.$queryRaw`
      SELECT id, phone, code, expires_at, used, created_at
      FROM sms_codes
      ORDER BY id DESC LIMIT 50
    `;
    res.json(codes);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

const { VALID_TRANSITIONS, appendStatusHistory } = require('./orderStateMachine');

// GET /api/admin/expedition-orders - 全量订单查询
router.get('/expedition-orders', adminWriteLimiter, adminAuth, async (req, res) => {
  try {
    const { status, limit = 50, page = 1 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let sql = 'SELECT * FROM expedition_orders';
    const params = [];
    if (status) { sql += ' WHERE status = ?'; params.push(status); }
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);
    const orders = await prisma.$queryRawUnsafe(sql, ...params);
    const countSql = status ? 'SELECT COUNT(*) c FROM expedition_orders WHERE status=?' : 'SELECT COUNT(*) c FROM expedition_orders';
    const total = Number((await prisma.$queryRawUnsafe(countSql, ...(status ? [status] : [])))[0].c);
    res.json({ orders, total });
  } catch(e) { res.status(500).json({ error: '服务器错误' }); }
});

// POST /api/admin/expedition-orders/:id/transition
router.post('/expedition-orders/:id/transition', adminWriteLimiter, adminAuth, async (req, res) => {
  try {
    const { newStatus } = req.body;
    const order = (await prisma.$queryRaw`SELECT * FROM expedition_orders WHERE id = ${req.params.id}`)[0];
    if (!order) return res.status(404).json({ error: '订单不存在' });
    const allowed = VALID_TRANSITIONS[order.status] || [];
    if (!allowed.includes(newStatus)) {
      return res.status(400).json({ error: `不允许从 ${order.status} 迁移到 ${newStatus}` });
    }
    const newHistory = appendStatusHistory(order.status_history, newStatus);
    await prisma.$executeRaw`UPDATE expedition_orders SET status = ${newStatus}, status_history = ${newHistory} WHERE id = ${order.id}`;
    try {
      const notifBody = `您的订单 #${order.id} 状态已更新为 ${newStatus}`;
      const notifLink = `/orders/${order.id}`;
      await prisma.$executeRaw`INSERT INTO notifications (user_id, type, title, body, link) VALUES (${order.user_id}, 'order', '订单状态更新', ${notifBody}, ${notifLink})`;
    } catch(e) {}
    res.json({ success: true, status: newStatus });
  } catch(e) { res.status(500).json({ error: '服务器错误' }); }
});

// GET /api/admin/tracks?flagged=1
router.get('/tracks', adminWriteLimiter, adminAuth, async (req, res) => {
  try {
    const { flagged, limit = 50, page = 1 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let sql = 'SELECT t.*, u.name as user_name FROM tracks t LEFT JOIN users u ON u.id = t.user_id';
    const params = [];
    if (flagged !== undefined) { sql += ' WHERE t.flagged = ?'; params.push(parseInt(flagged)); }
    sql += ' ORDER BY t.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);
    const tracks = await prisma.$queryRawUnsafe(sql, ...params);
    res.json(tracks);
  } catch(e) { res.status(500).json({ error: '服务器错误' }); }
});

// POST /api/admin/tracks/:id/unflag - 解除标记并补发积分
router.post('/tracks/:id/unflag', adminWriteLimiter, adminAuth, async (req, res) => {
  try {
    const track = (await prisma.$queryRaw`SELECT * FROM tracks WHERE id = ${req.params.id}`)[0];
    if (!track) return res.status(404).json({ error: '轨迹不存在' });
    await prisma.$executeRaw`UPDATE tracks SET flagged = 0, flag_reason = NULL WHERE id = ${req.params.id}`;
    // 补发积分
    try { await prisma.$executeRaw`UPDATE users SET points = COALESCE(points,0) + 10 WHERE id = ${track.user_id}`; } catch(e) {}
    try {
      const notifBody = `您的轨迹「${track.name || ''}」已通过审核并补发积分`;
      const notifLink = `/tracks/${track.id}`;
      await prisma.$executeRaw`INSERT INTO notifications (user_id, type, title, body, link) VALUES (${track.user_id}, 'track', '轨迹标记已解除', ${notifBody}, ${notifLink})`;
    } catch(e) {}
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: '服务器错误' }); }
});

// GET /api/admin/moderation-logs
router.get('/moderation-logs', adminWriteLimiter, adminAuth, async (req, res) => {
  try {
    const { limit = 50, page = 1 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const logs = await prisma.$queryRaw`SELECT * FROM moderation_logs ORDER BY created_at DESC LIMIT ${parseInt(limit)} OFFSET ${offset}`;
    const total = Number((await prisma.$queryRaw`SELECT COUNT(*) c FROM moderation_logs`)[0].c);
    res.json({ logs, total });
  } catch(e) { res.status(500).json({ error: '服务器错误' }); }
});

// POST /api/admin/guide-applications/:id/review
router.post('/guide-applications/:id/review', adminWriteLimiter, adminAuth, async (req, res) => {
  try {
    const { action, note } = req.body; // action: approve|reject|need_info
    const app = (await prisma.$queryRaw`SELECT * FROM guide_applications WHERE id = ${req.params.id}`)[0];
    if (!app) return res.status(404).json({ error: '申请不存在' });
    const statusMap = { approve: 'approved_pending_payment', reject: 'rejected', need_info: 'need_info' };
    const newStatus = statusMap[action];
    if (!newStatus) return res.status(400).json({ error: '无效操作' });
    await prisma.$executeRaw`UPDATE guide_applications SET status = ${newStatus}, note = ${note || null} WHERE id = ${req.params.id}`;
    if (newStatus === 'approved_pending_payment') {
      const certLevel = app.cert_level || 'basic';
      const existing = (await prisma.$queryRaw`SELECT id FROM guides WHERE user_id = ${app.user_id}`)[0];
      if (existing) {
        await prisma.$executeRaw`UPDATE guides SET status = 'approved_pending_payment', cert_level = ${certLevel} WHERE user_id = ${app.user_id}`;
      } else {
        await prisma.$executeRaw`INSERT INTO guides (user_id, name, cert, specialty, languages, day_rate, region, status, cert_level,
                      id_card_url, climbing_cert_url, insurance_cert_url, health_cert_url, passport_url, is_international, nationality)
                    VALUES (${app.user_id}, ${app.name}, ${app.cert}, ${app.specialty}, ${app.languages}, ${app.day_rate}, ${app.region}, 'approved_pending_payment', ${certLevel},
                      ${app.id_card_url || null}, ${app.climbing_cert_url || null},
                      ${app.insurance_cert_url || null}, ${app.health_cert_url || null},
                      ${app.passport_url || null}, ${app.is_international || 0}, ${app.nationality || null})`;
      }
    }
    const statusLabel = newStatus === 'approved_pending_payment' ? '审核通过，请完成付费' : newStatus === 'rejected' ? '已驳回' : '需要补充材料';
    try {
      const notifBody = `您的向导申请：${statusLabel}${note ? '。备注：' + note : ''}`;
      await prisma.$executeRaw`INSERT INTO notifications (user_id, type, title, body, link) VALUES (${app.user_id}, 'guide_review', ${'向导申请' + statusLabel}, ${notifBody}, '/guide-portal')`;
    } catch(e) {}
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: '服务器错误' }); }
});

// POST /api/admin/club-applications/:id/review
router.post('/club-applications/:id/review', adminWriteLimiter, adminAuth, async (req, res) => {
  try {
    const { action, note } = req.body;
    const clubApp = (await prisma.$queryRaw`SELECT * FROM club_applications WHERE id = ${req.params.id}`)[0];
    if (!clubApp) return res.status(404).json({ error: '申请不存在' });
    const statusMap = { approve: 'approved_pending_payment', reject: 'rejected', need_info: 'need_info' };
    const newStatus = statusMap[action];
    if (!newStatus) return res.status(400).json({ error: '无效操作' });
    await prisma.$executeRaw`UPDATE club_applications SET status = ${newStatus}, note = ${note || null} WHERE id = ${req.params.id}`;
    if (newStatus === 'approved_pending_payment' && clubApp.club_id) {
      const certLevel = clubApp.cert_level || 'standard';
      await prisma.$executeRaw`UPDATE clubs SET status = 'approved_pending_payment', cert_level = ${certLevel} WHERE id = ${clubApp.club_id}`;
    }
    try {
      const notifBody = `您的俱乐部申请已${newStatus === 'approved_pending_payment' ? '通过，请完成付费' : newStatus === 'rejected' ? '驳回' : '需要补充材料'}`;
      await prisma.$executeRaw`INSERT INTO notifications (user_id, type, title, body, link) VALUES (${clubApp.user_id}, 'club_review', '俱乐部申请审核结果', ${notifBody}, '/club-portal')`;
    } catch(e) {}
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: '服务器错误' }); }
});

// GET /api/admin/clubs/commercial — 俱乐部商业资质审核列表
router.get('/clubs/commercial', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const clubs = await prisma.$queryRaw`
      SELECT id, name, specialty, region, commercial_status, commercial_applied_at,
             commercial_reviewed_at, commercial_verified, commercial_reject_reason,
             business_license_url, business_license_no, insurance_cert_url,
             bank_account_name, bank_account_no, bank_name
      FROM clubs WHERE commercial_status != 'none'
      ORDER BY commercial_applied_at DESC LIMIT ${parseInt(limit)} OFFSET ${offset}
    `;
    const total = Number((await prisma.$queryRaw`SELECT COUNT(*) as c FROM clubs WHERE commercial_status != 'none'`)[0].c);
    res.json({ clubs, total, page: parseInt(page), limit: parseInt(limit) });
  } catch(e) { res.status(500).json({ error: '服务器错误' }); }
});

// POST /api/admin/clubs/:id/commercial-review — 审核俱乐部商业资质
router.post('/clubs/:id/commercial-review', adminWriteLimiter, adminAuth, async (req, res) => {
  try {
    const { action, reason } = req.body;
    const club = (await prisma.$queryRaw`SELECT * FROM clubs WHERE id = ${req.params.id}`)[0];
    if (!club) return res.status(404).json({ error: '俱乐部不存在' });
    if (action === 'approve') {
      await prisma.$executeRaw`UPDATE clubs SET commercial_verified=1, commercial_status='approved',
        commercial_reviewed_at=CURRENT_TIMESTAMP, commercial_reject_reason=NULL WHERE id=${req.params.id}`;
      // 通知俱乐部创建者
      try {
        const notifContent = `【资质审核通过】您的俱乐部 ${club.name} 商业资质已审核通过，可发布收费活动`;
        await prisma.$executeRaw`INSERT INTO notifications (user_id, type, content, related_id) VALUES (${club.creator_id}, 'commercial_approved', ${notifContent}, ${club.id})`;
      } catch(e) {}
    } else if (action === 'reject') {
      const rejectReason = reason || '资质不符合要求';
      await prisma.$executeRaw`UPDATE clubs SET commercial_verified=0, commercial_status='rejected',
        commercial_reviewed_at=CURRENT_TIMESTAMP, commercial_reject_reason=${rejectReason} WHERE id=${req.params.id}`;
      try {
        const notifContent = `【资质审核未通过】您的俱乐部 ${club.name} 商业资质审核未通过：${rejectReason}`;
        await prisma.$executeRaw`INSERT INTO notifications (user_id, type, content, related_id) VALUES (${club.creator_id}, 'commercial_rejected', ${notifContent}, ${club.id})`;
      } catch(e) {}
    } else if (action === 'need_info') {
      const needInfoReason = reason || '需补充材料';
      await prisma.$executeRaw`UPDATE clubs SET commercial_status='need_info',
        commercial_reviewed_at=CURRENT_TIMESTAMP, commercial_reject_reason=${needInfoReason} WHERE id=${req.params.id}`;
      try {
        const notifContent = `【资质补充】您的俱乐部 ${club.name} 商业资质需补充材料：${needInfoReason}`;
        await prisma.$executeRaw`INSERT INTO notifications (user_id, type, content, related_id) VALUES (${club.creator_id}, 'commercial_need_info', ${notifContent}, ${club.id})`;
      } catch(e) {}
    } else {
      return res.status(400).json({ error: '无效操作，action 应为 approve|reject|need_info' });
    }
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: '服务器错误' }); }
});

// GET /api/admin/guides/commercial — 向导商业资质审核列表
router.get('/guides/commercial', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const guides = await prisma.$queryRaw`
      SELECT id, name, specialty, region, commercial_status, commercial_applied_at,
             commercial_reviewed_at, commercial_verified, commercial_reject_reason,
             id_card_url, climbing_cert_url, insurance_cert_url, health_cert_url
      FROM guides WHERE commercial_status != 'none'
      ORDER BY commercial_applied_at DESC LIMIT ${parseInt(limit)} OFFSET ${offset}
    `;
    const total = Number((await prisma.$queryRaw`SELECT COUNT(*) as c FROM guides WHERE commercial_status != 'none'`)[0].c);
    res.json({ guides, total, page: parseInt(page), limit: parseInt(limit) });
  } catch(e) { res.status(500).json({ error: '服务器错误' }); }
});

// POST /api/admin/guides/:id/commercial-review — 审核向导商业资质
router.post('/guides/:id/commercial-review', adminWriteLimiter, adminAuth, async (req, res) => {
  try {
    const { action, reason } = req.body;
    const guide = (await prisma.$queryRaw`SELECT * FROM guides WHERE id = ${req.params.id}`)[0];
    if (!guide) return res.status(404).json({ error: '向导不存在' });
    if (action === 'approve') {
      await prisma.$executeRaw`UPDATE guides SET commercial_verified=1, commercial_status='approved',
        commercial_reviewed_at=CURRENT_TIMESTAMP, commercial_reject_reason=NULL WHERE id=${req.params.id}`;
      try {
        const notifContent = `【资质审核通过】您的向导商业资质已审核通过，可发布收费服务`;
        await prisma.$executeRaw`INSERT INTO notifications (user_id, type, content, related_id) VALUES (${guide.user_id}, 'commercial_approved', ${notifContent}, ${guide.id})`;
      } catch(e) {}
    } else if (action === 'reject') {
      const rejectReason = reason || '资质不符合要求';
      await prisma.$executeRaw`UPDATE guides SET commercial_verified=0, commercial_status='rejected',
        commercial_reviewed_at=CURRENT_TIMESTAMP, commercial_reject_reason=${rejectReason} WHERE id=${req.params.id}`;
      try {
        const notifContent = `【资质审核未通过】您的向导商业资质审核未通过：${rejectReason}`;
        await prisma.$executeRaw`INSERT INTO notifications (user_id, type, content, related_id) VALUES (${guide.user_id}, 'commercial_rejected', ${notifContent}, ${guide.id})`;
      } catch(e) {}
    } else if (action === 'need_info') {
      const needInfoReason = reason || '需补充材料';
      await prisma.$executeRaw`UPDATE guides SET commercial_status='need_info',
        commercial_reviewed_at=CURRENT_TIMESTAMP, commercial_reject_reason=${needInfoReason} WHERE id=${req.params.id}`;
      try {
        const notifContent = `【资质补充】您的向导商业资质需补充材料：${needInfoReason}`;
        await prisma.$executeRaw`INSERT INTO notifications (user_id, type, content, related_id) VALUES (${guide.user_id}, 'commercial_need_info', ${notifContent}, ${guide.id})`;
      } catch(e) {}
    } else {
      return res.status(400).json({ error: '无效操作，action 应为 approve|reject|need_info' });
    }
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: '服务器错误' }); }
});

// ── 山峰管理 CRUD ────────────────────────────────────────────────────────────

// GET /api/admin/peaks — 列出所有山峰（支持分页/搜索）
router.get('/peaks', adminWriteLimiter, adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, q = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const like = `%${q}%`;
    const rows = await prisma.$queryRaw`
      SELECT id, name, name_en, altitude, country, continent, difficulty,
             type, category, best_season, first_ascent, latitude, longitude,
             image, data_source, created_at
      FROM peaks
      WHERE (${q} = '' OR name LIKE ${like} OR name_en LIKE ${like} OR country LIKE ${like})
      ORDER BY altitude DESC
      LIMIT ${parseInt(limit)} OFFSET ${offset}
    `;
    const total = Number((await prisma.$queryRaw`
      SELECT COUNT(*) as c FROM peaks
      WHERE (${q} = '' OR name LIKE ${like} OR name_en LIKE ${like} OR country LIKE ${like})
    `)[0].c);
    res.json({ peaks: rows, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/admin/peaks — 新增山峰
router.post('/peaks', adminWriteLimiter, adminAuth, async (req, res) => {
  try {
    const {
      name, name_en, altitude, country, continent, difficulty, image,
      cover_image, type, category, categories, description, best_season,
      first_ascent, deaths, success_rate, annual_climbers, commercial_teams,
      latitude, longitude, region, routes, camps, main_route, supplemental_oxygen,
      season_detail, operating_company, data_source, permit_fee,
    } = req.body;
    if (!name) return res.status(400).json({ error: '山峰名称不能为空' });
    const categoriesStr = Array.isArray(categories) ? JSON.stringify(categories) : (categories || null);
    const routesStr = Array.isArray(routes) ? JSON.stringify(routes) : (routes || null);
    const campsStr = Array.isArray(camps) ? JSON.stringify(camps) : (camps || null);
    const [{ id: newPeakId }] = await prisma.$queryRaw`
      INSERT INTO peaks (name, name_en, altitude, country, continent, difficulty, image, cover_image,
                         type, category, categories, description, best_season, first_ascent, deaths,
                         success_rate, annual_climbers, commercial_teams, latitude, longitude, region,
                         routes, camps, main_route, supplemental_oxygen, season_detail,
                         operating_company, data_source, permit_fee)
      VALUES (${name}, ${name_en || null}, ${altitude || null}, ${country || null}, ${continent || null},
             ${difficulty || null}, ${image || null}, ${cover_image || null},
             ${type || null}, ${category || null}, ${categoriesStr},
             ${description || null}, ${best_season || null}, ${first_ascent || null},
             ${deaths || null}, ${success_rate || null}, ${annual_climbers || null},
             ${commercial_teams || null}, ${latitude || null}, ${longitude || null},
             ${region || null}, ${routesStr}, ${campsStr}, ${main_route || null},
             ${supplemental_oxygen || 0}, ${season_detail || null},
             ${operating_company || null}, ${data_source || '管理员录入'}, ${permit_fee || null})
      RETURNING id
    `;
    const peak = (await prisma.$queryRaw`SELECT * FROM peaks WHERE id = ${newPeakId}`)[0];
    res.json(peak);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/admin/peaks/:id — 编辑山峰
router.put('/peaks/:id', adminWriteLimiter, adminAuth, async (req, res) => {
  try {
    const peak = (await prisma.$queryRaw`SELECT id FROM peaks WHERE id = ${req.params.id}`)[0];
    if (!peak) return res.status(404).json({ error: '山峰不存在' });
    const allowed = [
      'name', 'name_en', 'altitude', 'country', 'continent', 'difficulty', 'image', 'cover_image',
      'type', 'category', 'description', 'best_season', 'first_ascent', 'deaths', 'success_rate',
      'annual_climbers', 'commercial_teams', 'latitude', 'longitude', 'region', 'main_route',
      'supplemental_oxygen', 'season_detail', 'operating_company', 'data_source', 'permit_fee',
    ];
    const updates = [];
    const vals = [];
    for (const key of allowed) {
      if (key in req.body) {
        updates.push(`${key} = ?`);
        vals.push(req.body[key]);
      }
    }
    if (req.body.categories !== undefined) {
      updates.push('categories = ?');
      vals.push(Array.isArray(req.body.categories) ? JSON.stringify(req.body.categories) : req.body.categories);
    }
    if (req.body.routes !== undefined) {
      updates.push('routes = ?');
      vals.push(Array.isArray(req.body.routes) ? JSON.stringify(req.body.routes) : req.body.routes);
    }
    if (updates.length === 0) return res.status(400).json({ error: '没有需要更新的字段' });
    vals.push(req.params.id);
    await prisma.$executeRawUnsafe(`UPDATE peaks SET ${updates.join(', ')} WHERE id = ?`, ...vals);
    const updated = (await prisma.$queryRaw`SELECT * FROM peaks WHERE id = ${req.params.id}`)[0];
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// DELETE /api/admin/peaks/:id — 删除山峰
router.delete('/peaks/:id', adminWriteLimiter, adminAuth, async (req, res) => {
  try {
    const peak = (await prisma.$queryRaw`SELECT id, name FROM peaks WHERE id = ${req.params.id}`)[0];
    if (!peak) return res.status(404).json({ error: '山峰不存在' });
    await prisma.$executeRaw`DELETE FROM peaks WHERE id = ${req.params.id}`;
    res.json({ success: true, deleted: peak.name });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/admin/peaks/suggestions — 用户提交的山峰建议列表
router.get('/peaks/suggestions', adminWriteLimiter, adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, status = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let sql = `
      SELECT ps.*, u.name as submitter_name
      FROM peak_suggestions ps
      LEFT JOIN users u ON u.id = ps.user_id
    `;
    const params = [];
    if (status) { sql += ' WHERE ps.status = ?'; params.push(status); }
    sql += ' ORDER BY ps.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);
    const rows = await prisma.$queryRawUnsafe(sql, ...params);
    const countSql = status
      ? 'SELECT COUNT(*) as c FROM peak_suggestions WHERE status = ?'
      : 'SELECT COUNT(*) as c FROM peak_suggestions';
    const total = Number((await prisma.$queryRawUnsafe(countSql, ...(status ? [status] : [])))[0].c);
    res.json({ suggestions: rows, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/admin/peaks/suggestions/:id/approve — 审批山峰建议（approve/reject）
router.put('/peaks/suggestions/:id/approve', adminWriteLimiter, adminAuth, async (req, res) => {
  try {
    const { action, reason } = req.body;
    const suggestion = (await prisma.$queryRaw`SELECT * FROM peak_suggestions WHERE id = ${req.params.id}`)[0];
    if (!suggestion) return res.status(404).json({ error: '建议不存在' });
    if (action === 'approve') {
      // 将建议转为正式山峰
      const routesStr = suggestion.routes || null;
      await prisma.$executeRaw`
        INSERT INTO peaks (name, name_en, altitude, country, continent, difficulty, description,
                           best_season, routes, latitude, longitude, image, data_source)
        VALUES (${suggestion.name}, ${suggestion.name_en}, ${suggestion.altitude}, ${suggestion.country},
               ${suggestion.continent}, ${suggestion.difficulty}, ${suggestion.description},
               ${suggestion.best_season}, ${routesStr}, ${suggestion.latitude}, ${suggestion.longitude}, ${suggestion.image}, '用户投稿')
      `;
      await prisma.$executeRaw`UPDATE peak_suggestions SET status = 'approved' WHERE id = ${req.params.id}`;
      // 通知用户
      if (suggestion.user_id) {
        try {
          const notifContent = `您提交的山峰「${suggestion.name}」已通过审核，已收录到山峰数据库！`;
          await prisma.$executeRaw`INSERT INTO notifications (user_id, type, content) VALUES (${suggestion.user_id}, 'peak_suggestion_approved', ${notifContent})`;
        } catch(e) {}
      }
      res.json({ success: true, message: '已通过审核并收录' });
    } else if (action === 'reject') {
      await prisma.$executeRaw`UPDATE peak_suggestions SET status = 'rejected' WHERE id = ${req.params.id}`;
      if (suggestion.user_id) {
        try {
          const notifContent = `您提交的山峰「${suggestion.name}」未通过审核${reason ? '：' + reason : ''}`;
          await prisma.$executeRaw`INSERT INTO notifications (user_id, type, content) VALUES (${suggestion.user_id}, 'peak_suggestion_rejected', ${notifContent})`;
        } catch(e) {}
      }
      res.json({ success: true, message: '已拒绝' });
    } else {
      res.status(400).json({ error: 'action 必须为 approve 或 reject' });
    }
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// ── 攀登线路管理 ─────────────────────────────────────────────────────────────

// GET /api/admin/routes — 攀登线路列表
router.get('/routes', adminWriteLimiter, adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const routes = await prisma.$queryRaw`
      SELECT id, name, peak, difficulty, region, altitude, duration_days, best_season, status, created_at
      FROM climbing_routes ORDER BY created_at DESC LIMIT ${parseInt(limit)} OFFSET ${offset}
    `;
    const total = Number((await prisma.$queryRaw`SELECT COUNT(*) as c FROM climbing_routes`)[0].c);
    res.json({ routes, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/admin/routes — 新建攀登线路
router.post('/routes', adminWriteLimiter, adminAuth, async (req, res) => {
  try {
    const { name, peak, difficulty, region, altitude, duration_days, best_season, description } = req.body;
    if (!name) return res.status(400).json({ error: '线路名称不能为空' });
    const [{ id: newRouteId }] = await prisma.$queryRaw`
      INSERT INTO climbing_routes (name, peak, difficulty, region, altitude, duration_days, best_season, description, status)
      VALUES (${name}, ${peak || null}, ${difficulty || null}, ${region || null},
              ${altitude ? parseInt(altitude) : null}, ${duration_days ? parseInt(duration_days) : null},
              ${best_season || null}, ${description || null}, 'active')
      RETURNING id
    `;
    const route = (await prisma.$queryRaw`SELECT * FROM climbing_routes WHERE id = ${newRouteId}`)[0];
    res.json(route);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/admin/routes/:id — 编辑攀登线路
router.put('/routes/:id', adminWriteLimiter, adminAuth, async (req, res) => {
  try {
    const route = (await prisma.$queryRaw`SELECT * FROM climbing_routes WHERE id = ${req.params.id}`)[0];
    if (!route) return res.status(404).json({ error: '线路不存在' });
    const body = req.body;
    const name = 'name' in body ? (body.name || null) : route.name;
    if ('name' in body && !body.name) return res.status(400).json({ error: '线路名称不能为空' });
    const peak = 'peak' in body ? (body.peak || null) : route.peak;
    const difficulty = 'difficulty' in body ? (body.difficulty || null) : route.difficulty;
    const region = 'region' in body ? (body.region || null) : route.region;
    const altitude = 'altitude' in body ? (body.altitude ? parseInt(body.altitude) : null) : route.altitude;
    const duration_days = 'duration_days' in body ? (body.duration_days ? parseInt(body.duration_days) : null) : route.duration_days;
    const best_season = 'best_season' in body ? (body.best_season || null) : route.best_season;
    const description = 'description' in body ? (body.description || null) : route.description;
    await prisma.$executeRaw`
      UPDATE climbing_routes SET
        name = ${name},
        peak = ${peak},
        difficulty = ${difficulty},
        region = ${region},
        altitude = ${altitude},
        duration_days = ${duration_days},
        best_season = ${best_season},
        description = ${description}
      WHERE id = ${req.params.id}
    `;
    const updated = (await prisma.$queryRaw`SELECT * FROM climbing_routes WHERE id = ${req.params.id}`)[0];
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// DELETE /api/admin/routes/:id — 删除攀登线路
router.delete('/routes/:id', adminWriteLimiter, adminAuth, async (req, res) => {
  try {
    const route = (await prisma.$queryRaw`SELECT id, name FROM climbing_routes WHERE id = ${req.params.id}`)[0];
    if (!route) return res.status(404).json({ error: '线路不存在' });
    await prisma.$executeRaw`DELETE FROM climbing_routes WHERE id = ${req.params.id}`;
    res.json({ success: true, deleted: route.name });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// ── 攻略管理 ─────────────────────────────────────────────────────────────────

// GET /api/admin/articles — 攻略列表（含审核状态）
router.get('/articles', adminWriteLimiter, adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, status = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let sql = `
      SELECT a.id, a.title, a.category, a.status, a.view_count, a.like_count,
             a.created_at, a.reviewed_at, a.reject_reason,
             u.name as author_name
      FROM articles a
      LEFT JOIN users u ON u.id = a.author_id
    `;
    const params = [];
    if (status) { sql += ' WHERE a.status = ?'; params.push(status); }
    sql += ' ORDER BY a.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);
    const rows = await prisma.$queryRawUnsafe(sql, ...params);
    const countSql = status
      ? 'SELECT COUNT(*) as c FROM articles WHERE status = ?'
      : 'SELECT COUNT(*) as c FROM articles';
    const total = Number((await prisma.$queryRawUnsafe(countSql, ...(status ? [status] : [])))[0].c);
    res.json({ articles: rows, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/admin/articles/:id/review — 审核攻略（approve/reject）
router.put('/articles/:id/review', adminWriteLimiter, adminAuth, async (req, res) => {
  try {
    const { action, reason } = req.body;
    const article = (await prisma.$queryRaw`SELECT id, title, author_id FROM articles WHERE id = ${req.params.id}`)[0];
    if (!article) return res.status(404).json({ error: '攻略不存在' });
    if (action === 'approve') {
      await prisma.$executeRaw`UPDATE articles SET status = 'published', reviewed_at = CURRENT_TIMESTAMP, reject_reason = NULL WHERE id = ${req.params.id}`;
      if (article.author_id) {
        try {
          const notifContent = `您发布的攻略「${article.title}」已通过审核并公开展示`;
          await prisma.$executeRaw`INSERT INTO notifications (user_id, type, content) VALUES (${article.author_id}, 'article_approved', ${notifContent})`;
        } catch(e) {}
      }
    } else if (action === 'reject') {
      const rejectReason = reason || '内容不符合规范';
      await prisma.$executeRaw`UPDATE articles SET status = 'rejected', reviewed_at = CURRENT_TIMESTAMP, reject_reason = ${rejectReason} WHERE id = ${req.params.id}`;
      if (article.author_id) {
        try {
          const notifContent = `您发布的攻略「${article.title}」未通过审核${reason ? '：' + reason : ''}`;
          await prisma.$executeRaw`INSERT INTO notifications (user_id, type, content) VALUES (${article.author_id}, 'article_rejected', ${notifContent})`;
        } catch(e) {}
      }
    } else {
      return res.status(400).json({ error: 'action 必须为 approve 或 reject' });
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// DELETE /api/admin/articles/:id — 删除攻略
router.delete('/articles/:id', adminWriteLimiter, adminAuth, async (req, res) => {
  try {
    const article = (await prisma.$queryRaw`SELECT id, title FROM articles WHERE id = ${req.params.id}`)[0];
    if (!article) return res.status(404).json({ error: '攻略不存在' });
    await prisma.$executeRaw`DELETE FROM articles WHERE id = ${req.params.id}`;
    res.json({ success: true, deleted: article.title });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/admin/sos-records — 查看所有SOS救援记录
router.get('/sos-records', adminWriteLimiter, adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, status = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let sql = `
      SELECT s.id, s.user_id, u.name as user_name, u.phone as user_phone,
             s.location, s.peak_name, s.message, s.status, s.timestamp
      FROM sos_records s
      LEFT JOIN users u ON u.id = s.user_id
    `;
    const params = [];
    if (status) { sql += ' WHERE s.status = ?'; params.push(status); }
    sql += ' ORDER BY s.timestamp DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);
    const records = await prisma.$queryRawUnsafe(sql, ...params);
    const countSql = status
      ? 'SELECT COUNT(*) as c FROM sos_records WHERE status = ?'
      : 'SELECT COUNT(*) as c FROM sos_records';
    const total = Number((await prisma.$queryRawUnsafe(countSql, ...(status ? [status] : [])))[0].c);
    res.json({ records, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/admin/sos-records/:id/status — 更新SOS处理状态
router.put('/sos-records/:id/status', adminWriteLimiter, adminAuth, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending', 'processing', 'resolved'].includes(status)) {
      return res.status(400).json({ error: '无效状态，有效值: pending|processing|resolved' });
    }
    const affected = await prisma.$executeRaw`UPDATE sos_records SET status = ${status} WHERE id = ${req.params.id}`;
    if (affected === 0) return res.status(404).json({ error: 'SOS记录不存在' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/admin/withdrawals — 提现申请管理
router.get('/withdrawals', adminWriteLimiter, adminAuth, async (req, res) => {
  try {
    const { status = '', page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let sql = 'SELECT * FROM withdrawal_requests';
    const params = [];
    if (status) { sql += ' WHERE status = ?'; params.push(status); }
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);
    const requests = await prisma.$queryRawUnsafe(sql, ...params);
    const countSql = status ? 'SELECT COUNT(*) as c FROM withdrawal_requests WHERE status = ?' : 'SELECT COUNT(*) as c FROM withdrawal_requests';
    const total = Number((await prisma.$queryRawUnsafe(countSql, ...(status ? [status] : [])))[0].c);
    res.json({ requests, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/admin/withdrawals/:id/approve — 批准提现
router.put('/withdrawals/:id/approve', adminWriteLimiter, adminAuth, async (req, res) => {
  try {
    const request = (await prisma.$queryRaw`SELECT * FROM withdrawal_requests WHERE id = ${req.params.id}`)[0];
    if (!request) return res.status(404).json({ error: '提现申请不存在' });
    if (request.status !== 'pending') return res.status(400).json({ error: '该申请已处理' });
    const now = new Date().toISOString();
    await prisma.$executeRaw`UPDATE withdrawal_requests SET status = 'approved', processed_at = ${now}, processed_by = 'admin' WHERE id = ${req.params.id}`;
    res.json({ success: true, message: `已批准提现 ${request.actual_amount} 元` });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/admin/withdrawals/:id/reject — 拒绝提现
router.put('/withdrawals/:id/reject', adminWriteLimiter, adminAuth, async (req, res) => {
  try {
    const { reason = '' } = req.body;
    const request = (await prisma.$queryRaw`SELECT * FROM withdrawal_requests WHERE id = ${req.params.id}`)[0];
    if (!request) return res.status(404).json({ error: '提现申请不存在' });
    if (request.status !== 'pending') return res.status(400).json({ error: '该申请已处理' });
    const now = new Date().toISOString();
    await prisma.$executeRaw`UPDATE withdrawal_requests SET status = 'rejected', processed_at = ${now}, processed_by = 'admin', reject_reason = ${reason} WHERE id = ${req.params.id}`;
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
