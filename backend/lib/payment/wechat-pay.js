'use strict';

const crypto = require('crypto');

const WECHAT_API_BASE = 'https://api.mch.weixin.qq.com';
const REQUIRED_KEYS = [
  'WECHAT_MCH_ID',
  'WECHAT_APP_ID',
  'WECHAT_API_V3_KEY',
  'WECHAT_CERT_SERIAL',
  'WECHAT_PRIVATE_KEY',
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
    mchId: (process.env.WECHAT_MCH_ID || '').trim(),
    appId: (process.env.WECHAT_APP_ID || '').trim(),
    apiV3Key: (process.env.WECHAT_API_V3_KEY || process.env.WECHAT_API_KEY_V3 || '').trim(),
    certSerial: (process.env.WECHAT_CERT_SERIAL || process.env.WECHAT_SERIAL_NO || '').trim(),
    privateKey: decodeBase64Pem(process.env.WECHAT_PRIVATE_KEY),
    platformPublicKey: decodeBase64Pem(process.env.WECHAT_PLATFORM_PUBLIC_KEY || process.env.WECHAT_PUBLIC_KEY || ''),
  };
}

function getMissingRequired(config = getConfig()) {
  return REQUIRED_KEYS.filter((key) => {
    if (key === 'WECHAT_API_V3_KEY') return !config.apiV3Key;
    if (key === 'WECHAT_PRIVATE_KEY') return !config.privateKey;
    if (key === 'WECHAT_CERT_SERIAL') return !config.certSerial;
    if (key === 'WECHAT_APP_ID') return !config.appId;
    if (key === 'WECHAT_MCH_ID') return !config.mchId;
    return !process.env[key];
  });
}

function isMockMode(config = getConfig()) {
  return getMissingRequired(config).length > 0;
}

function warnMock(method, missing) {
  if (warnedMock) return;
  warnedMock = true;
  console.warn(`[wechat-pay] ${method} 使用 mock 模式，缺少环境变量: ${missing.join(', ')}`);
}

function randomString(size = 24) {
  return crypto.randomBytes(size).toString('hex').slice(0, size);
}

function signWithPrivateKey(privateKey, message) {
  return crypto.createSign('RSA-SHA256').update(message).sign(privateKey, 'base64');
}

function buildAuthorization(method, path, body, config) {
  const nonce = randomString(16);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const content = body ? JSON.stringify(body) : '';
  const signMessage = `${method}\n${path}\n${timestamp}\n${nonce}\n${content}\n`;
  const signature = signWithPrivateKey(config.privateKey, signMessage);
  return {
    authorization: `WECHATPAY2-SHA256-RSA2048 mchid="${config.mchId}",nonce_str="${nonce}",timestamp="${timestamp}",serial_no="${config.certSerial}",signature="${signature}"`,
    bodyContent: content,
  };
}

