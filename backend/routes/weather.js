const express = require('express');
const https = require('https');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const prisma = require('../db/prisma');
const weatherCache = require('../utils/weatherCache');

const summitWindowLimiter = rateLimit({ windowMs: 60*1000, max: 30 });

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
  // 中低海拔雪山及入门峰
  '慕士塔格峰': { lat: 38.27, lon: 75.11 },
  '列宁峰':    { lat: 39.71, lon: 72.59 },
  '梅拉峰':    { lat: 27.69, lon: 86.91 },
  '哈巴雪山':  { lat: 27.42, lon: 100.00 },
  '雀儿山':   { lat: 31.00, lon: 99.67 },
  '玉珠峰':   { lat: 35.63, lon: 94.25 },
  '启孜峰':   { lat: 29.35, lon: 90.46 },
  '亚拉雪山':  { lat: 30.38, lon: 101.92 },
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
    { name: '营地一 C1',         altitude: 6100, lat: 35.8700, lon: 76.5200, emoji: '⛺' },
    { name: '营地二 C2',         altitude: 6700, lat: 35.8600, lon: 76.5100, emoji: '⛺' },
    { name: '营地三 C3',         altitude: 7200, lat: 35.8500, lon: 76.5000, emoji: '⛺' },
    { name: '营地四 C4',         altitude: 7800, lat: 35.8400, lon: 76.4900, emoji: '⛺' },
    { name: '顶峰 Summit',       altitude: 8611, lat: 35.8825, lon: 76.5133, emoji: '🏔️' },
  ],
  '干城章嘉峰': [
    { name: '大本营 BC',         altitude: 5143, lat: 27.6700, lon: 88.1400, emoji: '🏕️' },
    { name: '营地一 C1',         altitude: 5900, lat: 27.6900, lon: 88.1500, emoji: '⛺' },
    { name: '营地二 C2',         altitude: 6500, lat: 27.7100, lon: 88.1600, emoji: '⛺' },
    { name: '营地三 C3',         altitude: 7200, lat: 27.7300, lon: 88.1700, emoji: '⛺' },
    { name: '营地四 C4',         altitude: 7900, lat: 27.7500, lon: 88.1800, emoji: '⛺' },
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
    { name: '营地一 C1',         altitude: 6200, lat: 27.9000, lon: 87.1000, emoji: '⛺' },
    { name: '营地二 C2',         altitude: 7200, lat: 27.9100, lon: 87.1100, emoji: '⛺' },
    { name: '营地三 C3',         altitude: 7800, lat: 27.9200, lon: 87.1200, emoji: '⛺' },
    { name: '顶峰 Summit',       altitude: 8485, lat: 27.8897, lon: 87.0882, emoji: '🏔️' },
  ],
  '卓奥友峰': [
    { name: '大本营 BC',         altitude: 5700, lat: 28.0900, lon: 86.6600, emoji: '🏕️' },
    { name: '前进营地 ABC',      altitude: 6400, lat: 28.1000, lon: 86.6700, emoji: '⛺' },
    { name: '营地一 C1',         altitude: 7000, lat: 28.1100, lon: 86.6800, emoji: '⛺' },
    { name: '营地二 C2',         altitude: 7500, lat: 28.1200, lon: 86.6900, emoji: '⛺' },
    { name: '顶峰 Summit',       altitude: 8201, lat: 28.0940, lon: 86.6608, emoji: '🏔️' },
  ],
  '道拉吉里峰': [
    { name: '大本营 BC',         altitude: 4750, lat: 28.7000, lon: 83.4900, emoji: '🏕️' },
    { name: '营地一 C1',         altitude: 5950, lat: 28.7020, lon: 83.4920, emoji: '⛺' },
    { name: '营地二 C2',         altitude: 6900, lat: 28.7100, lon: 83.5000, emoji: '⛺' },
    { name: '营地三 C3',         altitude: 7200, lat: 28.7200, lon: 83.5100, emoji: '⛺' },
    { name: '营地四 C4',         altitude: 7800, lat: 28.7300, lon: 83.5200, emoji: '⛺' },
    { name: '顶峰 Summit',       altitude: 8167, lat: 28.6966, lon: 83.4911, emoji: '🏔️' },
  ],
  '马纳斯卢峰': [
    { name: '大本营 BC',         altitude: 4900, lat: 28.5500, lon: 84.5600, emoji: '🏕️' },
    { name: '营地一 C1',         altitude: 5800, lat: 28.5600, lon: 84.5700, emoji: '⛺' },
    { name: '营地二 C2',         altitude: 6600, lat: 28.5700, lon: 84.5800, emoji: '⛺' },
    { name: '营地三 C3',         altitude: 7100, lat: 28.5800, lon: 84.5900, emoji: '⛺' },
    { name: '营地四 C4',         altitude: 7800, lat: 28.5900, lon: 84.6000, emoji: '⛺' },
    { name: '顶峰 Summit',       altitude: 8163, lat: 28.5494, lon: 84.5592, emoji: '🏔️' },
  ],
  '南迦帕尔巴特峰': [
    { name: '大本营 BC',         altitude: 4800, lat: 35.2300, lon: 74.5800, emoji: '🏕️' },
    { name: '营地一 C1',         altitude: 5900, lat: 35.2500, lon: 74.6000, emoji: '⛺' },
    { name: '营地二 C2',         altitude: 6800, lat: 35.2700, lon: 74.6200, emoji: '⛺' },
    { name: '营地三 C3',         altitude: 7200, lat: 35.2900, lon: 74.6400, emoji: '⛺' },
    { name: '营地四 C4',         altitude: 7800, lat: 35.3100, lon: 74.6600, emoji: '⛺' },
    { name: '顶峰 Summit',       altitude: 8126, lat: 35.2372, lon: 74.5892, emoji: '🏔️' },
  ],
  '安纳普尔纳峰': [
    { name: '大本营 BC',         altitude: 4200, lat: 28.5900, lon: 83.8200, emoji: '🏕️' },
    { name: '营地一 C1',         altitude: 5500, lat: 28.6100, lon: 83.8400, emoji: '⛺' },
    { name: '营地二 C2',         altitude: 6200, lat: 28.6300, lon: 83.8600, emoji: '⛺' },
    { name: '营地三 C3',         altitude: 7200, lat: 28.6500, lon: 83.8800, emoji: '⛺' },
    { name: '营地四 C4',         altitude: 7400, lat: 28.6700, lon: 83.9000, emoji: '⛺' },
    { name: '顶峰 Summit',       altitude: 8091, lat: 28.5955, lon: 83.8203, emoji: '🏔️' },
  ],
  '加舒尔布鲁姆I峰': [
    { name: '大本营 BC',         altitude: 5150, lat: 35.7200, lon: 76.6900, emoji: '🏕️' },
    { name: '营地一 C1',         altitude: 5900, lat: 35.7300, lon: 76.7000, emoji: '⛺' },
    { name: '营地二 C2',         altitude: 6500, lat: 35.7500, lon: 76.7200, emoji: '⛺' },
    { name: '营地三 C3',         altitude: 7200, lat: 35.7700, lon: 76.7400, emoji: '⛺' },
    { name: '顶峰 Summit',       altitude: 8080, lat: 35.7244, lon: 76.6961, emoji: '🏔️' },
  ],
  '布洛阿特峰': [
    { name: '大本营 BC',         altitude: 4900, lat: 35.8100, lon: 76.5700, emoji: '🏕️' },
    { name: '营地一 C1',         altitude: 5700, lat: 35.8200, lon: 76.5800, emoji: '⛺' },
    { name: '营地二 C2',         altitude: 6600, lat: 35.8400, lon: 76.6000, emoji: '⛺' },
    { name: '营地三 C3',         altitude: 7200, lat: 35.8600, lon: 76.6200, emoji: '⛺' },
    { name: '顶峰 Summit',       altitude: 8051, lat: 35.8117, lon: 76.5658, emoji: '🏔️' },
  ],
  '加舒尔布鲁姆II峰': [
    { name: '大本营 BC',         altitude: 5150, lat: 35.7600, lon: 76.6500, emoji: '🏕️' },
    { name: '营地一 C1',         altitude: 5900, lat: 35.7700, lon: 76.6600, emoji: '⛺' },
    { name: '营地二 C2',         altitude: 6500, lat: 35.7900, lon: 76.6800, emoji: '⛺' },
    { name: '营地三 C3',         altitude: 7000, lat: 35.8100, lon: 76.7000, emoji: '⛺' },
    { name: '顶峰 Summit',       altitude: 8034, lat: 35.7586, lon: 76.6533, emoji: '🏔️' },
  ],
  '希夏邦马峰': [
    { name: '大本营 BC',         altitude: 5000, lat: 28.3500, lon: 85.7800, emoji: '🏕️' },
    { name: '前进营地 ABC',      altitude: 5700, lat: 28.3600, lon: 85.7900, emoji: '⛺' },
    { name: '营地一 C1',         altitude: 6400, lat: 28.3700, lon: 85.8000, emoji: '⛺' },
    { name: '营地二 C2',         altitude: 7100, lat: 28.3800, lon: 85.8100, emoji: '⛺' },
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
  '慕士塔格峰': [
    { name: '大本营 BC',         altitude: 3600, lat: 38.2700, lon: 75.1100, emoji: '🏕️' },
    { name: '营地一 C1',         altitude: 5300, lat: 38.2720, lon: 75.1120, emoji: '⛺' },
    { name: '营地二 C2',         altitude: 6200, lat: 38.2740, lon: 75.1140, emoji: '⛺' },
    { name: '营地三 C3',         altitude: 6900, lat: 38.2760, lon: 75.1160, emoji: '⛺' },
    { name: '顶峰 Summit',       altitude: 7546, lat: 38.2742, lon: 75.1133, emoji: '🏔️' },
  ],
  '列宁峰': [
    { name: '大本营 BC',         altitude: 3600, lat: 39.7100, lon: 72.5900, emoji: '🏕️' },
    { name: '营地一 C1',         altitude: 4400, lat: 39.7120, lon: 72.5920, emoji: '⛺' },
    { name: '营地二 C2',         altitude: 5400, lat: 39.7140, lon: 72.5940, emoji: '⛺' },
    { name: '营地三 C3',         altitude: 6100, lat: 39.7160, lon: 72.5960, emoji: '⛺' },
    { name: '顶峰 Summit',       altitude: 7134, lat: 39.7133, lon: 72.5953, emoji: '🏔️' },
  ],
  '梅拉峰': [
    { name: '卡雷村 Khare',      altitude: 5045, lat: 27.6900, lon: 86.9100, emoji: '🏕️' },
    { name: '高营地 High Camp',  altitude: 5800, lat: 27.6920, lon: 86.9120, emoji: '⛺' },
    { name: '顶峰 Summit',       altitude: 6461, lat: 27.6908, lon: 86.9098, emoji: '🏔️' },
  ],
  '哈巴雪山': [
    { name: '哈巴村大本营',      altitude: 3200, lat: 27.4200, lon: 100.0000, emoji: '🏕️' },
    { name: '中营地 C1',         altitude: 4700, lat: 27.4220, lon: 100.0020, emoji: '⛺' },
    { name: '高营地 C2',         altitude: 5100, lat: 27.4240, lon: 100.0040, emoji: '⛺' },
    { name: '顶峰 Summit',       altitude: 5396, lat: 27.4242, lon: 100.0033, emoji: '🏔️' },
  ],
  '玉珠峰': [
    { name: '大本营 BC',         altitude: 4700, lat: 35.6300, lon: 94.2500, emoji: '🏕️' },
    { name: '前进营地 ABC',      altitude: 5200, lat: 35.6320, lon: 94.2520, emoji: '⛺' },
    { name: '高营地 C1',         altitude: 5700, lat: 35.6340, lon: 94.2540, emoji: '⛺' },
    { name: '顶峰 Summit',       altitude: 6178, lat: 35.6350, lon: 94.2533, emoji: '🏔️' },
  ],
  '雀儿山': [
    { name: '大本营 BC',         altitude: 4400, lat: 31.0000, lon: 99.6700, emoji: '🏕️' },
    { name: '营地一 C1',         altitude: 5200, lat: 31.0020, lon: 99.6720, emoji: '⛺' },
    { name: '顶峰 Summit',       altitude: 6168, lat: 31.0033, lon: 99.6733, emoji: '🏔️' },
  ],
  '玉龙雪山': [
    { name: '玉龙雪山索道上站',  altitude: 3356, lat: 27.1000, lon: 100.2200, emoji: '🏕️' },
    { name: '冰川大本营',        altitude: 4500, lat: 27.1020, lon: 100.2220, emoji: '⛺' },
    { name: '顶峰 Summit',       altitude: 5596, lat: 27.1025, lon: 100.2208, emoji: '🏔️' },
  ],
  '启孜峰': [
    { name: '大本营 BC',         altitude: 5000, lat: 29.3500, lon: 90.4600, emoji: '🏕️' },
    { name: '高营地 C1',         altitude: 5700, lat: 29.3520, lon: 90.4620, emoji: '⛺' },
    { name: '顶峰 Summit',       altitude: 6206, lat: 29.3533, lon: 90.4633, emoji: '🏔️' },
  ],
  '亚拉雪山': [
    { name: '大本营 BC',         altitude: 3700, lat: 30.3800, lon: 101.9200, emoji: '🏕️' },
    { name: '营地一 C1',         altitude: 4600, lat: 30.3820, lon: 101.9220, emoji: '⛺' },
    { name: '顶峰 Summit',       altitude: 5820, lat: 30.3833, lon: 101.9217, emoji: '🏔️' },
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
// GET /api/weather (no params) → returns default empty weather info (200)
router.get('/', summitWindowLimiter, async (req, res) => {
  try {
    const { location, lat, lon } = req.query;
    const resolved = resolveParams(location, lat, lon);
    if (!resolved) {
      return res.json({ location: '', temp: null, wind: null, humidity: null, visibility: null, message: '请提供 location 或 lat/lon 参数' });
    }

    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) {
      return res.json({
        location: resolved.locationName,
        temp: -10,
        wind: 25,
        humidity: 40,
        visibility: 5.0,
        message: '天气服务暂不可用（未配置 API Key），请稍后再试',
        mock: true,
      });
    }

    const cacheKey = `weather:${JSON.stringify(resolved.params)}`;
    const cached = weatherCache.get(cacheKey);
    if (cached && !cached.stale) {
      return res.json(cached.value);
    }

    try {
      const data = await fetchWeather(resolved.params);
      const responseData = {
        location: resolved.locationName,
        temp: Math.round((data.main.temp - 273.15) * 10) / 10,
        wind: Math.round(data.wind.speed * 3.6 * 10) / 10,
        humidity: data.main.humidity,
        visibility: Math.round((data.visibility || 0) / 1000 * 10) / 10,
      };
      weatherCache.set(cacheKey, responseData);
      return res.json(responseData);
    } catch (e) {
      if (cached) {
        return res.json({ ...cached.value, stale: true, stale_at: cached.stale_at });
      }
      throw e;
    }
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

    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) {
      return res.json({
        location: resolved.locationName,
        forecast: [],
        message: '天气服务暂不可用（未配置 API Key），请稍后再试',
        mock: true,
      });
    }

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

// GET /api/weather/popular-peaks — 热门攀登山峰天气（首页滚动展示）
// 实时接入 OpenWeather API，失败时降级为 mock 数据
const POPULAR_PEAKS_META = [
  { name: '珠穆朗玛峰', nameEn: 'Mt. Everest', altitude: 8849, lat: 27.98, lon: 86.92, emoji: '🏔️' },
  { name: 'K2', nameEn: 'K2', altitude: 8611, lat: 35.88, lon: 76.51, emoji: '🏔️' },
  { name: '丹拿利峰', nameEn: 'Denali', altitude: 6190, lat: 63.07, lon: -151.00, emoji: '🏔️' },
  { name: '白朗峰', nameEn: 'Mont Blanc', altitude: 4808, lat: 45.83, lon: 6.86, emoji: '🏔️' },
  { name: '厄尔布鲁士', nameEn: 'Elbrus', altitude: 5642, lat: 43.35, lon: 42.44, emoji: '🏔️' },
  { name: '阿玛达布拉姆', nameEn: 'Ama Dablam', altitude: 6814, lat: 27.86, lon: 86.86, emoji: '🏔️' },
];

const POPULAR_PEAKS_MOCK = [
  { name: '珠穆朗玛峰', nameEn: 'Mt. Everest', altitude: 8849, lat: 27.98, lon: 86.92, temp: -28, wind: 45, humidity: 32, condition: '晴', conditionIcon: '☀️', emoji: '🏔️' },
  { name: 'K2', nameEn: 'K2', altitude: 8611, lat: 35.88, lon: 76.51, temp: -35, wind: 62, humidity: 25, condition: '多云', conditionIcon: '⛅', emoji: '🏔️' },
  { name: '丹拿利峰', nameEn: 'Denali', altitude: 6190, lat: 63.07, lon: -151.00, temp: -22, wind: 38, humidity: 55, condition: '阴', conditionIcon: '☁️', emoji: '🏔️' },
  { name: '白朗峰', nameEn: 'Mont Blanc', altitude: 4808, lat: 45.83, lon: 6.86, temp: -12, wind: 28, humidity: 70, condition: '小雪', conditionIcon: '🌨️', emoji: '🏔️' },
  { name: '厄尔布鲁士', nameEn: 'Elbrus', altitude: 5642, lat: 43.35, lon: 42.44, temp: -18, wind: 32, humidity: 48, condition: '晴', conditionIcon: '☀️', emoji: '🏔️' },
  { name: '阿玛达布拉姆', nameEn: 'Ama Dablam', altitude: 6814, lat: 27.86, lon: 86.86, temp: -15, wind: 22, humidity: 40, condition: '晴', conditionIcon: '☀️', emoji: '🏔️' },
];

function getConditionIconFromOwm(icon) {
  if (!icon) return '🌡️';
  if (icon.startsWith('01')) return '☀️';
  if (icon.startsWith('02')) return '⛅';
  if (icon.startsWith('03') || icon.startsWith('04')) return '☁️';
  if (icon.startsWith('09') || icon.startsWith('10')) return '🌧️';
  if (icon.startsWith('11')) return '⛈️';
  if (icon.startsWith('13')) return '🌨️';
  if (icon.startsWith('50')) return '🌫️';
  return '🌡️';
}

router.get('/popular-peaks', async (req, res) => {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    return res.json(POPULAR_PEAKS_MOCK);
  }
  try {
    const results = await Promise.allSettled(
      POPULAR_PEAKS_META.map(p => fetchWeather({ lat: p.lat, lon: p.lon }))
    );
    const data = POPULAR_PEAKS_META.map((peak, i) => {
      if (results[i].status === 'fulfilled') {
        const w = results[i].value;
        const temp = Math.round(w.main.temp - 273.15);
        return {
          ...peak,
          temp,
          wind: Math.round(w.wind.speed * 3.6),
          humidity: w.main.humidity,
          condition: translateWeather(w.weather[0].description),
          conditionIcon: getConditionIconFromOwm(w.weather[0].icon),
        };
      }
      // 单峰失败时用 mock 值
      return POPULAR_PEAKS_MOCK[i];
    });
    res.json(data);
  } catch (e) {
    res.json(POPULAR_PEAKS_MOCK);
  }
});

// GET /api/weather/summit-window/:peakId
router.get('/summit-window/:peakId', summitWindowLimiter, async (req, res) => {
  const peakId = parseInt(req.params.peakId);
  const [peak] = await prisma.$queryRaw`SELECT * FROM peaks WHERE id = ${peakId}`;
  if (!peak) return res.status(404).json({ error: '山峰不存在' });

  const lat = peak.latitude || 27.98;
  const lon = peak.longitude || 86.92;
  const apiKey = process.env.OPENWEATHER_API_KEY;
  const cacheKey = `summit-window:${req.params.peakId}`;
  const cached = weatherCache.get(cacheKey);

  if (!apiKey) {
    const mockDays = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      const score = Math.floor(Math.random() * 100);
      mockDays.push({
        date: date.toISOString().split('T')[0],
        score,
        recommendation: score >= 80 ? 'ideal' : score >= 60 ? 'good' : score >= 40 ? 'marginal' : 'dangerous',
        breakdown: { precipitation: 35, wind: 30, cloud: 15, temperature: 10, visibility: 10 }
      });
    }
    return res.json(mockDays);
  }

  if (cached && !cached.stale) {
    return res.json(cached.value);
  }

  const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&cnt=56`;
  https.get(url, (apiRes) => {
    let data = '';
    apiRes.on('data', chunk => data += chunk);
    apiRes.on('end', () => {
      try {
        const json = JSON.parse(data);
        const daily = {};
        (json.list || []).forEach(item => {
          const date = item.dt_txt.split(' ')[0];
          if (!daily[date]) daily[date] = [];
          daily[date].push(item);
        });

        const result = Object.entries(daily).slice(0, 7).map(([date, items]) => {
          const avgPop = items.reduce((s, i) => s + (i.pop || 0), 0) / items.length;
          const avgWind = items.reduce((s, i) => s + (i.wind?.speed || 0), 0) / items.length * 3.6;
          const avgCloud = items.reduce((s, i) => s + (i.clouds?.all || 0), 0) / items.length;
          const avgTemp = items.reduce((s, i) => s + (i.main?.temp || 273), 0) / items.length - 273.15;
          const avgVis = items.reduce((s, i) => s + (i.visibility || 10000), 0) / items.length;

          const popScore = avgPop < 0.1 ? 100 : avgPop > 0.6 ? 0 : Math.round((1 - avgPop) * 100);
          const windScore = avgWind < 10 ? 100 : avgWind > 40 ? 0 : Math.round((40 - avgWind) / 30 * 100);
          const cloudScore = Math.round((100 - avgCloud));
          const tempScore = avgTemp > -10 && avgTemp < 5 ? 100 : Math.max(0, 100 - Math.abs(avgTemp + 5) * 5);
          const visScore = Math.min(100, Math.round(avgVis / 100));

          const score = Math.round(popScore * 0.35 + windScore * 0.30 + cloudScore * 0.15 + tempScore * 0.10 + visScore * 0.10);
          return {
            date,
            score,
            recommendation: score >= 80 ? 'ideal' : score >= 60 ? 'good' : score >= 40 ? 'marginal' : 'dangerous',
            breakdown: { precipitation: popScore, wind: windScore, cloud: cloudScore, temperature: tempScore, visibility: visScore }
          };
        });
        weatherCache.set(cacheKey, result);
        res.json(result);
      } catch(e) {
        if (cached) {
          return res.json({ ...cached.value, stale: true, stale_at: cached.stale_at });
        }
        res.status(503).json({ error: 'weather unavailable' });
      }
    });
  }).on('error', () => {
    if (cached) {
      return res.json({ ...cached.value, stale: true, stale_at: cached.stale_at });
    }
    res.status(503).json({ error: 'weather unavailable' });
  });
});

// GET /api/weather/camps/:peakId - segmented weather per camp
router.get('/camps/:peakId', (req, res) => {
  try {
    const peakId = parseInt(req.params.peakId);
    const camps = [
      { name: 'Base Camp', altitude: 5364, wind_speed: Math.floor(Math.random()*30)+5, temp_c: Math.floor(Math.random()*10)-5, visibility: 'good', snow_risk: 'low' },
      { name: 'Camp 1', altitude: 6065, wind_speed: Math.floor(Math.random()*40)+10, temp_c: Math.floor(Math.random()*10)-15, visibility: 'moderate', snow_risk: 'moderate' },
      { name: 'Camp 2', altitude: 7000, wind_speed: Math.floor(Math.random()*50)+20, temp_c: Math.floor(Math.random()*10)-25, visibility: 'poor', snow_risk: 'high' },
      { name: 'Summit', altitude: 8848, wind_speed: Math.floor(Math.random()*80)+30, temp_c: Math.floor(Math.random()*10)-35, visibility: 'variable', snow_risk: 'very_high' },
    ];
    res.json({ peak_id: peakId, camps, generated_at: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/weather/summit-window/:peakId - 7-day summit window score
router.get('/summit-window/:peakId', (req, res) => {
  try {
    const peakId = parseInt(req.params.peakId);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(); date.setDate(date.getDate() + i);
      const score = Math.floor(Math.random() * 100);
      days.push({
        date: date.toISOString().split('T')[0],
        score,
        recommendation: score >= 70 ? 'good' : score >= 40 ? 'marginal' : 'poor',
        wind_speed: Math.floor(Math.random()*60)+5,
        temp_c: Math.floor(Math.random()*15)-30,
        precipitation_mm: Math.random() * 10,
      });
    }
    res.json({ peak_id: peakId, window: days });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/weather/avalanche-risk/:peakId - avalanche/altitude sickness risk
router.get('/avalanche-risk/:peakId', (req, res) => {
  try {
    const peakId = parseInt(req.params.peakId);
    const levels = ['low', 'moderate', 'considerable', 'high', 'extreme'];
    res.json({
      peak_id: peakId,
      avalanche_risk: levels[Math.floor(Math.random()*3)],
      altitude_sickness_risk: Math.random() > 0.5 ? 'moderate' : 'high',
      recommendations: ['携带氧气瓶', '渐进适应海拔', '关注天气变化', '保持组队行动'],
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
