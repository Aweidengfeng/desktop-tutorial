const express = require('express');
const router = express.Router();
const db = require('../db/database');
const auth = require('../middleware/auth');

// GET /api/bookings/my（需要JWT）
router.get('/my', auth, (req, res) => {
  try {
    const bookings = db.prepare(`
      SELECT id, mountain, guide_id, guide_name, date, members, notes, amount, status, created_at
      FROM bookings WHERE user_id = ? ORDER BY created_at DESC
    `).all(req.user.id);
    res.json(bookings);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/bookings（需要JWT）
router.post('/', auth, (req, res) => {
  try {
    const { mountain, guide_id, guide_name, date, members, notes } = req.body;
    if (!mountain || !date) return res.status(400).json({ error: '请填写山峰和日期' });
    const memberCount = parseInt(members) || 1;
    const amount = memberCount * 3000;
    const result = db.prepare(`
      INSERT INTO bookings (user_id, mountain, guide_id, guide_name, date, members, notes, amount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.user.id, mountain, guide_id || null, guide_name || '', date, memberCount, notes || '', amount);
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(result.lastInsertRowid);
    res.json(booking);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/bookings/:id（需要JWT）
router.get('/:id', auth, (req, res) => {
  try {
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!booking) return res.status(404).json({ error: '预约不存在' });
    res.json(booking);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
