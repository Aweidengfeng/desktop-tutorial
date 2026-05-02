/**
 * SummitLink 地图配置接口
 * 根据用户 IP 所在地区自动返回合适的地图引擎配置
 *
 * 规则：
 *   - 中国大陆 (CN) → 高德地图 (AMap)
 *   - 其他地区 → Mapbox GL JS
 *
 * IP 检测优先级：
 *   1. CF-IPCountry（Cloudflare 自动注入，最准确）
 *   2. X-Country（自定义代理头）
 *   3. 无法判断 → 默认高德（保守策略）
 */

const express = require('express');
const router = express.Router();

/**
 * GET /api/config/map
 * 返回当前用户应使用的地图引擎及对应配置
 *
 * Response:
 *   {
 *     provider: 'mapbox' | 'amap',
 *     mapboxToken: string | null,   // 仅 mapbox 时返回
 *     amapKey: string | null,       // 仅 amap 时返回
 *     country: string               // 检测到的国家代码，unknown 表示未检测到
 *   }
 */
router.get('/map', (req, res) => {
  // 读取 IP 国家代码（大写 ISO 3166-1 alpha-2）
  const country = (
    req.headers['cf-ipcountry'] ||
    req.headers['x-country'] ||
    ''
  ).toUpperCase().trim();

  // 中国大陆使用高德，其他所有地区使用 Mapbox
  // 未检测到国家时默认使用高德（保守策略，避免 Mapbox Token 泄露给非必要用户）
  const useMapbox = country && country !== 'CN' && country !== 'XX'; // XX = Cloudflare 无法确定

  const response = {
    provider: useMapbox ? 'mapbox' : 'amap',
    mapboxToken: useMapbox ? (process.env.MAPBOX_TOKEN || null) : null,
    amapKey: !useMapbox ? (process.env.AMAP_KEY || null) : null,
    country: country || 'unknown',
  };

  // 缓存 1 小时（IP 地区不会频繁变化）
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.json(response);
});

module.exports = router;
