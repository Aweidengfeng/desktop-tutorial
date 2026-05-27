const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const COUPON_CODE_RE = /^[A-Z0-9]{8}$/;

function toAmount(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function parseDateOrNull(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function normalizeCode(code) {
  return String(code || '').trim().toUpperCase();
}

function isValidCouponCode(code) {
  return COUPON_CODE_RE.test(code);
}

function hasValue(value) {
  return value !== null && value !== undefined && value !== '';
}

function generateCouponCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i += 1) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function isCouponExpired(coupon) {
  if (!coupon?.expires_at) return false;
  const expiresTs = new Date(coupon.expires_at).getTime();
  if (Number.isNaN(expiresTs)) return false;
  return expiresTs < Date.now();
}

function isApplicableType(coupon, orderType) {
  const raw = String(coupon?.applicable_types || 'all').trim().toLowerCase();
  if (!raw || raw === 'all') return true;
  const set = new Set(raw.split(',').map((v) => v.trim()).filter(Boolean));
  return set.has(String(orderType || '').trim().toLowerCase());
}

function getCouponDisplay(coupon) {
  if (coupon.type === 'fixed') {
    return `满${toAmount(coupon.min_order_amount || 0)}减${toAmount(coupon.value)}`;
  }
  const discount = Math.round((Number(coupon.value) || 0) * 100);
  return `${discount}折优惠`;
}

function computeDiscount(coupon, orderAmount) {
  const amount = Math.max(0, Number(orderAmount) || 0);
  if (coupon.type === 'fixed') {
    return toAmount(Math.min(amount, Number(coupon.value) || 0));
  }
  if (coupon.type === 'percent') {
    const discountRate = Number(coupon.value) || 0;
    let discountAmount = amount * Math.max(0, 1 - discountRate);
    if (hasValue(coupon.max_discount)) {
      discountAmount = Math.min(discountAmount, Number(coupon.max_discount) || 0);
    }
    return toAmount(Math.max(0, discountAmount));
  }
  return 0;
}

async function ensureCouponTables() {
  const isPg = String(process.env.DATABASE_PROVIDER || '').toLowerCase() === 'postgresql';
  if (isPg) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "coupons" (
        "id" SERIAL PRIMARY KEY,
        "code" TEXT UNIQUE NOT NULL,
        "type" TEXT NOT NULL,
        "value" DOUBLE PRECISION NOT NULL,
        "min_order_amount" DOUBLE PRECISION DEFAULT 0,
        "max_discount" DOUBLE PRECISION DEFAULT NULL,
        "total_quota" INTEGER DEFAULT NULL,
        "used_count" INTEGER DEFAULT 0,
        "per_user_limit" INTEGER DEFAULT 1,
        "applicable_types" TEXT DEFAULT 'all',
        "expires_at" TIMESTAMPTZ DEFAULT NULL,
        "created_by" INTEGER,
        "created_at" TIMESTAMPTZ DEFAULT NOW(),
        "status" TEXT DEFAULT 'active'
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "user_coupons" (
        "id" SERIAL PRIMARY KEY,
        "user_id" INTEGER NOT NULL,
        "coupon_id" INTEGER NOT NULL,
        "status" TEXT DEFAULT 'unused',
        "order_type" TEXT,
        "order_id" INTEGER,
        "used_at" TIMESTAMPTZ,
        "claimed_at" TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE("user_id", "coupon_id")
      )
    `);
  } else {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS coupons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        type TEXT NOT NULL,
        value REAL NOT NULL,
        min_order_amount REAL DEFAULT 0,
        max_discount REAL DEFAULT NULL,
        total_quota INTEGER DEFAULT NULL,
        used_count INTEGER DEFAULT 0,
        per_user_limit INTEGER DEFAULT 1,
        applicable_types TEXT DEFAULT 'all',
        expires_at TEXT DEFAULT NULL,
        created_by INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'active'
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS user_coupons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        coupon_id INTEGER NOT NULL,
        status TEXT DEFAULT 'unused',
        order_type TEXT,
        order_id INTEGER,
        used_at TEXT,
        claimed_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, coupon_id)
      )
    `);
  }
}

async function getCouponByCode(code) {
  return (await prisma.$queryRaw`SELECT * FROM coupons WHERE code = ${code}`)[0];
}

