/**
 * backend/lib/payment/wechat-split.js
 *
 * WeChat Pay profit-sharing (微信支付分账) skeleton.
 *
 * ⚠️  Feature flag: WECHAT_SPLIT_ENABLED=false (default).
 *     All functions return mock responses until the WeChat merchant account
 *     is approved and ICP filing is complete.
 *
 * Integration checklist (activate when ready):
 *  1. Set WECHAT_SPLIT_ENABLED=true in production env
 *  2. Set WECHAT_MCH_ID, WECHAT_API_KEY, WECHAT_CERT_SERIAL, WECHAT_PRIVATE_KEY
 *  3. Pre-register profit-sharing receivers for each merchant (addReceiver)
 *  4. End-to-end smoke test with a real small-amount order
 *
 * Reference: https://pay.weixin.qq.com/wiki/doc/apiv3/apis/chapter8_1_1.shtml
 */

'use strict';

const ENABLED = process.env.WECHAT_SPLIT_ENABLED === 'true';

// ─── Config helpers ──────────────────────────────────────────────────────────

function getConfig() {
  return {
    mchId:       process.env.WECHAT_MCH_ID        || '',
    apiKey:      process.env.WECHAT_API_KEY        || '',
    certSerial:  process.env.WECHAT_CERT_SERIAL    || '',
    privateKey:  process.env.WECHAT_PRIVATE_KEY    || '',
    apiBase:     'https://api.mch.weixin.qq.com/v3',
  };
}

// ─── Mock response helper ────────────────────────────────────────────────────

function mockResponse(extra = {}) {
  return {
    _mock:   true,
    enabled: false,
    message: 'WeChat split is disabled (WECHAT_SPLIT_ENABLED=false). Set env var to enable.',
    ...extra,
  };
}

// ─── Pre-register a receiver (must be done before requestSplit) ──────────────

/**
 * addReceiver — 添加分账接收方
 *
 * Registers a merchant's WeChat account as a profit-sharing receiver so that
 * future splits can transfer funds to them without manual confirmation.
 *
 * @param {object} params
 * @param {string} params.merchantWechatOpenid  Merchant's WeChat openid or mchid
 * @param {string} params.name                  Masked display name
 * @param {string} [params.relationType]        Defaults to 'SERVICE_PROVIDER'
 * @returns {Promise<object>}
 */
async function addReceiver({ merchantWechatOpenid, name, relationType = 'SERVICE_PROVIDER' }) {
  if (!ENABLED) return mockResponse({ action: 'addReceiver', merchantWechatOpenid });

  // TODO: implement real WeChat v3 API call
  // POST /v3/profitsharing/receivers/add
  throw new Error('addReceiver: real WeChat integration not yet activated');
}

// ─── Request a profit split after order completion ──────────────────────────

/**
 * requestSplit — 请求分账 (微信支付分账 v3)
 *
 * Must be called after the order is marked complete and the platform has
 * confirmed the transaction is beyond the refund window.
 *
 * @param {object} params
 * @param {string} params.orderId           Internal order ID (used as idempotency key)
 * @param {string} params.transactionId     WeChat trade_no from the original payment
 * @param {number} params.merchantAmount    Amount (in fen/cents) to split to the merchant
 * @param {string} params.merchantOpenid    Merchant's WeChat openid
 * @param {string} [params.description]     Transfer description (≤ 80 chars)
 * @returns {Promise<{ out_order_no: string, order_id: string, state: string }>}
 */
async function requestSplit({ orderId, transactionId, merchantAmount, merchantOpenid, description = '向导服务分账' }) {
  if (!ENABLED) {
    return mockResponse({
      action: 'requestSplit',
      out_order_no: `SPLIT_MOCK_${orderId}`,
      orderId,
      transactionId,
      merchantAmount,
      state: 'MOCK_PENDING',
    });
  }

  // TODO: implement real WeChat v3 API call
  // POST /v3/profitsharing/orders
  // Body: { appid, transaction_id, out_order_no, receivers: [{ type: 'OPENID', account, amount, description }], finish: false }
  throw new Error('requestSplit: real WeChat integration not yet activated');
}

// ─── Query split status ──────────────────────────────────────────────────────

/**
 * querySplitStatus — 查询分账结果
 *
 * @param {string} outOrderNo  The out_order_no returned by requestSplit
 * @returns {Promise<object>}
 */
async function querySplitStatus(outOrderNo) {
  if (!ENABLED) return mockResponse({ action: 'querySplitStatus', outOrderNo, state: 'MOCK_PENDING' });

  // TODO: GET /v3/profitsharing/orders/{out_order_no}?transaction_id=...
  throw new Error('querySplitStatus: real WeChat integration not yet activated');
}

// ─── Finish / close a split order ───────────────────────────────────────────

/**
 * finishSplit — 完结分账 (冻结剩余资金，解除冻结)
 *
 * Must be called to release any remaining frozen funds back to the platform
 * after all receivers have been paid.
 *
 * @param {string} outOrderNo
 * @param {string} transactionId
 * @returns {Promise<object>}
 */
async function finishSplit(outOrderNo, transactionId) {
  if (!ENABLED) return mockResponse({ action: 'finishSplit', outOrderNo });

  // TODO: POST /v3/profitsharing/finish-order
  throw new Error('finishSplit: real WeChat integration not yet activated');
}

// ─── Refund a split ──────────────────────────────────────────────────────────

/**
 * refundSplit — 分账回退
 *
 * Reclaims a previously split amount from a receiver back to the platform.
 * Used when an order is cancelled/disputed after split.
 *
 * @param {object} params
 * @param {string} params.outReturnNo   Unique refund order number
 * @param {string} params.outOrderNo    Original split order number
 * @param {number} params.returnAmount  Amount to reclaim (fen)
 * @param {string} params.description
 * @returns {Promise<object>}
 */
async function refundSplit({ outReturnNo, outOrderNo, returnAmount, description = '订单取消回退' }) {
  if (!ENABLED) return mockResponse({ action: 'refundSplit', outReturnNo, outOrderNo });

  // TODO: POST /v3/profitsharing/return-orders
  throw new Error('refundSplit: real WeChat integration not yet activated');
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  ENABLED,
  addReceiver,
  requestSplit,
  querySplitStatus,
  finishSplit,
  refundSplit,
  /** Exposed for testing / admin status endpoints */
  getConfig,
};
