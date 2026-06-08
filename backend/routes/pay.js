/**
 * @route /api/pay
 * @desc  旧版支付路由（向后兼容层 — 已弃用 / DEPRECATED）
 *        ⚠️  新功能请使用 /api/payment（payment.js）
 *        本文件仅保留用于兼容旧版前端调用，请勿在此添加新的支付逻辑。
 *        所有响应会带上 Deprecation / Link 头，引导调用方迁移至 /api/payment。
 *
 *        安全说明：以下端点涉及资金托管、结算、提现与账务查询，
 *        必须经过身份认证与归属校验，平台级资金操作（托管/结算）要求管理员权限，
 *        以杜绝横向越权（IDOR）与未授权资金操作。
 */
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const prisma = require('../db/prisma');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const { paymentsEnabled, paymentsDisabledResponse } = require('../utils/payments');
const { createPaymentWithProvider } = require('../middleware/payment');

const payLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '操作过于频繁，请稍后再试' },
});

// 弃用标记：提示调用方迁移到 /api/payment（不改变现有功能）
router.use((req, res, next) => {
  res.set('Deprecation', 'true');
  res.set('Link', '</api/payment>; rel="successor-version"');
  res.set('Warning', '299 - "Deprecated: use /api/payment"');
  next();
});

// 判断当前登录用户是否为管理员（优先看 JWT 声明，再回退 DB）
async function isAdminUser(user) {
  if (!user) return false;
  if (user.isAdmin) return true;
  if (user.id == null) return false;
  try {
    const u = await prisma.user.findUnique({
      where: { id: Number(user.id) },
      select: { isAdmin: true },
    });
    return !!u?.isAdmin;
  } catch (_) {
    return false;
  }
}

// 校验当前登录用户是否拥有指定的 owner（user / guide / club）
async function userOwnsAccount(userId, ownerType, ownerId) {
  const oid = Number(ownerId);
  const uid = Number(userId);
  if (!Number.isFinite(oid) || !Number.isFinite(uid)) return false;
  if (ownerType === 'user') return oid === uid;
  if (ownerType === 'guide') {
    const rows = await prisma.$queryRaw`SELECT id FROM guides WHERE id = ${oid} AND user_id = ${uid}`;
    return rows.length > 0;
  }
  if (ownerType === 'club') {
    const rows = await prisma.$queryRaw`SELECT id FROM clubs WHERE id = ${oid} AND creator_id = ${uid}`;
    return rows.length > 0;
  }
  return false;
}

