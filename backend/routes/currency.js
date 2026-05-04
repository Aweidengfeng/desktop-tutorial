// backend/routes/currency.js
// 汇率缓存（fallback到固定汇率，真实项目可接入 Open Exchange Rates API）
const express = require('express');
const router = express.Router();

// 静态汇率（以 USD 为基准，2026-05-04更新；真实项目可接入 Open Exchange Rates API）
const BASE_RATES = {
  usd: 1,
  eur: 0.92,
  cny: 7.24,
  gbp: 0.79,
  jpy: 149.5,
  aud: 1.53,
  cad: 1.36
};

let ratesCache = { rates: BASE_RATES, updatedAt: Date.now() };

// GET /api/currency/rates — 获取汇率
router.get('/rates', (req, res) => {
  res.json({
    base: 'usd',
    rates: ratesCache.rates,
    updatedAt: new Date(ratesCache.updatedAt).toISOString()
  });
});

// POST /api/currency/convert — 货币转换
router.post('/convert', (req, res) => {
  const { amount, from = 'usd', to = 'usd' } = req.body;
  if (amount === undefined || amount === null || isNaN(Number(amount))) {
    return res.status(400).json({ error: 'Invalid amount' });
  }
  const fromRate = ratesCache.rates[from.toLowerCase()];
  const toRate = ratesCache.rates[to.toLowerCase()];
  if (!fromRate || !toRate) {
    return res.status(400).json({ error: `Unsupported currency: ${from} or ${to}` });
  }
  const converted = (Number(amount) / fromRate) * toRate;
  res.json({ amount: Number(amount), from, to, converted: Math.round(converted * 100) / 100 });
});

module.exports = router;
