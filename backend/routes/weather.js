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

// 各山峰营地数据
const PEAK_CAMPS = {
  '珠穆朗玛峰': [
    { name: '大本营 EBC',       altitude: 5364, lat: 27.9986, lon: 86.8508, emoji: '🏕️' },
    { name: '营地一 C1',         altitude: 6065, lat: 27.9700, lon: 86.8600, emoji: '⛺' },
    { name: '营地二 C2',         altitude: 6500, lat: 27.9600, lon: 86.8900, emoji: '⛺' },
    { name: '营地三 C3',         altitude: 7200, lat: 27.9700, lon: 86.9100, emoji: '⛺' },
    { name: '南坳 C4',           altitude: 7920, lat: 27.9596, lon: 86.9314, emoji: '⛺' },
    { name: '顶峰 Summit',       altitude: 8849, lat: 27.9881, lon: 86.9250, emoji: '🏔️' },
  ],
  'K2': [
    { name: '大本营 BC',         altitude: 5000, lat: 35.8821, lon: 76.5133, emoji: '🏕️' },
    { name: '营地一 C1',         altitude: 6100, lat: 35.8750, lon: 76.5150, emoji: '⛺' },
    { name: '营地二 C2',         altitude: 6700, lat: 35.8700, lon: 76.5100, emoji: '⛺' },
    { name: '营地三 C3',         altitude: 7200, lat: 35.8650, lon: 76.5050, emoji: '⛺' },
    { name: '营地四 C4',         altitude: 7800, lat: 35.8610, lon: 76.5080, emoji: '⛺' },
    { name: '顶峰 Summit',       altitude: 8611, lat: 35.8825, lon: 76.5133, emoji: '🏔️' },
  ],
  '干城章嘉峰': [
    { name: '大本营 BC',         altitude: 5143, lat: 27.6700, lon: 88.1400, emoji: '🏕️' },
    { name: '营地一 C1',         altitude: 5900, lat: 27.6800, lon: 88.1500, emoji: '⛺' },
    { name: '营地二 C2',         altitude: 6500, lat: 27.6900, lon: 88.1550, emoji: '⛺' },
    { name: '营地三 C3',         altitude: 7200, lat: 27.7000, lon: 88.1600, emoji: '⛺' },
    { name: '营地四 C4',         altitude: 7900, lat: 27.7050, lon: 88.1620, emoji: '⛺' },
    { name: '顶峰 Summit',       altitude: 8586, lat: 27.7025, lon: 88.1475, emoji: '🏔️' },
  ],
  '洛子峰': [
    { name: '大本营 EBC',        altitude: 5364, lat: 27.9986, lon: 86.8508, emoji: '🏕️' },
    { name: '营地二 C2',         altitude: 6400, lat: 27.9600, lon: 86.9000, emoji: '⛺' },
    { name: '营地三 C3',         altitude: 7200, lat: 27.9620, lon: 86.9200, emoji: '⛺' },
    { name: '营地四 C4',         altitude: 7900, lat: 27.9610, lon: 86.9300, emoji: '⛺' },
    { name: '顶峰 Summit',       altitude: 8516, lat: 27.9617, lon: 86.9330, emoji: '🏔️' },
  ],
  '马卡鲁峰': [
    { name: '大本营 BC',         altitude: 5700, lat: 27.8900, lon: 87.0900, emoji: '🏕️' },
    { name: '营地一 C1',         altitude: 6200, lat: 27.8950, lon: 87.1000, emoji: '⛺' },
    { name: '营地二 C2',         altitude: 7200, lat: 27.8980, lon: 87.1050, emoji: '⛺' },
    { name: '营地三 C3',         altitude: 7800, lat: 27.8990, lon: 87.1080, emoji: '⛺' },
    { name: '顶峰 Summit',       altitude: 8485, lat: 27.8897, lon: 87.0882, emoji: '🏔️' },
  ],
  '卓奥友峰': [
    { name: '大本营 BC',         altitude: 5700, lat: 28.0900, lon: 86.6600, emoji: '🏕️' },
    { name: '前进营地 ABC',      altitude: 6400, lat: 28.0940, lon: 86.6640, emoji: '⛺' },
    { name: '营地一 C1',         altitude: 7000, lat: 28.0960, lon: 86.6660, emoji: '⛺' },
    { name: '营地二 C2',         altitude: 7500, lat: 28.0970, lon: 86.6670, emoji: '⛺' },
    { name: '顶峰 Summit',       altitude: 8201, lat: 28.0940, lon: 86.6608, emoji: '🏔️' },
  ],
  '道拉吉里峰': [
    { name: '大本营 BC',         altitude: 4750, lat: 28.7000, lon: 83.4900, emoji: '🏕️' },
    { name: '营地一 C1',         altitude: 5950, lat: 28.7020, lon: 83.4920, emoji: '⛺' },
    { name: '营地二 C2',         altitude: 6900, lat: 28.7040, lon: 83.4940, emoji: '⛺' },
    { name: '营地三 C3',         altitude: 7200, lat: 28.7050, lon: 83.4950, emoji: '⛺' },
    { name: '营地四 C4',         altitude: 7800, lat: 28.7060, lon: 83.4960, emoji: '⛺' },
    { name: '顶峰 Summit',       altitude: 8167, lat: 28.6966, lon: 83.4911, emoji: '🏔️' },
  ],
  '马纳斯卢峰': [
    { name: '大本营 BC',         altitude: 4900, lat: 28.5500, lon: 84.5600, emoji: '🏕️' },
    { name: '营地一 C1',         altitude: 5800, lat: 28.5520, lon: 84.5620, emoji: '⛺' },
    { name: '营地二 C2',         altitude: 6600, lat: 28.5540, lon: 84.5640, emoji: '⛺' },
    { name: '营地三 C3',         altitude: 7100, lat: 28.5550, lon: 84.5650, emoji: '⛺' },
    { name: '营地四 C4',         altitude: 7800, lat: 28.5560, lon: 84.5660, emoji: '⛺' },
    { name: '顶峰 Summit',       altitude: 8163, lat: 28.5494, lon: 84.5592, emoji: '🏔️' },
  ],
  '南迦帕尔巴特峰': [
    { name: '大本营 BC',         altitude: 4800, lat: 35.2300, lon: 74.5800, emoji: '🏕️' },
    { name: '营地一 C1',         altitude: 5900, lat: 35.2320, lon: 74.5820, emoji: '⛺' },
    { name: '营地二 C2',         altitude: 6800, lat: 35.2340, lon: 74.5840, emoji: '⛺' },
    { name: '营地三 C3',         altitude: 7200, lat: 35.2350, lon: 74.5850, emoji: '⛺' },
    { name: '营地四 C4',         altitude: 7800, lat: 35.2360, lon: 74.5860, emoji: '⛺' },
    { name: '顶峰 Summit',       altitude: 8126, lat: 35.2372, lon: 74.5892, emoji: '🏔️' },
  ],
  '安纳普尔纳峰': [
    { name: '大本营 BC',         altitude: 4200, lat: 28.5900, lon: 83.8200, emoji: '🏕️' },
    { name: '营地一 C1',         altitude: 5500, lat: 28.5920, lon: 83.8220, emoji: '⛺' },
    { name: '营地二 C2',         altitude: 6200, lat: 28.5940, lon: 83.8240, emoji: '⛺' },
    { name: '营地三 C3',         altitude: 7200, lat: 28.5950, lon: 83.8250, emoji: '⛺' },
    { name: '营地四 C4',         altitude: 7400, lat: 28.5960, lon: 83.8260, emoji: '⛺' },
    { name: '顶峰 Summit',       altitude: 8091, lat: 28.5955, lon: 83.8203, emoji: '🏔️' },
  ],
  '加舒尔布鲁姆I峰': [
    { name: '大本营 BC',         altitude: 5150, lat: 35.7200, lon: 76.6900, emoji: '🏕️' },
    { name: '营地一 C1',         altitude: 5900, lat: 35.7220, lon: 76.6920, emoji: '⛺' },
    { name: '营地二 C2',         altitude: 6500, lat: 35.7240, lon: 76.6940, emoji: '⛺' },
    { name: '营地三 C3',         altitude: 7200, lat: 35.7250, lon: 76.6950, emoji: '⛺' },
    { name: '顶峰 Summit',       altitude: 8080, lat: 35.7244, lon: 76.6961, emoji: '🏔️' },
  ],
  '布洛阿特峰': [
    { name: '大本营 BC',         altitude: 4900, lat: 35.8100, lon: 76.5700, emoji: '🏕️' },
    { name: '营地一 C1',         altitude: 5700, lat: 35.8120, lon: 76.5720, emoji: '⛺' },
    { name: '营地二 C2',         altitude: 6600, lat: 35.8140, lon: 76.5740, emoji: '⛺' },
    { name: '营地三 C3',         altitude: 7200, lat: 35.8150, lon: 76.5750, emoji: '⛺' },
    { name: '顶峰 Summit',       altitude: 8051, lat: 35.8117, lon: 76.5658, emoji: '🏔️' },
  ],
  '加舒尔布鲁姆II峰': [
    { name: '大本营 BC',         altitude: 5150, lat: 35.7600, lon: 76.6500, emoji: '🏕️' },
    { name: '营地一 C1',         altitude: 5900, lat: 35.7620, lon: 76.6520, emoji: '⛺' },
    { name: '营地二 C2',         altitude: 6500, lat: 35.7640, lon: 76.6540, emoji: '⛺' },
    { name: '营地三 C3',         altitude: 7000, lat: 35.7650, lon: 76.6550, emoji: '⛺' },
    { name: '顶峰 Summit',       altitude: 8034, lat: 35.7586, lon: 76.6533, emoji: '🏔️' },
  ],
  '希夏邦马峰': [
    { name: '大本营 BC',         altitude: 5000, lat: 28.3500, lon: 85.7800, emoji: '🏕️' },
    { name: '前进营地 ABC',      altitude: 5700, lat: 28.3520, lon: 85.7820, emoji: '⛺' },
    { name: '营地一 C1',         altitude: 6400, lat: 28.3540, lon: 85.7840, emoji: '⛺' },
    { name: '营地二 C2',         altitude: 7100, lat: 28.3550, lon: 85.7850, emoji: '⛺' },
    { name: '顶峰 Summit',       altitude: 8027, lat: 28.3525, lon: 85.7775, emoji: '🏔️' },
  ],
  // 大陆最高峰
  '麦金利山': [
    { name: '大本营 BC',         altitude: 2194, lat: 63.0700, lon: -151.0000, emoji: '🏕️' },
    { name: '营地一 C1',         altitude: 3353, lat: 63.0720, lon: -151.0020, emoji: '⛺' },
    { name: '营地二 C2',         altitude: 4328, lat: 63.0740, lon: -151.0040, emoji: '⛺' },
    { name: '营地三 C3',         altitude: 5240, lat: 63.0750, lon: -151.0050, emoji: '⛺' },
    { name: '顶峰 Summit',       altitude: 6190, lat: 63.0692, lon: -151.0027, emoji: '🏔️' },
  ],
  '阿空加瓜峰': [
    { name: '大本营 Plaza Argentina', altitude: 4300, lat: -32.6500, lon: -70.0100, emoji: '🏕️' },
    { name: '营地一 C1',         altitude: 5500, lat: -32.6480, lon: -70.0080, emoji: '⛺' },
    { name: '营地二 C2',         altitude: 6000, lat: -32.6460, lon: -70.0060, emoji: '⛺' },
    { name: '白石营地 Nido',     altitude: 6500, lat: -32.6450, lon: -70.0050, emoji: '⛺' },
    { name: '顶峰 Summit',       altitude: 6961, lat: -32.6532, lon: -70.0110, emoji: '🏔️' },
  ],
  '乞力马扎罗山': [
    { name: '大门口 Marangu Gate', altitude: 1879, lat: -3.0700, lon: 37.3500, emoji: '🏕️' },
    { name: '曼达拉营地',        altitude: 2700, lat: -3.0600, lon: 37.3600, emoji: '⛺' },
    { name: '霍龙博营地',        altitude: 3720, lat: -3.0500, lon: 37.3700, emoji: '⛺' },
    { name: '基博营地',          altitude: 4703, lat: -3.0800, lon: 37.3520, emoji: '⛺' },
    { name: '乌呼鲁峰顶',        altitude: 5895, lat: -3.0674, lon: 37.3556, emoji: '🏔️' },
  ],
  '厄尔布鲁士山': [
    { name: '大本营 BC',         altitude: 2350, lat: 43.3500, lon: 42.4400, emoji: '🏕️' },
    { name: '桶屋营地',          altitude: 3800, lat: 43.3520, lon: 42.4420, emoji: '⛺' },
    { name: '高地营地',          altitude: 4700, lat: 43.3540, lon: 42.4440, emoji: '⛺' },
    { name: '顶峰 Summit',       altitude: 5642, lat: 43.3500, lon: 42.4394, emoji: '🏔️' },
  ],
  '文森峰': [
    { name: '大本营 Union Glacier', altitude: 700, lat: -79.7700, lon: -83.2600, emoji: '🏕️' },
    { name: '中段营地',          altitude: 3800, lat: -78.5400, lon: -85.6200, emoji: '⛺' },
    { name: '高营地',            altitude: 4800, lat: -78.5300, lon: -85.6100, emoji: '⛺' },
    { name: '顶峰 Summit',       altitude: 4892, lat: -78.5254, lon: -85.6170, emoji: '🏔️' },
  ],
  '四姑娘山': [
    { name: '日隆镇',            altitude: 2680, lat: 30.9200, lon: 102.9100, emoji: '🏕️' },
    { name: '大本营 BC',         altitude: 3800, lat: 30.9300, lon: 102.9200, emoji: '⛺' },
    { name: '营地一 C1',         altitude: 4800, lat: 30.9400, lon: 102.9300, emoji: '⛺' },
    { name: '顶峰 (幺妹峰)',     altitude: 6250, lat: 30.9500, lon: 102.9700, emoji: '🏔️' },
  ],
  '贡嘎山': [
    { name: '磨西镇',            altitude: 1600, lat: 29.5800, lon: 101.8700, emoji: '🏕️' },
    { name: '大本营 BC',         altitude: 3600, lat: 29.5900, lon: 101.8800, emoji: '⛺' },
    { name: '营地一 C1',         altitude: 5000, lat: 29.5950, lon: 101.8900, emoji: '⛺' },
    { name: '营地二 C2',         altitude: 6000, lat: 29.5960, lon: 101.8920, emoji: '⛺' },
    { name: '顶峰 Summit',       altitude: 7556, lat: 29.5942, lon: 101.8781, emoji: '🏔️' },
  ],
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

// GET /api/weather/camps?peak=山峰名称
router.get('/camps', async (req, res) => {
  const { peak } = req.query;
  const camps = PEAK_CAMPS[peak];
  if (!camps) {
    return res.json({ error: '暂无该山峰营地数据' });
  }

  const results = await Promise.allSettled(
    camps.map(async (camp) => {
      let weather = null;
      let forecast = [];
      try {
        const wData = await fetchWeather({ lat: camp.lat, lon: camp.lon });
        weather = {
          temp: Math.round((wData.main.temp - 273.15) * 10) / 10,
          wind: Math.round(wData.wind.speed * 3.6 * 10) / 10,
          humidity: wData.main.humidity,
          visibility: Math.round((wData.visibility || 0) / 1000 * 10) / 10,
        };
      } catch (e) {}
      try {
        const fData = await fetchForecast({ lat: camp.lat, lon: camp.lon });
        const dayMap = {};
        for (const item of fData.list) {
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
        forecast = Object.entries(dayMap).slice(0, 7).map(([date, v]) => ({
          date,
          temp_max: Math.round(Math.max(...v.temps) * 10) / 10,
          temp_min: Math.round(Math.min(...v.temps) * 10) / 10,
          wind: Math.round((v.winds.reduce((a, b) => a + b, 0) / v.winds.length) * 10) / 10,
          humidity: Math.round(v.humidities.reduce((a, b) => a + b, 0) / v.humidities.length),
          description: translateWeather(v.descs[Math.floor(v.descs.length / 2)] || v.descs[0] || ''),
        }));
      } catch (e) {}
      return { name: camp.name, altitude: camp.altitude, emoji: camp.emoji, weather, forecast };
    })
  );

  res.json({
    peak,
    camps: results.map(r => r.status === 'fulfilled' ? r.value : null).filter(Boolean),
  });
});

module.exports = router;
