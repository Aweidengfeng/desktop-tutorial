const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const auth = require('../middleware/auth');
const { createPayment, verifyCallback, PROVIDER } = require('../middleware/payment');

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
      description: description || 'AlpineLink 订单',
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
      <h2>🏔️ AlpineLink Mock 支付</h2>
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