async function validateCouponForUser({ userId, coupon, orderType, orderAmount }) {
  if (!coupon) return { ok: false, error: '优惠券不存在' };
  if (String(coupon.status || 'active') !== 'active') return { ok: false, error: '优惠券当前不可用' };
  if (isCouponExpired(coupon)) return { ok: false, error: '优惠券已过期' };
  if (hasValue(coupon.total_quota) && Number(coupon.used_count || 0) >= Number(coupon.total_quota)) {
    return { ok: false, error: '优惠券已用完' };
  }
  if (orderType && !isApplicableType(coupon, orderType)) return { ok: false, error: '该优惠券不适用于当前订单类型' };
  if (hasValue(orderAmount) && Number(orderAmount) < Number(coupon.min_order_amount || 0)) {
    return { ok: false, error: `订单金额未达到最低使用门槛（¥${toAmount(coupon.min_order_amount || 0)}）` };
  }
  const userCoupon = (await prisma.$queryRaw`
    SELECT * FROM user_coupons
    WHERE user_id = ${userId} AND coupon_id = ${coupon.id}
    ORDER BY claimed_at DESC
    LIMIT 1
  `)[0];
  if (!userCoupon) return { ok: false, error: '请先领取该优惠券' };
  if (userCoupon.status !== 'unused') return { ok: false, error: '优惠券已使用或不可用' };

  return { ok: true, userCoupon };
}

router.post('/claim', auth, async (req, res) => {
  try {
    await ensureCouponTables();
    const code = normalizeCode(req.body?.code);
    if (!isValidCouponCode(code)) {
      return res.status(400).json({ error: '优惠券码格式错误（需为8位大写字母或数字）' });
    }

    const coupon = await getCouponByCode(code);
    if (!coupon) return res.status(404).json({ error: '优惠券不存在' });
    if (String(coupon.status || 'active') !== 'active') return res.status(400).json({ error: '优惠券当前不可领取' });
    if (isCouponExpired(coupon)) return res.status(400).json({ error: '优惠券已过期' });
    if (hasValue(coupon.total_quota) && Number(coupon.used_count || 0) >= Number(coupon.total_quota)) {
      return res.status(400).json({ error: '优惠券已领完' });
    }

    const claimedCountRow = (await prisma.$queryRaw`
      SELECT COUNT(*) AS cnt
      FROM user_coupons
      WHERE user_id = ${req.user.id} AND coupon_id = ${coupon.id}
    `)[0];
    const claimedCount = Number(claimedCountRow?.cnt || 0);
    if (claimedCount >= Number(coupon.per_user_limit || 1)) {
      return res.status(400).json({ error: '已达到该券的个人领取上限' });
    }

    await prisma.$executeRaw`
      INSERT INTO user_coupons (user_id, coupon_id, status)
      VALUES (${req.user.id}, ${coupon.id}, 'unused')
    `;
    return res.json({ success: true, couponId: coupon.id, message: '领券成功' });
  } catch (e) {
    if (String(e?.message || '').toLowerCase().includes('unique')) {
      return res.status(400).json({ error: '该优惠券你已领取过' });
    }
    return res.status(500).json({ error: '服务器错误' });
  }
});

router.get('/my', auth, async (req, res) => {
  try {
    await ensureCouponTables();
    const statusFilter = String(req.query.status || '').trim();
    const rows = await prisma.$queryRaw`
      SELECT
        uc.id,
        uc.user_id,
        uc.coupon_id,
        uc.status AS user_status,
        uc.order_type,
        uc.order_id,
        uc.used_at,
        uc.claimed_at,
        c.code,
        c.type,
        c.value,
        c.min_order_amount,
        c.max_discount,
        c.total_quota,
        c.used_count,
        c.per_user_limit,
        c.applicable_types,
        c.expires_at,
        c.created_at,
        c.status AS coupon_status
      FROM user_coupons uc
      INNER JOIN coupons c ON c.id = uc.coupon_id
      WHERE uc.user_id = ${req.user.id}
      ORDER BY uc.claimed_at DESC
    `;

    const normalized = rows.map((item) => {
      let status = item.user_status || 'unused';
      if (status === 'unused' && (String(item.coupon_status || '') !== 'active' || isCouponExpired(item))) {
        status = 'expired';
      }
      return {
        ...item,
        status,
      };
    });

    const coupons = statusFilter
      ? normalized.filter((item) => item.status === statusFilter)
      : normalized;
    return res.json({ coupons });
  } catch (e) {
    return res.status(500).json({ error: '服务器错误' });
  }
});

