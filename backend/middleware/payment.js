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
  if (PROVIDER === 'mock' || process.env.NODE_ENV === 'test') {
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

  if (PROVIDER === 'wechat') {
    return createWechatPayment({ orderNo, amount, description, openid });
  }

  if (PROVIDER === 'alipay') {
    return createAlipayPayment({ orderNo, amount, description, returnUrl });
  }

  throw new Error(`不支持的支付提供商: ${PROVIDER}`);
}

async function createWechatPayment({ orderNo, amount, description, openid }) {
  // 微信支付 v3 JSAPI 下单
  const body = {
    appid: process.env.WECHAT_APP_ID,
    mchid: process.env.WECHAT_MCH_ID,
    description,
    out_trade_no: orderNo,
    notify_url: process.env.PAYMENT_NOTIFY_URL || 'https://alpinelink.com/api/payment/notify/wechat',
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
 */
async function verifyCallback(provider, headers, body) {
  if (provider === 'mock') return { valid: true, orderNo: body.orderNo };
  // TODO: 实际签名验证
  return { valid: false, error: '回调验证框架占位' };
}

module.exports = { createPayment, verifyCallback, PROVIDER };
