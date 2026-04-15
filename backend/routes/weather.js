const express = require('express');
const router = express.Router();

// 模拟天气数据（如需真实天气，替换为和风天气API或OpenWeatherMap）
const weatherData = {
  '珠峰大本营': { location: '珠峰大本营', temp: -8, wind: 45, humidity: 32, visibility: 12 },
  'K2大本营':   { location: 'K2大本营',   temp: -12, wind: 55, humidity: 28, visibility: 8 },
  '四姑娘山':   { location: '四姑娘山',   temp: 2,   wind: 20, humidity: 60, visibility: 20 },
  '玉龙雪山':   { location: '玉龙雪山',   temp: -2,  wind: 15, humidity: 55, visibility: 18 },
};

// GET /api/weather?location=珠峰大本营
router.get('/', (req, res) => {
  try {
    const { location } = req.query;
    const data = weatherData[location] || {
      location: location || '未知地点',
      temp: -5,
      wind: 30,
      humidity: 40,
      visibility: 15,
    };
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
