const express = require('express');
const https = require('https');
const router = express.Router();

// 山峰坐标映射（用坐标查询更准确）
const peakCoords = {
  '珠峰大本营': { lat: 28.0,  lon: 86.85  },
  'K2大本营':   { lat: 35.88, lon: 76.51  },
  '四姑娘山':   { lat: 30.95, lon: 102.97 },
  '玉龙雪山':   { lat: 27.1,  lon: 100.22 },
};

function fetchWeather(params) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) {
      return reject(new Error('未配置 OPENWEATHER_API_KEY 环境变量'));
    }
    const query = new URLSearchParams({ ...params, appid: apiKey });
    const url = `https://api.openweathermap.org/data/2.5/weather?${query}`;
    https.get(url, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(raw);
          if (res.statusCode !== 200) {
            return reject(new Error(json.message || `API 返回 ${res.statusCode}`));
          }
          resolve(json);
        } catch (e) {
          reject(new Error('解析天气数据失败'));
        }
      });
    }).on('error', (e) => reject(e));
  });
}

// GET /api/weather?location=珠峰大本营
// GET /api/weather?lat=28.0&lon=86.85
router.get('/', async (req, res) => {
  try {
    const { location, lat, lon } = req.query;

    let params;
    let locationName;

    if (lat !== undefined && lon !== undefined) {
      params = { lat, lon };
      locationName = location || `${lat},${lon}`;
    } else if (location && peakCoords[location]) {
      params = peakCoords[location];
      locationName = location;
    } else if (location) {
      params = { q: location };
      locationName = location;
    } else {
      return res.status(400).json({ error: '请提供 location 或 lat/lon 参数' });
    }

    const data = await fetchWeather(params);

    res.json({
      location: locationName,
      temp: Math.round((data.main.temp - 273.15) * 10) / 10,
      wind: Math.round(data.wind.speed * 3.6 * 10) / 10,
      humidity: data.main.humidity,
      visibility: Math.round((data.visibility || 0) / 1000 * 10) / 10,
    });
  } catch (e) {
    res.status(502).json({ error: e.message || '天气数据获取失败' });
  }
});

module.exports = router;
