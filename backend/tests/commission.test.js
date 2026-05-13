'use strict';
/**
 * backend/tests/commission.test.js
 *
 * Unit tests for backend/lib/commission.js
 * Covers all 8 branches: us/cn × standard/certified/new/club
 * plus boundary conditions and edge cases.
 */

const {
  computeCommission,
  getEffectiveRate,
  COMMISSION_RATES,
  isCertified,
  isNew,
} = require('../lib/commission');

// ─── Fixtures ────────────────────────────────────────────────────────────────

function guideStandard(region) {
  return { type: 'guide', certifications: [], completed_orders: 10, region };
}

function guideCertifiedUS() {
  return {
    type: 'guide',
    certifications: [{ type: 'IFMGA', issued_at: '2020-01-01' }],
    completed_orders: 10,
    region: 'us',
  };
}

function guideCertifiedCN() {
  return {
    type: 'guide',
    certifications: [{ type: 'CMA_L5', issued_at: '2021-01-01' }],
    completed_orders: 10,
    region: 'cn',
  };
}

function guideNew(region, completed = 0) {
  return { type: 'guide', certifications: [], completed_orders: completed, region };
}

function club(region) {
  return { type: 'club', certifications: [], completed_orders: 99, region };
}

const order = (gross) => ({ gross_amount: gross });

// ─── getEffectiveRate ─────────────────────────────────────────────────────────

describe('getEffectiveRate', () => {
  // ── US ──────────────────────────────────────────────────────────────────

  test('us / guide_standard → 12%', () => {
    expect(getEffectiveRate(guideStandard('us'), 'us')).toBe(0.12);
  });

  test('us / guide_certified (IFMGA) → 10%', () => {
    expect(getEffectiveRate(guideCertifiedUS(), 'us')).toBe(0.10);
  });

  test('us / guide_new (0 completed orders) → 0%', () => {
    expect(getEffectiveRate(guideNew('us', 0), 'us')).toBe(0.00);
  });

  test('us / guide_new (2 completed orders) → 0%', () => {
    expect(getEffectiveRate(guideNew('us', 2), 'us')).toBe(0.00);
  });

  test('us / club → 8%', () => {
    expect(getEffectiveRate(club('us'), 'us')).toBe(0.08);
  });

  // ── CN ──────────────────────────────────────────────────────────────────

  test('cn / guide_standard → 8%', () => {
    expect(getEffectiveRate(guideStandard('cn'), 'cn')).toBe(0.08);
  });

  test('cn / guide_certified (CMA_L5) → 10%', () => {
    expect(getEffectiveRate(guideCertifiedCN(), 'cn')).toBe(0.10);
  });

  test('cn / guide_new (0 completed orders) → 0%', () => {
    expect(getEffectiveRate(guideNew('cn', 0), 'cn')).toBe(0.00);
  });

  test('cn / guide_new (2 completed orders) → 0%', () => {
    expect(getEffectiveRate(guideNew('cn', 2), 'cn')).toBe(0.00);
  });

  test('cn / club → 6%', () => {
    expect(getEffectiveRate(club('cn'), 'cn')).toBe(0.06);
  });

  // ── Boundary: exactly 3rd order triggers graduation ─────────────────────

  test('guide with exactly 3 completed_orders is no longer "new" → standard rate (us)', () => {
    const m = guideNew('us', 3);
    expect(getEffectiveRate(m, 'us')).toBe(0.12); // standard
  });

  test('guide with exactly 3 completed_orders is no longer "new" → standard rate (cn)', () => {
    const m = guideNew('cn', 3);
    expect(getEffectiveRate(m, 'cn')).toBe(0.08); // standard
  });

  // ── Custom rate override ─────────────────────────────────────────────────

  test('custom_rate overrides tier (us)', () => {
    const m = { ...guideStandard('us'), custom_rate: 0.05 };
    expect(getEffectiveRate(m, 'us')).toBe(0.05);
  });

  test('custom_rate 0 is valid (full subsidy)', () => {
    const m = { ...club('us'), custom_rate: 0 };
    expect(getEffectiveRate(m, 'us')).toBe(0);
  });

  test('invalid custom_rate (NaN) falls through to normal tier', () => {
    const m = { ...club('cn'), custom_rate: NaN };
    expect(getEffectiveRate(m, 'cn')).toBe(0.06);
  });

  test('invalid custom_rate > 1 falls through to normal tier', () => {
    const m = { ...club('us'), custom_rate: 1.5 };
    expect(getEffectiveRate(m, 'us')).toBe(0.08);
  });

  // ── Cert priority (new trumps cert) ─────────────────────────────────────

  test('certified guide with only 1 completed order is still "new" → 0%', () => {
    const m = { ...guideCertifiedUS(), completed_orders: 1 };
    expect(getEffectiveRate(m, 'us')).toBe(0.00);
  });

  // ── Unknown region ───────────────────────────────────────────────────────

  test('unknown region throws', () => {
    expect(() => getEffectiveRate(guideStandard('us'), 'eu')).toThrow();
  });

  // ── Missing merchant ────────────────────────────────────────────────────

  test('null merchant throws', () => {
    expect(() => getEffectiveRate(null, 'us')).toThrow();
  });
});

