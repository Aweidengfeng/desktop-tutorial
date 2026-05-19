/**
 * payment.js — 支付网关抽象层（渐进增强）
 * 支持：微信支付 v3、支付宝、Mock（开发/测试）
 *
 * 环境变量：
 *   PAYMENT_PROVIDER    wechat | alipay | mock（默认 mock）
 *   WECHAT_APP_ID       微信 AppID
 *   WECHAT_MCH_ID       微信商户号
 *   WECHAT_API_KEY_V3   微信支付 v3 API 密钥
 *   WECHAT_SERIAL_NO    微信证书序列号
 *   ALIPAY_APP_ID       支付宝 AppID
 *   ALIPAY_PRIVATE_KEY  支付宝私钥
 *   ALIPAY_PUBLIC_KEY   支付宝公钥
 *   PAYMENT_NOTIFY_URL  回调通知 URL
 */

const PROVIDER = process.env.PAYMENT_PROVIDER || 'mock';

function normalizeProvider(provider) {
  const value = String(provider || '').toLowerCase().trim();
  if (value === 'wechat' || value === 'alipay' || value === 'mock') return value;
  return PROVIDER;
}

/**
 * 创建支付订单
 * @param {object} options
 * @param {string} options.orderNo       订单号
 * @param {number} options.amount        金额（分）
 * @param {string} options.description   商品描述
 * @param {string} options.openid        微信 openid（微信支付必填）
 * @param {string} options.returnUrl     同步跳转 URL（支付宝）
 * @returns {Promise<{provider, payParams}>}
 */
async function createPayment({ orderNo, amount, description, openid, returnUrl }) {
  return createPaymentWithProvider(PROVIDER, { orderNo, amount, description, openid, returnUrl });
}

async function createPaymentWithProvider(provider, { orderNo, amount, description, openid, returnUrl }) {
  const resolvedProvider = normalizeProvider(provider);
  if (resolvedProvider === 'mock' || process.env.NODE_ENV === 'test') {
    // Mock 支付：直接返回模拟支付参数
    return {
      provider: 'mock',
      payParams: {
        mock: true,
        orderNo,
        amount,
        description,
        mockPayUrl: `/api/payment/mock-pay?orderNo=${orderNo}&amount=${amount}`,
      },
    };
  }

  if (resolvedProvider === 'wechat') {
    return createWechatPayment({ orderNo, amount, description, openid });
  }

  if (resolvedProvider === 'alipay') {
    return createAlipayPayment({ orderNo, amount, description, returnUrl });
  }

  throw new Error(`不支持的支付提供商: ${resolvedProvider}`);
}

async function createWechatPayment({ orderNo, amount, description, openid }) {
  // 微信支付 v3 JSAPI 下单
  const body = {
    appid: process.env.WECHAT_APP_ID,
    mchid: process.env.WECHAT_MCH_ID,
    description,
    out_trade_no: orderNo,
    notify_url: process.env.PAYMENT_NOTIFY_URL || 'https://summitlink.com/api/payment/notify/wechat',
    amount: { total: amount, currency: 'CNY' },
    payer: { openid },
  };

  // TODO: 实际微信支付 v3 签名逻辑（需证书文件）
  // 此处为框架占位，生产接入时补充签名实现
  console.log('[payment] 微信支付下单 (框架):', orderNo, amount);
  return {
    provider: 'wechat',
    payParams: { framework: true, message: '请配置微信支付证书后启用' },
  };
}

async function createAlipayPayment({ orderNo, amount, description, returnUrl }) {
  // 支付宝 PC/H5 支付框架
  console.log('[payment] 支付宝下单 (框架):', orderNo, amount);
  return {
    provider: 'alipay',
    payParams: { framework: true, message: '请配置支付宝密钥后启用' },
  };
}

/**
 * 验证支付回调签名
 * - mock：直接返回 valid: true
 * - stripe：使用 stripe.webhooks.constructEvent 验证；未配置密钥时跳过（开发模式）
 * - wechat：检查基础字段存在性（完整 v3 签名需证书）
 * - alipay：需配置 ALIPAY_PUBLIC_KEY（完整 RSA2 待实现）
 */
async function verifyCallback(provider, headers, body) {
  if (provider === 'mock') return { valid: true, orderNo: body && body.orderNo };
  try {
    if (provider === 'stripe') {
      const stripeKey = process.env.STRIPE_SECRET_KEY;
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!stripeKey || !webhookSecret) {
        // Stripe 未配置，跳过验证（开发模式）
        let event;
        try { event = typeof body === 'string' ? JSON.parse(body) : (Buffer.isBuffer(body) ? JSON.parse(body.toString()) : body); } catch(e) { event = body; }
        return { valid: true, event, skipped: true };
      }
      const sig = headers && headers['stripe-signature'];
      if (!sig) return { valid: false, error: 'Missing stripe-signature header' };
      const stripe = require('stripe')(stripeKey);
      const event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
      return { valid: true, event };
    }

    if (provider === 'wechat') {
      // 微信支付 v3：需要证书文件验签（完整实现待 WECHAT_API_KEY_V3 配置）
      const wechatApiKeyV3 = process.env.WECHAT_API_KEY_V3;
      let parsed;
      try { parsed = typeof body === 'string' ? JSON.parse(body) : (Buffer.isBuffer(body) ? JSON.parse(body.toString()) : body); } catch(e) { parsed = body; }
      if (!wechatApiKeyV3) {
        // 无密钥时，检查基础字段存在性作为预验证
        const hasRequiredFields = parsed && (parsed.event_type || parsed.resource);
        return { valid: !!hasRequiredFields, event: parsed, skipped: true, warning: '微信支付 v3 签名验证需配置证书，当前跳过' };
      }
      // TODO: 完整微信 v3 HMAC-SHA256 签名验证（需 WECHAT_SERIAL_NO + 证书）
      return { valid: false, error: '微信支付签名验证需要完整证书配置' };
    }

    if (provider === 'alipay') {
      // 支付宝：RSA2 验签（需 ALIPAY_PUBLIC_KEY）
      const alipayPublicKey = process.env.ALIPAY_PUBLIC_KEY;
      if (!alipayPublicKey) {
        return { valid: false, error: '支付宝验签需配置 ALIPAY_PUBLIC_KEY' };
      }
      // TODO: 实装 RSA2 验签
      return { valid: false, error: '支付宝 RSA2 验签待实现' };
    }

    return { valid: false, error: `未知支付提供商: ${provider}` };
  } catch(e) {
    return { valid: false, error: e.message };
  }
}

module.exports = { createPayment, createPaymentWithProvider, verifyCallback, PROVIDER };
