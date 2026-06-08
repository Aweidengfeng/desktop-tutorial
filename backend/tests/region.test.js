const { detectRegion, getDatabaseUrl, getRegionConfig } = require('../lib/region');

function makeReq({ query = {}, cookies = {}, headers = {} } = {}) {
  return { query, cookies, headers };
}

describe('region detection', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('prefers explicit query parameter', () => {
    const req = makeReq({
      query: { region: 'cn' },
      cookies: { user_region: 'us' },
      headers: { 'cf-ipcountry': 'US', 'accept-language': 'en-US' },
    });
    expect(detectRegion(req)).toBe('cn');
  });

  test('falls back to cookie when query is missing', () => {
    const req = makeReq({
      cookies: { user_region: 'us' },
      headers: { 'cf-ipcountry': 'CN' },
    });
    expect(detectRegion(req)).toBe('us');
  });

  test('uses CDN country header when no query/cookie', () => {
    expect(detectRegion(makeReq({ headers: { 'cf-ipcountry': 'CN' } }))).toBe('cn');
    expect(detectRegion(makeReq({ headers: { 'x-vercel-ip-country': 'US' } }))).toBe('us');
    expect(detectRegion(makeReq({ headers: { 'x-country-code': 'TW' } }))).toBe('cn');
  });

  test('falls back to accept-language', () => {
    expect(detectRegion(makeReq({ headers: { 'accept-language': 'zh-CN,zh;q=0.9' } }))).toBe('cn');
    expect(detectRegion(makeReq({ headers: { 'accept-language': 'en-US,en;q=0.8' } }))).toBe('us');
  });

  test('defaults to us', () => {
    expect(detectRegion(makeReq())).toBe('us');
  });

  test('database url fallback keeps existing behavior', () => {
    process.env.DATABASE_URL = 'file:/tmp/default.db';
    process.env.DATABASE_URL_US = 'file:/tmp/us.db';

    expect(getDatabaseUrl('cn')).toBe('file:/tmp/default.db');
    expect(getDatabaseUrl('us')).toBe('file:/tmp/us.db');

    process.env.DATABASE_URL_CN = 'file:/tmp/cn.db';
    expect(getDatabaseUrl('cn')).toBe('file:/tmp/cn.db');
  });

  test('region config exposes legal entities and providers', () => {
    const cnConfig = getRegionConfig('cn');
    const usConfig = getRegionConfig('us');

    expect(cnConfig.paymentProviders).toEqual(['wechat', 'alipay']);
    expect(cnConfig.legalEntity).toContain('未登峰');
    expect(cnConfig.socialCreditCode).toBe('91110112MAKCMPQ75F');
    expect(cnConfig.icpNumber).toBe('京ICP备2026031853号-2A');

    expect(usConfig.paymentProviders).toEqual(['stripe']);
    expect(usConfig.legalEntity).toBe('Unsummit Technology Limited');
  });
});
