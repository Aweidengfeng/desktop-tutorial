'use strict';

/**
 * @file stripe-connect.js
 * @description Stripe Connect 向导提现框架
 *
 * 功能：
 *   createConnectedAccount  — 创建 Stripe Express 账户
 *   createAccountLink       — 生成 onboarding 链接
 *   createPayout            — 向已 onboard 账户打款
 *
 * mock 模式：STRIPE_SECRET_KEY 缺失时返回 mock 数据，不抛出异常。
 */

const MOCK_PREFIX = 'mock_acct_';

function getStripeClient() {
  const key = (process.env.STRIPE_SECRET_KEY || '').trim();
  if (!key) return null;
  try {
    return require('stripe')(key);
  } catch (e) {
    console.warn('[stripe-connect] stripe 模块加载失败:', e.message);
    return null;
  }
}

function isMock() {
  const stripeDisabled = String(process.env.STRIPE_DISABLED || '').toLowerCase() === 'true';
  return !process.env.STRIPE_SECRET_KEY || stripeDisabled;
}

/**
 * 创建 Stripe Express 账户（向导入驻用）
 * @param {{ email: string, country: string }} options
 * @returns {Promise<{ accountId: string, mock: boolean }>}
 */
async function createConnectedAccount({ email, country = 'US' }) {
  if (isMock()) {
    const accountId = `${MOCK_PREFIX}${Date.now()}`;
    console.warn('[stripe-connect] mock 模式：createConnectedAccount ->', accountId);
    return { accountId, mock: true };
  }
  const stripe = getStripeClient();
  if (!stripe) return { accountId: `${MOCK_PREFIX}${Date.now()}`, mock: true };
  const account = await stripe.accounts.create({
    type: 'express',
    email,
    country: country.toUpperCase(),
    capabilities: {
      transfers: { requested: true },
    },
  });
  return { accountId: account.id, mock: false };
}

/**
 * 生成 Stripe Connect onboarding 链接
 * @param {{ accountId: string, returnUrl: string, refreshUrl: string }} options
 * @returns {Promise<{ url: string, mock: boolean }>}
 */
async function createAccountLink({ accountId, returnUrl, refreshUrl }) {
  if (isMock() || String(accountId || '').startsWith(MOCK_PREFIX)) {
    const url = returnUrl || 'https://summitlink.app/guide-portal';
    console.warn('[stripe-connect] mock 模式：createAccountLink ->', url);
    return { url, mock: true };
  }
  const stripe = getStripeClient();
  if (!stripe) return { url: returnUrl || '', mock: true };
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: 'account_onboarding',
  });
  return { url: link.url, mock: false };
}

/**
 * 向已 onboard 的账户打款（Stripe Connect Transfer）
 * @param {{ accountId: string, amount: number, currency: string, description?: string }} options
 * @returns {Promise<{ transferId: string, mock: boolean }>}
 */
async function createPayout({ accountId, amount, currency = 'usd', description = 'SummitLink 向导提现' }) {
  if (isMock() || String(accountId || '').startsWith(MOCK_PREFIX)) {
    const transferId = `mock_tr_${Date.now()}`;
    console.warn('[stripe-connect] mock 模式：createPayout ->', transferId, 'amount:', amount, currency);
    return { transferId, mock: true };
  }
  const stripe = getStripeClient();
  if (!stripe) return { transferId: `mock_tr_${Date.now()}`, mock: true };
  const transfer = await stripe.transfers.create({
    amount: Math.round(Number(amount)),
    currency: currency.toLowerCase(),
    destination: accountId,
    description,
  });
  return { transferId: transfer.id, mock: false };
}

module.exports = { createConnectedAccount, createAccountLink, createPayout, isMock };
