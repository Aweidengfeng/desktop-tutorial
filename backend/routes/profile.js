const express = require('express');
const router = express.Router();
const db = require('../db/database');
const auth = require('../middleware/auth');

// ─── 医疗信息 ─────────────────────────────────────────────────────────────────

// GET /api/profile/medical
router.get('/medical', auth, (req, res) => {
  try {
    const info = db.prepare('SELECT * FROM medical_info WHERE user_id = ?').get(req.user.id);
    res.json(info || { user_id: req.user.id, blood_type: '', allergies: '', health_notes: '' });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/profile/medical
router.put('/medical', auth, (req, res) => {
  try {
    const { blood_type, allergies, health_notes } = req.body;
    const existing = db.prepare('SELECT id FROM medical_info WHERE user_id = ?').get(req.user.id);
    if (existing) {
      db.prepare(`
        UPDATE medical_info SET blood_type = ?, allergies = ?, health_notes = ?
        WHERE user_id = ?
      `).run(blood_type || null, allergies || null, health_notes || null, req.user.id);
    } else {
      db.prepare(`
        INSERT INTO medical_info (user_id, blood_type, allergies, health_notes)
        VALUES (?, ?, ?, ?)
      `).run(req.user.id, blood_type || null, allergies || null, health_notes || null);
    }
    const info = db.prepare('SELECT * FROM medical_info WHERE user_id = ?').get(req.user.id);
    res.json(info);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// ─── 紧急联系人 ──────────────────────────────────────────────────────────────

// GET /api/profile/emergency-contacts
router.get('/emergency-contacts', auth, (req, res) => {
  try {
    const contacts = db.prepare(`
      SELECT * FROM emergency_contacts WHERE user_id = ? ORDER BY id ASC
    `).all(req.user.id);
    res.json(contacts);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/profile/emergency-contacts
router.post('/emergency-contacts', auth, (req, res) => {
  try {
    const { name, relationship, phone } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ error: '姓名和电话不能为空' });
    }
    const result = db.prepare(`
      INSERT INTO emergency_contacts (user_id, name, relationship, phone)
      VALUES (?, ?, ?, ?)
    `).run(req.user.id, name, relationship || null, phone);
    const contact = db.prepare('SELECT * FROM emergency_contacts WHERE id = ?').get(result.lastInsertRowid);
    res.json(contact);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// DELETE /api/profile/emergency-contacts/:id
router.delete('/emergency-contacts/:id', auth, (req, res) => {
  try {
    const contact = db.prepare(`
      SELECT id FROM emergency_contacts WHERE id = ? AND user_id = ?
    `).get(req.params.id, req.user.id);
    if (!contact) return res.status(404).json({ error: '联系人不存在' });
    db.prepare('DELETE FROM emergency_contacts WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// ─── 装备清单 ─────────────────────────────────────────────────────────────────

// GET /api/profile/gear-checklist
router.get('/gear-checklist', auth, (req, res) => {
  try {
    const items = db.prepare(`
      SELECT * FROM gear_checklist WHERE user_id = ? ORDER BY id ASC
    `).all(req.user.id);
    res.json(items);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/profile/gear-checklist
router.post('/gear-checklist', auth, (req, res) => {
  try {
    const { item_name, category, notes } = req.body;
    if (!item_name) return res.status(400).json({ error: '装备名称不能为空' });
    const result = db.prepare(`
      INSERT INTO gear_checklist (user_id, item_name, category, notes)
      VALUES (?, ?, ?, ?)
    `).run(req.user.id, item_name, category || null, notes || null);
    const item = db.prepare('SELECT * FROM gear_checklist WHERE id = ?').get(result.lastInsertRowid);
    res.json(item);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/profile/gear-checklist/:id
router.put('/gear-checklist/:id', auth, (req, res) => {
  try {
    const item = db.prepare(`
      SELECT id FROM gear_checklist WHERE id = ? AND user_id = ?
    `).get(req.params.id, req.user.id);
    if (!item) return res.status(404).json({ error: '装备项不存在' });
    const { is_ready, item_name, category, notes } = req.body;
    db.prepare(`
      UPDATE gear_checklist SET is_ready = ?, item_name = COALESCE(?, item_name),
        category = COALESCE(?, category), notes = COALESCE(?, notes)
      WHERE id = ?
    `).run(is_ready ? 1 : 0, item_name || null, category || null, notes || null, req.params.id);
    const updated = db.prepare('SELECT * FROM gear_checklist WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// ─── 我的收藏 ─────────────────────────────────────────────────────────────────

// GET /api/profile/favorites
router.get('/favorites', auth, (req, res) => {
  try {
    const favs = db.prepare(`
      SELECT * FROM favorites WHERE user_id = ? ORDER BY created_at DESC
    `).all(req.user.id);
    res.json(favs);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/profile/favorites
router.post('/favorites', auth, (req, res) => {
  try {
    const { type, item_id } = req.body;
    const validTypes = ['peak', 'article', 'gear', 'guide'];
    if (!type || !item_id) {
      return res.status(400).json({ error: 'type 和 item_id 不能为空' });
    }
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: '收藏类型不正确' });
    }
    const result = db.prepare(`
      INSERT OR IGNORE INTO favorites (user_id, type, item_id)
      VALUES (?, ?, ?)
    `).run(req.user.id, type, item_id);
    if (result.changes === 0) {
      return res.status(400).json({ error: '已经收藏过了' });
    }
    const fav = db.prepare('SELECT * FROM favorites WHERE id = ?').get(result.lastInsertRowid);
    res.json(fav);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// DELETE /api/profile/favorites/:id
router.delete('/favorites/:id', auth, (req, res) => {
  try {
    const fav = db.prepare(`
      SELECT id FROM favorites WHERE id = ? AND user_id = ?
    `).get(req.params.id, req.user.id);
    if (!fav) return res.status(404).json({ error: '收藏不存在' });
    db.prepare('DELETE FROM favorites WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