// POST /api/pay/create
router.post('/create', auth, async (req, res) => {
  if (!paymentsEnabled()) return paymentsDisabledResponse(res);
  try {
    const { amount, method, description, openid, return_url } = req.body;
    const orderNo = 'SL' + Date.now();
    const userId = req.user.id;
    await prisma.$executeRaw`
      INSERT INTO orders (user_id, order_no, amount, method, status)
      VALUES (${userId}, ${orderNo}, ${amount}, ${method || 'alipay'}, 'pending')
    `;
    const selectedMethod = String(method || 'alipay').toLowerCase();
    const paymentResult = await createPaymentWithProvider(selectedMethod, {
      orderNo,
      amount: Math.round(Number(amount || 0) * 100),
      description: description || 'SummitLink 订单',
      openid,
      returnUrl: return_url,
    }).catch((err) => {
      console.warn('[pay/create] fallback to mock payParams:', err && err.message ? err.message : err);
      return {
        provider: selectedMethod,
        payParams: {
          mock: true,
          orderNo,
        },
      };
    });
    res.json({
      success: true,
      orderNo,
      ...paymentResult,
      message: paymentResult?.payParams?.mock
        ? '订单创建成功（mock 模式）'
        : '订单创建成功',
    });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/pay/status/:orderNo
router.get('/status/:orderNo', auth, async (req, res) => {
  try {
    const order = (await prisma.$queryRaw`SELECT * FROM orders WHERE order_no = ${req.params.orderNo}`)[0];
    if (!order) return res.status(404).json({ error: '订单不存在' });
    // 归属校验：仅订单所有者或管理员可查看，防止横向越权读取他人订单
    const owns = Number(order.user_id) === Number(req.user.id);
    if (!owns && !(await isAdminUser(req.user))) {
      return res.status(403).json({ error: '无权访问该订单' });
    }
    res.json({ orderNo: order.order_no, amount: order.amount, status: order.status });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/pay/escrow — 平台资金托管（仅管理员，平台级账务操作）
router.post('/escrow', payLimiter, adminAuth, async (req, res) => {
  try {
    const { order_type, order_id, order_no, total_amount, owner_type, owner_id, commission_rate = 0.15 } = req.body;
    if (!order_type || !order_id || !total_amount) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    const platform_fee = Math.round(total_amount * commission_rate * 100) / 100;
    const owner_income = Math.round((total_amount - platform_fee) * 100) / 100;

    const existing = (await prisma.$queryRaw`SELECT id FROM platform_transactions WHERE order_type = ${order_type} AND order_id = ${order_id}`)[0];
    if (existing) {
      return res.json({ success: true, message: '已存在托管记录', transaction_id: Number(existing.id) });
    }

    const [{ id: newTxId }] = await prisma.$queryRaw`
      INSERT INTO platform_transactions (order_type, order_id, order_no, owner_type, owner_id, total_amount, platform_fee, owner_income, commission_rate, status)
      VALUES (${order_type}, ${order_id}, ${order_no || null}, ${owner_type || null}, ${owner_id || null}, ${total_amount}, ${platform_fee}, ${owner_income}, ${commission_rate}, 'held')
      RETURNING id
    `;
    const transaction_id = Number(newTxId);

    res.json({
      success: true,
      transaction_id,
      total_amount,
      platform_fee,
      owner_income,
      commission_rate,
      status: 'held',
      message: '资金已托管至平台'
    });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/pay/settle — 平台结算打款（仅管理员，平台级账务操作）
router.post('/settle', payLimiter, adminAuth, async (req, res) => {
  try {
    const { transaction_id } = req.body;
    if (!transaction_id) return res.status(400).json({ error: '缺少 transaction_id' });

    const tx = (await prisma.$queryRaw`SELECT * FROM platform_transactions WHERE id = ${transaction_id}`)[0];
    if (!tx) return res.status(404).json({ error: '托管记录不存在' });
    if (tx.status === 'settled') return res.status(400).json({ error: '该笔资金已结算' });

    const now = new Date().toISOString();
    await prisma.$executeRaw`UPDATE platform_transactions SET status = 'settled', settled_at = ${now} WHERE id = ${transaction_id}`;

    res.json({
      success: true,
      message: `结算成功，${tx.owner_income} 元将打款至 ${tx.owner_type} (ID: ${tx.owner_id})`,
      owner_income: tx.owner_income,
      platform_fee: tx.platform_fee
    });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/pay/withdraw — 提现申请（需登录 + 归属校验）
router.post('/withdraw', payLimiter, auth, async (req, res) => {
  try {
    const { owner_type, owner_id, amount, account_type = 'bank', account_info } = req.body;
    if (!owner_type || !owner_id || !amount) return res.status(400).json({ error: '缺少必要参数' });
    // 归属校验：仅账户所有者或管理员可发起提现，防止越权提取他人资金
    const owns = await userOwnsAccount(req.user.id, owner_type, owner_id);
    if (!owns && !(await isAdminUser(req.user))) {
      return res.status(403).json({ error: '无权为该账户发起提现' });
    }
    if (amount < 100) return res.status(400).json({ error: '最低提现金额为100元' });

    const fee = amount >= 1000 ? 0 : 2;
    const actual_amount = amount - fee;

    const [{ id: newWithdrawalId }] = await prisma.$queryRaw`
      INSERT INTO withdrawal_requests (owner_type, owner_id, amount, fee, actual_amount, account_type, account_info, status)
      VALUES (${owner_type}, ${owner_id}, ${amount}, ${fee}, ${actual_amount}, ${account_type}, ${JSON.stringify(account_info || {})}, 'pending')
      RETURNING id
    `;
    const request_id = Number(newWithdrawalId);

    res.json({
      success: true,
      request_id,
      amount,
      fee,
      actual_amount,
      status: 'pending',
      message: '提现申请已提交，1-3个工作日内处理'
    });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/pay/transactions — 账务查询（需登录 + 归属校验）
router.get('/transactions', payLimiter, auth, async (req, res) => {
  try {
    const { owner_type, owner_id, status } = req.query;
    if (!owner_type || !owner_id) return res.status(400).json({ error: '缺少 owner_type 和 owner_id' });
    // 归属校验：仅账户所有者或管理员可查询账务，防止横向越权读取他人账务
    const owns = await userOwnsAccount(req.user.id, owner_type, owner_id);
    if (!owns && !(await isAdminUser(req.user))) {
      return res.status(403).json({ error: '无权查看该账户账务' });
    }

    const ownerIdNum = parseInt(owner_id);
    const transactions = status
      ? await prisma.$queryRaw`
          SELECT * FROM platform_transactions
          WHERE owner_type = ${owner_type} AND owner_id = ${ownerIdNum} AND status = ${status}
          ORDER BY created_at DESC LIMIT 50`
      : await prisma.$queryRaw`
          SELECT * FROM platform_transactions
          WHERE owner_type = ${owner_type} AND owner_id = ${ownerIdNum}
          ORDER BY created_at DESC LIMIT 50`;

    const summary = (await prisma.$queryRaw`
      SELECT
        SUM(CASE WHEN status = 'held' THEN owner_income ELSE 0 END) as pending_amount,
        SUM(CASE WHEN status = 'settled' THEN owner_income ELSE 0 END) as settled_amount,
        COUNT(*) as total_orders
      FROM platform_transactions WHERE owner_type = ${owner_type} AND owner_id = ${ownerIdNum}
    `)[0];

    res.json({ transactions, summary });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
