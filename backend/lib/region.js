const CN_REGIONS = ['CN', 'HK', 'MO', 'TW'];

function normalizeRegion(input) {
  const value = String(input || '').trim().toLowerCase();
  return value === 'cn' ? 'cn' : (value === 'us' || value === 'global' ? 'global' : null);
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
  if (country && country.length === 2) return 'global';

  const language = String(req && req.headers && req.headers['accept-language'] || '').toLowerCase();
  if (language.includes('zh')) return 'cn';

  return process.env.DEPLOY_REGION || 'global';
}

function getDatabaseUrl(region) {
  if (region === 'cn') {
    return process.env.DATABASE_URL_CN || process.env.DATABASE_URL;
  }
  return process.env.DATABASE_URL_US || process.env.DATABASE_URL;
}

function getRegionConfig(region) {
  return {
    cn: {
      apiBaseUrl: process.env.API_BASE_URL_CN || 'https://api-cn.summitlink.app',
      cdnHost: process.env.COS_CDN_DOMAIN || process.env.CDN_HOST_US || '',
      paymentProviders: ['wechat', 'alipay'],
      stripeEnabled: false,
      currency: 'CNY',
      legalEntity: '末登峰（北京）科技有限公司',
      legalEntityEn: 'Modengfeng (Beijing) Technology Co., Ltd.',
      socialCreditCode: '91110112MAKCMPQ75F',
      icpNumber: process.env.ICP_NUMBER || '京ICP备XXXXXXXX号（备案中）',
      icpPoliceNumber: process.env.ICP_POLICE_NUMBER || '京公网安备XXXXXXXXXXXXX号（备案中）',
      deployTarget: 'tencent-cloud',
    },
    global: {
      apiBaseUrl: process.env.API_BASE_URL_US || 'https://api.summitlink.app',
      cdnHost: process.env.CDN_HOST_US || process.env.COS_CDN_DOMAIN || '',
      paymentProviders: ['stripe'],
      stripeEnabled: process.env.STRIPE_DISABLED !== 'true',
      currency: 'USD',
      legalEntity: 'SummitLink US LLC',
      legalEntityEn: 'SummitLink US LLC',
      deployTarget: 'railway',
    },
  }[region] || {
    apiBaseUrl: process.env.API_BASE_URL_US || 'https://api.summitlink.app',
    cdnHost: process.env.CDN_HOST_US || '',
    paymentProviders: ['stripe'],
    stripeEnabled: process.env.STRIPE_DISABLED !== 'true',
    currency: 'USD',
    legalEntity: 'SummitLink US LLC',
    legalEntityEn: 'SummitLink US LLC',
    deployTarget: 'railway',
  };
}

module.exports = { detectRegion, getDatabaseUrl, getRegionConfig, CN_REGIONS };
