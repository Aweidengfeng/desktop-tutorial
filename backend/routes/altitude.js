/**
 * GET /api/altitude?lat=XX&lng=YY
 * 根据经纬度返回海拔高度估算
 * 优先调用高德地图 API，回退到基于山峰数据库的近似计算
 */
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

const altitudeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: '请求太频繁' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Simple haversine distance in km
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Approximate altitude via known peaks and linear interpolation
function estimateAltitude(lat, lng) {
  // Known peak positions from weather.js
  const knownPeaks = [
    { lat: 27.9881, lng: 86.9250, alt: 8849, name: '珠峰' },
    { lat: 35.8813, lng: 76.5155, alt: 8611, name: 'K2' },
    { lat: 28.0000, lng: 86.8800, alt: 5364, name: '珠峰大本营' },
    { lat: 28.6966, lng: 83.4911, alt: 8167, name: '洛子峰' },
    { lat: 28.5494, lng: 84.5592, alt: 8163, name: '马纳斯卢峰' },
    { lat: 35.7586, lng: 76.6533, alt: 8034, name: '迦舒尔布鲁姆' },
    { lat: 28.5955, lng: 83.8203, alt: 8091, name: '道拉吉里峰' },
    { lat: 28.8971, lng: 83.5903, alt: 8167, name: '安纳普尔纳峰' },
    { lat: 27.7025, lng: 88.1475, alt: 8586, name: '干城章嘉峰' },
    { lat: 28.0900, lng: 86.6600, alt: 8201, name: '卓奥友峰' },
    { lat: 27.4200, lng: 100.0000, alt: 3200, name: '哈巴雪山大本营' },
    { lat: 30.2741, lng: 102.1023, alt: 4000, name: '四姑娘山' },
    { lat: -3.0674, lng: 37.3556, alt: 5895, name: '乞力马扎罗' },
    { lat: 43.3500, lng: 42.4400, alt: 5642, name: '厄尔布鲁士' },
    { lat: 63.0692, lng: -151.0027, alt: 6190, name: '迪纳利峰' },
    { lat: -32.6532, lng: -70.0109, alt: 6961, name: '阿空加瓜峰' },
  ];

  // Find closest known peak
  let minDist = Infinity, closestAlt = 500;
  for (const p of knownPeaks) {
    const d = haversine(lat, lng, p.lat, p.lng);
    if (d < minDist) { minDist = d; closestAlt = p.alt; }
  }

  // Within 5km of known peak → weighted blend
  if (minDist < 5) {
    // Blend: closer → use peak altitude more
    const weight = Math.max(0, 1 - minDist / 5);
    return Math.round(closestAlt * weight + 800 * (1 - weight));
  }

  // Rough global DEM approximation using latitude
  // Higher absolute latitude bands + known mountain regions
  const absLat = Math.abs(lat);
  const isHimalayas = lat > 25 && lat < 36 && lng > 75 && lng < 100;
  const isAlps = lat > 44 && lat < 48 && lng > 6 && lng < 16;
  const isAndes = lat < 0 && lat > -40 && lng > -80 && lng < -60;
  const isAfrica = lat > -10 && lat < 10 && lng > 30 && lng < 45;

  if (isHimalayas) return Math.round(3000 + Math.random() * 2000);
  if (isAlps) return Math.round(1500 + Math.random() * 2000);
  if (isAndes) return Math.round(2000 + Math.random() * 3000);
  if (isAfrica) return Math.round(800 + Math.random() * 1500);

  // Default: sea level + gentle slope
  return Math.round(100 + absLat * 10 + Math.random() * 200);
}

// GET /api/altitude?lat=27.9881&lng=86.9250
router.get('/', altitudeLimiter, async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);

  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({ error: '请提供有效的经纬度参数 lat 和 lng' });
  }

  // Try 高德 Elevation API if key is configured
  const amapKey = process.env.AMAP_KEY;
  if (amapKey) {
    try {
      const url = `https://restapi.amap.com/v3/geocode/elevation?key=${amapKey}&locations=${lng},${lat}&output=JSON`;
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 3000);
      const resp = await fetch(url, { signal: ctrl.signal });
      clearTimeout(timeout);
      if (resp.ok) {
        const data = await resp.json();
        if (data.status === '1' && data.elevations && data.elevations[0]) {
          const alt = parseFloat(data.elevations[0]);
          if (!isNaN(alt)) {
            return res.json({ altitude: Math.round(alt), source: 'amap', lat, lng });
          }
        }
      }
    } catch(e) {
      // Fall through to estimate
    }
  }

  // Fallback: estimate from known peaks
  const altitude = estimateAltitude(lat, lng);
  res.json({ altitude, source: 'estimate', lat, lng });
});

module.exports = router;
