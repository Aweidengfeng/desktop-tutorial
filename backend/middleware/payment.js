/**
 * payment.js — 支付网关抽象层（渐进增强）
 * 支持：微信支付 v3、支付宝、Mock（开发/测试）
 *
 * 环境变量：
 *   PAYMENT_PROVIDER    wechat | alipay | mock（默认 mock）
 *   WECHAT_APP_ID       微信 AppID
 *   WECHAT_MCH_ID       微信商户号
 *   WECHAT_API_V3_KEY（兼容 WECHAT_API_KEY_V3） 微信支付 v3 API 密钥
 *   WECHAT_CERT_SERIAL（兼容 WECHAT_SERIAL_NO） 微信证书序列号
 *   ALIPAY_APP_ID       支付宝 AppID
 *   ALIPAY_PRIVATE_KEY  支付宝私钥
 *   ALIPAY_PUBLIC_KEY   支付宝公钥
 *   PAYMENT_NOTIFY_URL  回调通知 URL
 */

const PROVIDER = process.env.PAYMENT_PROVIDER || 'mock';
const wechatPay = require('../lib/payment/wechat-pay');
const alipay = require('../lib/payment/alipay');

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

async function createWechatPayment({ orderNo, amount, description }) {
  const payParams = await wechatPay.createNativeOrder({
    body: description,
    outTradeNo: orderNo,
    totalFee: amount,
    notifyUrl: process.env.PAYMENT_NOTIFY_URL || 'https://summitlink.com/api/payment/notify/wechat',
  });
  return {
    provider: 'wechat',
    payParams,
  };
}

async function createAlipayPayment({ orderNo, amount, description, returnUrl }) {
  const payParams = await alipay.createOrder({
    subject: description,
    outTradeNo: orderNo,
    totalAmount: (Number(amount) / 100).toFixed(2),
    returnUrl,
    notifyUrl: process.env.PAYMENT_NOTIFY_URL || 'https://summitlink.com/api/payment/notify/alipay',
  });
  return {
    provider: 'alipay',
    payParams,
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
        try { event = typeof body === 'string' ? JSON.parse(body) : (Buffer.isBuffer(body) ? JSON.parse(body.toString()) : body); } catch(e) { console.warn('[Stripe Parse]', e.message); event = body; }
        return { valid: true, event, skipped: true };
      }
      const sig = headers && headers['stripe-signature'];
      if (!sig) return { valid: false, error: 'Missing stripe-signature header' };
      const stripe = require('stripe')(stripeKey);
      const event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
      return { valid: true, event };
    }

    if (provider === 'wechat') {
      const result = await wechatPay.verifyNotify(
        body,
        headers && (headers['wechatpay-signature'] || headers['Wechatpay-Signature']),
        headers && (headers['wechatpay-timestamp'] || headers['Wechatpay-Timestamp']),
        headers && (headers['wechatpay-nonce'] || headers['Wechatpay-Nonce']),
      );
      return {
        valid: !!result.valid,
        event: result.payload,
        orderNo: result.orderNo,
        mock: !!result.mock,
        error: result.error,
      };
    }

    if (provider === 'alipay') {
      let params = body;
      if (Buffer.isBuffer(body)) {
        params = Object.fromEntries(new URLSearchParams(body.toString('utf8')));
      } else if (typeof body === 'string') {
        params = Object.fromEntries(new URLSearchParams(body));
      }
      const result = await alipay.verifyNotify(params || {});
      return {
        valid: !!result.valid,
        orderNo: result.outTradeNo,
        mock: !!result.mock,
      };
    }

    return { valid: false, error: `未知支付提供商: ${provider}` };
  } catch(e) {
    return { valid: false, error: e.message };
  }
}

module.exports = { createPayment, createPaymentWithProvider, verifyCallback, PROVIDER };
