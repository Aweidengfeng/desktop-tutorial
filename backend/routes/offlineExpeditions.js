const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const db = require('../db/database');
const auth = require('../middleware/auth');

const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '操作过于频繁，请稍后再试' },
});

// POST /api/offline-expeditions - create/upsert expedition (idempotent by client_uuid)
router.post('/', writeLimiter, auth, (req, res) => {
  try {
    const { client_uuid, peak_id, peak_name, started_at, cover_media_url, poster_url } = req.body;
    if (!client_uuid || !started_at) return res.status(400).json({ error: 'client_uuid 和 started_at 不能为空' });
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO user_expeditions_log (client_uuid, user_id, peak_id, peak_name, started_at, cover_media_url, poster_url, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(client_uuid) DO UPDATE SET
        peak_id = excluded.peak_id,
        peak_name = excluded.peak_name,
        cover_media_url = excluded.cover_media_url,
        poster_url = excluded.poster_url,
        updated_at = excluded.updated_at
    `).run(client_uuid, req.user.id, peak_id || null, peak_name || null, started_at, cover_media_url || null, poster_url || null, now, now);
    const expedition = db.prepare('SELECT * FROM user_expeditions_log WHERE client_uuid = ?').get(client_uuid);
    res.json(expedition);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/offline-expeditions/my - list user's expeditions
router.get('/my', auth, (req, res) => {
  try {
    const expeditions = db.prepare('SELECT * FROM user_expeditions_log WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
    res.json(expeditions);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/offline-expeditions/public/:userId - get public expeditions for a user
router.get('/public/:userId', (req, res) => {
  try {
    const expeditions = db.prepare("SELECT * FROM user_expeditions_log WHERE user_id = ? AND status = 'completed' ORDER BY created_at DESC").all(req.params.userId);
    res.json(expeditions);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/offline-expeditions/:id - get expedition details
router.get('/:id', auth, (req, res) => {
  try {
    const expedition = db.prepare('SELECT * FROM user_expeditions_log WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!expedition) return res.status(404).json({ error: '远征记录不存在' });
    res.json(expedition);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/offline-expeditions/:id/moments - batch upload moments (idempotent by client_uuid)
router.post('/:id/moments', writeLimiter, auth, (req, res) => {
  try {
    const expedition = db.prepare('SELECT * FROM user_expeditions_log WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!expedition) return res.status(404).json({ error: '远征记录不存在' });
    const moments = Array.isArray(req.body) ? req.body : [req.body];
    const now = new Date().toISOString();
    const insert = db.prepare(`
      INSERT OR IGNORE INTO expedition_moments (client_uuid, expedition_id, recorded_at, altitude, lat, lng, type, media_url, content, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertMany = db.transaction((items) => {
      for (const m of items) {
        if (!m.client_uuid || !m.recorded_at) continue;
        insert.run(m.client_uuid, expedition.id, m.recorded_at, m.altitude || 0, m.lat || null, m.lng || null, m.type || 'text', m.media_url || null, m.content || null, now);
      }
    });
    insertMany(moments);
    const count = db.prepare('SELECT COUNT(*) as c FROM expedition_moments WHERE expedition_id = ?').get(expedition.id).c;
    db.prepare('UPDATE user_expeditions_log SET total_moments = ?, updated_at = ? WHERE id = ?').run(count, now, expedition.id);
    res.json({ success: true, total_moments: count });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/offline-expeditions/:id/moments - get moments for an expedition
router.get('/:id/moments', auth, (req, res) => {
  try {
    const expedition = db.prepare('SELECT * FROM user_expeditions_log WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!expedition) return res.status(404).json({ error: '远征记录不存在' });
    const moments = db.prepare('SELECT * FROM expedition_moments WHERE expedition_id = ? ORDER BY recorded_at ASC').all(expedition.id);
    res.json(moments);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/offline-expeditions/:id/finalize - finalize expedition
router.post('/:id/finalize', auth, (req, res) => {
  try {
    const expedition = db.prepare('SELECT * FROM user_expeditions_log WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!expedition) return res.status(404).json({ error: '远征记录不存在' });
    const { summited = 0, max_altitude = 0, total_gain = 0, duration_sec = 0, ended_at } = req.body;
    const now = new Date().toISOString();
    const moments = db.prepare('SELECT COUNT(*) as c FROM expedition_moments WHERE expedition_id = ?').get(expedition.id);
    db.prepare(`
      UPDATE user_expeditions_log SET
        status = 'completed',
        summited = ?,
        max_altitude = ?,
        total_gain = ?,
        duration_sec = ?,
        ended_at = ?,
        total_moments = ?,
        updated_at = ?
      WHERE id = ?
    `).run(summited ? 1 : 0, max_altitude, total_gain, duration_sec, ended_at || now, moments.c, now, expedition.id);
    const updated = db.prepare('SELECT * FROM user_expeditions_log WHERE id = ?').get(expedition.id);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/offline-expeditions/:id/subscribe - subscribe to expedition notifications
router.post('/:id/subscribe', auth, (req, res) => {
  try {
    const expedition = db.prepare('SELECT id FROM user_expeditions_log WHERE id = ?').get(req.params.id);
    if (!expedition) return res.status(404).json({ error: '远征记录不存在' });
    db.prepare('INSERT OR IGNORE INTO expedition_subscribers (expedition_id, user_id) VALUES (?, ?)').run(expedition.id, req.user.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
