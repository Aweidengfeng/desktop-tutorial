const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

const configLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, message: { error: '请求太频繁' }, standardHeaders: true, legacyHeaders: false });

function isPaymentsEnabled() {
  return String(process.env.PAYMENTS_ENABLED || 'false').toLowerCase() === 'true';
}

function hasValidMapboxToken(token) {
  const normalized = String(token || '').trim();
  if (!normalized) return false;
  if (/^pk\.xxx/i.test(normalized)) return false;
  if (/your[_-]?mapbox/i.test(normalized)) return false;
  return normalized.startsWith('pk.');
}

router.get('/', configLimiter, (_req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.json({
    paymentsEnabled: isPaymentsEnabled(),
  });
});

/**
 * GET /api/config/map
 * 根据用户 IP 所在地区自动返回合适的地图引擎配置。
 * 公开接口，无需鉴权。
 *
 * IP 检测优先级：
 *   1. CF-IPCountry（Cloudflare 自动注入，最准确）
 *   2. X-Country（自定义代理头）
 *   3. 无法判断 → 默认高德（保守策略）
 *
 * 规则：
 *   - 中国大陆 (CN) 或无法判断 → 高德地图 (AMap)
 *   - 其他地区 且 MAPBOX_TOKEN 已配置 → Mapbox GL JS
 *
 * Response:
 *   {
 *     provider: 'mapbox' | 'amap',
 *     token: string | null,        // mapbox 时返回 MAPBOX_TOKEN（前向兼容字段）
 *     mapboxToken: string | null,  // 同 token，新字段名
 *     amapKey: string | null,      // amap 时返回（可供 Capacitor 端直接使用）
 *     amapSecurityCode: string | null, // amap 时返回（高德官方要求与 Key 配对使用）
 *     country: string              // 检测到的国家代码，unknown 表示未检测到
 *   }
 */
router.get('/map', configLimiter, (req, res) => {
  // 读取 IP 国家代码（大写 ISO 3166-1 alpha-2）
  const country = (
    req.headers['cf-ipcountry'] ||
    req.headers['x-country'] ||
    ''
  ).toUpperCase().trim();

  // 中国大陆或无法判断时使用高德；其他地区优先 Mapbox，无 token 时降级 OSM
  // country 为空字符串 = 无法检测（默认高德）
  // country = 'XX' = Cloudflare 标记的"无法确定"（默认高德）
  const isNonChina = country !== '' && country !== 'CN' && country !== 'XX';
  const mapboxToken = String(process.env.MAPBOX_TOKEN || '').trim();
  const useMapbox = isNonChina && hasValidMapboxToken(mapboxToken);
  const useOsmFallback = isNonChina && !useMapbox;

  const response = {
    provider: useMapbox ? 'mapbox' : (useOsmFallback ? 'osm' : 'amap'),
    token: useMapbox ? mapboxToken : null,         // 前向兼容（旧前端读 data.token）
    mapboxToken: useMapbox ? mapboxToken : null,   // 新字段（新前端读 data.mapboxToken）
    amapKey: !useMapbox && !useOsmFallback ? (process.env.AMAP_KEY || null) : null,
    amapSecurityCode: !useMapbox && !useOsmFallback ? (process.env.AMAP_SECURITY_CODE || null) : null,
    tileUrl: useOsmFallback ? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' : null,
    attribution: useOsmFallback ? '© OpenStreetMap contributors' : null,
    country: country || 'unknown',
  };

  // 缓存 10 分钟（比 1 小时更合适 - 兼顾旅行中/VPN 用户的 IP 变化）
  res.setHeader('Cache-Control', 'public, max-age=600');
  res.json(response);
});

module.exports = router;
