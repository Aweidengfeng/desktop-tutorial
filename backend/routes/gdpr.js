const express = require('express');
const router = express.Router();

// GET /api/gdpr/check — 检查用户地区是否需要 GDPR 横幅
router.get('/check', (req, res) => {
  // 通过 CF-IPCountry 头（Cloudflare）或 X-Country 头判断地区
  const country = (
    req.headers['cf-ipcountry'] ||
    req.headers['x-country'] ||
    ''
  ).toUpperCase();

  // 欧盟国家列表
  const EU_COUNTRIES = [
    'AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR',
    'DE','GR','HU','IE','IT','LV','LT','LU','MT','NL',
    'PL','PT','RO','SK','SI','ES','SE','IS','LI','NO'
  ];

  const requiresGdpr = EU_COUNTRIES.includes(country);

  res.json({
    requiresGdpr,
    country: country || 'unknown',
    privacyUrl: '/legal/privacy',
    termsUrl: '/legal/terms',
  });
});

module.exports = router;
