/**
 * @route /api/payment
 * @desc  主支付路由（新版，推荐使用）
 *        职责：Stripe Webhook、支付意图创建/确认、支付宝/微信支付（CN）、
 *              订单支付状态管理、退款处理
 *        ⚠️  /api/pay 是旧版兼容层，新功能不要加到那里
 */
const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const auth = require('../middleware/auth');
const { createPaymentWithProvider, verifyCallback, PROVIDER } = require('../middleware/payment');
const { paymentsEnabled, paymentsDisabledResponse } = require('../utils/payments');
const { captureEvent } = require('../middleware/sentry');

const stripeKey = (process.env.STRIPE_SECRET_KEY || '').trim();
const stripeDisabledByFlag = String(process.env.STRIPE_DISABLED || '').toLowerCase() === 'true';
const stripeDisabledByMissingKey = !stripeKey;
const stripeDisabled = stripeDisabledByFlag || stripeDisabledByMissingKey;
const paymentsFeatureDisabled = !paymentsEnabled();
const stripeDisabledReason = stripeDisabledByFlag
  ? 'STRIPE_DISABLED=true'
  : 'STRIPE_SECRET_KEY missing';

function makeDisabledHandler(reason) {
  return (req, res) => res.status(503).json({
    error: 'payment_unavailable',
    message: '支付功能暂未开放，请稍后再试',
    reason,
  });
}

function resolveProvider(req) {
  const forced = String((req.query && req.query.provider) || (req.body && req.body.provider) || '').toLowerCase().trim();
  if (forced === 'stripe' || forced === 'wechat' || forced === 'alipay' || forced === 'mock') {
    return forced;
  }
  const available = Array.isArray(req.regionConfig && req.regionConfig.paymentProviders)
    ? req.regionConfig.paymentProviders
    : [];
  if (req.region === 'cn') {
    if (available.includes('wechat')) return 'wechat';
    if (available.includes('alipay')) return 'alipay';
  }
  if (req.region === 'us' && available.includes('stripe')) return 'stripe';
  return PROVIDER;
}

if (!stripeDisabled && process.env.NODE_ENV === 'production' && stripeKey.startsWith('sk_test_')) {
  throw new Error(
    '[Stripe] 生产环境禁止使用测试密钥（sk_test_...）。\n' +
    '  请在 Railway → Variables 中将 STRIPE_SECRET_KEY 替换为正式密钥（sk_live_...）。\n' +
    '  正式密钥可在 https://dashboard.stripe.com/apikeys 获取。\n' +
    '  如需临时禁用支付让服务恢复，请在 Railway Variables 设置 STRIPE_DISABLED=true。'
  );
}

