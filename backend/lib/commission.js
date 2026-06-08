/**
 * backend/lib/commission.js
 *
 * Dual-region commission engine for Unsummit / 未登峰 platform.
 *
 * Regions: 'us' | 'cn'
 * Merchant types: 'guide' | 'club'
 * Merchant tiers: 'new' | 'certified' | 'standard' | 'seed'
 *
 * US rates  — guide_standard 12%, guide_certified 10%, guide_new 0%, club 8%
 * CN rates  — guide_standard 8%,  guide_certified 10%, guide_new 0%, club 6%
 *
 * "New" = first 3 completed orders regardless of region / tier.
 */

'use strict';

// ─── Rate table ─────────────────────────────────────────────────────────────

const COMMISSION_RATES = {
  us: {
    guide_standard:  0.12,
    guide_certified: 0.10,
    guide_new:       0.00,
    club:            0.08,
    currency:           'USD',
    payment_gateway:    'stripe',
    payout_method:      'stripe_connect',
    min_payout_amount:  100,
    payout_schedule:    'weekly',
  },
  cn: {
    guide_standard:  0.08,
    guide_certified: 0.10,
    guide_new:       0.00,
    club:            0.06,
    currency:           'CNY',
    payment_gateway:    'wechat',
    payment_gateway_backup: 'alipay',
    payout_method:      'wechat_split',
    min_payout_amount:  100,
    payout_schedule:    'on_completion',
  },
};

// Certification types that qualify for the "certified" tier in each region.
const CERTIFIED_CERTS_US = new Set([
  'IFMGA', 'UIAGM', 'AMGA', 'BMG', 'ACMG', 'NZMGA',
]);
const CERTIFIED_CERTS_CN = new Set([
  'CMA_L5',   // 中登协 5 级
  'ALPINE_SENIOR', // 高山协作员高级
]);

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns true if the merchant has an internationally recognised certification
 * (or the CN-equivalent) that qualifies for the lower "certified" rate.
 *
 * @param {object} merchant  — at minimum { certifications: Array|null, region?: string }
 * @param {string} region    — 'us' | 'cn'
 */
function isCertified(merchant, region) {
  const certs = Array.isArray(merchant && merchant.certifications)
    ? merchant.certifications
    : [];

  const validSet = region === 'cn' ? CERTIFIED_CERTS_CN : CERTIFIED_CERTS_US;

  return certs.some((c) => {
    const type = String((c && c.type) || '').trim().toUpperCase();
    return validSet.has(type);
  });
}

/**
 * Returns true if the merchant qualifies for the 0 % "new guide" promotion.
 * Condition: guide type AND completed_orders < 3.
 *
 * @param {object} merchant  — { type: 'guide'|'club', completed_orders?: number }
 */
function isNew(merchant) {
  if (!merchant || merchant.type !== 'guide') return false;
  const completed = Number(merchant.completed_orders) || 0;
  return completed < 3;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Determine the effective commission rate for a merchant in a given region.
 *
 * Priority:
 *   1. If merchant type is 'club'  → club rate
 *   2. If guide AND completed_orders < 3 → guide_new (0 %)
 *   3. If guide AND has qualifying cert  → guide_certified
 *   4. Otherwise                         → guide_standard
 *
 * @param {object} merchant  — { type, certifications, completed_orders, custom_rate? }
 * @param {string} region    — 'us' | 'cn'
 * @returns {number}  rate as a decimal fraction (e.g. 0.12 for 12 %)
 */
function getEffectiveRate(merchant, region) {
  const rates = COMMISSION_RATES[region];
  if (!rates) throw new Error(`Unknown region: ${region}`);

  // Explicit override set by admin for a specific merchant.
  if (merchant && merchant.custom_rate != null) {
    const r = Number(merchant.custom_rate);
    if (!Number.isNaN(r) && r >= 0 && r <= 1) return r;
  }

  if (!merchant) throw new Error('merchant is required');

  if (merchant.type === 'club') return rates.club;

  // Guide path
  if (isNew(merchant))         return rates.guide_new;
  if (isCertified(merchant, region)) return rates.guide_certified;
  return rates.guide_standard;
}

/**
 * Compute the financial split for one order.
 *
 * @param {object} order      — { gross_amount: number }
 * @param {object} merchant   — see getEffectiveRate
 * @param {string} region     — 'us' | 'cn'
 * @returns {{ gross: number, commission_rate: number, platform_fee: number, merchant_payout: number, currency: string }}
 */
function computeCommission(order, merchant, region) {
  if (!order || order.gross_amount == null) {
    throw new Error('order.gross_amount is required');
  }

  const gross = Number(order.gross_amount);
  if (Number.isNaN(gross) || gross < 0) {
    throw new Error('order.gross_amount must be a non-negative number');
  }

  const commission_rate = getEffectiveRate(merchant, region);
  const platform_fee    = round2(gross * commission_rate);
  const merchant_payout = round2(gross - platform_fee);

  if (merchant_payout < 0) {
    throw new Error('merchant_payout cannot be negative (commission_rate > 1 or rounding error)');
  }
  const currency        = (COMMISSION_RATES[region] || {}).currency || 'USD';

  return { gross, commission_rate, platform_fee, merchant_payout, currency };
}

/** Round to 2 decimal places using banker's-safe arithmetic. */
function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

module.exports = {
  computeCommission,
  getEffectiveRate,
  COMMISSION_RATES,
  isCertified,
  isNew,
};
