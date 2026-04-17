const express = require('express');
const https = require('https');
const router = express.Router();

// 山峰坐标映射（用坐标查询更准确）
const peakCoords = {
  '珠穆朗玛峰': { lat: 27.98, lon: 86.92 },
  '珠峰大本营': { lat: 28.0,  lon: 86.85 },
  'K2':        { lat: 35.88, lon: 76.51 },
  'K2大本营':   { lat: 35.88, lon: 76.51 },
  '干城章嘉峰': { lat: 27.70, lon: 88.14 },
  '洛子峰':    { lat: 27.96, lon: 86.93 },
  '马卡鲁峰':  { lat: 27.89, lon: 87.09 },
  '卓奥友峰':  { lat: 28.09, lon: 86.66 },
  '道拉吉里峰': { lat: 28.70, lon: 83.49 },
  '马纳斯卢峰': { lat: 28.55, lon: 84.56 },
  '南迦帕尔巴特峰': { lat: 35.23, lon: 74.58 },
  '安纳普尔纳峰': { lat: 28.59, lon: 83.82 },
  '加舒尔布鲁姆I峰': { lat: 35.72, lon: 76.69 },
  '布洛阿特峰': { lat: 35.81, lon: 76.57 },
  '加舒尔布鲁姆II峰': { lat: 35.76, lon: 76.65 },
  '希夏邦马峰': { lat: 28.35, lon: 85.78 },
  '麦金利山':  { lat: 63.07, lon: -151.00 },
  '阿空加瓜峰': { lat: -32.65, lon: -70.01 },
  '乞力马扎罗山': { lat: -3.07, lon: 37.35 },
  '文森峰':    { lat: -78.53, lon: -85.62 },
  '科修斯科山': { lat: -36.46, lon: 148.26 },
  '厄尔布鲁士山': { lat: 43.35, lon: 42.44 },
  '四姑娘山':  { lat: 30.95, lon: 102.97 },
  '玉龙雪山':  { lat: 27.10, lon: 100.22 },
  '贡嘎山':   { lat: 29.59, lon: 101.88 },
  '梅里雪山':  { lat: 28.44, lon: 98.68 },
  '梅鲁峰':   { lat: 30.88, lon: 79.10 },
  '阿玛达布拉姆峰': { lat: 27.86, lon: 86.86 },
  '岛峰':     { lat: 27.93, lon: 86.92 },
};

// 天气描述英文→中文映射
const weatherDescMap = {
  'clear sky': '晴',
  'few clouds': '少云',
  'scattered clouds': '多云',
  'broken clouds': '阴',
  'overcast clouds': '阴',
  'shower rain': '小雨',
  'light rain': '小雨',
  'rain': '中雨',
  'moderate rain': '中雨',
  'heavy intensity rain': '大雨',
  'thunderstorm': '雷暴',
  'snow': '小雪',
  'light snow': '小雪',
  'heavy snow': '大雪',
  'mist': '雾',
  'fog': '雾',
};

function translateWeather(desc) {
  if (!desc) return desc;
  const lower = desc.toLowerCase();
  return weatherDescMap[lower] || desc;
}

function fetchData(url) {
  return new Promise((resolve, reject) => {
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

function fetchWeather(params) {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) return Promise.reject(new Error('未配置 OPENWEATHER_API_KEY 环境变量'));
  const query = new URLSearchParams({ ...params, appid: apiKey });
  return fetchData(`https://api.openweathermap.org/data/2.5/weather?${query}`);
}

function fetchForecast(params) {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) return Promise.reject(new Error('未配置 OPENWEATHER_API_KEY 环境变量'));
  const query = new URLSearchParams({ ...params, appid: apiKey, cnt: 56 });
  return fetchData(`https://api.openweathermap.org/data/2.5/forecast?${query}`);
}

function resolveParams(location, lat, lon) {
  if (lat !== undefined && lon !== undefined) {
    return { params: { lat, lon }, locationName: location || `${lat},${lon}` };
  }
  if (location && peakCoords[location]) {
    return { params: peakCoords[location], locationName: location };
  }
  if (location) {
    return { params: { q: location }, locationName: location };
  }
  return null;
}

// GET /api/weather?location=珠峰大本营
// GET /api/weather?lat=28.0&lon=86.85
router.get('/', async (req, res) => {
  try {
    const { location, lat, lon } = req.query;
    const resolved = resolveParams(location, lat, lon);
    if (!resolved) return res.status(400).json({ error: '请提供 location 或 lat/lon 参数' });

    const data = await fetchWeather(resolved.params);

    res.json({
      location: resolved.locationName,
      temp: Math.round((data.main.temp - 273.15) * 10) / 10,
      wind: Math.round(data.wind.speed * 3.6 * 10) / 10,
      humidity: data.main.humidity,
      visibility: Math.round((data.visibility || 0) / 1000 * 10) / 10,
    });
  } catch (e) {
    res.status(502).json({ error: e.message || '天气数据获取失败' });
  }
});

// GET /api/weather/forecast?location=珠穆朗玛峰
// GET /api/weather/forecast?lat=27.98&lon=86.92
router.get('/forecast', async (req, res) => {
  try {
    const { location, lat, lon } = req.query;
    const resolved = resolveParams(location, lat, lon);
    if (!resolved) return res.status(400).json({ error: '请提供 location 或 lat/lon 参数' });

    const data = await fetchForecast(resolved.params);

    // 将3小时间隔数据聚合成7天预报
    const dayMap = {};
    for (const item of data.list) {
      const date = item.dt_txt.slice(0, 10);
      if (!dayMap[date]) {
        dayMap[date] = { temps: [], winds: [], humidities: [], descs: [] };
      }
      dayMap[date].temps.push(item.main.temp - 273.15);
      dayMap[date].winds.push(item.wind.speed * 3.6);
      dayMap[date].humidities.push(item.main.humidity);
      if (item.weather && item.weather[0]) {
        dayMap[date].descs.push(item.weather[0].description);
      }
    }

    const forecast = Object.entries(dayMap).slice(0, 7).map(([date, v]) => ({
      date,
      temp_max: Math.round(Math.max(...v.temps) * 10) / 10,
      temp_min: Math.round(Math.min(...v.temps) * 10) / 10,
      wind: Math.round((v.winds.reduce((a, b) => a + b, 0) / v.winds.length) * 10) / 10,
      humidity: Math.round(v.humidities.reduce((a, b) => a + b, 0) / v.humidities.length),
      description: translateWeather(v.descs[Math.floor(v.descs.length / 2)] || v.descs[0] || ''),
    }));

    res.json({ location: resolved.locationName, forecast });
  } catch (e) {
    res.status(502).json({ error: e.message || '天气预报获取失败' });
  }
});

module.exports = router;
