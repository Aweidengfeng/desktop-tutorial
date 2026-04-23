const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const auth = require('../middleware/auth');
const rateLimit = require('express-rate-limit');
const prisma = require('../db/prisma');

const passportLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: '请求太频繁，请稍候再试' },
  standardHeaders: true,
  legacyHeaders: false,
});

// GET /api/passport/verify/:uuid — 护照验证（公开接口）
router.get('/verify/:uuid', async (req, res) => {
  try {
    const uuid = req.params.uuid;
    const [user] = await prisma.$queryRaw`SELECT id, name, avatar FROM users WHERE passport_uuid = ${uuid}`;
    if (!user) return res.status(404).json({ valid: false, error: '护照不存在或已失效' });
    const [completedCount] = await prisma.$queryRaw`SELECT COUNT(*) as c FROM user_expeditions_log WHERE user_id = ${user.id} AND status IN ('completed','summited')`;
    res.json({ valid: true, name: user.name, completedExpeditions: Number(completedCount.c) });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/passport/my — 获取当前用户护照元数据（需登录）
router.get('/my', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const [user] = await prisma.$queryRaw`SELECT id, name, avatar, passport_uuid FROM users WHERE id = ${userId}`;
    const completed = await prisma.$queryRaw`SELECT * FROM user_expeditions_log WHERE user_id = ${userId} AND status IN ('completed','summited') ORDER BY ended_at DESC`;
    if (!completed.length) {
      return res.status(403).json({ error: '完成至少一次攀登才能生成电子护照' });
    }
    let uuid = user.passport_uuid;
    if (!uuid) {
      uuid = crypto.randomUUID();
      try { await prisma.$executeRaw`UPDATE users SET passport_uuid = ${uuid} WHERE id = ${userId}`; } catch(e) {}
    }
    res.json({
      uuid,
      name: user.name,
      avatar: user.avatar,
      totalExpeditions: completed.length,
      verifyUrl: '/passport/verify/' + uuid,
    });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/user/:id/passport.pdf — 下载电子护照（需登录，只能下载自己的护照）
router.get('/:id/passport.pdf', passportLimiter, auth, async (req, res) => {
  const targetId = parseInt(req.params.id, 10);
  if (targetId !== req.user.id) {
    return res.status(403).json({ error: '只能下载自己的电子护照' });
  }
  try {
    const userId = req.user.id;
    const [user] = await prisma.$queryRaw`SELECT id, name, avatar, passport_uuid, created_at FROM users WHERE id = ${userId}`;
    if (!user) return res.status(404).json({ error: '用户不存在' });

    // Try to get completed expeditions from multiple possible tables
    let completed = [];
    try {
      completed = await prisma.$queryRaw`SELECT uel.*, p.name as peak_name_db, p.altitude as peak_altitude FROM user_expeditions_log uel LEFT JOIN peaks p ON p.name = uel.peak_name WHERE uel.user_id = ${userId} AND uel.status IN ('completed','summited') ORDER BY uel.ended_at DESC`;
    } catch(e) {}

    // Fallback: use expedition_orders + tracks
    if (!completed.length) {
      let expOrders = [];
      try {
        expOrders = await prisma.$queryRaw`
          SELECT eo.*, e.title as peak_name, p.altitude as peak_altitude, p.name as peak_name_db
          FROM expedition_orders eo
          LEFT JOIN expeditions e ON eo.expedition_id = e.id
          LEFT JOIN peaks p ON e.peak_id = p.id
          WHERE eo.user_id = ${userId} AND eo.status IN ('completed','paid','confirmed')
          ORDER BY eo.created_at DESC
        `;
      } catch(e) {}
      completed.push(...expOrders.map(o => ({ ...o, ended_at: o.created_at, summited: 0 })));
    }

    // Fallback: use tracks
    let tracks = [];
    try {
      tracks = await prisma.$queryRaw`SELECT * FROM tracks WHERE user_id = ${userId} ORDER BY created_at DESC`;
    } catch(e) {}

    if (!completed.length && !tracks.length) {
      return res.status(403).json({ error: '完成至少一次攀登才能生成电子护照' });
    }

    // Merge tracks into completed if needed
    if (!completed.length && tracks.length) {
      completed = tracks.map(t => ({
        peak_name: t.name || t.peak_name || '轨迹',
        peak_altitude: t.max_elevation || t.elevation || 0,
        ended_at: t.date || t.created_at,
        summited: 1,
        duration_sec: t.duration_minutes ? t.duration_minutes * 60 : 0,
        max_altitude: t.max_elevation || t.elevation || 0,
      }));
    }

    let uuid = user.passport_uuid;
    if (!uuid) {
      uuid = crypto.randomUUID();
      try { await prisma.$executeRaw`UPDATE users SET passport_uuid = ${uuid} WHERE id = ${userId}`; } catch(e) {}
    }

    const totalGain = completed.reduce((s, e) => s + (e.max_altitude || 0), 0);
    const issueDate = new Date().toLocaleDateString('zh-CN');
    const verifyUrl = `${process.env.APP_URL || 'https://summitlink.app'}/passport/verify/${uuid}`;

    const doc = new PDFDocument({ size: 'A5', layout: 'portrait', margin: 30 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="passport-${uuid.slice(0, 8)}.pdf"`);
    doc.pipe(res);

    // ── Cover page ──────────────────────────────────────────────────────────
    // Background gradient simulation (blue to dark)
    doc.rect(0, 0, doc.page.width, doc.page.height).fill('#0f172a');

    // Decorative header bar
    doc.rect(0, 0, doc.page.width, 8).fill('#3b82f6');

    // Mountain silhouette (simple polygon)
    doc.save();
    doc.fillColor('#1e3a5f');
    doc.polygon(
      [0, 180], [60, 130], [90, 150], [130, 90], [170, 140], [200, 110], [240, 80], [280, 120], [320, 70], [360, 100], [420, 120],
      [420, 180]
    ).fill();
    doc.polygon(
      [0, 200], [80, 155], [130, 170], [200, 135], [260, 155], [320, 130], [380, 150], [420, 140], [420, 200]
    ).fillColor('#16213e').fill();
    doc.restore();

    // Stars
    doc.fillColor('#ffffff');
    for (let i = 0; i < 30; i++) {
      const x = Math.abs(Math.sin(i * 137.5) * doc.page.width);
      const y = Math.abs(Math.cos(i * 137.5) * 80);
      doc.circle(x, y + 20, 0.8).fill();
    }

    // Logo & Title
    doc.fontSize(20).fillColor('#f59e0b').font('Helvetica-Bold')
      .text('SummitLink', 0, 50, { align: 'center' });
    doc.fontSize(11).fillColor('#94a3b8').font('Helvetica')
      .text('ELECTRONIC CLIMBING PASSPORT', 0, 74, { align: 'center' });
    doc.fontSize(9).fillColor('#64748b')
      .text('电 子 攀 登 护 照', 0, 90, { align: 'center' });

    // Divider
    doc.moveTo(40, 215).lineTo(doc.page.width - 40, 215).strokeColor('#3b82f6').lineWidth(1).stroke();

    // User info section
    doc.fontSize(14).fillColor('#f1f5f9').font('Helvetica-Bold')
      .text(user.name || '攀登者', 0, 225, { align: 'center' });

    doc.fontSize(9).fillColor('#94a3b8').font('Helvetica')
      .text(`护照编号: ${uuid}`, 0, 245, { align: 'center' });
    doc.text(`签发日期: ${issueDate}`, 0, 258, { align: 'center' });

    // Stats boxes
    const boxY = 280;
    const boxW = 90;
    const boxGap = (doc.page.width - 40 - 3 * boxW) / 2;
    const boxes = [
      { label: '完成攀登', value: completed.length + ' 次' },
      { label: '最高海拔', value: Math.max(...completed.map(e => e.max_altitude || 0)) + 'm' },
      { label: '累计高差', value: Math.round(totalGain) + 'm' },
    ];
    boxes.forEach((box, i) => {
      const x = 20 + i * (boxW + boxGap);
      doc.roundedRect(x, boxY, boxW, 48, 6).fillAndStroke('#1e293b', '#3b82f6');
      doc.fontSize(16).fillColor('#60a5fa').font('Helvetica-Bold').text(box.value, x, boxY + 8, { width: boxW, align: 'center' });
      doc.fontSize(8).fillColor('#94a3b8').font('Helvetica').text(box.label, x, boxY + 30, { width: boxW, align: 'center' });
    });

    // QR code placeholder (text-based)
    const qrY = 345;
    doc.roundedRect(doc.page.width / 2 - 40, qrY, 80, 80, 4).fillAndStroke('#1e293b', '#3b82f6');
    doc.fontSize(6).fillColor('#64748b').font('Helvetica').text('扫码验证护照', doc.page.width / 2 - 40, qrY + 66, { width: 80, align: 'center' });
    doc.fontSize(5).fillColor('#475569').text(verifyUrl, 20, qrY + 78, { align: 'center' });
    // Draw a simple QR-like grid
    doc.fillColor('#3b82f6');
    const qx = doc.page.width / 2 - 35, qy2 = qrY + 5;
    const cellSize = 4.5;
    const qrData = [
      [1,1,1,1,1,1,1,0,1,0,0,1,0],
      [1,0,0,0,0,0,1,0,1,1,0,1,0],
      [1,0,1,1,1,0,1,0,0,1,1,0,1],
      [1,0,1,1,1,0,1,0,1,0,1,1,0],
      [1,0,1,1,1,0,1,0,0,1,0,0,1],
      [1,0,0,0,0,0,1,0,1,1,1,0,0],
      [1,1,1,1,1,1,1,0,1,0,1,0,1],
      [0,0,0,0,0,0,0,0,0,1,1,1,0],
      [1,0,1,1,0,0,1,0,1,0,0,1,1],
      [0,1,0,1,0,1,0,0,0,1,0,0,1],
      [1,0,1,0,1,0,1,1,1,0,1,1,0],
      [0,1,0,0,0,1,0,1,0,0,0,1,1],
      [1,1,1,1,1,1,1,0,0,1,1,0,1],
    ];
    qrData.forEach((row, ri) => {
      row.forEach((cell, ci) => {
        if (cell) doc.rect(qx + ci * cellSize, qy2 + ri * cellSize, cellSize - 0.5, cellSize - 0.5).fill();
      });
    });

    // Footer
    doc.rect(0, doc.page.height - 16, doc.page.width, 16).fill('#1e3a5f');
    doc.fontSize(7).fillColor('#64748b').text('SummitLink © 2026 — 本护照由平台数字签名，不可伪造', 0, doc.page.height - 11, { align: 'center' });

    // ── Page 2: Climbing History ────────────────────────────────────────────
    doc.addPage({ size: 'A5', layout: 'portrait', margin: 30 });
    doc.rect(0, 0, doc.page.width, doc.page.height).fill('#0f172a');
    doc.rect(0, 0, doc.page.width, 8).fill('#3b82f6');

    doc.fontSize(14).fillColor('#f59e0b').font('Helvetica-Bold').text('攀登履历', 30, 25);
    doc.fontSize(8).fillColor('#94a3b8').font('Helvetica').text('EXPEDITION HISTORY', 30, 43);
    doc.moveTo(30, 55).lineTo(doc.page.width - 30, 55).strokeColor('#334155').lineWidth(0.5).stroke();

    // Table header
    const cols = [30, 120, 195, 265, 330];
    const headers = ['山峰', '海拔', '登顶日期', '用时(h)', '状态'];
    doc.fontSize(7).fillColor('#60a5fa').font('Helvetica-Bold');
    headers.forEach((h, i) => doc.text(h, cols[i], 62, { width: (cols[i + 1] || doc.page.width - 30) - cols[i] - 4 }));
    doc.moveTo(30, 72).lineTo(doc.page.width - 30, 72).strokeColor('#334155').lineWidth(0.5).stroke();

    let rowY = 78;
    completed.forEach((exp, idx) => {
      if (rowY > doc.page.height - 50) return; // overflow guard
      const bg = idx % 2 === 0 ? '#0f172a' : '#111827';
      doc.rect(30, rowY - 2, doc.page.width - 60, 18).fill(bg);
      const peakName = String(exp.peak_name || '未知山峰').slice(0, 8);
      const alt = exp.max_altitude ? Math.round(exp.max_altitude) + 'm' : (exp.peak_altitude ? exp.peak_altitude + 'm' : '—');
      const date = exp.ended_at ? exp.ended_at.slice(0, 10) : '—';
      const dur = exp.duration_sec ? (exp.duration_sec / 3600).toFixed(1) : '—';
      const status = exp.summited ? '✓ 登顶' : '完成';
      doc.fontSize(7).fillColor('#e2e8f0').font('Helvetica');
      doc.text(peakName, cols[0], rowY, { width: cols[1] - cols[0] - 4 });
      doc.text(alt, cols[1], rowY, { width: cols[2] - cols[1] - 4 });
      doc.text(date, cols[2], rowY, { width: cols[3] - cols[2] - 4 });
      doc.text(dur, cols[3], rowY, { width: cols[4] - cols[3] - 4 });
      doc.fillColor(exp.summited ? '#4ade80' : '#94a3b8').text(status, cols[4], rowY, { width: 45 });
      rowY += 18;
    });

    doc.moveTo(30, rowY + 4).lineTo(doc.page.width - 30, rowY + 4).strokeColor('#334155').lineWidth(0.5).stroke();
    doc.fontSize(8).fillColor('#64748b').font('Helvetica')
      .text(`共 ${completed.length} 条攀登记录 · 累计最高海拔 ${Math.max(...completed.map(e => e.max_altitude || 0))}m`, 30, rowY + 10);

    // Footer
    doc.rect(0, doc.page.height - 16, doc.page.width, 16).fill('#1e3a5f');
    doc.fontSize(7).fillColor('#64748b').text('SummitLink © 2026 — 本护照由平台数字签名，不可伪造', 0, doc.page.height - 11, { align: 'center' });

    doc.end();
  } catch (e) {
    if (!res.headersSent) {
      res.status(500).json({ error: '护照生成失败：' + e.message });
    }
  }
});

module.exports = router;
