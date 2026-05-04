const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const auth = require('../middleware/auth');
const { createPayment, verifyCallback, PROVIDER } = require('../middleware/payment');

// ─── Stripe 支付（如已配置 STRIPE_SECRET_KEY）─────────────────────────────────
if (process.env.STRIPE_SECRET_KEY) {
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

  // GET /api/payment/config — 返回前端公钥
  router.get('/config', (req, res) => {
    res.json({ publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '' });
  });

  // POST /api/payment/create-intent — 创建 Stripe 支付意图
  router.post('/create-intent', auth, async (req, res) => {
    try {
      const { amount, currency = 'usd', orderId, orderType } = req.body;
      if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency,
        metadata: {
          orderId: orderId || '',
          orderType: orderType || 'general',
          userId: String(req.user.id)
        }
      });

      // 记录到数据库（stripe_payments 表）
      await prisma.$executeRaw`
        INSERT INTO stripe_payments (user_id, stripe_payment_intent_id, amount, currency, status, order_id, order_type, created_at, updated_at)
        VALUES (${req.user.id}, ${paymentIntent.id}, ${amount}, ${currency}, ${'pending'}, ${orderId || null}, ${orderType || null}, datetime('now'), datetime('now'))
        ON CONFLICT DO NOTHING
      `.catch(err => console.warn('Stripe payment DB write failed (non-fatal):', err.message));

      res.json({ clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id });
    } catch (err) {
      console.error('create-intent error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/payment/stripe-webhook — Stripe Webhook（原始 body，已在 app.js 提前注册）
  router.post('/stripe-webhook', async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      if (process.env.STRIPE_WEBHOOK_SECRET && sig) {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
      } else {
        event = JSON.parse(req.body.toString());
      }
    } catch (err) {
      return res.status(400).json({ error: `Webhook Error: ${err.message}` });
    }

    const pi = event.data?.object;
    if (event.type === 'payment_intent.succeeded') {
      await prisma.$executeRaw`
        UPDATE stripe_payments SET status = 'paid', updated_at = datetime('now') WHERE stripe_payment_intent_id = ${pi.id}
      `.catch(err => console.error('Webhook DB update (succeeded) failed:', err.message));
    } else if (event.type === 'payment_intent.payment_failed') {
      await prisma.$executeRaw`
        UPDATE stripe_payments SET status = 'failed', updated_at = datetime('now') WHERE stripe_payment_intent_id = ${pi.id}
      `.catch(err => console.error('Webhook DB update (failed) failed:', err.message));
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

module.exports = router;
