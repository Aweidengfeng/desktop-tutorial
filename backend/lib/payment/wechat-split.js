'use strict';

const crypto = require('crypto');
const wechatPay = require('./wechat-pay');

const WECHAT_API_BASE = 'https://api.mch.weixin.qq.com';
let warnedMock = false;

function isSplitEnabled() {
  return String(process.env.WECHAT_SPLIT_ENABLED || 'false').toLowerCase() === 'true';
}

function randomNo(prefix = 'split') {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
}

function mockResult(action, extra = {}) {
  return {
    mock: true,
    action,
    state: 'MOCK_PENDING',
    message: 'WeChat split mock mode (WECHAT_SPLIT_ENABLED=false or payment env missing).',
    ...extra,
  };
}

function warnMockOnce(message) {
  if (warnedMock) return;
  warnedMock = true;
  console.warn(message);
}

function signWechatHeaders(method, path, bodyText, config) {
  const nonce = crypto.randomBytes(16).toString('hex');
  const timestamp = `${Math.floor(Date.now() / 1000)}`;
  const message = `${method}\n${path}\n${timestamp}\n${nonce}\n${bodyText}\n`;
  const signature = crypto.createSign('RSA-SHA256').update(message).sign(config.privateKey, 'base64');
  return `WECHATPAY2-SHA256-RSA2048 mchid="${config.mchId}",nonce_str="${nonce}",timestamp="${timestamp}",serial_no="${config.certSerial}",signature="${signature}"`;
}

async function callWechatSplitApi(method, path, payload, config) {
  const bodyText = payload ? JSON.stringify(payload) : '';
  const authorization = signWechatHeaders(method, path, bodyText, config);
  const res = await fetch(`${WECHAT_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: authorization,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'SummitLink/1.0',
    },
    body: method === 'GET' ? undefined : bodyText,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || data.code || `WeChat split API ${res.status}`);
    err.status = res.status;
    err.response = data;
    throw err;
  }
  return data;
}

function shouldUseMock(config = wechatPay.getConfig()) {
  return !isSplitEnabled() || wechatPay.isMockMode(config);
}

async function splitOrder({ transactionId, receivers = [] }) {
  const config = wechatPay.getConfig();
  if (shouldUseMock(config)) {
    if (!isSplitEnabled()) {
      warnMockOnce('[wechat-split] WECHAT_SPLIT_ENABLED=false，使用 mock 分账响应');
    } else {
      warnMockOnce('[wechat-split] 支付配置不完整，使用 mock 分账响应');
    }
    return mockResult('splitOrder', {
      transactionId,
      outOrderNo: randomNo('split'),
      receivers,
    });
  }

  const outOrderNo = randomNo('split');
  const payload = {
    appid: config.appId,
    transaction_id: transactionId,
    out_order_no: outOrderNo,
    receivers,
    unfreeze_unsplit: true,
  };
  const data = await callWechatSplitApi('POST', '/v3/profitsharing/orders', payload, config);
  return {
    mock: false,
    transactionId,
    outOrderNo,
    state: data.state || 'PROCESSING',
    raw: data,
  };
}

async function querySplit({ transactionId, outOrderNo }) {
  const config = wechatPay.getConfig();
  if (shouldUseMock(config)) {
    return mockResult('querySplit', {
      transactionId,
      outOrderNo: outOrderNo || randomNo('split'),
      state: 'MOCK_PENDING',
    });
  }

  if (!outOrderNo) {
    throw new Error('querySplit 需要 outOrderNo');
  }
  const path = `/v3/profitsharing/orders/${encodeURIComponent(outOrderNo)}?transaction_id=${encodeURIComponent(transactionId)}`;
  const data = await callWechatSplitApi('GET', path, null, config);
  return {
    mock: false,
    transactionId,
    outOrderNo,
    state: data.state || 'PROCESSING',
    raw: data,
  };
}

async function addReceiver({ merchantWechatOpenid, name, relationType = 'SERVICE_PROVIDER' }) {
  const config = wechatPay.getConfig();
  if (shouldUseMock(config)) {
    return mockResult('addReceiver', {
      account: merchantWechatOpenid,
      relationType,
      state: 'SUCCESS',
    });
  }
  const receiver = {
    type: 'PERSONAL_OPENID',
    account: merchantWechatOpenid,
    name,
    relation_type: relationType,
  };
  const data = await callWechatSplitApi('POST', '/v3/profitsharing/receivers/add', receiver, config);
  return {
    mock: false,
    account: merchantWechatOpenid,
    relationType,
    state: data.result || 'SUCCESS',
    raw: data,
  };
}

async function requestSplit({ orderId, transactionId, merchantAmount, merchantOpenid, description = '向导服务分账' }) {
  const receivers = [{
    type: 'PERSONAL_OPENID',
    account: merchantOpenid,
    amount: Number(merchantAmount),
    description,
  }];
  const result = await splitOrder({ transactionId, receivers });
  return {
    ...result,
    out_order_no: result.outOrderNo || `SPLIT_${orderId || Date.now()}`,
    order_id: orderId || null,
  };
}

async function querySplitStatus(outOrderNo, transactionId) {
  const result = await querySplit({ transactionId: transactionId || randomNo('tx'), outOrderNo });
  return {
    ...result,
    out_order_no: result.outOrderNo,
  };
}

async function finishSplit(outOrderNo, transactionId) {
  const config = wechatPay.getConfig();
  if (shouldUseMock(config)) {
    return mockResult('finishSplit', { outOrderNo, transactionId, state: 'FINISHED' });
  }
  const payload = {
    appid: config.appId,
    transaction_id: transactionId,
    out_order_no: outOrderNo,
    description: '分账完结',
  };
  const data = await callWechatSplitApi('POST', '/v3/profitsharing/finish-order', payload, config);
  return {
    mock: false,
    outOrderNo,
    transactionId,
    state: data.result || 'FINISHED',
    raw: data,
  };
}

async function refundSplit({ outReturnNo, outOrderNo, returnAmount, description = '订单取消回退' }) {
  const config = wechatPay.getConfig();
  if (shouldUseMock(config)) {
    return mockResult('refundSplit', { outReturnNo, outOrderNo, returnAmount, state: 'SUCCESS' });
  }
  const payload = {
    out_return_no: outReturnNo,
    out_order_no: outOrderNo,
    return_amount: Number(returnAmount),
    description,
  };
  const data = await callWechatSplitApi('POST', '/v3/profitsharing/return-orders', payload, config);
  return {
    mock: false,
    outReturnNo,
    outOrderNo,
    state: data.result || 'SUCCESS',
    raw: data,
  };
}

module.exports = {
  splitOrder,
  querySplit,
  addReceiver,
  requestSplit,
  querySplitStatus,
  finishSplit,
  refundSplit,
};