async function callWechatApi(method, path, body, config) {
  const { authorization, bodyContent } = buildAuthorization(method, path, body, config);
  const response = await fetch(`${WECHAT_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: authorization,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'SummitLink/1.0',
    },
    body: method === 'GET' ? undefined : bodyContent,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(payload.message || payload.code || `WeChat API ${response.status}`);
    err.response = payload;
    err.status = response.status;
    throw err;
  }
  return payload;
}

async function createOrder({ body, outTradeNo, totalFee, notifyUrl, openid }) {
  const config = getConfig();
  const missing = getMissingRequired(config);
  if (missing.length > 0) {
    warnMock('createOrder', missing);
    return {
      mock: true,
      prepayId: `mock_prepay_id_${outTradeNo || Date.now()}`,
      prepay_id: `mock_prepay_id_${outTradeNo || Date.now()}`,
      appId: config.appId || 'mock_app_id',
      timeStamp: `${Math.floor(Date.now() / 1000)}`,
      nonceStr: randomString(16),
      package: `prepay_id=mock_prepay_id_${outTradeNo || Date.now()}`,
      signType: 'RSA',
      paySign: 'mock_pay_sign',
    };
  }

  const path = '/v3/pay/transactions/jsapi';
  const requestBody = {
    appid: config.appId,
    mchid: config.mchId,
    description: body || 'SummitLink 订单',
    out_trade_no: outTradeNo,
    notify_url: notifyUrl,
    amount: { total: Number(totalFee), currency: 'CNY' },
    payer: { openid: openid || 'mock_openid' },
  };
  const response = await callWechatApi('POST', path, requestBody, config);
  const prepayId = response.prepay_id;
  const nonceStr = randomString(16);
  const timeStamp = `${Math.floor(Date.now() / 1000)}`;
  const packageValue = `prepay_id=${prepayId}`;
  const paySignMessage = `${config.appId}\n${timeStamp}\n${nonceStr}\n${packageValue}\n`;
  const paySign = signWithPrivateKey(config.privateKey, paySignMessage);
  return {
    mock: false,
    prepayId,
    prepay_id: prepayId,
    appId: config.appId,
    timeStamp,
    nonceStr,
    package: packageValue,
    signType: 'RSA',
    paySign,
  };
}

async function verifyNotify(rawBody, signature, timestamp, nonce) {
  const config = getConfig();
  const missing = getMissingRequired(config);
  if (missing.length > 0) {
    warnMock('verifyNotify', missing);
    let parsed = {};
    try {
      parsed = JSON.parse(Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody || '{}'));
    } catch (_) {}
    return {
      valid: true,
      mock: true,
      payload: parsed,
      orderNo: parsed?.out_trade_no || null,
    };
  }

  if (!config.platformPublicKey) {
    return { valid: false, error: 'WECHAT_PLATFORM_PUBLIC_KEY 未配置，无法校验微信回调签名' };
  }
  const bodyText = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody || '');
  const verifyMessage = `${timestamp || ''}\n${nonce || ''}\n${bodyText}\n`;
  const valid = crypto.createVerify('RSA-SHA256').update(verifyMessage).verify(config.platformPublicKey, signature || '', 'base64');
  let parsed = {};
  try {
    parsed = JSON.parse(bodyText || '{}');
  } catch (_) {}
  return {
    valid,
    mock: false,
    payload: parsed,
    orderNo: parsed?.out_trade_no || parsed?.resource?.out_trade_no || null,
  };
}

async function createNativeOrder({ body, outTradeNo, totalFee, notifyUrl }) {
  const config = getConfig();
  const missing = getMissingRequired(config);
  if (missing.length > 0) {
    warnMock('createNativeOrder', missing);
    return {
      mock: true,
      codeUrl: 'weixin://wxpay/bizpayurl?pr=mock',
      outTradeNo: outTradeNo || `mock_${Date.now()}`,
    };
  }
  const path = '/v3/pay/transactions/native';
  const requestBody = {
    appid: config.appId,
    mchid: config.mchId,
    description: body || 'SummitLink 订单',
    out_trade_no: outTradeNo,
    notify_url: notifyUrl,
    amount: { total: Number(totalFee), currency: 'CNY' },
  };
  const response = await callWechatApi('POST', path, requestBody, config);
  return {
    mock: false,
    codeUrl: response.code_url,
    outTradeNo,
    raw: response,
  };
}

async function queryOrder({ outTradeNo }) {
  const config = getConfig();
  const missing = getMissingRequired(config);
  if (missing.length > 0) {
    warnMock('queryOrder', missing);
    return {
      mock: true,
      tradeState: 'SUCCESS',
      outTradeNo,
    };
  }
  const path = `/v3/pay/transactions/out-trade-no/${outTradeNo}?mchid=${config.mchId}`;
  const response = await callWechatApi('GET', path, null, config);
  return {
    mock: false,
    tradeState: response.trade_state || 'NOTPAY',
    outTradeNo,
    raw: response,
  };
}

async function createRefund({ outTradeNo, outRefundNo, totalFee, refundFee }) {
  const config = getConfig();
  const missing = getMissingRequired(config);
  if (missing.length > 0) {
    warnMock('createRefund', missing);
    return {
      mock: true,
      outTradeNo,
      outRefundNo,
      refundId: `mock_refund_${outRefundNo || Date.now()}`,
      status: 'SUCCESS',
    };
  }
  const path = '/v3/refund/domestic/refunds';
  const requestBody = {
    out_trade_no: outTradeNo,
    out_refund_no: outRefundNo,
    amount: {
      total: Number(totalFee),
      refund: Number(refundFee),
      currency: 'CNY',
    },
    reason: '订单退款',
  };
  const response = await callWechatApi('POST', path, requestBody, config);
  return {
    mock: false,
    refundId: response.refund_id || null,
    status: response.status || 'PROCESSING',
    outTradeNo,
    outRefundNo,
    raw: response,
  };
}

module.exports = {
  createOrder,
  createNativeOrder,
  queryOrder,
  verifyNotify,
  createRefund,
  getConfig,
  isMockMode,
};