if (paymentsFeatureDisabled || stripeDisabled) {
  const disabledHandler = paymentsFeatureDisabled
    ? (req, res) => paymentsDisabledResponse(res)
    : makeDisabledHandler(stripeDisabledReason);
  const routes = [
    ['get', '/config'],
    ['post', '/create-intent'],
    ['post', '/create-payment-intent'],
    ['post', '/stripe-webhook'],
    ['get', '/stripe-history'],
    ['get', '/stripe-stats'],
    ['get', '/provider'],
    ['post', '/create'],
    ['get', '/mock-pay'],
    ['post', '/mock-confirm'],
    ['post', '/notify/wechat'],
  ];
  for (const [method, path] of routes) {
    router[method](path, disabledHandler);
  }
  if (paymentsFeatureDisabled) {
    console.log('[payments] PAYMENTS_ENABLED=false, payment routes return 503');
  } else {
    console.warn(`[Stripe] ⚠️ 支付功能已降级（503）。原因: ${stripeDisabledReason}`);
  }
} else {
  const stripe = require('stripe')(stripeKey);

  // 内部订单类型 → 表/金额列 映射
  // ⚠️ 安全要点：
  //   - 表名 / 列名是硬编码白名单，绝不能从用户输入派生
  //   - 金额必须从数据库重新计算，绝不能信任前端传来的 amount
  const ORDER_TABLES = Object.freeze({
    expedition:    { table: 'expedition_orders',    amountColumn: 'total'  },
    activity:      { table: 'activity_orders',      amountColumn: 'amount' },
    guide_service: { table: 'guide_service_orders', amountColumn: 'amount' },
  });
  // 允许在 $executeRawUnsafe / $queryRawUnsafe 中拼接的表名 / 列名白名单
  const ALLOWED_TABLES   = new Set(Object.values(ORDER_TABLES).map(m => m.table));
  const ALLOWED_AMOUNT_COLUMNS = new Set(Object.values(ORDER_TABLES).map(m => m.amountColumn));
  function getOrderMapping(orderType) {
    if (!Object.prototype.hasOwnProperty.call(ORDER_TABLES, orderType)) return null;
    const m = ORDER_TABLES[orderType];
    if (!ALLOWED_TABLES.has(m.table) || !ALLOWED_AMOUNT_COLUMNS.has(m.amountColumn)) return null;
    return m;
  }

  // 状态机：哪些订单状态允许发起支付
  const PAYABLE_STATUSES = new Set(['pending_payment', 'pending']);

  // 状态机：哪些 stripe_payments 状态允许被 webhook 推进到 paid
  // （避免把 refunded / canceled 反向变回 paid）
  function canTransitionTo(current, next) {
    if (current === next) return false;
    if (current === 'refunded' || current === 'canceled') return false;
    return true;
  }

  // GET /api/payment/config — 返回前端公钥
  router.get('/config', (req, res) => {
    res.json({ publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '' });
  });

  // POST /api/payment/create-intent — 创建 Stripe 支付意图
  // 安全要点：
  //  1) 必须提供 orderType + orderId，服务端按订单表重算金额（拒绝信任前端 amount）
  //  2) 校验订单归属当前用户，且订单处于可支付状态
  //  3) 使用 Stripe idempotencyKey 防止同一订单生成多个 intent
  const createIntentHandler = async (req, res) => {
    try {
      const { orderId, orderType, currency = 'usd' } = req.body || {};
      const mapping = getOrderMapping(orderType);
      if (!mapping || !orderId) {
        return res.status(400).json({ error: 'orderType 或 orderId 缺失或不支持' });
      }
      const orderIdNum = Number(orderId);
      if (!Number.isInteger(orderIdNum) || orderIdNum <= 0) {
        return res.status(400).json({ error: 'orderId 不合法' });
      }
      // 服务端按订单表重新查询金额（不信任前端）
      // 二次防御：表名 / 列名再次断言命中白名单后再拼接到 SQL
      if (!ALLOWED_TABLES.has(mapping.table) || !ALLOWED_AMOUNT_COLUMNS.has(mapping.amountColumn)) {
        return res.status(400).json({ error: 'orderType 不合法' });
      }
      const rows = await prisma.$queryRawUnsafe(
        `SELECT id, user_id, status, ${mapping.amountColumn} AS amount FROM ${mapping.table} WHERE id = ? AND user_id = ?`,
        orderIdNum,
        req.user.id,
      );
      const order = Array.isArray(rows) ? rows[0] : null;
      if (!order) {
        return res.status(404).json({ error: '订单不存在或不属于当前用户' });
      }
      if (!PAYABLE_STATUSES.has(order.status)) {
        return res.status(409).json({ error: `订单状态不可支付：${order.status}` });
      }
      const amount = Number(order.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(409).json({ error: '订单金额无效' });
      }

      // Stripe idempotencyKey 保证同一订单 + 用户重复请求时返回同一 intent，避免重复扣款
      const idempotencyKey = `intent:${orderType}:${orderIdNum}:${req.user.id}`;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency,
        metadata: {
          orderId: String(orderIdNum),
          orderType,
          userId: String(req.user.id),
        },
      }, { idempotencyKey });

      // 记录到数据库（stripe_payments 表）
      await prisma.$executeRaw`
        INSERT INTO stripe_payments (user_id, stripe_payment_intent_id, amount, currency, status, order_id, order_type, created_at, updated_at)
        VALUES (${req.user.id}, ${paymentIntent.id}, ${amount}, ${currency}, ${'pending'}, ${String(orderIdNum)}, ${orderType}, datetime('now'), datetime('now'))
        ON CONFLICT DO NOTHING
      `.catch(err => console.warn('Stripe payment DB write failed (non-fatal):', err.message));

      res.json({ clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id });
    } catch (err) {
      captureEvent({
        message: 'payment.create_intent.failed',
        level: 'error',
      }, {
        userId: req.user?.id,
        tags: { module: 'payment', action: 'create-intent' },
        extra: { error: err.message, orderType: req.body?.orderType || null, orderId: req.body?.orderId || null },
      });
      console.error('create-intent error:', err.message);
      res.status(500).json({ error: 'create-intent failed' });
    }
  };
  router.post('/create-intent', auth, createIntentHandler);
  router.post('/create-payment-intent', auth, createIntentHandler);

  // POST /api/payment/stripe-webhook — Stripe Webhook（原始 body，已在 app.js 提前注册）
  // 安全要点：
  //  1) 生产环境必须校验签名
  //  2) 通过 stripe_webhook_events.stripe_event_id UNIQUE 防重放（Stripe 网络抖动会重发同一事件）
  //  3) 处理 succeeded / failed / canceled / charge.refunded，并按 metadata 同步内部订单状态
  router.post('/stripe-webhook', async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      if (process.env.STRIPE_WEBHOOK_SECRET && sig) {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
      } else if (process.env.NODE_ENV === 'production') {
        // 生产环境必须验证签名，禁止接受未签名事件
        return res.status(400).json({ error: 'Webhook signature required in production' });
      } else {
        event = JSON.parse(req.body.toString());
      }
    } catch (err) {
      return res.status(400).json({ error: `Webhook Error: ${err.message}` });
    }

    if (!event || !event.id) {
      return res.status(400).json({ error: 'Invalid event' });
    }

    // 幂等/防重放：UNIQUE(stripe_event_id) 约束保证同一 event.id 只处理一次
    const pi = event.data && event.data.object ? event.data.object : null;
    const piId = pi && pi.id ? String(pi.id) : null;
    try {
      await prisma.$executeRaw`
        INSERT INTO stripe_webhook_events (stripe_event_id, type, payment_intent_id, received_at)
        VALUES (${event.id}, ${event.type || ''}, ${piId}, datetime('now'))
      `;
    } catch (err) {
      // UNIQUE 冲突 = 重复事件 → 直接返回 200，避免 Stripe 持续重试
      if (err && /UNIQUE|duplicate|constraint/i.test(err.message || '')) {
        return res.json({ received: true, duplicate: true });
      }
      console.error('Webhook idempotency record failed:', err.message);
      // 不阻塞处理，但需要后续观察
    }

    // 根据事件类型推进 stripe_payments 与内部订单状态
    async function updateInternalOrder(metadata, nextStatus) {
      const orderType = metadata && metadata.orderType;
      const orderId = metadata && metadata.orderId;
      const mapping = orderType ? getOrderMapping(orderType) : null;
      if (!mapping || !orderId) return;
      // 二次防御：拼接前断言表名 / 列名命中白名单
      if (!ALLOWED_TABLES.has(mapping.table)) return;
      const orderIdNum = Number(orderId);
      if (!Number.isInteger(orderIdNum) || orderIdNum <= 0) return;
      // 仅允许已知状态字符串，避免间接被注入到日志/字符串拼接
      const ALLOWED_NEXT = new Set(['paid', 'refunded', 'failed', 'canceled']);
      if (!ALLOWED_NEXT.has(nextStatus)) return;
      try {
        // 兼容性：旧代码在 expedition_orders/activity_orders/guide_service_orders 等表中
        // 既写过英式 'cancelled' 也写过美式 'canceled'（Stripe 事件用美式拼写：
        // payment_intent.canceled），因此 WHERE 子句同时排除两种拼写，避免误把已取消单回滚为 paid。
        // 推荐后续统一为 'cancelled'（英式，仓库现状用得多）；映射工作不在本 PR 范围。
        await prisma.$executeRawUnsafe(
          `UPDATE ${mapping.table} SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status NOT IN ('refunded','cancelled','canceled')`,
          nextStatus,
          orderIdNum,
        );
      } catch (err) {
        // 不把外部数据放进格式串，避免 tainted-format-string
        console.error('Webhook internal order update failed', {
          orderType, orderId: orderIdNum, nextStatus, error: err && err.message,
        });
      }
    }

    async function setStripePaymentStatus(paymentIntentId, nextStatus) {
      if (!paymentIntentId) return null;
      // 读取当前状态，做状态机保护
      const rows = await prisma.$queryRaw`
        SELECT status, order_type, order_id FROM stripe_payments WHERE stripe_payment_intent_id = ${paymentIntentId}
      `.catch(() => []);
      const cur = Array.isArray(rows) ? rows[0] : null;
      if (cur && !canTransitionTo(cur.status, nextStatus)) {
        return cur;
      }
      await prisma.$executeRaw`
        UPDATE stripe_payments SET status = ${nextStatus}, updated_at = datetime('now')
        WHERE stripe_payment_intent_id = ${paymentIntentId}
      `.catch(err => console.error(`Webhook DB update (${nextStatus}) failed:`, err.message));
      return cur;
    }

    try {
      if (event.type === 'payment_intent.succeeded' && pi) {
        const prev = await setStripePaymentStatus(pi.id, 'paid');
        // 用 metadata 优先，回退到 stripe_payments 记录
        const meta = (pi.metadata && pi.metadata.orderType) ? pi.metadata
          : (prev ? { orderType: prev.order_type, orderId: prev.order_id } : null);
        if (meta) {
          // 处理向导/俱乐部上架费：更新状态为 verified/active
          if (meta.orderType === 'guide_listing') {
            const appId = Number(meta.orderId);
            if (Number.isInteger(appId) && appId > 0) {
              try {
                const expiresAt = new Date();
                expiresAt.setFullYear(expiresAt.getFullYear() + 1);
                await prisma.$executeRaw`
                  UPDATE guides SET status = 'approved', listing_fee_paid = 1, listing_fee_paid_at = CURRENT_TIMESTAMP,
                    cert_expires_at = ${expiresAt.toISOString()}
                  WHERE user_id = (SELECT user_id FROM guide_applications WHERE id = ${appId})
                    AND status = 'approved_pending_payment'
                `;
                await prisma.$executeRaw`
                  UPDATE guide_applications SET status = 'approved', listing_fee_paid = 1, listing_fee_paid_at = CURRENT_TIMESTAMP
                  WHERE id = ${appId} AND status = 'approved_pending_payment'
                `;
              } catch (guideErr) {
                console.error('Webhook guide_listing update failed:', guideErr.message);
              }
            }
          } else if (meta.orderType === 'club_listing') {
            const appId = Number(meta.orderId);
            if (Number.isInteger(appId) && appId > 0) {
              try {
                const expiresAt = new Date();
                expiresAt.setFullYear(expiresAt.getFullYear() + 1);
                await prisma.$executeRaw`
                  UPDATE clubs SET status = 'active', verified = 1, listing_fee_paid = 1,
                    listing_fee_paid_at = CURRENT_TIMESTAMP, cert_expires_at = ${expiresAt.toISOString()}
                  WHERE creator_id = (SELECT user_id FROM club_applications WHERE id = ${appId})
                    AND status = 'approved_pending_payment'
                `;
                await prisma.$executeRaw`
                  UPDATE club_applications SET status = 'approved', listing_fee_paid = 1, listing_fee_paid_at = CURRENT_TIMESTAMP
                  WHERE id = ${appId} AND status = 'approved_pending_payment'
                `;
              } catch (clubErr) {
                console.error('Webhook club_listing update failed:', clubErr.message);
              }
            }
          } else {
            await updateInternalOrder(meta, 'paid');
          }
        }
      } else if (event.type === 'payment_intent.payment_failed' && pi) {
        await setStripePaymentStatus(pi.id, 'failed');
      } else if (event.type === 'payment_intent.canceled' && pi) {
        await setStripePaymentStatus(pi.id, 'canceled');
      } else if (event.type === 'charge.refunded' && pi) {
        // charge.refunded 的 object 是 charge；payment_intent 字段指向对应 PI
        const refundedPiId = pi.payment_intent ? String(pi.payment_intent) : null;
        const prev = await setStripePaymentStatus(refundedPiId, 'refunded');
        if (prev) {
          await updateInternalOrder({ orderType: prev.order_type, orderId: prev.order_id }, 'refunded');
        }
      }
    } catch (err) {
      console.error('Webhook handler error:', err.message);
      // 仍返回 200，避免 Stripe 永久重试；已持久化 event.id，可后续人工补偿
    }

    res.json({ received: true });
  });

  // GET /api/payment/stripe-history — 用户 Stripe 支付记录
  router.get('/stripe-history', auth, async (req, res) => {
    try {
      const payments = await prisma.$queryRaw`
        SELECT * FROM stripe_payments WHERE user_id = ${req.user.id} ORDER BY created_at DESC LIMIT 50
      `;
      res.json(payments);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/payment/stripe-stats — Stripe 支付统计（用于投资人看板）
  router.get('/stripe-stats', auth, async (req, res) => {
    try {
      const [totalRevenue, totalCount, byStatus] = await Promise.all([
        prisma.$queryRaw`SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as cnt FROM stripe_payments WHERE status = 'paid'`,
        prisma.$queryRaw`SELECT COUNT(*) as cnt FROM stripe_payments`,
        prisma.$queryRaw`SELECT status, COUNT(*) as cnt FROM stripe_payments GROUP BY status`
      ]);
      res.json({
        totalRevenue: Number(totalRevenue[0].total) || 0,
        paidCount: Number(totalRevenue[0].cnt) || 0,
        totalCount: Number(totalCount[0].cnt) || 0,
        byStatus
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}

// GET /api/payment/provider — 当前支付提供商
router.get('/provider', (req, res) => {
  const provider = resolveProvider(req);
  const providers = Array.isArray(req.regionConfig && req.regionConfig.paymentProviders)
    ? req.regionConfig.paymentProviders
    : [provider];
  res.json({ region: req.region || 'us', provider, providers, mock: provider === 'mock' });
});

// POST /api/payment/create — 创建支付订单
router.post('/create', auth, async (req, res) => {
  try {
    const { order_type, order_id, amount, description, openid, return_url } = req.body;
    if (!order_id || !amount || amount <= 0) {
      return res.status(400).json({ error: '订单信息不完整' });
    }
    const selectedProvider = resolveProvider(req);

    // 生成订单号
    const orderNo = `AL${Date.now()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    // 记录支付意向
    await prisma.$executeRaw`
      INSERT INTO payment_orders (order_no, user_id, order_type, order_ref_id, amount, status, provider, created_at)
      VALUES (${orderNo}, ${req.user.id}, ${order_type || 'general'}, ${String(order_id)}, ${amount}, ${'pending'}, ${selectedProvider}, datetime('now'))
      ON CONFLICT DO NOTHING
    `.catch(() => {}); // 表不存在时静默（迁移前）

    if (selectedProvider === 'stripe') {
      return res.json({
        orderNo,
        provider: 'stripe',
        payParams: {
          action: 'create_intent',
          endpoint: '/api/payment/create-intent',
        },
        message: 'Use /api/payment/create-intent to create a Stripe PaymentIntent（请使用 /api/payment/create-intent 创建 Stripe 支付意图）',
      });
    }

    const result = await createPaymentWithProvider(selectedProvider, {
      orderNo,
      amount: Math.round(amount * 100), // 转为分
      description: description || 'SummitLink 订单',
      openid,
      returnUrl: return_url,
    });

    res.json({ orderNo, ...result });
  } catch (e) {
    console.error('[payment/create]', e.message);
    res.status(500).json({ error: '创建支付订单失败' });
  }
});

// GET /api/payment/mock-pay — Mock 支付页面（仅开发/测试）
router.get('/mock-pay', async (req, res) => {
  if (process.env.NODE_ENV === 'production') return res.status(404).send('Not Found');
  const escape = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#x27;');
  const orderNo = escape(req.query.orderNo || '');
  const amount = escape(req.query.amount || '0');
  const amountDisplay = (parseFloat(amount) / 100).toFixed(2);
  // Use JSON.stringify to safely embed orderNo in the JS context
  const orderNoJson = JSON.stringify(String(req.query.orderNo || ''));
  res.send(`
    <html><body style="font-family:sans-serif;text-align:center;padding:40px">
      <h2>🏔️ SummitLink Mock 支付</h2>
      <p>订单号：<strong>${orderNo}</strong></p>
      <p>金额：<strong>¥${amountDisplay}</strong></p>
      <button onclick="pay()" style="background:#1e40af;color:white;padding:12px 32px;border:none;border-radius:6px;font-size:16px;cursor:pointer">确认支付</button>
      <script>
        async function pay() {
          await fetch('/api/payment/mock-confirm', {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({orderNo: ${orderNoJson}})
          });
          document.body.innerHTML = '<h2 style="color:green">✅ 支付成功！</h2><p>3秒后关闭...</p>';
          setTimeout(() => window.close(), 3000);
        }
      </script>
    </body></html>
  `);
});

// POST /api/payment/mock-confirm — Mock 支付确认
router.post('/mock-confirm', async (req, res) => {
  if (process.env.NODE_ENV === 'production') return res.status(404).json({ error: 'Not Found' });
  const { orderNo } = req.body;
  await prisma.$executeRaw`
    UPDATE payment_orders SET status = 'paid', paid_at = datetime('now') WHERE order_no = ${orderNo}
  `.catch(() => {});
  res.json({ success: true, orderNo });
});

// POST /api/payment/notify/wechat — 微信支付回调
router.post('/notify/wechat', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const { valid, orderNo } = await verifyCallback('wechat', req.headers, req.body);
    if (!valid) return res.status(400).json({ error: '签名验证失败' });
    if (orderNo) {
      await prisma.$executeRaw`
        UPDATE payment_orders SET status = 'paid', paid_at = datetime('now') WHERE order_no = ${orderNo}
      `.catch((err) => console.warn('[payment/notify/wechat] update payment_orders failed:', err.message));
    }
    res.json({ code: 'SUCCESS' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/payment/wechat/qrcode — 获取微信 NATIVE 支付二维码（适用于非微信内浏览器）
// 返回 { codeUrl, orderId, expireAt }；mock 模式返回 { codeUrl: 'weixin://...', mock: true }
/**
 * @swagger
 * /api/payment/wechat/qrcode:
 *   post:
 *     tags: [订单]
 *     summary: 生成微信支付二维码
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [order_id, amount]
 *             properties:
 *               order_type: { type: string }
 *               order_id: { type: string }
 *               amount: { type: number }
 *               description: { type: string }
 *     responses:
 *       200:
 *         description: 返回二维码链接
 */
router.post('/wechat/qrcode', auth, async (req, res) => {
  try {
    const wechatPay = require('../lib/payment/wechat-pay');
    const { order_type = 'expedition', order_id, amount, description } = req.body || {};
    if (!order_id || !amount || amount <= 0) {
      return res.status(400).json({ error: '订单信息不完整' });
    }
    const orderNo = `WX${Date.now()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const totalFee = Math.round(Number(amount) * 100); // 转为分
    const notifyUrl = process.env.PAYMENT_NOTIFY_URL
      || `${process.env.API_BASE || 'https://summitlink.app'}/api/payment/notify/wechat`;
    const expireAt = new Date(Date.now() + 120 * 1000).toISOString(); // 120 秒有效期

    // 记录支付意向
    await prisma.$executeRaw`
      INSERT INTO payment_orders (order_no, user_id, order_type, order_ref_id, amount, status, provider, created_at)
      VALUES (${orderNo}, ${req.user.id}, ${order_type}, ${String(order_id)}, ${amount}, ${'pending'}, ${'wechat'}, datetime('now'))
      ON CONFLICT DO NOTHING
    `.catch((e) => console.warn('[payment/wechat/qrcode] insert payment_orders failed:', e.message));

    const result = await wechatPay.createNativeOrder({
      body: description || 'SummitLink 订单',
      outTradeNo: orderNo,
      totalFee,
      notifyUrl,
    });

    res.json({
      codeUrl: result.codeUrl,
      orderId: orderNo,
      expireAt,
      mock: result.mock || false,
    });
  } catch (e) {
    captureEvent({
      message: 'payment.wechat_qrcode.failed',
      level: 'error',
    }, {
      userId: req.user?.id,
      tags: { module: 'payment', action: 'wechat-qrcode' },
      extra: { error: e.message },
    });
    console.error('[payment/wechat/qrcode]', e.message);
    res.status(500).json({ error: '生成微信二维码失败' });
  }
});

// GET /api/payment/wechat/query?orderId=xxx — 轮询微信支付状态
router.get('/wechat/query', auth, async (req, res) => {
  try {
    const wechatPay = require('../lib/payment/wechat-pay');
    const { orderId } = req.query;
    if (!orderId) return res.status(400).json({ error: '缺少 orderId 参数' });

    // 先从本地 DB 查询
    const rows = await prisma.$queryRaw`
      SELECT status FROM payment_orders WHERE order_no = ${orderId} AND user_id = ${req.user.id}
    `.catch(() => []);
    if (rows.length > 0 && rows[0].status === 'paid') {
      return res.json({ paid: true, status: 'paid', orderId });
    }

    // 向微信查询（mock 模式直接返回）
    const result = await wechatPay.queryOrder({ outTradeNo: orderId });
    const paid = result.tradeState === 'SUCCESS';

    if (paid) {
      await prisma.$executeRaw`
        UPDATE payment_orders SET status = 'paid', paid_at = datetime('now') WHERE order_no = ${orderId}
      `.catch(() => {});
    }

    res.json({ paid, status: result.tradeState, orderId, mock: result.mock || false });
  } catch (e) {
    console.error('[payment/wechat/query]', e.message);
    res.status(500).json({ error: '查询支付状态失败' });
  }
});

module.exports = router;
