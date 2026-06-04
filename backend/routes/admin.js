const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const prisma = require('../db/prisma');
const adminAuth = require('../middleware/adminAuth');
const devOnly = require('../middleware/devOnly');
const { GUIDE_CERT_LEVELS, CLUB_CERT_LEVELS } = require('../utils/certLevels');
const { sendMail, certificationResultEmail } = require('../middleware/mailer');
const PDFDocument = require('pdfkit');
const stripeConnect = require('../lib/payment/stripe-connect');
const { captureEvent } = require('../middleware/sentry');
const { getJwtSecret } = require('../utils/jwtSecret');
const { sendPushToUser } = require('../lib/pushSender');


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

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_REGION = 'cn';
const SAFE_TABLES = new Set([
  'orders',
  'users',
  'invite_codes',
  'platform_expeditions',
  'guide_applications',
  'club_applications',
  'guides',
  'clubs',
  'sos_alerts',
  'bookings',
  'climbing_routes',
  'expedition_orders',
  'expeditions',
  'moderation_logs',
  'withdrawal_requests',
  'disputes',
  'merchant_kyc',
]);
const INSURANCE_INQUIRY_STATUS_VALUES = new Set(['pending', 'issued', 'cancelled', 'claimed', 'claim_settled']);
const INVITE_CODE_OPTIONAL_COLUMNS = {
  max_uses: true,
  used_count: true,
  expires_at: true,
  region: true,
  tier: true,
  notes: true,
  created_by: true,
};
let postgresAdminOpsBootstrapPromise = null;

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

function parsePositiveInt(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function roundAmount(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function periodToDays(period) {
  return ({ '7d': 7, '30d': 30, '90d': 90 }[period] || 7);
}

function startOfUtcDay(value) {
  const date = new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function startOfUtcWeek(value) {
  const date = startOfUtcDay(value);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date;
}

function formatBucketDate(value) {
  return startOfUtcDay(value).toISOString().slice(0, 10);
}

function buildChartDates(period, endDate) {
  const days = periodToDays(period);
  const step = period === '90d' ? 7 : 1;
  const dates = [];
  const end = startOfUtcDay(endDate);
  const start = new Date(end.getTime() - (days - 1) * DAY_MS);
  const cursor = period === '90d' ? startOfUtcWeek(start) : startOfUtcDay(start);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + step);
  }
  return dates;
}

function isPostgresDatabase() {
  return (process.env.DATABASE_PROVIDER || '').toLowerCase() === 'postgresql';
}

async function getTableColumns(tableName) {
  if (!SAFE_TABLES.has(tableName)) return [];
  try {
    if (isPostgresDatabase()) {
      const rows = await prisma.$queryRaw`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = ${tableName}
      `;
      return rows.map((row) => row.column_name);
    }
    const rows = await prisma.$queryRawUnsafe(`PRAGMA table_info(${tableName})`);
    return rows.map((row) => row.name);
  } catch (_) {
    return [];
  }
}

function isMissingTableError(error) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('no such table') || message.includes("doesn't exist") || message.includes('does not exist');
}

