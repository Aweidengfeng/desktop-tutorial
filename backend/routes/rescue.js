const express = require('express');
const router = express.Router();
const db = require('../db/database');
const auth = require('../middleware/auth');

// GET /api/rescue/contacts — 获取救援联系方式列表
router.get('/contacts', (req, res) => {
  try {
    const contacts = db.prepare('SELECT * FROM rescue_contacts ORDER BY id ASC').all();
    res.json(contacts);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/rescue/sos — 发送SOS求救记录（需登录）
router.post('/sos', auth, (req, res) => {
  try {
    const { location, peak_name, message } = req.body;
    const result = db.prepare(`
      INSERT INTO sos_records (user_id, location, peak_name, message)
      VALUES (?, ?, ?, ?)
    `).run(req.user.id, location || null, peak_name || null, message || null);
    const record = db.prepare('SELECT * FROM sos_records WHERE id = ?').get(result.lastInsertRowid);
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
