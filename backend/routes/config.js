const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

const configLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, message: { error: '请求太频繁' }, standardHeaders: true, legacyHeaders: false });

/**
 * GET /api/config/map
 * 返回地图引擎配置（provider + token）。
 * 公开接口，无需鉴权。
 * 当 MAPBOX_TOKEN 环境变量存在时返回 mapbox，否则返回 amap。
 */
router.get('/map', configLimiter, (req, res) => {
  if (process.env.MAPBOX_TOKEN) {
    return res.json({ provider: 'mapbox', token: process.env.MAPBOX_TOKEN });
  }
  return res.json({ provider: 'amap' });
});

module.exports = router;
