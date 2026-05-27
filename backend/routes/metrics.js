const express = require('express');

const router = express.Router();

router.post('/web-vitals', (req, res) => {
  const { metrics, url, ts } = req.body || {};
  if (!metrics || typeof metrics !== 'object' || Array.isArray(metrics)) {
    return res.status(400).json({ error: 'metrics payload is required' });
  }

  const safeUrl = typeof url === 'string' ? url.slice(0, 2048) : '';
  const safeTs = Number.isFinite(Number(ts)) ? Number(ts) : Date.now();
  console.log('[metrics]', JSON.stringify({ metrics, url: safeUrl, ts: safeTs }));
  return res.json({ ok: true });
});

module.exports = router;
