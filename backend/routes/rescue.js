const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const auth = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

const rescueLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: '请求太频繁' },
  standardHeaders: true,
  legacyHeaders: false,
});

// GET /api/rescue/contacts — 获取救援联系方式列表
router.get('/contacts', rescueLimiter, async (req, res) => {
  try {
    const contacts = await prisma.$queryRaw`SELECT * FROM rescue_contacts ORDER BY id ASC`;
    res.json(contacts);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/rescue/config — 获取平台救援电话配置
router.get('/config', rescueLimiter, async (req, res) => {
  try {
    let phone = process.env.RESCUE_PHONE || '400-888-6699';
    try {
      const cfg = (await prisma.$queryRaw`SELECT value FROM system_config WHERE key = 'rescue_phone'`)[0];
      if (cfg && cfg.value) phone = cfg.value;
    } catch(e) {}
    res.json({ phone, name: '巅峰探索平台救援热线' });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/rescue/sos — 发送SOS求救记录（需登录）
router.post('/sos', auth, async (req, res) => {
  try {
    const { location, peak_name, message, lat, lng, altitude } = req.body;
    const locationStr = location || (lat && lng ? `${lat},${lng}` : null);
    const inserted = await prisma.$queryRaw`
      INSERT INTO sos_records (user_id, location, peak_name, message)
      VALUES (${req.user.id}, ${locationStr}, ${peak_name || null}, ${message || null})
      RETURNING id
    `;
    const record = (await prisma.$queryRaw`SELECT * FROM sos_records WHERE id = ${inserted[0].id}`)[0];

    // Notify user's emergency contacts via in-app notification
    try {
      const contacts = await prisma.$queryRaw`SELECT * FROM emergency_contacts WHERE user_id = ${req.user.id}`;
      const user = (await prisma.$queryRaw`SELECT name FROM users WHERE id = ${req.user.id}`)[0];
      for (const c of contacts) {
        if (c.contact_user_id) {
          await prisma.$executeRaw`
            INSERT INTO notifications (user_id, type, title, body, data, created_at)
            VALUES (${c.contact_user_id}, 'sos_alert', 'SOS 求救',
              ${`${user.name || '您的联系人'} 触发了 SOS 求救，位置：${locationStr || '未知'}`},
              ${JSON.stringify({ sos_record_id: record.id, lat, lng })}, CURRENT_TIMESTAMP) ON CONFLICT DO NOTHING
          `;
        }
      }
    } catch(e) {}

    res.json({ success: true, record });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/rescue/sos/history — 获取当前用户的SOS记录历史（需登录）
router.get('/sos/history', auth, async (req, res) => {
  try {
    const records = await prisma.$queryRaw`
      SELECT * FROM sos_records WHERE user_id = ${req.user.id} ORDER BY timestamp DESC
    `;
    res.json(records);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/rescue/sos/status/:id — 查询单条 SOS 记录状态（需登录，仅本人）
router.get('/sos/status/:id', auth, async (req, res) => {
  try {
    const recordId = Number(req.params.id);
    if (!Number.isFinite(recordId) || recordId <= 0) {
      return res.status(400).json({ error: '无效记录ID' });
    }
    let records = [];
    try {
      records = await prisma.$queryRaw`
        SELECT id, status, message, location, created_at, timestamp
        FROM sos_records
        WHERE id = ${recordId} AND user_id = ${req.user.id}
        LIMIT 1
      `;
    } catch (queryErr) {
      if (!String(queryErr.message || '').match(/no such column|does not exist/i)) throw queryErr;
      try {
        records = await prisma.$queryRaw`
          SELECT id, status, message, location, timestamp
          FROM sos_records
          WHERE id = ${recordId} AND user_id = ${req.user.id}
          LIMIT 1
        `;
      } catch (secondErr) {
        if (!String(secondErr.message || '').match(/no such column|does not exist/i)) throw secondErr;
        records = await prisma.$queryRaw`
          SELECT id, message, location, created_at
          FROM sos_records
          WHERE id = ${recordId} AND user_id = ${req.user.id}
          LIMIT 1
        `;
      }
    }
    const rawRecord = records[0] || null;
    const record = rawRecord
      ? {
          id: rawRecord.id,
          status: rawRecord.status || 'pending',
          message: rawRecord.message || null,
          location: rawRecord.location || null,
          created_at: rawRecord.created_at || rawRecord.timestamp || null,
          timestamp: rawRecord.timestamp || rawRecord.created_at || null,
        }
      : null;
    if (!record) return res.status(404).json({ error: '记录不存在' });
    res.json(record);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
