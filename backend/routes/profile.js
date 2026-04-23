const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const auth = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

const profileReadLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false, message: { error: '请求过于频繁' } });
const profileWriteLimiter = rateLimit({ windowMs: 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false, message: { error: '操作过于频繁' } });

// ─── 医疗信息 ─────────────────────────────────────────────────────────────────

// GET /api/profile/medical
router.get('/medical', profileReadLimiter, auth, async (req, res) => {
  try {
    const [info] = await prisma.$queryRaw`SELECT * FROM medical_info WHERE user_id = ${req.user.id}`;
    res.json(info || { user_id: req.user.id, blood_type: '', allergies: '', health_notes: '' });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/profile/medical
router.put('/medical', profileWriteLimiter, auth, async (req, res) => {
  try {
    const { blood_type, allergies, health_notes } = req.body;
    const [existing] = await prisma.$queryRaw`SELECT id FROM medical_info WHERE user_id = ${req.user.id}`;
    if (existing) {
      await prisma.$executeRaw`
        UPDATE medical_info SET blood_type = ${blood_type || null}, allergies = ${allergies || null}, health_notes = ${health_notes || null}
        WHERE user_id = ${req.user.id}
      `;
    } else {
      await prisma.$executeRaw`
        INSERT INTO medical_info (user_id, blood_type, allergies, health_notes)
        VALUES (${req.user.id}, ${blood_type || null}, ${allergies || null}, ${health_notes || null})
      `;
    }
    const [info] = await prisma.$queryRaw`SELECT * FROM medical_info WHERE user_id = ${req.user.id}`;
    res.json(info);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// ─── 紧急联系人 ──────────────────────────────────────────────────────────────

// GET /api/profile/emergency-contacts
router.get('/emergency-contacts', profileReadLimiter, auth, async (req, res) => {
  try {
    const contacts = await prisma.$queryRaw`
      SELECT * FROM emergency_contacts WHERE user_id = ${req.user.id} ORDER BY id ASC
    `;
    res.json(contacts);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/profile/emergency-contacts
router.post('/emergency-contacts', profileWriteLimiter, auth, async (req, res) => {
  try {
    const { name, relationship, phone } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ error: '姓名和电话不能为空' });
    }
    await prisma.$executeRaw`
      INSERT INTO emergency_contacts (user_id, name, relationship, phone)
      VALUES (${req.user.id}, ${name}, ${relationship || null}, ${phone})
    `;
    const [contact] = await prisma.$queryRaw`
      SELECT * FROM emergency_contacts WHERE user_id = ${req.user.id} ORDER BY id DESC LIMIT 1
    `;
    res.json(contact);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// DELETE /api/profile/emergency-contacts/:id
router.delete('/emergency-contacts/:id', profileWriteLimiter, auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [contact] = await prisma.$queryRaw`
      SELECT id FROM emergency_contacts WHERE id = ${id} AND user_id = ${req.user.id}
    `;
    if (!contact) return res.status(404).json({ error: '联系人不存在' });
    await prisma.$executeRaw`DELETE FROM emergency_contacts WHERE id = ${id}`;
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// ─── 装备清单 ─────────────────────────────────────────────────────────────────

// GET /api/profile/gear-checklist
router.get('/gear-checklist', profileReadLimiter, auth, async (req, res) => {
  try {
    const items = await prisma.$queryRaw`
      SELECT * FROM gear_checklist WHERE user_id = ${req.user.id} ORDER BY id ASC
    `;
    res.json(items);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/profile/gear-checklist
router.post('/gear-checklist', profileWriteLimiter, auth, async (req, res) => {
  try {
    const { item_name, category, notes } = req.body;
    if (!item_name) return res.status(400).json({ error: '装备名称不能为空' });
    await prisma.$executeRaw`
      INSERT INTO gear_checklist (user_id, item_name, category, notes)
      VALUES (${req.user.id}, ${item_name}, ${category || null}, ${notes || null})
    `;
    const [item] = await prisma.$queryRaw`
      SELECT * FROM gear_checklist WHERE user_id = ${req.user.id} ORDER BY id DESC LIMIT 1
    `;
    res.json(item);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/profile/gear-checklist/:id
router.put('/gear-checklist/:id', profileWriteLimiter, auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [item] = await prisma.$queryRaw`
      SELECT id FROM gear_checklist WHERE id = ${id} AND user_id = ${req.user.id}
    `;
    if (!item) return res.status(404).json({ error: '装备项不存在' });
    const { is_ready, item_name, category, notes } = req.body;
    const isReady = is_ready ? 1 : 0;
    await prisma.$executeRaw`
      UPDATE gear_checklist SET is_ready = ${isReady},
        item_name = COALESCE(${item_name || null}, item_name),
        category = COALESCE(${category || null}, category),
        notes = COALESCE(${notes || null}, notes)
      WHERE id = ${id}
    `;
    const [updated] = await prisma.$queryRaw`SELECT * FROM gear_checklist WHERE id = ${id}`;
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// ─── 我的收藏 ─────────────────────────────────────────────────────────────────

// GET /api/profile/favorites
router.get('/favorites', profileReadLimiter, auth, async (req, res) => {
  try {
    const favs = await prisma.$queryRaw`
      SELECT * FROM favorites WHERE user_id = ${req.user.id} ORDER BY created_at DESC
    `;
    res.json(favs);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/profile/favorites
router.post('/favorites', profileWriteLimiter, auth, async (req, res) => {
  try {
    const { type, item_id } = req.body;
    const validTypes = ['peak', 'article', 'gear', 'guide'];
    if (!type || !item_id) {
      return res.status(400).json({ error: 'type 和 item_id 不能为空' });
    }
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: '收藏类型不正确' });
    }
    const result = await prisma.$executeRaw`
      INSERT OR IGNORE INTO favorites (user_id, type, item_id) VALUES (${req.user.id}, ${type}, ${item_id})
    `;
    if (result === 0) {
      return res.status(400).json({ error: '已经收藏过了' });
    }
    const [fav] = await prisma.$queryRaw`
      SELECT * FROM favorites WHERE user_id = ${req.user.id} AND type = ${type} AND item_id = ${item_id}
    `;
    res.json(fav);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// DELETE /api/profile/favorites/:id
router.delete('/favorites/:id', profileWriteLimiter, auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [fav] = await prisma.$queryRaw`
      SELECT id FROM favorites WHERE id = ${id} AND user_id = ${req.user.id}
    `;
    if (!fav) return res.status(404).json({ error: '收藏不存在' });
    await prisma.$executeRaw`DELETE FROM favorites WHERE id = ${id}`;
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
