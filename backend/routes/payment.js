const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const auth = require('../middleware/auth');
const { createPayment, verifyCallback, PROVIDER } = require('../middleware/payment');
const verifyStripeWebhook = require('../middleware/stripeWebhook');

// 如果未配置 Stripe，优雅降级
if (!process.env.STRIPE_SECRET_KEY) {
  router.all('/create-intent', (req, res) => {
    res.status(503).json({ error: 'Payment service not configured' });
  });
  router.all('/webhook', (req, res) => {
    res.status(503).json({ error: 'Payment service not configured' });
  });
  router.all('/config', (req, res) => {
    res.status(503).json({ error: 'Payment service not configured' });
  });
  router.all('/history', (req, res) => {
    res.status(503).json({ error: 'Payment service not configured' });
  });
}

const stripe = process.env.STRIPE_SECRET_KEY
  ? require('stripe')(process.env.STRIPE_SECRET_KEY)
  : null;

// GET /api/payment/provider — 当前支付提供商
router.get('/provider', (req, res) => {
  res.json({ provider: PROVIDER, mock: PROVIDER === 'mock' });
});

// POST /api/payment/create — 创建支付订单
router.post('/create', auth, async (req, res) => {
  try {
    const { order_type, order_id, amount, description, openid, return_url } = req.body;
    if (!order_id || !amount || amount <= 0) {
      return res.status(400).json({ error: '订单信息不完整' });
    }

    // 生成订单号
    const orderNo = `AL${Date.now()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    // 记录支付意向
    await prisma.$executeRaw`
      INSERT INTO payment_orders (order_no, user_id, order_type, order_ref_id, amount, status, provider, created_at)
      VALUES (${orderNo}, ${req.user.id}, ${order_type || 'general'}, ${String(order_id)}, ${amount}, ${'pending'}, ${PROVIDER}, datetime('now'))
      ON CONFLICT DO NOTHING
    `.catch(() => {}); // 表不存在时静默（迁移前）

    const result = await createPayment({
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
    await prisma.$executeRaw`
      UPDATE payment_orders SET status = 'paid', paid_at = datetime('now') WHERE order_no = ${orderNo}
    `.catch(() => {});
    res.json({ code: 'SUCCESS' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────
// Stripe 端点
// ─────────────────────────────────────────

// GET /api/payment/config — 返回前端需要的 Stripe 公钥
router.get('/config', (req, res) => {
  res.json({ publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || null });
});

// POST /api/payment/create-intent — 创建 Stripe 支付意图
router.post('/create-intent', auth, async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'Payment service not configured' });
  try {
    const { amount, currency, orderId, orderType } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: '金额不合法' });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // 转为分
      currency: currency || 'usd',
      metadata: {
        orderId: String(orderId || ''),
        orderType: String(orderType || ''),
        userId: String(req.user.id),
      },
    });

    // 记录到数据库
    await prisma.$executeRaw`
      INSERT INTO payments (user_id, stripe_payment_intent_id, amount, currency, status, order_id, order_type)
      VALUES (${req.user.id}, ${paymentIntent.id}, ${amount}, ${currency || 'usd'}, 'pending', ${String(orderId || '')}, ${String(orderType || '')})
      ON CONFLICT(stripe_payment_intent_id) DO NOTHING
    `.catch(dbErr => console.error('[payment/create-intent] DB insert error:', dbErr.message));

    res.json({ clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id });
  } catch (e) {
    console.error('[payment/create-intent]', e.message);
    res.status(500).json({ error: '创建支付意图失败' });
  }
});

// POST /api/payment/webhook — 接收 Stripe Webhook（raw body 由 app.js 预处理）
router.post('/webhook', verifyStripeWebhook, async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'Payment service not configured' });
  try {
    // req.stripeEvent 由 verifyStripeWebhook 中间件设置（已验签）
    // 若 STRIPE_WEBHOOK_SECRET 未配置（开发环境），则直接解析 body
    let event = req.stripeEvent;
    if (!event) {
      try {
        event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      } catch (e) {
        return res.status(400).json({ error: 'Invalid JSON body' });
      }
    }

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object;
        await prisma.$executeRaw`
          UPDATE payments SET status = 'paid', updated_at = datetime('now')
          WHERE stripe_payment_intent_id = ${pi.id}
        `.catch(dbErr => console.error('[payment/webhook] DB update (succeeded) error:', dbErr.message));
        break;
      }
      case 'payment_intent.payment_failed': {
        const pi = event.data.object;
        await prisma.$executeRaw`
          UPDATE payments SET status = 'failed', updated_at = datetime('now')
          WHERE stripe_payment_intent_id = ${pi.id}
        `.catch(dbErr => console.error('[payment/webhook] DB update (failed) error:', dbErr.message));
        break;
      }
      default:
        // 忽略其他事件类型
        break;
    }

    res.json({ received: true });
  } catch (e) {
    console.error('[payment/webhook]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/payment/history — 用户支付记录（需要 JWT）
router.get('/history', auth, async (req, res) => {
  try {
    const payments = await prisma.$queryRaw`
      SELECT id, stripe_payment_intent_id, amount, currency, status, order_id, order_type, created_at, updated_at
      FROM payments
      WHERE user_id = ${req.user.id}
      ORDER BY created_at DESC
    `;
    res.json(payments);
  } catch (e) {
    console.error('[payment/history]', e.message);
    res.status(500).json({ error: '获取支付记录失败' });
  }
});

module.exports = router;
