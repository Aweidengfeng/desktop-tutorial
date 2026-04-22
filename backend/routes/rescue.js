const express = require('express');
const router = express.Router();
const db = require('../db/database');
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
router.get('/contacts', rescueLimiter, (req, res) => {
  try {
    const contacts = db.prepare('SELECT * FROM rescue_contacts ORDER BY id ASC').all();
    res.json(contacts);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/rescue/config — 获取平台救援电话配置
router.get('/config', rescueLimiter, (req, res) => {
  try {
    // Try to get from system_config table, fallback to env, then default
    let phone = process.env.RESCUE_PHONE || '400-888-6699';
    try {
      const cfg = db.prepare("SELECT value FROM system_config WHERE key = 'rescue_phone'").get();
      if (cfg && cfg.value) phone = cfg.value;
    } catch(e) {}
    res.json({ phone, name: '巅峰探索平台救援热线' });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/rescue/sos — 发送SOS求救记录（需登录）
router.post('/sos', auth, (req, res) => {
  try {
    const { location, peak_name, message, lat, lng, altitude } = req.body;
    const locationStr = location || (lat && lng ? `${lat},${lng}` : null);
    const result = db.prepare(`
      INSERT INTO sos_records (user_id, location, peak_name, message)
      VALUES (?, ?, ?, ?)
    `).run(req.user.id, locationStr, peak_name || null, message || null);
    const record = db.prepare('SELECT * FROM sos_records WHERE id = ?').get(result.lastInsertRowid);

    // Notify user's emergency contacts via in-app notification
    try {
      const contacts = db.prepare('SELECT * FROM emergency_contacts WHERE user_id = ?').all(req.user.id);
      const user = db.prepare('SELECT name FROM users WHERE id = ?').get(req.user.id);
      contacts.forEach(c => {
        // If the contact has a user_id on the platform, send notification
        if (c.contact_user_id) {
          db.prepare(`INSERT OR IGNORE INTO notifications (user_id, type, title, body, data, created_at)
            VALUES (?, 'sos_alert', ?, ?, ?, CURRENT_TIMESTAMP)`)
            .run(c.contact_user_id, 'SOS 求救',
              `${user.name || '您的联系人'} 触发了 SOS 求救，位置：${locationStr || '未知'}`,
              JSON.stringify({ sos_record_id: record.id, lat, lng }));
        }
      });
    } catch(e) {}

    res.json({ success: true, record });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/rescue/sos/history — 获取当前用户的SOS记录历史（需登录）
router.get('/sos/history', auth, (req, res) => {
  try {
    const records = db.prepare(`
      SELECT * FROM sos_records WHERE user_id = ? ORDER BY timestamp DESC
    `).all(req.user.id);
    res.json(records);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