async function ensureAdminOpsTables() {
  if (isPostgresDatabase()) {
    if (!postgresAdminOpsBootstrapPromise) {
      postgresAdminOpsBootstrapPromise = (async () => {
        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS disputes (
            id SERIAL PRIMARY KEY,
            order_id INTEGER UNIQUE,
            user_id INTEGER,
            order_no TEXT,
            type TEXT DEFAULT 'complaint',
            status TEXT DEFAULT 'open',
            resolution TEXT,
            refund_amount REAL DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            resolved_at TIMESTAMPTZ
          )
        `);
        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS platform_config (
            config_key TEXT PRIMARY KEY,
            config_value TEXT NOT NULL,
            updated_at TIMESTAMPTZ DEFAULT NOW()
          )
        `);
        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS invite_codes (
            id SERIAL PRIMARY KEY,
            code TEXT UNIQUE NOT NULL,
            max_uses INTEGER DEFAULT 1,
            used_count INTEGER DEFAULT 0,
            expires_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW()
          )
        `);
        const inviteColumns = await getTableColumns('invite_codes');
        if (inviteColumns.length > 0) {
          if (!inviteColumns.includes('max_uses')) {
            await prisma.$executeRawUnsafe('ALTER TABLE invite_codes ADD COLUMN IF NOT EXISTS max_uses INTEGER DEFAULT 1');
          }
          if (!inviteColumns.includes('used_count')) {
            await prisma.$executeRawUnsafe('ALTER TABLE invite_codes ADD COLUMN IF NOT EXISTS used_count INTEGER DEFAULT 0');
          }
          if (!inviteColumns.includes('expires_at')) {
            await prisma.$executeRawUnsafe('ALTER TABLE invite_codes ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ');
          }
          if (!inviteColumns.includes('created_at')) {
            await prisma.$executeRawUnsafe('ALTER TABLE invite_codes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()');
          }
        }
      })();
    }
    try {
      await postgresAdminOpsBootstrapPromise;
    } catch (error) {
      postgresAdminOpsBootstrapPromise = null;
      throw error;
    }
  } else {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS disputes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER UNIQUE,
        user_id INTEGER,
        order_no TEXT,
        type TEXT DEFAULT 'complaint',
        status TEXT DEFAULT 'open',
        resolution TEXT,
        refund_amount REAL DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        resolved_at TEXT
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS platform_config (
        config_key TEXT PRIMARY KEY,
        config_value TEXT NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS invite_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        max_uses INTEGER DEFAULT 1,
        used_count INTEGER DEFAULT 0,
        expires_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const inviteColumns = await getTableColumns('invite_codes');
    if (inviteColumns.length > 0) {
      if (!inviteColumns.includes('max_uses')) {
        await prisma.$executeRawUnsafe('ALTER TABLE invite_codes ADD COLUMN max_uses INTEGER DEFAULT 1');
      }
      if (!inviteColumns.includes('used_count')) {
        await prisma.$executeRawUnsafe('ALTER TABLE invite_codes ADD COLUMN used_count INTEGER DEFAULT 0');
      }
      if (!inviteColumns.includes('expires_at')) {
        await prisma.$executeRawUnsafe('ALTER TABLE invite_codes ADD COLUMN expires_at TEXT');
      }
      if (!inviteColumns.includes('created_at')) {
        await prisma.$executeRawUnsafe('ALTER TABLE invite_codes ADD COLUMN created_at TEXT DEFAULT CURRENT_TIMESTAMP');
      }
    }
  }
}

async function getPlatformConfigValue(key, fallback) {
  try {
    await ensureAdminOpsTables();
    const row = (await prisma.$queryRaw`SELECT config_value FROM platform_config WHERE config_key = ${key}`)[0];
    if (row && row.config_value !== undefined && row.config_value !== null) {
      const value = Number(row.config_value);
      if (Number.isFinite(value)) return value;
    }
  } catch (_) {}
  return fallback;
}

async function setPlatformConfigValue(key, value) {
  await ensureAdminOpsTables();
  await prisma.$executeRawUnsafe(
    `INSERT INTO platform_config (config_key, config_value, updated_at)
     VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(config_key) DO UPDATE SET
       config_value = excluded.config_value,
       updated_at = CURRENT_TIMESTAMP`,
    key,
    String(value)
  );
}

async function syncDisputesFromOrders() {
  await ensureAdminOpsTables();
  const orderColumns = await getTableColumns('orders');
  if (!orderColumns.length) return;
  try {
    await prisma.$executeRawUnsafe(`
      INSERT INTO disputes (order_id, user_id, order_no, type, status, created_at)
      SELECT o.id,
             o.user_id,
             o.order_no,
             'order_dispute',
             'open',
             o.created_at
      FROM orders o
      WHERE o.status = 'disputed'
        AND NOT EXISTS (
          SELECT 1 FROM disputes d WHERE d.order_id = o.id
        )
    `);
  } catch (_) {}
}

async function createInviteCodes(req, res) {
  await ensureAdminOpsTables();
  const columns = await getTableColumns('invite_codes');
  const count = Math.min(parsePositiveInt(req.body?.count, 1), 50);
  const maxUses = parsePositiveInt(req.body?.max_uses, 1);
  const expiresAt = req.body?.expires_at || req.body?.expiresAt || null;
  const prefix = String(req.body?.prefix || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 12);
  const generated = [];
  let attempts = 0;

  while (generated.length < count && attempts < count * 20) {
    attempts += 1;
    const code = `${prefix}${crypto.randomBytes(16).toString('hex').toUpperCase()}`;
    const insertColumns = ['code'];
    const values = [code];
    if (columns.includes('max_uses')) {
      insertColumns.push('max_uses');
      values.push(maxUses);
    }
    if (columns.includes('used_count')) {
      insertColumns.push('used_count');
      values.push(0);
    }
    if (columns.includes('expires_at')) {
      insertColumns.push('expires_at');
      values.push(expiresAt);
    }
    if (columns.includes('region')) {
      insertColumns.push('region');
      values.push(req.body?.region || 'all');
    }
    if (columns.includes('tier')) {
      insertColumns.push('tier');
      values.push(req.body?.tier || 'normal');
    }
    if (columns.includes('notes')) {
      insertColumns.push('notes');
      values.push(req.body?.notes || null);
    }
    if (columns.includes('created_by')) {
      insertColumns.push('created_by');
      values.push(req.admin?.username || 'admin');
    }
    const invalidColumn = insertColumns.find((column) => column !== 'code' && !INVITE_CODE_OPTIONAL_COLUMNS[column]);
    if (invalidColumn) {
      throw new Error(`邀请码表结构异常: 未知列 ${invalidColumn}`);
    }
    try {
      const placeholders = insertColumns.map(() => '?').join(', ');
      await prisma.$executeRawUnsafe(
        `INSERT INTO invite_codes (${insertColumns.join(', ')}) VALUES (${placeholders})`,
        ...values
      );
      generated.push(code);
    } catch (err) {
      if (!String(err.message || '').toLowerCase().includes('unique')) throw err;
    }
  }

  res.json({ success: true, codes: generated });
}

// POST /api/admin/login
router.post('/login', adminLoginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body || {};
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      console.error('[admin/login] ADMIN_PASSWORD not configured');
      return res.status(500).json({ error: '管理员账号未配置' });
    }
    const userOk = timingSafeEqual(username, adminUsername);
    const passOk = timingSafeEqual(password, adminPassword);
    if (!userOk || !passOk) {
      console.warn('[admin/login] Failed login attempt for user:', username);
      return res.status(401).json({ error: '用户名或密码错误' });
    }
    const token = jwt.sign({ isAdmin: true, username }, getJwtSecret(), { expiresIn: '7d' });
    res.cookie('adminToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });
    res.json({
      success: true,
      message: '登录成功',
      token,
      expiresIn: 7 * 24 * 60 * 60
    });
    console.log('[admin/login] Successful login for user:', username);
  } catch (e) {
    console.error('[admin/login] Error:', e.message);
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
/**
 * @swagger
 * /api/admin/stats:
 *   get:
 *     tags: [管理员]
 *     summary: 获取管理端统计概览
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 返回管理统计数据
 *       401:
 *         description: 未授权
 */
router.get('/stats', adminWriteLimiter, adminAuth, async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    let totalUsers = 0, totalPosts = 0, totalOrders = 0, totalClubs = 0, totalBookings = 0;
    let newUsersToday = 0, pendingPosts = 0, pendingGuides = 0, pendingBookings = 0;
    try { totalUsers = Number((await prisma.$queryRaw`SELECT COUNT(*) as c FROM users`)[0].c); } catch(e) { if (isMissingTableError(e)) { console.warn('admin/stats users query failed:', e.message); } else { throw e; } }
    try { totalPosts = Number((await prisma.$queryRaw`SELECT COUNT(*) as c FROM posts`)[0].c); } catch(e) { if (isMissingTableError(e)) { console.warn('admin/stats posts query failed:', e.message); } else { throw e; } }
    try { totalOrders = Number((await prisma.$queryRaw`SELECT COUNT(*) as c FROM orders`)[0].c); } catch(e) { if (isMissingTableError(e)) { console.warn('admin/stats orders query failed:', e.message); } else { throw e; } }
    try { totalClubs = Number((await prisma.$queryRaw`SELECT COUNT(*) as c FROM clubs`)[0].c); } catch(e) { if (isMissingTableError(e)) { console.warn('admin/stats clubs query failed:', e.message); } else { throw e; } }
    try { totalBookings = Number((await prisma.$queryRaw`SELECT COUNT(*) as c FROM bookings`)[0].c); } catch(e) { if (isMissingTableError(e)) { console.warn('admin/stats bookings query failed:', e.message); } else { throw e; } }
    try { newUsersToday = Number((await prisma.$queryRaw`SELECT COUNT(*) as c FROM users WHERE date(created_at) = ${today}`)[0].c); } catch(e) { if (isMissingTableError(e)) { console.warn('admin/stats newUsersToday query failed:', e.message); } else { throw e; } }
    try { pendingPosts = Number((await prisma.$queryRaw`SELECT COUNT(*) as c FROM posts WHERE status = 'pending'`)[0].c); } catch(e) { if (isMissingTableError(e)) { console.warn('admin/stats pendingPosts query failed:', e.message); } else { throw e; } }
    try { pendingGuides = Number((await prisma.$queryRaw`SELECT COUNT(*) as c FROM guide_applications WHERE status = 'pending'`)[0].c); } catch(e) { if (isMissingTableError(e)) { console.warn('admin/stats pendingGuides query failed:', e.message); } else { throw e; } }
    try { pendingBookings = Number((await prisma.$queryRaw`SELECT COUNT(*) as c FROM bookings WHERE status = 'pending'`)[0].c); } catch(e) { if (isMissingTableError(e)) { console.warn('admin/stats pendingBookings query failed:', e.message); } else { throw e; } }
    let pendingSos = 0;
    let pendingWithdrawals = 0;
    let stripeRevenue = 0;
    let stripeTransactions = 0;
    try { pendingSos = Number((await prisma.$queryRaw`SELECT COUNT(*) as c FROM sos_records WHERE status = 'pending'`)[0].c); } catch(e) {}
    try { pendingWithdrawals = Number((await prisma.$queryRaw`SELECT COUNT(*) as c FROM withdrawal_requests WHERE status = 'pending'`)[0].c); } catch(e) {}
    try {
      const sr = (await prisma.$queryRaw`SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as cnt FROM stripe_payments WHERE status = 'paid'`)[0];
      stripeRevenue = Number(sr.total) || 0;
      stripeTransactions = Number(sr.cnt) || 0;
    } catch(e) { console.warn('admin/stats stripe_payments query failed (non-fatal):', e.message); }
    // Real-time KPI fields (today active users, week revenue, SOS count, avg rating)
    let activeUsersToday = newUsersToday;
    let weekRevenue = 0;
    let sosCount = pendingSos;
    let avgRating = null;
    try {
      const [row] = await prisma.$queryRaw`SELECT COUNT(DISTINCT user_id) as cnt FROM notifications WHERE date(created_at) = ${today}`.catch(() => [{ cnt: 0 }]);
      activeUsersToday = Number(row?.cnt || 0);
    } catch(e) {}
    try {
      const [row] = await prisma.$queryRaw`SELECT COALESCE(SUM(amount), 0) as total FROM orders WHERE status = 'paid' AND date(created_at) >= ${weekAgo}`.catch(() => [{ total: 0 }]);
      weekRevenue = Number(row?.total || 0);
    } catch(e) {}
    try {
      const [row] = await prisma.$queryRaw`SELECT COUNT(*) as cnt FROM sos_alerts WHERE date(created_at) >= ${weekAgo}`.catch(() => [{ cnt: 0 }]);
      sosCount = Number(row?.cnt || 0);
    } catch(e) {}
    try {
      const [row] = await prisma.$queryRaw`SELECT ROUND(AVG(rating), 1) as avg FROM guide_reviews`.catch(() => [{ avg: null }]);
      avgRating = row?.avg ? Number(row.avg) : null;
    } catch(e) {}
    res.json({ totalUsers, totalPosts, totalOrders, totalClubs, totalBookings, newUsersToday, pendingPosts, pendingGuides, pendingBookings, pendingSos, pendingWithdrawals, stripeRevenue, stripeTransactions, activeUsersToday, weekRevenue, sosCount, avgRating });
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
    // 异步发送认证结果邮件
    prisma.$queryRaw`SELECT name, email FROM users WHERE id = ${app.user_id}`.then(rows => {
      const u = rows[0];
      if (u?.email) sendMail({ to: u.email, ...certificationResultEmail({ userName: u.name || app.name, type: 'guide', status: 'approved', reviewNote: '' }) }).catch(() => {});
    }).catch(() => {});
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
    // 异步发送认证结果邮件
    const reason = req.body?.reason || '';
    prisma.$queryRaw`SELECT name, email FROM users WHERE id = ${app.user_id}`.then(rows => {
      const u = rows[0];
      if (u?.email) sendMail({ to: u.email, ...certificationResultEmail({ userName: u.name || app.name, type: 'guide', status: 'rejected', reviewNote: reason }) }).catch(() => {});
    }).catch(() => {});
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

// GET /api/admin/insurance-inquiries
router.get('/insurance-inquiries', adminAuth, async (req, res) => {
  try {
    const page = parsePositiveInt(req.query.page, 1);
    const limit = Math.min(parsePositiveInt(req.query.limit, 20), 100);
    const offset = (page - 1) * limit;
    const status = String(req.query.status || '').trim();
    if (status && !INSURANCE_INQUIRY_STATUS_VALUES.has(status)) {
      return res.status(400).json({ error: '无效 status' });
    }

    const whereClause = status ? 'WHERE status = ?' : '';
    const params = status ? [status, limit, offset] : [limit, offset];
    const inquiries = await prisma.$queryRawUnsafe(`
      SELECT
        id, user_id, plan_name, name, phone, peak_name, departure_date,
        status, policy_no, issued_at, provider_ref, claim_status, created_at
      FROM insurance_inquiries
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `, ...params);

    const totalSql = status
      ? 'SELECT COUNT(*) as c FROM insurance_inquiries WHERE status = ?'
      : 'SELECT COUNT(*) as c FROM insurance_inquiries';
    const totalRow = (await prisma.$queryRawUnsafe(totalSql, ...(status ? [status] : [])))[0];
    const total = Number(totalRow?.c || 0);

    res.json({ inquiries, total, page, limit });
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
    await prisma.$executeRaw`UPDATE clubs SET status = 'revoked', verified = false, cert_expires_at = NULL, listing_fee_paid = false WHERE id = ${req.params.id}`;
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
    await prisma.$executeRaw`UPDATE guides SET status = 'revoked', cert_expires_at = NULL, listing_fee_paid = false WHERE id = ${req.params.id}`;
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
    const page = parsePositiveInt(req.query.page, 1);
    const limit = Math.min(parsePositiveInt(req.query.limit, 20), 100);
    const status = String(req.query.status || '').trim();
    const offset = (page - 1) * limit;
    let sql = `SELECT b.id, b.user_id, u.name as user_name, b.mountain,
               b.guide_name, b.club_name, b.type, b.date, b.members, b.amount, b.status,
               b.confirmed_at, b.rejected_reason, b.created_at
               FROM bookings b LEFT JOIN users u ON u.id = b.user_id`;
    const params = [];
    if (status) { sql += ' WHERE b.status = ?'; params.push(status); }
    sql += ' ORDER BY b.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    const bookings = await prisma.$queryRawUnsafe(sql, ...params);
    const countSql = status ? 'SELECT COUNT(*) as c FROM bookings WHERE status = ?' : 'SELECT COUNT(*) as c FROM bookings';
    const countParams = status ? [status] : [];
    const total = Number((await prisma.$queryRawUnsafe(countSql, ...countParams))[0].c);
    res.json({ bookings, total, page, limit });
  } catch (e) {
    if (isMissingTableError(e)) {
      const page = parsePositiveInt(req.query.page, 1);
      const limit = Math.min(parsePositiveInt(req.query.limit, 20), 100);
      return res.json({ bookings: [], total: 0, page, limit });
    }
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/admin/bookings/:id/status
router.put('/bookings/:id/status', adminWriteLimiter, adminAuth, async (req, res) => {
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
    const status = String(req.query.status || '').trim();
    const page = parsePositiveInt(req.query.page, 1);
    const limit = Math.min(parsePositiveInt(req.query.limit, 20), 100);
    const offset = (page - 1) * limit;
    let sql = `
      SELECT
        id,
        COALESCE(name, club_name) AS name,
        region,
        specialty,
        contact,
        status,
        created_at
      FROM club_applications
    `;
    const params = [];
    if (status) { sql += ' WHERE status = ?'; params.push(status); }
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    const applications = await prisma.$queryRawUnsafe(sql, ...params);
    const countSql = status ? 'SELECT COUNT(*) as c FROM club_applications WHERE status = ?' : 'SELECT COUNT(*) as c FROM club_applications';
    const countParams = status ? [status] : [];
    const total = Number((await prisma.$queryRawUnsafe(countSql, ...countParams))[0].c);
    res.json({ applications, total, page, limit });
  } catch (e) {
    if (isMissingTableError(e)) {
      return res.json({ applications: [], total: 0, page: 1, limit: 20 });
    }
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
    // 异步发送认证结果邮件
    prisma.$queryRaw`SELECT name, email FROM users WHERE id = ${app.user_id}`.then(rows => {
      const u = rows[0];
      if (u?.email) sendMail({ to: u.email, ...certificationResultEmail({ userName: u.name || app.name, type: 'club', status: 'approved', reviewNote: '' }) }).catch(() => {});
    }).catch(() => {});
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/admin/club-applications/:id/reject — 拒绝俱乐部申请
router.post('/club-applications/:id/reject', adminWriteLimiter, adminAuth, async (req, res) => {
  try {
    const { reason = '' } = req.body;
    const app = (await prisma.$queryRaw`SELECT id, user_id, name FROM club_applications WHERE id = ${req.params.id}`)[0];
    if (!app) return res.status(404).json({ error: '申请不存在' });
    await prisma.$executeRaw`UPDATE club_applications SET status = 'rejected', reject_reason = ${reason} WHERE id = ${req.params.id}`;
    res.json({ success: true });
    // 异步发送认证结果邮件
    prisma.$queryRaw`SELECT name, email FROM users WHERE id = ${app.user_id}`.then(rows => {
      const u = rows[0];
      if (u?.email) sendMail({ to: u.email, ...certificationResultEmail({ userName: u.name || app.name, type: 'club', status: 'rejected', reviewNote: reason }) }).catch(() => {});
    }).catch(() => {});
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
    try {
      const [expedition] = await prisma.$queryRaw`SELECT id, title, publisher_type, publisher_id FROM expeditions WHERE id = ${Number(req.params.id)}`;
      if (expedition) {
        let notifyUserId = null;
        if (expedition.publisher_type === 'guide') {
          const [guide] = await prisma.$queryRaw`SELECT user_id FROM guides WHERE id = ${expedition.publisher_id}`;
          if (guide) notifyUserId = guide.user_id;
        } else if (expedition.publisher_type === 'club') {
          const [club] = await prisma.$queryRaw`SELECT creator_id FROM clubs WHERE id = ${expedition.publisher_id}`;
          if (club) notifyUserId = club.creator_id;
        }
        if (notifyUserId) {
          const content = `【远征审核通过】您发布的远征 ${expedition.title} 已审核通过并上架`;
          await prisma.$executeRaw`INSERT INTO notifications (user_id, type, content, related_id) VALUES (${notifyUserId}, 'expedition_approved', ${content}, ${expedition.id})`;
          await sendPushToUser(notifyUserId, {
            title: '远征审核通过',
            body: `${expedition.title} 已审核通过并上架`,
            data: { type: 'expedition_approved', expeditionId: expedition.id },
          });
        }
      }
    } catch (e) {
      console.warn('[admin/expeditions/approve] 通知失败:', e.message);
    }
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

// PUT /api/admin/expeditions/:id/status — 管理员更新远征状态（如下架 closed）
router.put('/expeditions/:id/status', adminWriteLimiter, adminAuth, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['published', 'pending', 'closed', 'rejected'].includes(status)) return res.status(400).json({ error: '无效状态值' });
    const affected = await prisma.$executeRaw`UPDATE expeditions SET status = ${status}, updated_at = ${new Date().toISOString()} WHERE id = ${Number(req.params.id)}`;
    if (affected === 0) return res.status(404).json({ error: '远征不存在' });
    res.json({ success: true, status });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// ── A9: 验证码查看器（内测用）────────────────────────────────────

// GET /api/admin/sms-codes — 查看最近50条验证码（仅管理员，内测用）
router.get('/sms-codes', adminLoginLimiter, devOnly, adminAuth, async (req, res) => {
  // 生产环境禁用 - 安全漏洞，仅内测使用
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }
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
router.get('/expedition-orders', adminAuth, async (req, res) => {
  try {
    const status = String(req.query.status || '').trim();
    const page = parsePositiveInt(req.query.page, 1);
    const limit = Math.min(parsePositiveInt(req.query.limit, 20), 100);
    const offset = (page - 1) * limit;
    const expeditionColumns = await getTableColumns('expeditions');
    const usersExist = (await getTableColumns('users')).length > 0;
    const expeditionTitleExpr = expeditionColumns.includes('title')
      ? (expeditionColumns.includes('peak_name') ? 'COALESCE(e.title, e.peak_name)' : expeditionColumns.includes('name') ? 'COALESCE(e.title, e.name)' : 'e.title')
      : expeditionColumns.includes('name') ? 'e.name' : expeditionColumns.includes('peak_name') ? 'e.peak_name' : 'NULL';
    let sql = `
      SELECT o.id, o.user_id, o.expedition_id, o.status, o.total, o.created_at, o.contact_name, o.contact_phone, o.participants,
             ${expeditionColumns.length > 0 ? `${expeditionTitleExpr} AS expedition_title` : 'NULL AS expedition_title'},
             ${usersExist ? 'u.name AS user_name' : 'NULL AS user_name'}
      FROM expedition_orders o
      ${expeditionColumns.length > 0 ? 'LEFT JOIN expeditions e ON e.id = o.expedition_id' : ''}
      ${usersExist ? 'LEFT JOIN users u ON u.id = o.user_id' : ''}
    `;
    const params = [];
    if (status) { sql += ' WHERE o.status = ?'; params.push(status); }
    sql += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    const orders = await prisma.$queryRawUnsafe(sql, ...params);
    const countSql = status ? 'SELECT COUNT(*) c FROM expedition_orders WHERE status=?' : 'SELECT COUNT(*) c FROM expedition_orders';
    const total = Number((await prisma.$queryRawUnsafe(countSql, ...(status ? [status] : [])))[0].c);
    res.json({ orders, total, page, limit });
  } catch (e) {
    if (isMissingTableError(e)) {
      const page = parsePositiveInt(req.query.page, 1);
      const limit = Math.min(parsePositiveInt(req.query.limit, 20), 100);
      return res.json({ orders: [], total: 0, page, limit });
    }
    res.status(500).json({ error: '服务器错误' });
  }
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
  } catch (e) {
    if (isMissingTableError(e)) {
      return res.status(404).json({ error: '订单数据不存在' });
    }
    res.status(500).json({ error: '服务器错误' });
  }
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

// GET /api/admin/tracks/export-pdf — 导出全量轨迹汇总 PDF
router.get('/tracks/export-pdf', adminWriteLimiter, adminAuth, async (req, res) => {
  try {
    const tracks = await prisma.$queryRaw`
      SELECT id, name, peak_name, date, distance, distance_km, elevation, elevation_gain, max_elevation, points, created_at
      FROM tracks ORDER BY created_at DESC LIMIT 300
    `;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="tracks_report_${new Date().toISOString().slice(0, 10)}.pdf"`);
    const doc = new PDFDocument({ size: 'A4', margin: 36 });
    doc.pipe(res);
    doc.fontSize(18).text('SummitLink Tracks Summary Report');
    doc.fontSize(10).fillColor('#666').text(`Generated at: ${new Date().toISOString()}`);
    doc.fillColor('black').moveDown(0.8);

    tracks.forEach((track, idx) => {
      if (doc.y > 720) doc.addPage();
      const points = parseTrackPointsSafe(track.points);
      const chart = buildAsciiChartForAdmin(points);
      doc.fontSize(12).text(`${idx + 1}. #${track.id} ${track.name || track.peak_name || '未命名轨迹'}`);
      doc.fontSize(10).text(
        `Date: ${track.date || String(track.created_at || '').slice(0, 10)} | Distance: ${Number(track.distance_km || track.distance || 0).toFixed(2)} km | Gain: ${Number(track.elevation_gain || track.elevation || 0).toFixed(0)} m | Max: ${Number(track.max_elevation || 0).toFixed(0)} m`,
      );
      doc.font('Courier').fontSize(8).text(chart);
      doc.font('Helvetica').moveDown(0.6);
    });
    doc.end();
  } catch (e) {
    console.error('[admin/tracks/export-pdf] failed:', e && e.message ? e.message : e);
    res.status(500).json({ error: '导出失败' });
  }
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
router.get('/moderation-logs', adminAuth, async (req, res) => {
  try {
    const columns = await getTableColumns('moderation_logs');
    const hasAction = columns.includes('action');
    const hasTargetType = columns.includes('target_type');
    const hasTargetId = columns.includes('target_id');
    const hasOperator = columns.includes('operator');
    const hasNote = columns.includes('note');
    const hasReason = columns.includes('reason');
    const hasContentType = columns.includes('content_type');
    const hasContent = columns.includes('content');
    const hasAdminId = columns.includes('admin_id');
    const hasUserId = columns.includes('user_id');
    const page = parsePositiveInt(req.query.page, 1);
    const limit = Math.min(parsePositiveInt(req.query.limit, 20), 100);
    const offset = (page - 1) * limit;
    const logs = await prisma.$queryRawUnsafe(`
      SELECT
        id,
        ${hasAction ? 'action' : hasContentType ? 'content_type' : "''"} AS action,
        ${hasTargetType ? 'target_type' : hasContentType ? 'content_type' : 'NULL'} AS target_type,
        ${hasTargetId ? 'target_id' : 'NULL'} AS target_id,
        ${hasOperator ? 'operator' : hasAdminId ? 'admin_id' : hasUserId ? 'user_id' : 'NULL'} AS operator,
        ${hasNote ? 'note' : hasReason ? 'reason' : hasContent ? 'content' : 'NULL'} AS note,
        created_at
      FROM moderation_logs
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `, limit, offset);
    const total = Number((await prisma.$queryRaw`SELECT COUNT(*) c FROM moderation_logs`)[0].c);
    res.json({ logs, total });
  } catch (e) {
    if (isMissingTableError(e)) {
      return res.json({ logs: [], total: 0 });
    }
    res.status(500).json({ error: '服务器错误' });
  }
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
    const page = parsePositiveInt(req.query.page, 1);
    const limit = Math.min(parsePositiveInt(req.query.limit, 20), 100);
    const offset = (page - 1) * limit;
    const clubs = await prisma.$queryRaw`
      SELECT id, name, specialty, region, commercial_status, commercial_applied_at,
             commercial_reviewed_at, commercial_verified, commercial_reject_reason,
             business_license_url, business_license_no, insurance_cert_url,
             bank_account_name, bank_account_no, bank_name
      FROM clubs WHERE commercial_status != 'none'
      ORDER BY commercial_applied_at DESC LIMIT ${limit} OFFSET ${offset}
    `;
    const total = Number((await prisma.$queryRaw`SELECT COUNT(*) as c FROM clubs WHERE commercial_status != 'none'`)[0].c);
    const normalized = clubs.map((club) => ({ ...club, cert_url: club.business_license_url || null }));
    res.json({ clubs: normalized, total, page, limit });
  } catch (e) {
    if (isMissingTableError(e)) {
      return res.json({ clubs: [], total: 0, page: 1, limit: 20 });
    }
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/admin/clubs/:id/commercial-review — 审核俱乐部商业资质
router.post('/clubs/:id/commercial-review', adminWriteLimiter, adminAuth, async (req, res) => {
  try {
    const { action } = req.body;
    const reason = req.body?.reason ?? req.body?.note ?? '';
    const club = (await prisma.$queryRaw`SELECT * FROM clubs WHERE id = ${req.params.id}`)[0];
    if (!club) return res.status(404).json({ error: '俱乐部不存在' });
    if (action === 'approve') {
      await prisma.$executeRaw`UPDATE clubs SET commercial_verified=true, commercial_status='approved',
        commercial_reviewed_at=CURRENT_TIMESTAMP, commercial_reject_reason=NULL WHERE id=${req.params.id}`;
      // 通知俱乐部创建者
      try {
        const notifContent = `【资质审核通过】您的俱乐部 ${club.name} 商业资质已审核通过，可发布收费活动`;
        await prisma.$executeRaw`INSERT INTO notifications (user_id, type, content, related_id) VALUES (${club.creator_id}, 'commercial_approved', ${notifContent}, ${club.id})`;
      } catch(e) {}
    } else if (action === 'reject') {
      const rejectReason = reason || '资质不符合要求';
      await prisma.$executeRaw`UPDATE clubs SET commercial_verified=false, commercial_status='rejected',
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
  } catch (e) {
    if (isMissingTableError(e)) {
      return res.status(404).json({ error: '俱乐部数据不存在' });
    }
    res.status(500).json({ error: '服务器错误' });
  }
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
    const { action } = req.body;
    const reason = req.body?.reason ?? req.body?.note ?? '';
    const guide = (await prisma.$queryRaw`SELECT * FROM guides WHERE id = ${req.params.id}`)[0];
    if (!guide) return res.status(404).json({ error: '向导不存在' });
    if (action === 'approve') {
      await prisma.$executeRaw`UPDATE guides SET commercial_verified=true, commercial_status='approved',
        commercial_reviewed_at=CURRENT_TIMESTAMP, commercial_reject_reason=NULL WHERE id=${req.params.id}`;
      try {
        const notifContent = `【资质审核通过】您的向导商业资质已审核通过，可发布收费服务`;
        await prisma.$executeRaw`INSERT INTO notifications (user_id, type, content, related_id) VALUES (${guide.user_id}, 'commercial_approved', ${notifContent}, ${guide.id})`;
      } catch(e) {}
    } else if (action === 'reject') {
      const rejectReason = reason || '资质不符合要求';
      await prisma.$executeRaw`UPDATE guides SET commercial_verified=false, commercial_status='rejected',
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

// PUT /api/admin/merchants/:id/status — 暂停/恢复商家账户
router.put('/merchants/:id/status', adminWriteLimiter, adminAuth, async (req, res) => {
  try {
    const nextStatus = String(req.body?.status || '').trim();
    if (!['active', 'suspended'].includes(nextStatus)) {
      return res.status(400).json({ error: 'status 必须为 active 或 suspended' });
    }

    const merchantId = Number(req.params.id);
    if (!Number.isFinite(merchantId) || merchantId <= 0) {
      return res.status(400).json({ error: '无效商家ID' });
    }

    let updatedGuides = 0;
    let updatedClubs = 0;

    const guideApp = (await prisma.$queryRaw`SELECT user_id FROM guide_applications WHERE id = ${merchantId}`)[0];
    if (guideApp?.user_id) {
      try {
        updatedGuides += await prisma.$executeRaw`UPDATE guides SET status = ${nextStatus} WHERE user_id = ${guideApp.user_id}`;
      } catch (error) {
        console.error('[admin/merchants/:id/status] guide application update failed:', error.message);
      }
    }

    const clubApp = (await prisma.$queryRaw`SELECT user_id FROM club_applications WHERE id = ${merchantId}`)[0];
    if (clubApp?.user_id) {
      try {
        updatedClubs += await prisma.$executeRaw`UPDATE clubs SET status = ${nextStatus} WHERE creator_id = ${clubApp.user_id}`;
      } catch (error) {
        console.error('[admin/merchants/:id/status] club application update failed:', error.message);
      }
    }

    if (!updatedGuides && !updatedClubs) {
      try {
        updatedGuides += await prisma.$executeRaw`UPDATE guides SET status = ${nextStatus} WHERE id = ${merchantId}`;
      } catch (error) {
        console.error('[admin/merchants/:id/status] guide direct update failed:', error.message);
      }
      try {
        updatedClubs += await prisma.$executeRaw`UPDATE clubs SET status = ${nextStatus} WHERE id = ${merchantId}`;
      } catch (error) {
        console.error('[admin/merchants/:id/status] club direct update failed:', error.message);
      }
    }

    if (!updatedGuides && !updatedClubs) {
      return res.status(404).json({ error: '商家不存在' });
    }

    res.json({
      success: true,
      status: nextStatus,
      updated_guides: updatedGuides,
      updated_clubs: updatedClubs,
    });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
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
router.get('/routes', adminAuth, async (req, res) => {
  try {
    const page = parsePositiveInt(req.query.page, 1);
    const limit = Math.min(parsePositiveInt(req.query.limit, 20), 100);
    const offset = (page - 1) * limit;
    const routes = await prisma.$queryRaw`
      SELECT id, name, peak, difficulty, region, description, altitude, duration_days, best_season, status, created_at
      FROM climbing_routes ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
    `;
    const total = Number((await prisma.$queryRaw`SELECT COUNT(*) as c FROM climbing_routes`)[0].c);
    res.json({ routes, total, page, limit });
  } catch (e) {
    if (isMissingTableError(e)) {
      const page = parsePositiveInt(req.query.page, 1);
      const limit = Math.min(parsePositiveInt(req.query.limit, 20), 100);
      return res.json({ routes: [], total: 0, page, limit });
    }
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
    if (isMissingTableError(e)) {
      return res.status(400).json({ error: '线路数据表不存在' });
    }
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
    if (isMissingTableError(e)) {
      return res.status(400).json({ error: '线路数据表不存在' });
    }
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
    if (isMissingTableError(e)) {
      return res.status(400).json({ error: '线路数据表不存在' });
    }
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
    const sosAlertColumns = await prisma.$queryRawUnsafe('PRAGMA table_info(sos_alerts)');
    const hasStatus = sosAlertColumns.some((column) => column.name === 'status');
    let sql = `
      SELECT s.id, s.user_id, u.name as user_name,
             COALESCE(s.phone, u.phone) as phone,
             s.lat, s.lng, s.accuracy,
             ${hasStatus ? "COALESCE(s.status, 'pending')" : "'pending'"} as status,
             s.timestamp, s.created_at
      FROM sos_alerts s
      LEFT JOIN users u ON u.id = s.user_id
    `;
    const params = [];
    if (status && hasStatus) { sql += ' WHERE s.status = ?'; params.push(status); }
    sql += ' ORDER BY COALESCE(s.timestamp, s.created_at) DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);
    const records = await prisma.$queryRawUnsafe(sql, ...params);
    const countSql = status
      ? `SELECT COUNT(*) as c FROM sos_alerts ${hasStatus ? 'WHERE status = ?' : ''}`
      : 'SELECT COUNT(*) as c FROM sos_alerts';
    const total = Number((await prisma.$queryRawUnsafe(countSql, ...(status && hasStatus ? [status] : [])))[0].c);
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
    const sosAlertColumns = await prisma.$queryRawUnsafe('PRAGMA table_info(sos_alerts)');
    const hasStatus = sosAlertColumns.some((column) => column.name === 'status');
    if (!hasStatus) {
      await prisma.$executeRawUnsafe(`ALTER TABLE sos_alerts ADD COLUMN status TEXT DEFAULT 'pending'`);
    }
    const affected = await prisma.$executeRaw`UPDATE sos_alerts SET status = ${status} WHERE id = ${req.params.id}`;
    if (affected === 0) return res.status(404).json({ error: 'SOS记录不存在' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/admin/withdrawals — 提现申请管理
router.get('/withdrawals', adminAuth, async (req, res) => {
  try {
    const status = String(req.query.status || '').trim();
    const page = parsePositiveInt(req.query.page, 1);
    const limit = Math.min(parsePositiveInt(req.query.limit, 20), 100);
    const offset = (page - 1) * limit;
    const withdrawalColumns = await getTableColumns('withdrawal_requests');
    const hasUserId = withdrawalColumns.includes('user_id');
    let sql = hasUserId ? `
      SELECT wr.*, g.name as guide_name, g.user_id as guide_user_id, u.name as user_name
      FROM withdrawal_requests wr
      LEFT JOIN guides g ON g.id = wr.owner_id AND wr.owner_type = 'guide'
      LEFT JOIN users u ON u.id = wr.user_id
    ` : `
      SELECT wr.*, g.name as guide_name, g.user_id as guide_user_id, u.name as user_name
      FROM withdrawal_requests wr
      LEFT JOIN guides g ON g.id = wr.owner_id AND wr.owner_type = 'guide'
      LEFT JOIN users u ON u.id = wr.owner_id
    `;
    const params = [];
    if (status) { sql += ' WHERE wr.status = ?'; params.push(status); }
    sql += ' ORDER BY wr.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    const rows = await prisma.$queryRawUnsafe(sql, ...params);
    const withdrawals = rows.map((r) => {
      let accountInfo = {};
      try { accountInfo = r.account_info ? JSON.parse(r.account_info) : {}; } catch (_) {}
      return {
        ...r,
        user_id: r.user_id ?? r.owner_id,
        method: r.method ?? r.account_type ?? '',
        note: r.note ?? r.reject_reason ?? '',
        bank_account: r.bank_account ?? accountInfo.bank_account ?? '',
        bank_name: r.bank_name ?? accountInfo.bank_name ?? '',
      };
    });
    const countSql = status ? 'SELECT COUNT(*) as c FROM withdrawal_requests WHERE status = ?' : 'SELECT COUNT(*) as c FROM withdrawal_requests';
    const total = Number((await prisma.$queryRawUnsafe(countSql, ...(status ? [status] : [])))[0].c);
    // requests 字段保留用于兼容现有 admin.html 读取逻辑。
    res.json({ withdrawals, requests: withdrawals, total, page, limit });
  } catch (e) {
    if (isMissingTableError(e)) {
      return res.json({ withdrawals: [], requests: [], total: 0, page: 1, limit: 20 });
    }
    res.status(500).json({ error: '服务器错误' });
  }
});

async function processWithdrawalAction(withdrawalId, action, note = '') {
  if (!['approve', 'reject'].includes(action)) {
    return { statusCode: 400, body: { error: '无效 action，有效值: approve|reject' } };
  }
  const request = (await prisma.$queryRaw`SELECT * FROM withdrawal_requests WHERE id = ${withdrawalId}`)[0];
  if (!request) return { statusCode: 404, body: { error: '提现申请不存在' } };
  if (request.status !== 'pending') return { statusCode: 400, body: { error: '该申请已处理' } };

  const isApprove = action === 'approve';
  const paymentsEnabled = String(process.env.PAYMENTS_ENABLED || '').toLowerCase() === 'true';
  const now = new Date().toISOString();
  const finalNote = String(note || '').trim();

  let stripeTransferId = null;
  let stripeError = null;
  let payoutMock = true;

  if (isApprove && request.owner_type === 'guide') {
    // 尝试 Stripe Connect 打款
    const [guide] = await prisma.$queryRaw`SELECT stripe_account_id FROM guides WHERE id = ${request.owner_id}`;
    const stripeAccountId = guide && guide.stripe_account_id;
    if (stripeAccountId && !stripeConnect.isMock()) {
      try {
        const amountUsd = Math.round(Number(request.amount || 0) * 100); // 分（USD cents）
        const { transferId, mock } = await stripeConnect.createPayout({
          accountId: stripeAccountId,
          amount: amountUsd,
          currency: 'usd',
          description: `SummitLink 向导提现 #${withdrawalId}`,
        });
        stripeTransferId = transferId;
        payoutMock = mock;
      } catch (e) {
        stripeError = e.message;
        console.error('[admin/withdrawal] Stripe payout failed:', e.message);
      }
    }
  }

  const defaultNote = (() => {
    if (!isApprove) return '管理员驳回';
    if (stripeTransferId && !payoutMock) return `Stripe 转账成功，transfer_id: ${stripeTransferId}`;
    if (stripeError) return `Stripe 打款失败（${stripeError}），待人工处理`;
    if (paymentsEnabled) return '已批准：等待真实银行转账处理';
    return 'PAYMENTS_ENABLED=false：记录 mock 审批结果';
  })();

  await prisma.$executeRaw`
    UPDATE withdrawal_requests
    SET status = ${isApprove ? 'approved' : 'rejected'},
        processed_at = ${now},
        processed_by = 'admin',
        note = ${finalNote || defaultNote},
        reject_reason = ${isApprove ? null : (finalNote || '管理员驳回')}
    WHERE id = ${withdrawalId}
  `;
  if (!isApprove && request.owner_type === 'guide') {
    await prisma.$executeRaw`
      UPDATE guides SET balance = balance + ${Number(request.amount || 0)}
      WHERE id = ${request.owner_id}
    `;
  }

  captureEvent({
    message: 'withdrawal.reviewed',
    level: isApprove ? 'info' : 'warning',
  }, {
    userId: request.user_id || request.owner_id,
    tags: { module: 'withdrawal', action, ownerType: request.owner_type || 'unknown' },
    extra: { withdrawalId: Number(withdrawalId), amount: Number(request.amount || 0), stripeTransferId, stripeError, payoutMock },
  });

  return {
    statusCode: 200,
    body: {
      success: true,
      status: isApprove ? 'approved' : 'rejected',
      mock_transfer: isApprove ? payoutMock : undefined,
      stripe_transfer_id: stripeTransferId || undefined,
      payments_enabled: paymentsEnabled,
      note: finalNote || undefined,
      message: isApprove ? '已批准提现申请' : '已拒绝提现申请',
    },
  };
}

// PATCH /api/admin/withdrawals/:id — 审批提现
router.patch('/withdrawals/:id', adminWriteLimiter, adminAuth, async (req, res) => {
  try {
    const { action, note = '' } = req.body || {};
    const result = await processWithdrawalAction(req.params.id, action, note);
    res.status(result.statusCode).json(result.body);
  } catch (e) {
    if (isMissingTableError(e)) {
      return res.status(404).json({ error: '提现数据不存在' });
    }
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/admin/withdrawals/:id/approve — 批准提现
router.put('/withdrawals/:id/approve', adminWriteLimiter, adminAuth, async (req, res) => {
  try {
    const result = await processWithdrawalAction(req.params.id, 'approve', req.body?.note || '');
    res.status(result.statusCode).json(result.body);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/admin/withdrawals/:id/reject — 拒绝提现
router.put('/withdrawals/:id/reject', adminWriteLimiter, adminAuth, async (req, res) => {
  try {
    const result = await processWithdrawalAction(req.params.id, 'reject', req.body?.reason || req.body?.note || '');
    res.status(result.statusCode).json(result.body);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

async function buildGmvReportsPayload(req) {
  const period = String(req.query.period || '7d');
  const region = String(req.query.region || 'all').toLowerCase();
  const days = periodToDays(period);
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - (days - 1) * DAY_MS);
  const expeditionColumns = await getTableColumns('expeditions');
  const expeditionOrderColumns = await getTableColumns('expedition_orders');
  const hasExpeditions = expeditionColumns.length > 0;
  const guidePayoutColumn = expeditionOrderColumns.includes('guide_commission') ? 'o.guide_commission' : 'o.publisher_income';
  const regionExpr = hasExpeditions && expeditionColumns.includes('region')
    ? 'COALESCE(e.region, "all")'
    : '"all"';
  const rows = await prisma.$queryRawUnsafe(
    `SELECT
       COALESCE(o.total, 0) AS total,
       COALESCE(o.platform_fee, 0) AS platform_fee,
       COALESCE(${guidePayoutColumn}, 0) AS guide_payout,
       ${regionExpr} AS region
     FROM expedition_orders o
     ${hasExpeditions ? 'LEFT JOIN expeditions e ON e.id = o.expedition_id' : ''}
     WHERE o.status = ?
       AND datetime(o.created_at) >= datetime(?)`,
    'paid',
    startDate.toISOString()
  );

  let totalGmv = 0;
  let platformFee = 0;
  let guidePayout = 0;
  for (const row of rows) {
    const rowRegion = String(row.region || 'all').toLowerCase();
    if (region !== 'all' && rowRegion !== region) continue;
    totalGmv = roundAmount(totalGmv + Number(row.total || 0));
    platformFee = roundAmount(platformFee + Number(row.platform_fee || 0));
    guidePayout = roundAmount(guidePayout + Number(row.guide_payout || 0));
  }
  return {
    // 同时返回 camelCase 与 snake_case，兼容不同前端版本。
    total: totalGmv,
    totalGmv,
    total_gmv: totalGmv,
    platformFee,
    platform_fee: platformFee,
    guidePayout,
    guide_payout: guidePayout,
    completedPayout: totalGmv,
    completed_payout: totalGmv,
    currency: region === 'us' ? '$' : '¥',
    region,
    period,
  };
}

// GET /api/admin/gmv-reports — GMV 报表（远征订单）
router.get('/gmv-reports', adminAuth, async (req, res) => {
  try {
    const payload = await buildGmvReportsPayload(req);
    res.json(payload);
  } catch (e) {
    if (isMissingTableError(e)) {
      const region = String(req.query.region || 'all').toLowerCase();
      const period = String(req.query.period || '7d');
      return res.json({
        total: 0,
        totalGmv: 0,
        total_gmv: 0,
        platformFee: 0,
        platform_fee: 0,
        guidePayout: 0,
        guide_payout: 0,
        completedPayout: 0,
        completed_payout: 0,
        currency: region === 'us' ? '$' : '¥',
        region,
        period,
      });
    }
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/admin/gmv — GMV 报表
router.get('/gmv', adminAuth, async (req, res) => {
  const period = String(req.query.period || '7d');
  const region = String(req.query.region || 'all').toLowerCase();
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - (periodToDays(period) - 1) * DAY_MS);
  const chartIndex = new Map(buildChartDates(period, endDate).map((date) => [date, 0]));

  try {
    const orderColumns = await getTableColumns('orders');
    if (!orderColumns.length) {
      return res.json({ total: 0, period, region, chart: [], byRegion: {} });
    }

    const regionExpr = orderColumns.includes('region')
      ? `COALESCE(region, '${DEFAULT_REGION}') AS region`
      : `'${DEFAULT_REGION}' AS region`;
    const rows = await prisma.$queryRawUnsafe(
      `SELECT amount, created_at, ${regionExpr}
       FROM orders
       WHERE status = ?
         AND datetime(created_at) >= datetime(?)
       ORDER BY created_at ASC`,
      'paid',
      startDate.toISOString()
    );

    const byRegion = {};
    let total = 0;
    for (const row of rows) {
      const rowRegion = String(row.region || DEFAULT_REGION).toLowerCase();
      if (region !== 'all' && rowRegion !== region) continue;
      const amount = roundAmount(row.amount);
      const bucket = period === '90d'
        ? startOfUtcWeek(row.created_at).toISOString().slice(0, 10)
        : formatBucketDate(row.created_at);
      if (chartIndex.has(bucket)) {
        chartIndex.set(bucket, roundAmount(chartIndex.get(bucket) + amount));
      }
      byRegion[rowRegion] = roundAmount((byRegion[rowRegion] || 0) + amount);
      total = roundAmount(total + amount);
    }

    res.json({
      total,
      totalGmv: total,
      platformRevenue: total,
      pendingPayout: 0,
      completedPayout: total,
      currency: '¥',
      period,
      region,
      chart: Array.from(chartIndex.entries()).map(([date, amount]) => ({ date, amount })),
      byRegion,
    });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/admin/disputes — 争议列表
router.get('/disputes', adminAuth, async (req, res) => {
  const status = String(req.query.status || 'open').toLowerCase();
  try {
    await syncDisputesFromOrders();
    const usersExist = (await getTableColumns('users')).length > 0;
    const where = status ? 'WHERE d.status = ?' : '';
    const disputes = await prisma.$queryRawUnsafe(
      `SELECT d.*, ${usersExist ? 'u.name AS user_name' : 'NULL AS user_name'}
       FROM disputes d
       ${usersExist ? 'LEFT JOIN users u ON u.id = d.user_id' : ''}
       ${where}
       ORDER BY d.created_at DESC`,
      ...(status ? [status] : [])
    );
    res.json({ disputes, total: disputes.length });
  } catch (e) {
    if (isMissingTableError(e)) {
      return res.json({ disputes: [], total: 0 });
    }
    res.status(500).json({ error: '服务器错误' });
  }
});

async function resolveDispute(req, res) {
  try {
    await syncDisputesFromOrders();
    const { resolution = '' } = req.body || {};
    const refundAmount = req.body?.refundAmount ?? req.body?.refund_amount ?? 0;
    if (!String(resolution).trim()) {
      return res.status(400).json({ error: 'resolution 不能为空' });
    }
    let dispute = (await prisma.$queryRaw`SELECT * FROM disputes WHERE id = ${Number(req.params.id)}`)[0];
    if (!dispute) {
      dispute = (await prisma.$queryRaw`SELECT * FROM disputes WHERE order_id = ${Number(req.params.id)}`)[0];
    }
    if (!dispute) return res.status(404).json({ error: '争议不存在' });

    await prisma.$executeRaw`
      UPDATE disputes
      SET status = 'resolved',
          resolution = ${String(resolution).trim()},
          refund_amount = ${roundAmount(refundAmount)},
          resolved_at = CURRENT_TIMESTAMP
      WHERE id = ${dispute.id}
    `;
    try {
      await prisma.$executeRaw`UPDATE orders SET status = 'resolved' WHERE id = ${dispute.order_id}`;
    } catch (_) {}
    res.json({ success: true });
  } catch (e) {
    if (isMissingTableError(e)) {
      return res.status(404).json({ error: '争议数据不存在' });
    }
    res.status(500).json({ error: '服务器错误' });
  }
}

// PUT /api/admin/disputes/:id/resolve — 处理争议
router.put('/disputes/:id/resolve', adminWriteLimiter, adminAuth, resolveDispute);

// POST /api/admin/disputes/:id/resolve — 处理争议（兼容前端）
router.post('/disputes/:id/resolve', adminWriteLimiter, adminAuth, resolveDispute);

// GET /api/admin/featured-slots — 推荐位配置
router.get('/featured-slots', adminAuth, async (_req, res) => {
  try {
    const slots = { us: [], cn: [] };
    const expeditionColumns = await getTableColumns('platform_expeditions');
    if (expeditionColumns.length && expeditionColumns.includes('is_featured')) {
      const titleExpr = expeditionColumns.includes('title') ? 'title' : 'name';
      const merchantExpr = expeditionColumns.includes('merchant_id') ? 'merchant_id' : 'NULL';
      const rows = await prisma.$queryRawUnsafe(
        `SELECT id,
                ${titleExpr} AS display_name,
                COALESCE(region, '${DEFAULT_REGION}') AS region,
                ${merchantExpr} AS merchant_id
         FROM platform_expeditions
         WHERE is_featured = 1
         ORDER BY updated_at DESC, created_at DESC
         LIMIT 12`
      );
      rows.forEach((row) => {
        const key = String(row.region || DEFAULT_REGION).toLowerCase() === 'us' ? 'us' : DEFAULT_REGION;
        slots[key].push({
          id: row.id,
          displayName: row.display_name,
          merchantId: row.merchant_id,
          isSeed: false,
        });
      });
    }
    res.json({ slots });
  } catch (e) {
    if (String(e.message || '').includes('no such table')) {
      return res.json({ slots: { us: [], cn: [] } });
    }
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/admin/banners — 后台 Banner 列表
router.get('/banners', adminAuth, async (_req, res) => {
  try {
    const banners = await prisma.$queryRaw`SELECT * FROM banners ORDER BY sort_order ASC, id DESC`;
    res.json({ banners });
  } catch (e) {
    if (String(e.message || '').includes('no such table')) {
      return res.json({ banners: [] });
    }
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/admin/banners/:id — 更新 Banner 启用状态
router.put('/banners/:id', adminWriteLimiter, adminAuth, async (req, res) => {
  try {
    const banner = (await prisma.$queryRaw`SELECT * FROM banners WHERE id = ${Number(req.params.id)}`)[0];
    if (!banner) return res.status(404).json({ error: 'Banner不存在' });
    const nextActive = req.body?.is_active !== undefined ? (req.body.is_active ? 1 : 0) : banner.is_active;
    await prisma.$executeRaw`UPDATE banners SET is_active = ${nextActive} WHERE id = ${Number(req.params.id)}`;
    const updated = (await prisma.$queryRaw`SELECT * FROM banners WHERE id = ${Number(req.params.id)}`)[0];
    res.json(updated);
  } catch (e) {
    if (String(e.message || '').includes('no such table')) {
      return res.status(404).json({ error: 'Banner不存在' });
    }
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/admin/commission-rates — 全局佣金配置
router.get('/commission-rates', adminAuth, async (_req, res) => {
  try {
    let guideRate = Number(process.env.DEFAULT_GUIDE_COMMISSION_RATE || 0.15);
    let clubRate = Number(process.env.DEFAULT_CLUB_COMMISSION_RATE || 0.12);

    try {
      const guideRow = (await prisma.$queryRaw`SELECT AVG(commission_rate) AS avg_rate FROM guides WHERE commission_rate IS NOT NULL`)[0];
      if (guideRow && Number.isFinite(Number(guideRow.avg_rate))) {
        guideRate = Number(guideRow.avg_rate);
      }
    } catch (_) {}
    try {
      const clubRow = (await prisma.$queryRaw`SELECT AVG(commission_rate) AS avg_rate FROM clubs WHERE commission_rate IS NOT NULL`)[0];
      if (clubRow && Number.isFinite(Number(clubRow.avg_rate))) {
        clubRate = Number(clubRow.avg_rate);
      }
    } catch (_) {}

    guideRate = await getPlatformConfigValue('guide_rate', guideRate);
    clubRate = await getPlatformConfigValue('club_rate', clubRate);

    res.json({
      guide_rate: roundAmount(guideRate),
      club_rate: roundAmount(clubRate),
      us: { guide_standard: roundAmount(guideRate), guide_certified: roundAmount(guideRate), guide_new: 0, club: roundAmount(clubRate) },
      cn: { guide_standard: roundAmount(guideRate), guide_certified: roundAmount(guideRate), guide_new: 0, club: roundAmount(clubRate) },
    });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/admin/commission-rates — 更新全局佣金配置
router.put('/commission-rates', adminWriteLimiter, adminAuth, async (req, res) => {
  try {
    const guideRate = Number(req.body?.guide_rate);
    const clubRate = Number(req.body?.club_rate);
    if (!Number.isFinite(guideRate) || guideRate < 0 || guideRate > 1) {
      return res.status(400).json({ error: 'guide_rate 必须在 0 到 1 之间' });
    }
    if (!Number.isFinite(clubRate) || clubRate < 0 || clubRate > 1) {
      return res.status(400).json({ error: 'club_rate 必须在 0 到 1 之间' });
    }

    await setPlatformConfigValue('guide_rate', roundAmount(guideRate));
    await setPlatformConfigValue('club_rate', roundAmount(clubRate));
    res.json({ success: true, guide_rate: roundAmount(guideRate), club_rate: roundAmount(clubRate) });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/admin/merchants/:id/custom-rate — 商家自定义佣金
router.put('/merchants/:id/custom-rate', adminWriteLimiter, adminAuth, async (req, res) => {
  try {
    const customRate = req.body?.custom_rate ?? req.body?.commission_rate;
    const parsedRate = Number(customRate);
    if (!Number.isFinite(parsedRate) || parsedRate < 0 || parsedRate > 1) {
      return res.status(400).json({ error: 'custom_rate 必须在 0 到 1 之间' });
    }

    let updated = 0;
    try { updated += await prisma.$executeRaw`UPDATE guides SET commission_rate = ${parsedRate} WHERE id = ${Number(req.params.id)}`; } catch (_) {}
    try { updated += await prisma.$executeRaw`UPDATE clubs SET commission_rate = ${parsedRate} WHERE id = ${Number(req.params.id)}`; } catch (_) {}
    if (!updated) return res.status(404).json({ error: '商家不存在' });
    res.json({ success: true, custom_rate: roundAmount(parsedRate) });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/admin/merchant-kyc — 商家 KYC 审核列表
router.get('/merchant-kyc', adminAuth, async (req, res) => {
  const status = String(req.query.status || '').trim();
  try {
    const usersExist = (await getTableColumns('users')).length > 0;
    const guidesExist = (await getTableColumns('guides')).length > 0;
    const clubsExist = (await getTableColumns('clubs')).length > 0;
    let sql = `
      SELECT
        mk.id,
        mk.name,
        mk.type,
        mk.status,
        mk.cert_url,
        mk.business_license_url,
        mk.insurance_cert_url,
        mk.created_at,
        mk.user_id,
        mk.target_id,
        mk.note,
        ${usersExist ? 'u.name AS user_name, u.email AS email' : 'NULL AS user_name, NULL AS email'}
      FROM merchant_kyc mk
      ${usersExist ? 'LEFT JOIN users u ON u.id = mk.user_id' : ''}
      ${guidesExist ? "LEFT JOIN guides g ON mk.type = 'guide' AND g.id = mk.target_id" : ''}
      ${clubsExist ? "LEFT JOIN clubs c ON mk.type = 'club' AND c.id = mk.target_id" : ''}
    `;
    const params = [];
    if (status) {
      sql += ' WHERE mk.status = ?';
      params.push(status);
    }
    sql += ' ORDER BY mk.created_at DESC';
    const merchants = await prisma.$queryRawUnsafe(sql, ...params);
    res.json({ merchants, total: merchants.length });
  } catch (e) {
    if (isMissingTableError(e)) {
      return res.json({ merchants: [], total: 0 });
    }
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/admin/merchant-kyc/:id/review — 审核商家 KYC
router.post('/merchant-kyc/:id/review', adminWriteLimiter, adminAuth, async (req, res) => {
  try {
    const action = String(req.body?.action || '').trim();
    const note = String(req.body?.note || '').trim();
    const status = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : '';
    if (!status) {
      return res.status(400).json({ error: 'action 必须为 approve 或 reject' });
    }
    const affected = await prisma.$executeRaw`
      UPDATE merchant_kyc
      SET status = ${status}, note = ${note || null}
      WHERE id = ${Number(req.params.id)}
    `;
    if (!affected) return res.status(404).json({ error: '审核记录不存在' });
    res.json({ success: true, status });
  } catch (e) {
    if (isMissingTableError(e)) {
      return res.status(404).json({ error: '商家KYC数据不存在' });
    }
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/admin/merchant-kyc/:id/approve — 通过 KYC
router.post('/merchant-kyc/:id/approve', adminWriteLimiter, adminAuth, async (req, res) => {
  try {
    const { type } = req.body || {};
    if (type === 'guide') {
      const app = (await prisma.$queryRaw`SELECT * FROM guide_applications WHERE id = ${Number(req.params.id)}`)[0];
      if (!app) return res.status(404).json({ error: '申请不存在' });
      await prisma.$executeRaw`UPDATE guide_applications SET status = 'approved_pending_payment' WHERE id = ${Number(req.params.id)}`;
      const existing = (await prisma.$queryRaw`SELECT id FROM guides WHERE user_id = ${app.user_id}`)[0];
      if (existing) {
        await prisma.$executeRaw`UPDATE guides SET status = 'approved_pending_payment' WHERE user_id = ${app.user_id}`;
      } else {
        await prisma.$executeRaw`
          INSERT INTO guides (user_id, name, cert, specialty, languages, day_rate, region, status)
          VALUES (${app.user_id}, ${app.name}, ${app.cert}, ${app.specialty}, ${app.languages}, ${app.day_rate}, ${app.region}, 'approved_pending_payment')
        `;
      }
      return res.json({ success: true });
    }
    if (type === 'club') {
      const app = (await prisma.$queryRaw`SELECT * FROM club_applications WHERE id = ${Number(req.params.id)}`)[0];
      if (!app) return res.status(404).json({ error: '申请不存在' });
      await prisma.$executeRaw`UPDATE club_applications SET status = 'approved_pending_payment' WHERE id = ${Number(req.params.id)}`;
      if (app.club_id) {
        await prisma.$executeRaw`UPDATE clubs SET status = 'approved_pending_payment' WHERE id = ${app.club_id}`;
      }
      return res.json({ success: true });
    }
    return res.status(400).json({ error: 'type 必须为 guide 或 club' });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/admin/merchant-kyc/:id/reject — 拒绝 KYC
router.post('/merchant-kyc/:id/reject', adminWriteLimiter, adminAuth, async (req, res) => {
  try {
    const { type, reason = '' } = req.body || {};
    if (type === 'guide') {
      const app = (await prisma.$queryRaw`SELECT * FROM guide_applications WHERE id = ${Number(req.params.id)}`)[0];
      if (!app) return res.status(404).json({ error: '申请不存在' });
      await prisma.$executeRaw`UPDATE guide_applications SET status = 'rejected', note = ${reason || null} WHERE id = ${Number(req.params.id)}`;
      return res.json({ success: true });
    }
    if (type === 'club') {
      const app = (await prisma.$queryRaw`SELECT * FROM club_applications WHERE id = ${Number(req.params.id)}`)[0];
      if (!app) return res.status(404).json({ error: '申请不存在' });
      await prisma.$executeRaw`UPDATE club_applications SET status = 'rejected', reject_reason = ${reason || null} WHERE id = ${Number(req.params.id)}`;
      return res.json({ success: true });
    }
    return res.status(400).json({ error: 'type 必须为 guide 或 club' });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/admin/platform-routes — 平台路线审核列表
router.get('/platform-routes', adminAuth, async (_req, res) => {
  try {
    const routes = await prisma.$queryRaw`
      SELECT id, name, name AS title, peak, peak AS peakName, region, status, created_at
      FROM climbing_routes
      WHERE status = 'pending'
      ORDER BY created_at DESC
    `;
    res.json({ routes, total: routes.length });
  } catch (e) {
    if (String(e.message || '').includes('no such table')) {
      return res.json({ routes: [], total: 0 });
    }
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/admin/platform-routes/:id/approve — 通过路线审核
router.put('/platform-routes/:id/approve', adminWriteLimiter, adminAuth, async (req, res) => {
  try {
    const affected = await prisma.$executeRaw`UPDATE climbing_routes SET status = 'active' WHERE id = ${Number(req.params.id)}`;
    if (!affected) return res.status(404).json({ error: '路线不存在' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/admin/platform-routes/:id/reject — 拒绝路线审核
router.put('/platform-routes/:id/reject', adminWriteLimiter, adminAuth, async (req, res) => {
  try {
    const affected = await prisma.$executeRaw`UPDATE climbing_routes SET status = 'rejected' WHERE id = ${Number(req.params.id)}`;
    if (!affected) return res.status(404).json({ error: '路线不存在' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/admin/invite-codes — 邀请码列表
router.get('/invite-codes', adminAuth, async (_req, res) => {
  try {
    await ensureAdminOpsTables();
    const columns = await getTableColumns('invite_codes');
    if (!columns.length) return res.json({ codes: [], total: 0 });
    const rows = await prisma.$queryRawUnsafe(
      `SELECT ${columns.includes('id') ? 'id' : 'rowid AS id'},
              code,
              ${columns.includes('max_uses') ? 'max_uses' : '1 AS max_uses'},
              ${columns.includes('used_count') ? 'used_count' : '0 AS used_count'},
              ${columns.includes('expires_at') ? 'expires_at' : 'NULL AS expires_at'},
              ${columns.includes('created_at') ? 'created_at' : 'CURRENT_TIMESTAMP AS created_at'},
              ${columns.includes('region') ? 'region' : `'all' AS region`},
              ${columns.includes('tier') ? 'tier' : `'normal' AS tier`},
              ${columns.includes('notes') ? 'notes' : 'NULL AS notes'},
              ${columns.includes('used_by') ? 'used_by' : 'NULL AS used_by'}
       FROM invite_codes
       ORDER BY ${columns.includes('created_at') ? 'created_at' : 'rowid'} DESC`
    );
    res.json({ codes: rows, total: rows.length });
  } catch (e) {
    if (String(e.message || '').includes('no such table')) {
      return res.json({ codes: [], total: 0 });
    }
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/admin/invite-codes — 批量生成邀请码
router.post('/invite-codes', adminWriteLimiter, adminAuth, async (req, res) => {
  try {
    await createInviteCodes(req, res);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/admin/invite-codes/generate — 兼容旧前端
router.post('/invite-codes/generate', adminWriteLimiter, adminAuth, async (req, res) => {
  try {
    req.body = {
      ...req.body,
      max_uses: req.body?.max_uses ?? 1,
      expires_at: req.body?.expires_at ?? req.body?.expiresAt ?? null,
    };
    await createInviteCodes(req, res);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// DELETE /api/admin/invite-codes/:id — 删除邀请码
router.delete('/invite-codes/:id', adminWriteLimiter, adminAuth, async (req, res) => {
  try {
    await ensureAdminOpsTables();
    const columns = await getTableColumns('invite_codes');
    if (!columns.length) return res.status(404).json({ error: '邀请码不存在' });
    const key = columns.includes('id') ? 'id' : 'rowid';
    const affected = await prisma.$executeRawUnsafe(`DELETE FROM invite_codes WHERE ${key} = ?`, Number(req.params.id));
    if (!affected) return res.status(404).json({ error: '邀请码不存在' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/admin/backup — 触发数据库备份（需 admin 鉴权）
router.post('/backup', adminWriteLimiter, adminAuth, (req, res) => {
  const { execFile } = require('child_process');
  const path = require('path');
  const fs = require('fs');
  // Resolve the script path relative to this file's directory (backend/routes/ → backend/scripts/)
  const script = path.resolve(__dirname, '../scripts/backup-db.sh');
  if (!fs.existsSync(script)) {
    return res.status(404).json({ error: '备份脚本不存在' });
  }
  // Use execFile with an array of args to avoid shell injection
  execFile('bash', [script], { timeout: 60000 }, (err, stdout, stderr) => {
    if (err) {
      console.error('[backup] 备份失败:', err.message, stderr);
      return res.status(500).json({ error: '备份执行失败', detail: stderr });
    }
    console.log('[backup] 备份完成:', stdout);
    res.json({ success: true, output: stdout });
  });
});

module.exports = router;

function buildAsciiChartForAdmin(points = [], width = 46, height = 6) {
  const normalized = (points || []).map((p) => Number(p.ele ?? p.alt ?? p[2] ?? 0)).filter((v) => Number.isFinite(v));
  if (normalized.length < 2) return 'N/A';
  const min = Math.min(...normalized);
  const max = Math.max(...normalized);
  const range = Math.max(max - min, 1);
  const grid = Array.from({ length: height }, () => Array(width).fill(' '));
  for (let x = 0; x < width; x += 1) {
    const idx = Math.min(normalized.length - 1, Math.round((x / (width - 1)) * (normalized.length - 1)));
    const y = height - 1 - Math.round(((normalized[idx] - min) / range) * (height - 1));
    grid[y][x] = '*';
  }
  return grid.map((line) => line.join('')).join('\n');
}

function parseTrackPointsSafe(points) {
  if (!points) return [];
  if (Array.isArray(points)) return points;
  if (typeof points === 'string') {
    try {
      const parsed = JSON.parse(points);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }
  return [];
}