// ─── isCertified ─────────────────────────────────────────────────────────────

describe('isCertified', () => {
  test('IFMGA qualifies for us', () => {
    expect(isCertified({ certifications: [{ type: 'IFMGA' }] }, 'us')).toBe(true);
  });

  test('UIAGM qualifies for us', () => {
    expect(isCertified({ certifications: [{ type: 'UIAGM' }] }, 'us')).toBe(true);
  });

  test('AMGA qualifies for us', () => {
    expect(isCertified({ certifications: [{ type: 'AMGA' }] }, 'us')).toBe(true);
  });

  test('BMG qualifies for us', () => {
    expect(isCertified({ certifications: [{ type: 'BMG' }] }, 'us')).toBe(true);
  });

  test('ACMG qualifies for us', () => {
    expect(isCertified({ certifications: [{ type: 'ACMG' }] }, 'us')).toBe(true);
  });

  test('NZMGA qualifies for us', () => {
    expect(isCertified({ certifications: [{ type: 'NZMGA' }] }, 'us')).toBe(true);
  });

  test('CMA_L5 qualifies for cn', () => {
    expect(isCertified({ certifications: [{ type: 'CMA_L5' }] }, 'cn')).toBe(true);
  });

  test('ALPINE_SENIOR qualifies for cn', () => {
    expect(isCertified({ certifications: [{ type: 'ALPINE_SENIOR' }] }, 'cn')).toBe(true);
  });

  test('CMA_L5 does NOT qualify for us', () => {
    expect(isCertified({ certifications: [{ type: 'CMA_L5' }] }, 'us')).toBe(false);
  });

  test('empty certifications → not certified', () => {
    expect(isCertified({ certifications: [] }, 'us')).toBe(false);
  });

  test('null certifications → not certified', () => {
    expect(isCertified({ certifications: null }, 'us')).toBe(false);
  });
});

// ─── isNew ───────────────────────────────────────────────────────────────────

describe('isNew', () => {
  test('guide with 0 completed orders is new', () => {
    expect(isNew({ type: 'guide', completed_orders: 0 })).toBe(true);
  });

  test('guide with 2 completed orders is still new', () => {
    expect(isNew({ type: 'guide', completed_orders: 2 })).toBe(true);
  });

  test('guide with 3 completed orders is NOT new', () => {
    expect(isNew({ type: 'guide', completed_orders: 3 })).toBe(false);
  });

  test('club is never "new" (applies only to guides)', () => {
    expect(isNew({ type: 'club', completed_orders: 0 })).toBe(false);
  });

  test('null merchant → false', () => {
    expect(isNew(null)).toBe(false);
  });
});

// ─── computeCommission ───────────────────────────────────────────────────────