router.post('/verify', auth, async (req, res) => {
  try {
    await ensureCouponTables();
    const code = normalizeCode(req.body?.code);
    const orderType = String(req.body?.order_type || '').trim().toLowerCase();
    const orderAmount = Number(req.body?.order_amount);
    if (!code) return res.status(400).json({ error: '请提供优惠券码' });
    if (!Number.isFinite(orderAmount) || orderAmount <= 0) return res.status(400).json({ error: '订单金额无效' });
    if (!orderType) return res.status(400).json({ error: '订单类型不能为空' });

    const coupon = await getCouponByCode(code);
    const validation = await validateCouponForUser({ userId: req.user.id, coupon, orderType, orderAmount });
    if (!validation.ok) return res.status(400).json({ valid: false, message: validation.error, error: validation.error });

    const discountAmount = computeDiscount(coupon, orderAmount);
    const finalAmount = toAmount(Math.max(0, orderAmount - discountAmount));
    return res.json({
      valid: true,
      couponId: coupon.id,
      type: coupon.type,
      value: toAmount(coupon.value),
      discountAmount,
      finalAmount,
      message: getCouponDisplay(coupon),
    });
  } catch (e) {
    return res.status(500).json({ error: '服务器错误' });
  }
});

router.post('/use', auth, async (req, res) => {
  try {
    await ensureCouponTables();
    const couponId = Number(req.body?.coupon_id);
    const orderType = String(req.body?.order_type || '').trim().toLowerCase();
    const orderId = req.body?.order_id ? Number(req.body.order_id) : null;
    if (!Number.isFinite(couponId) || couponId <= 0) return res.status(400).json({ error: 'coupon_id 无效' });

    const coupon = (await prisma.$queryRaw`SELECT * FROM coupons WHERE id = ${couponId}`)[0];
    const validation = await validateCouponForUser({ userId: req.user.id, coupon, orderType, orderAmount: null });
    if (!validation.ok) return res.status(400).json({ error: validation.error });

    const affected = await prisma.$executeRaw`
      UPDATE user_coupons
      SET status = 'used',
          order_type = ${orderType || null},
          order_id = ${orderId},
          used_at = CURRENT_TIMESTAMP
      WHERE id = ${validation.userCoupon.id}
        AND user_id = ${req.user.id}
        AND status = 'unused'
    `;
    if (!affected) return res.status(400).json({ error: '优惠券已被使用' });

    await prisma.$executeRaw`
      UPDATE coupons
      SET used_count = COALESCE(used_count, 0) + 1
      WHERE id = ${couponId}
    `;
    return res.json({ success: true, message: '优惠券核销成功' });
  } catch (e) {
    return res.status(500).json({ error: '服务器错误' });
  }
});

router.get('/', adminAuth, async (req, res) => {
  try {
    await ensureCouponTables();
    const status = String(req.query.status || '').trim();
    const rows = status
      ? await prisma.$queryRaw`SELECT * FROM coupons WHERE status = ${status} ORDER BY created_at DESC`
      : await prisma.$queryRaw`SELECT * FROM coupons ORDER BY created_at DESC`;
    return res.json({ coupons: rows });
  } catch (e) {
    return res.status(500).json({ error: '服务器错误' });
  }
});

