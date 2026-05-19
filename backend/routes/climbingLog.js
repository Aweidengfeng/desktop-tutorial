const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const prisma = require('../db/prisma');
const auth = require('../middleware/auth');

const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '操作过于频繁，请稍后再试' },
});

function generateGearItems(peak_name, altitude_tier, season, difficulty) {
  const base = ['登山靴', '冰爪', '冰镐', '头盔', '安全带', '绳索', '手套', '太阳镜', '防晒霜', '急救包'];
  const highAlt = ['高山帐篷', '睡袋（-20℃）', '氧气瓶', '高山炉具', '雪铲', '雪锚'];
  const winter = ['羽绒服', '保温内衣', '暖手包', '防冻药膏'];
  const technical = ['上升器', '下降器', '快挂', '岩钉', '岩锤'];
  let items = [...base];
  if (altitude_tier === 'high' || altitude_tier === '8000+') items = items.concat(highAlt);
  if (season === 'winter' || season === '冬季') items = items.concat(winter);
  if (difficulty === 'technical' || difficulty === '技术') items = items.concat(technical);
  return items.map(name => ({ name, checked: false }));
}

// GET /api/climbing-log - user's climbing log
router.get('/', auth, async (req, res) => {
  try {
    const expeditions = await prisma.$queryRaw`SELECT * FROM user_expeditions_log WHERE user_id = ${req.user.id} ORDER BY started_at DESC`;
    res.json(expeditions);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/climbing-log/stats - user stats
router.get('/stats', auth, async (req, res) => {
  try {
    const row = (await prisma.$queryRaw`
      SELECT COUNT(*) as total_expeditions,
             SUM(CASE WHEN summited=1 THEN 1 ELSE 0 END) as total_summits,
             SUM(max_altitude) as total_altitude,
             SUM(duration_sec) as total_duration_sec,
             MAX(max_altitude) as highest_altitude
      FROM user_expeditions_log WHERE user_id = ${req.user.id}
    `)[0];
    res.json({
      total_expeditions: Number(row.total_expeditions),
      total_summits: Number(row.total_summits),
      total_altitude: Number(row.total_altitude),
      total_duration_sec: Number(row.total_duration_sec),
      highest_altitude: row.highest_altitude,
    });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/climbing-log/gear-list - generate smart gear checklist
router.post('/gear-list', writeLimiter, auth, async (req, res) => {
  try {
    const { peak_id, peak_name, altitude_tier, season, difficulty } = req.body;
    if (!peak_name) return res.status(400).json({ error: 'peak_name 不能为空' });
    const items = generateGearItems(peak_name, altitude_tier, season, difficulty);
    const now = new Date().toISOString();
    const inserted = await prisma.$queryRaw`
      INSERT INTO smart_gear_lists (user_id, peak_id, peak_name, altitude_tier, season, difficulty, items, created_at)
      VALUES (${req.user.id}, ${peak_id || null}, ${peak_name}, ${altitude_tier || null}, ${season || null}, ${difficulty || null}, ${JSON.stringify(items)}, ${now})
      RETURNING id
    `;
    const list = (await prisma.$queryRaw`SELECT * FROM smart_gear_lists WHERE id = ${inserted[0].id}`)[0];
    list.items = JSON.parse(list.items);
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/climbing-log/gear-list/:id - update gear list
router.put('/gear-list/:id', auth, async (req, res) => {
  try {
    const list = (await prisma.$queryRaw`SELECT * FROM smart_gear_lists WHERE id = ${Number(req.params.id)} AND user_id = ${req.user.id}`)[0];
    if (!list) return res.status(404).json({ error: '装备清单不存在' });
    const { items } = req.body;
    if (!items) return res.status(400).json({ error: 'items 不能为空' });
    await prisma.$executeRaw`UPDATE smart_gear_lists SET items = ${JSON.stringify(items)} WHERE id = ${list.id}`;
    const updated = (await prisma.$queryRaw`SELECT * FROM smart_gear_lists WHERE id = ${list.id}`)[0];
    updated.items = JSON.parse(updated.items);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/climbing-log/gear-list/:id - get a gear list
router.get('/gear-list/:id', auth, async (req, res) => {
  try {
    const list = (await prisma.$queryRaw`SELECT * FROM smart_gear_lists WHERE id = ${Number(req.params.id)} AND user_id = ${req.user.id}`)[0];
    if (!list) return res.status(404).json({ error: '装备清单不存在' });
    list.items = JSON.parse(list.items);
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/climbing-log/gear-list/:id/export-pdf - 导出装备清单为可打印 HTML
router.post('/gear-list/:id/export-pdf', auth, async (req, res) => {
  try {
    const list = (await prisma.$queryRaw`SELECT * FROM smart_gear_lists WHERE id = ${Number(req.params.id)} AND user_id = ${req.user.id}`)[0];
    if (!list) return res.status(404).json({ error: '装备清单不存在' });

    let items = [];
    try { items = JSON.parse(list.items || '[]'); } catch(e) {}

    // HTML-escape helper to prevent XSS
    function esc(str) {
      return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
    }

    const userName = esc(req.user.name || req.user.username || req.user.email || '攀登者');
    const now = new Date().toLocaleDateString('zh-CN');
    const peakName = esc(list.peak_name || '未知山峰');

    const checked = items.filter(i => i.checked);
    const unchecked = items.filter(i => !i.checked);

    function renderRows(arr, style) {
      if (!arr.length) return '';
      return arr.map(i => `<tr style="${style}"><td style="padding:8px 12px;">${esc(i.name)}</td><td style="padding:8px 12px;text-align:center;">${i.checked ? '✅' : '⬜'}</td></tr>`).join('');
    }

    const html = `<!DOCTYPE html>
<html lang="zh"><head><meta charset="UTF-8">
<title>SummitLink 装备清单 — ${peakName}</title>
<style>
  body{font-family:Arial,sans-serif;margin:32px;color:#1a1a2e;}
  h1{color:#2b6579;margin-bottom:4px;}
  h3{color:#0f3460;margin:20px 0 6px;}
  .meta{color:#666;font-size:14px;margin-bottom:24px;}
  table{width:100%;border-collapse:collapse;font-size:14px;}
  th{background:#0f3460;color:#fff;padding:10px 12px;text-align:left;}
  tr:nth-child(even){background:#f5f8fc;}
  td{border-bottom:1px solid #e0e0e0;}
  .footer{margin-top:32px;font-size:12px;color:#999;text-align:center;}
  @media print{body{margin:16px;}}
</style></head>
<body>
  <h1>🏔 SummitLink 装备清单</h1>
  <div class="meta">
    山峰：${peakName} &nbsp;|&nbsp; 攀登者：${userName} &nbsp;|&nbsp; 导出日期：${now}
    ${list.season ? ' &nbsp;|&nbsp; 季节：' + esc(list.season) : ''}
    ${list.difficulty ? ' &nbsp;|&nbsp; 难度：' + esc(list.difficulty) : ''}
  </div>
  ${unchecked.length ? `<h3>待准备（${unchecked.length} 件）</h3>
  <table>
    <thead><tr><th>装备名称</th><th style="width:80px;text-align:center;">状态</th></tr></thead>
    <tbody>${renderRows(unchecked, '')}</tbody>
  </table>` : ''}
  ${checked.length ? `<h3>已准备（${checked.length} 件）</h3>
  <table>
    <thead><tr><th>装备名称</th><th style="width:80px;text-align:center;">状态</th></tr></thead>
    <tbody>${renderRows(checked, 'opacity:0.6;')}</tbody>
  </table>` : ''}
  ${!items.length ? '<p style="color:#999;text-align:center;padding:24px;">暂无装备记录</p>' : ''}
  <div class="footer">SummitLink — 连接每一位攀登者 · summitlink.app</div>
</body></html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="summitlink-gear-${Date.now()}.html"`);
    res.send(html);
  } catch (e) {
    console.error('[GearExport]', e);
    res.status(500).json({ error: '导出失败' });
  }
});

module.exports = router;