describe('computeCommission', () => {
  // ── US combinations ──────────────────────────────────────────────────────

  test('us / guide_standard: $1000 order → $120 fee, $880 payout', () => {
    const result = computeCommission(order(1000), guideStandard('us'), 'us');
    expect(result.gross).toBe(1000);
    expect(result.commission_rate).toBe(0.12);
    expect(result.platform_fee).toBe(120);
    expect(result.merchant_payout).toBe(880);
    expect(result.currency).toBe('USD');
  });

  test('us / guide_certified: $1000 order → $100 fee, $900 payout', () => {
    const result = computeCommission(order(1000), guideCertifiedUS(), 'us');
    expect(result.platform_fee).toBe(100);
    expect(result.merchant_payout).toBe(900);
  });

  test('us / guide_new: $1000 order → $0 fee, $1000 payout', () => {
    const result = computeCommission(order(1000), guideNew('us', 0), 'us');
    expect(result.platform_fee).toBe(0);
    expect(result.merchant_payout).toBe(1000);
  });

  test('us / club: $1000 order → $80 fee, $920 payout', () => {
    const result = computeCommission(order(1000), club('us'), 'us');
    expect(result.platform_fee).toBe(80);
    expect(result.merchant_payout).toBe(920);
  });

  // ── CN combinations ──────────────────────────────────────────────────────

  test('cn / guide_standard: ¥5000 order → ¥400 fee, ¥4600 payout', () => {
    const result = computeCommission(order(5000), guideStandard('cn'), 'cn');
    expect(result.platform_fee).toBe(400);
    expect(result.merchant_payout).toBe(4600);
    expect(result.currency).toBe('CNY');
  });

  test('cn / guide_certified: ¥5000 order → ¥500 fee, ¥4500 payout', () => {
    const result = computeCommission(order(5000), guideCertifiedCN(), 'cn');
    expect(result.platform_fee).toBe(500);
    expect(result.merchant_payout).toBe(4500);
  });

  test('cn / guide_new: ¥5000 order → ¥0 fee, ¥5000 payout', () => {
    const result = computeCommission(order(5000), guideNew('cn', 0), 'cn');
    expect(result.platform_fee).toBe(0);
    expect(result.merchant_payout).toBe(5000);
  });

  test('cn / club: ¥5000 order → ¥300 fee, ¥4700 payout', () => {
    const result = computeCommission(order(5000), club('cn'), 'cn');
    expect(result.platform_fee).toBe(300);
    expect(result.merchant_payout).toBe(4700);
  });

  // ── Edge / boundary cases ────────────────────────────────────────────────

  test('zero-value order → all zeros', () => {
    const result = computeCommission(order(0), guideStandard('us'), 'us');
    expect(result.gross).toBe(0);
    expect(result.platform_fee).toBe(0);
    expect(result.merchant_payout).toBe(0);
  });

  test('floating-point order rounds correctly', () => {
    // $99.99 × 12% = $11.9988 → rounds to $12.00
    const result = computeCommission(order(99.99), guideStandard('us'), 'us');
    expect(result.platform_fee).toBe(12.00);
    expect(result.merchant_payout).toBeCloseTo(87.99, 2);
  });

  test('negative gross_amount throws', () => {
    expect(() => computeCommission(order(-1), guideStandard('us'), 'us')).toThrow();
  });

  test('missing gross_amount throws', () => {
    expect(() => computeCommission({}, guideStandard('us'), 'us')).toThrow();
  });

  test('null order throws', () => {
    expect(() => computeCommission(null, guideStandard('us'), 'us')).toThrow();
  });
});

// ─── COMMISSION_RATES constant ───────────────────────────────────────────────

describe('COMMISSION_RATES constant', () => {
  test('us rates are defined', () => {
    expect(COMMISSION_RATES.us.guide_standard).toBe(0.12);
    expect(COMMISSION_RATES.us.guide_certified).toBe(0.10);
    expect(COMMISSION_RATES.us.guide_new).toBe(0.00);
    expect(COMMISSION_RATES.us.club).toBe(0.08);
    expect(COMMISSION_RATES.us.currency).toBe('USD');
    expect(COMMISSION_RATES.us.payment_gateway).toBe('stripe');
  });

  test('cn rates are defined', () => {
    expect(COMMISSION_RATES.cn.guide_standard).toBe(0.08);
    expect(COMMISSION_RATES.cn.guide_certified).toBe(0.10);
    expect(COMMISSION_RATES.cn.guide_new).toBe(0.00);
    expect(COMMISSION_RATES.cn.club).toBe(0.06);
    expect(COMMISSION_RATES.cn.currency).toBe('CNY');
    expect(COMMISSION_RATES.cn.payment_gateway).toBe('wechat');
  });
});
