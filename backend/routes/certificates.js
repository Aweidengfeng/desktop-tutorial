const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const db = require('../db/database');

function generateCertNo() {
  const year = new Date().getFullYear();
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = '';
  for (let i = 0; i < 8; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return `SL-${year}-${id}`;
}

// GET /api/certificates/:trackId  (or :trackId.png)
router.get('/:trackId', auth, (req, res) => {
  try {
    const trackId = req.params.trackId.replace('.png', '');
    const track = db.prepare('SELECT * FROM tracks WHERE id = ? AND user_id = ?').get(trackId, req.user.id);
    if (!track) return res.status(404).json({ error: '轨迹不存在' });

    let certNo = track.certificate_no;
    if (!certNo) {
      certNo = generateCertNo();
      try {
        db.prepare('UPDATE tracks SET certificate_no = ? WHERE id = ?').run(certNo, track.id);
      } catch(e) {}
    }

    const user = db.prepare('SELECT name FROM users WHERE id = ?').get(req.user.id);
    const userName = user?.name || '攀登者';

    const peakName = track.peak_name || track.name || '未知山峰';
    const date = track.date || (track.created_at && track.created_at.split('T')[0]) || '未知日期';
    const distance = track.distance_km || track.distance || 0;
    const elevation = track.elevation_gain || track.elevation || 0;

    // Sanitize text values for SVG (prevent injection)
    const safeName = String(userName).replace(/[<>&"']/g, '');
    const safePeak = String(peakName).replace(/[<>&"']/g, '');

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="560" viewBox="0 0 800 560">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0f172a"/>
      <stop offset="100%" style="stop-color:#1e3a5f"/>
    </linearGradient>
    <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#f59e0b"/>
      <stop offset="100%" style="stop-color:#fbbf24"/>
    </linearGradient>
  </defs>
  <rect width="800" height="560" fill="url(#bg)" rx="16"/>
  <rect x="20" y="20" width="760" height="520" fill="none" stroke="#f59e0b" stroke-width="2" rx="12" opacity="0.5"/>
  <rect x="30" y="30" width="740" height="500" fill="none" stroke="#f59e0b" stroke-width="0.5" rx="10" opacity="0.3"/>
  <polygon points="400,80 480,200 320,200" fill="none" stroke="#60a5fa" stroke-width="2"/>
  <polygon points="400,100 450,180 350,180" fill="#1e3a5f"/>
  <text x="400" y="240" font-family="serif" font-size="28" fill="#f59e0b" text-anchor="middle" font-weight="bold">SummitLink 登顶证书</text>
  <text x="400" y="270" font-family="sans-serif" font-size="14" fill="#94a3b8" text-anchor="middle">SUMMIT CERTIFICATE</text>
  <line x1="150" y1="285" x2="650" y2="285" stroke="#f59e0b" stroke-width="1" opacity="0.5"/>
  <text x="400" y="320" font-family="serif" font-size="22" fill="#f1f5f9" text-anchor="middle">兹证明 ${safeName} 同学</text>
  <text x="400" y="355" font-family="serif" font-size="18" fill="#60a5fa" text-anchor="middle">成功完成 ${safePeak} 攀登</text>
  <text x="250" y="395" font-family="sans-serif" font-size="13" fill="#94a3b8" text-anchor="middle">距离: ${Number(distance).toFixed(1)} km</text>
  <text x="400" y="395" font-family="sans-serif" font-size="13" fill="#94a3b8" text-anchor="middle">爬升: ${elevation} m</text>
  <text x="550" y="395" font-family="sans-serif" font-size="13" fill="#94a3b8" text-anchor="middle">日期: ${date}</text>
  <text x="400" y="430" font-family="monospace" font-size="12" fill="#f59e0b" text-anchor="middle">${certNo}</text>
  <text x="400" y="480" font-family="sans-serif" font-size="11" fill="#475569" text-anchor="middle">本证书由 SummitLink 平台颁发，唯一编号，不可伪造</text>
  <text x="700" y="530" font-family="sans-serif" font-size="10" fill="#334155" text-anchor="end">SummitLink © 2026</text>
</svg>`;

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Content-Disposition', `inline; filename="certificate-${certNo}.svg"`);
    res.send(svg);
  } catch(e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
