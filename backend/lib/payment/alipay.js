'use strict';

const REQUIRED_KEYS = [
  'ALIPAY_APP_ID',
  'ALIPAY_PRIVATE_KEY',
  'ALIPAY_PUBLIC_KEY',
];

let warnedMock = false;

function decodeBase64Pem(value) {
  if (!value) return '';
  const raw = String(value).trim();
  if (raw.includes('BEGIN')) return raw.replace(/\\n/g, '\n');
  try {
    return Buffer.from(raw, 'base64').toString('utf8').replace(/\\n/g, '\n').trim();
  } catch (_) {
    return raw.replace(/\\n/g, '\n');
  }
}

function getConfig() {
  return {
    appId: (process.env.ALIPAY_APP_ID || '').trim(),
    privateKey: decodeBase64Pem(process.env.ALIPAY_PRIVATE_KEY),
    publicKey: decodeBase64Pem(process.env.ALIPAY_PUBLIC_KEY),
    gateway: (process.env.ALIPAY_GATEWAY || 'https://openapi.alipay.com/gateway.do').trim(),
  };
}

function getMissingRequired(config = getConfig()) {
  return REQUIRED_KEYS.filter((key) => {
    if (key === 'ALIPAY_APP_ID') return !config.appId;
    if (key === 'ALIPAY_PRIVATE_KEY') return !config.privateKey;
    if (key === 'ALIPAY_PUBLIC_KEY') return !config.publicKey;
    return !process.env[key];
  });
}

function warnMock(method, missing) {
  if (warnedMock) return;
  warnedMock = true;
  console.warn(`[alipay] ${method} 使用 mock 模式，缺少环境变量: ${missing.join(', ')}`);
}

function createSdk(config) {
  const AlipaySdk = require('alipay-sdk').default;
  return new AlipaySdk({
    appId: config.appId,
    privateKey: config.privateKey,
    alipayPublicKey: config.publicKey,
    gateway: config.gateway,
  });
}

async function createOrder({ subject, outTradeNo, totalAmount, returnUrl, notifyUrl }) {
  const config = getConfig();
  const missing = getMissingRequired(config);
  if (missing.length > 0) {
    warnMock('createOrder', missing);
    return {
      mock: true,
      outTradeNo,
      sign_str: `mock_alipay_sign_${outTradeNo || Date.now()}`,
      pagePayUrl: `https://mock.alipay.local/pay?outTradeNo=${encodeURIComponent(outTradeNo || '')}`,
    };
  }

  const sdk = createSdk(config);
  const bizContent = {
    subject: subject || 'SummitLink 订单',
    outTradeNo,
    totalAmount: Number(totalAmount).toFixed(2),
    productCode: 'QUICK_MSECURITY_PAY',
  };
  const signStr = sdk.sdkExec('alipay.trade.app.pay', {
    notifyUrl,
    bizContent,
  });
  const pagePayUrl = await sdk.pageExec('alipay.trade.page.pay', {
    method: 'GET',
    returnUrl,
    notifyUrl,
    bizContent: {
      ...bizContent,
      productCode: 'FAST_INSTANT_TRADE_PAY',
    },
  });
  return {
    mock: false,
    outTradeNo,
    sign_str: signStr,
    pagePayUrl,
  };
}

async function verifyNotify(params = {}) {
  const config = getConfig();
  const missing = getMissingRequired(config);
  if (missing.length > 0) {
    warnMock('verifyNotify', missing);
    return { valid: true, mock: true };
  }

  const sdk = createSdk(config);
  const valid = await sdk.checkNotifySign(params);
  return {
    valid: !!valid,
    mock: false,
    outTradeNo: params.out_trade_no || params.outTradeNo || null,
  };
}

async function createRefund({ outTradeNo, outRequestNo, refundAmount, refundReason }) {
  const config = getConfig();
  const missing = getMissingRequired(config);
  if (missing.length > 0) {
    warnMock('createRefund', missing);
    return {
      mock: true,
      outTradeNo,
      outRequestNo,
      refundAmount: Number(refundAmount).toFixed(2),
      status: 'SUCCESS',
    };
  }

  const sdk = createSdk(config);
  const result = await sdk.exec('alipay.trade.refund', {
    bizContent: {
      outTradeNo,
      outRequestNo,
      refundAmount: Number(refundAmount).toFixed(2),
      refundReason: refundReason || '订单退款',
    },
  });
  return {
    mock: false,
    outTradeNo,
    outRequestNo,
    status: result?.code === '10000' ? 'SUCCESS' : 'FAILED',
    raw: result,
  };
}

module.exports = {
  createOrder,
  verifyNotify,
  createRefund,
  getConfig,
};