router.post('/', adminAuth, async (req, res) => {
  try {
    await ensureCouponTables();
    let code = normalizeCode(req.body?.code);
    if (!code) {
      code = generateCouponCode();
    }
    if (!isValidCouponCode(code)) {
      return res.status(400).json({ error: '券码需为8位大写字母+数字' });
    }

    const type = String(req.body?.type || '').trim();
    const value = Number(req.body?.value);
    const minOrderAmount = req.body?.min_order_amount === undefined ? 0 : Number(req.body.min_order_amount);
    const maxDiscount = req.body?.max_discount === '' || req.body?.max_discount === null || req.body?.max_discount === undefined
      ? null
      : Number(req.body.max_discount);
    const totalQuota = req.body?.total_quota === '' || req.body?.total_quota === null || req.body?.total_quota === undefined
      ? null
      : Number(req.body.total_quota);
    const perUserLimit = req.body?.per_user_limit === undefined ? 1 : Number(req.body.per_user_limit);
    const applicableTypesRaw = req.body?.applicable_types;
    const applicableTypes = Array.isArray(applicableTypesRaw)
      ? applicableTypesRaw.join(',')
      : String(applicableTypesRaw || 'all');
    const expiresAt = parseDateOrNull(req.body?.expires_at);
    const status = req.body?.status ? String(req.body.status) : 'active';

    if (!['fixed', 'percent'].includes(type)) return res.status(400).json({ error: '优惠券类型无效' });
    if (!Number.isFinite(value) || value <= 0) return res.status(400).json({ error: '面值必须大于0' });
    if (type === 'percent' && (value < 0.1 || value > 1)) return res.status(400).json({ error: '百分比券 value 需在 0.1~1.0' });
    if (!Number.isFinite(minOrderAmount) || minOrderAmount < 0) return res.status(400).json({ error: '最低使用金额无效' });
    if (hasValue(maxDiscount) && (!Number.isFinite(maxDiscount) || maxDiscount < 0)) return res.status(400).json({ error: '最大减免无效' });
    if (hasValue(totalQuota) && (!Number.isFinite(totalQuota) || totalQuota <= 0)) return res.status(400).json({ error: '总发放量无效' });
    if (!Number.isFinite(perUserLimit) || perUserLimit <= 0) return res.status(400).json({ error: '每人限领次数无效' });

    await prisma.$executeRaw`
      INSERT INTO coupons (
        code, type, value, min_order_amount, max_discount, total_quota,
        used_count, per_user_limit, applicable_types, expires_at, created_by, status
      ) VALUES (
        ${code}, ${type}, ${value}, ${minOrderAmount}, ${maxDiscount}, ${totalQuota},
        0, ${perUserLimit}, ${applicableTypes || 'all'}, ${expiresAt}, ${req.admin?.id || null}, ${status}
      )
    `;
    const created = await getCouponByCode(code);
    return res.json({ success: true, coupon: created });
  } catch (e) {
    if (String(e?.message || '').toLowerCase().includes('unique')) {
      return res.status(400).json({ error: '券码已存在' });
    }
    return res.status(500).json({ error: '服务器错误' });
  }
});

router.patch('/:id', adminAuth, async (req, res) => {
  try {
    await ensureCouponTables();
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: '优惠券ID无效' });
    const action = String(req.body?.action || '').trim();
    let nextStatus = req.body?.status ? String(req.body.status).trim() : '';
    if (action === 'pause') nextStatus = 'paused';
    else if (action === 'resume') nextStatus = 'active';
    else if (action === 'expire') nextStatus = 'expired';
    if (!nextStatus) return res.status(400).json({ error: '请提供状态或 action' });

    const affected = await prisma.$executeRaw`UPDATE coupons SET status = ${nextStatus} WHERE id = ${id}`;
    if (!affected) return res.status(404).json({ error: '优惠券不存在' });
    const updated = (await prisma.$queryRaw`SELECT * FROM coupons WHERE id = ${id}`)[0];
    return res.json({ success: true, coupon: updated });
  } catch (e) {
    return res.status(500).json({ error: '服务器错误' });
  }
});

router.delete('/:id', adminAuth, async (req, res) => {
  try {
    await ensureCouponTables();
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: '优惠券ID无效' });
    const affected = await prisma.$executeRaw`UPDATE coupons SET status = 'deleted' WHERE id = ${id}`;
    if (!affected) return res.status(404).json({ error: '优惠券不存在' });
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: '服务器错误' });
  }
});

router.get('/:id/stats', adminAuth, async (req, res) => {
  try {
    await ensureCouponTables();
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: '优惠券ID无效' });

    const coupon = (await prisma.$queryRaw`SELECT * FROM coupons WHERE id = ${id}`)[0];
    if (!coupon) return res.status(404).json({ error: '优惠券不存在' });

    const summary = (await prisma.$queryRaw`
      SELECT
        COUNT(*) AS claimed_count,
        SUM(CASE WHEN status = 'used' THEN 1 ELSE 0 END) AS used_count,
        SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) AS expired_count
      FROM user_coupons
      WHERE coupon_id = ${id}
    `)[0];
    const byOrderTypeRows = await prisma.$queryRaw`
      SELECT order_type, COUNT(*) AS count
      FROM user_coupons
      WHERE coupon_id = ${id} AND status = 'used'
      GROUP BY order_type
      ORDER BY count DESC
    `;
    const byOrderType = (byOrderTypeRows || []).map((item) => ({
      order_type: item.order_type || null,
      count: Number(item.count || 0),
    }));

    return res.json({
      couponId: id,
      code: coupon.code,
      claimedCount: Number(summary?.claimed_count || 0),
      usedCount: Number(summary?.used_count || 0),
      expiredCount: Number(summary?.expired_count || 0),
      totalQuota: coupon.total_quota,
      usedQuota: Number(coupon.used_count || 0),
      byOrderType,
    });
  } catch (e) {
    return res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
