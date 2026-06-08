const CN_REGIONS = ['CN', 'HK', 'MO', 'TW'];

function normalizeRegion(input) {
  const value = String(input || '').trim().toLowerCase();
  if (value === 'cn') return 'cn';
  if (value === 'us' || value === 'global') return 'us';
  return null;
}

function detectRegion(req) {
  // DEPLOY_REGION env var takes priority (set per-server in .env)
  const envRegion = normalizeRegion(process.env.DEPLOY_REGION);
  if (envRegion) return envRegion;

  const queryRegion = normalizeRegion(req && req.query && req.query.region);
  if (queryRegion) return queryRegion;

  const cookieRegion = normalizeRegion(req && req.cookies && req.cookies.user_region);
  if (cookieRegion) return cookieRegion;

  const country = String(
    (req && req.headers && (
      req.headers['cf-ipcountry'] ||
      req.headers['x-vercel-ip-country'] ||
      req.headers['x-country-code'] ||
      req.headers['x-country']
    )) || ''
  ).trim().toUpperCase();
  if (country && CN_REGIONS.includes(country)) return 'cn';
  if (country && country.length === 2) return 'us';

  const language = String(req && req.headers && req.headers['accept-language'] || '').toLowerCase();
  if (language.includes('zh')) return 'cn';
  if (language.length > 0) return 'us';

  return process.env.DEPLOY_REGION || 'us';
}

function getDatabaseUrl(region) {
  if (region === 'cn') {
    return process.env.DATABASE_URL_CN || process.env.DATABASE_URL;
  }
  return process.env.DATABASE_URL_US || process.env.DATABASE_URL;
}

function getRegionConfig(region) {
  const usConfig = {
    apiBaseUrl: process.env.API_BASE_URL_US || 'https://api.summitlink.app',
    cdnHost: process.env.CDN_HOST_US || process.env.COS_CDN_DOMAIN || '',
    paymentProviders: ['stripe'],
    stripeEnabled: process.env.STRIPE_DISABLED !== 'true',
    currency: 'USD',
    legalEntity: 'Unsummit Technology Limited',
    legalEntityEn: 'Unsummit Technology Limited',
    deployTarget: 'railway',
  };
  return {
    cn: {
      apiBaseUrl: process.env.API_BASE_URL_CN || 'https://api-cn.summitlink.app',
      cdnHost: process.env.COS_CDN_DOMAIN || process.env.CDN_HOST_US || '',
      paymentProviders: ['wechat', 'alipay'],
      stripeEnabled: false,
      currency: 'CNY',
      legalEntity: '未登峰（北京）科技有限公司',
      legalEntityEn: 'Weidengfeng (Beijing) Technology Co., Ltd.',
      socialCreditCode: '91110112MAKCMPQ75F',
      icpNumber: process.env.ICP_NUMBER || '京ICP备2026031853号-2A',
      icpPoliceNumber: process.env.ICP_POLICE_NUMBER || '京公网安备XXXXXXXXXXXXX号（备案中）',
      deployTarget: 'tencent-cloud',
    },
    us: usConfig,
    global: usConfig, // legacy alias
  }[region] || usConfig;
}

module.exports = { detectRegion, getDatabaseUrl, getRegionConfig, CN_REGIONS };

