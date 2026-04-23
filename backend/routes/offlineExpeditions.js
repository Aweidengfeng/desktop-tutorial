const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const prisma = require('../db/prisma');
const auth = require('../middleware/auth');

const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '操作过于频繁，请稍后再试' },
});

// POST / - create/upsert expedition (idempotent by client_uuid)
router.post('/', writeLimiter, auth, async (req, res) => {
  try {
    const { client_uuid, peak_id, peak_name, started_at, cover_media_url, poster_url } = req.body;
    if (!client_uuid || !started_at) return res.status(400).json({ error: 'client_uuid 和 started_at 不能为空' });
    const now = new Date().toISOString();
    await prisma.$executeRaw`
      INSERT INTO user_expeditions_log (client_uuid, user_id, peak_id, peak_name, started_at, cover_media_url, poster_url, created_at, updated_at)
      VALUES (${client_uuid}, ${req.user.id}, ${peak_id || null}, ${peak_name || null}, ${started_at}, ${cover_media_url || null}, ${poster_url || null}, ${now}, ${now})
      ON CONFLICT(client_uuid) DO UPDATE SET
        peak_id = excluded.peak_id,
        peak_name = excluded.peak_name,
        cover_media_url = excluded.cover_media_url,
        poster_url = excluded.poster_url,
        updated_at = excluded.updated_at
    `;
    const expedition = (await prisma.$queryRaw`SELECT * FROM user_expeditions_log WHERE client_uuid = ${client_uuid}`)[0];
    res.json(expedition);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /my
router.get('/my', auth, async (req, res) => {
  try {
    const expeditions = await prisma.$queryRaw`SELECT * FROM user_expeditions_log WHERE user_id = ${req.user.id} ORDER BY created_at DESC`;
    res.json(expeditions);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /public/:userId
router.get('/public/:userId', async (req, res) => {
  try {
    const expeditions = await prisma.$queryRaw`SELECT * FROM user_expeditions_log WHERE user_id = ${Number(req.params.userId)} AND status = 'completed' ORDER BY created_at DESC`;
    res.json(expeditions);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /:id
router.get('/:id', auth, async (req, res) => {
  try {
    const expedition = (await prisma.$queryRaw`SELECT * FROM user_expeditions_log WHERE id = ${Number(req.params.id)} AND user_id = ${req.user.id}`)[0];
    if (!expedition) return res.status(404).json({ error: '远征记录不存在' });
    res.json(expedition);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /:id/moments - batch upload moments (idempotent by client_uuid)
router.post('/:id/moments', writeLimiter, auth, async (req, res) => {
  try {
    const expedition = (await prisma.$queryRaw`SELECT * FROM user_expeditions_log WHERE id = ${Number(req.params.id)} AND user_id = ${req.user.id}`)[0];
    if (!expedition) return res.status(404).json({ error: '远征记录不存在' });
    const moments = Array.isArray(req.body) ? req.body : [req.body];
    const now = new Date().toISOString();
    for (const m of moments) {
      if (!m.client_uuid || !m.recorded_at) continue;
      await prisma.$executeRaw`
        INSERT OR IGNORE INTO expedition_moments (client_uuid, expedition_id, recorded_at, altitude, lat, lng, type, media_url, content, created_at)
        VALUES (${m.client_uuid}, ${expedition.id}, ${m.recorded_at}, ${m.altitude || 0}, ${m.lat || null}, ${m.lng || null}, ${m.type || 'text'}, ${m.media_url || null}, ${m.content || null}, ${now})
      `;
    }
    const countRow = (await prisma.$queryRaw`SELECT COUNT(*) as c FROM expedition_moments WHERE expedition_id = ${expedition.id}`)[0];
    const count = Number(countRow.c);
    await prisma.$executeRaw`UPDATE user_expeditions_log SET total_moments = ${count}, updated_at = ${now} WHERE id = ${expedition.id}`;
    res.json({ success: true, total_moments: count });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /:id/moments
router.get('/:id/moments', auth, async (req, res) => {
  try {
    const expedition = (await prisma.$queryRaw`SELECT * FROM user_expeditions_log WHERE id = ${Number(req.params.id)} AND user_id = ${req.user.id}`)[0];
    if (!expedition) return res.status(404).json({ error: '远征记录不存在' });
    const moments = await prisma.$queryRaw`SELECT * FROM expedition_moments WHERE expedition_id = ${expedition.id} ORDER BY recorded_at ASC`;
    res.json(moments);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /:id/finalize
router.post('/:id/finalize', auth, async (req, res) => {
  try {
    const expedition = (await prisma.$queryRaw`SELECT * FROM user_expeditions_log WHERE id = ${Number(req.params.id)} AND user_id = ${req.user.id}`)[0];
    if (!expedition) return res.status(404).json({ error: '远征记录不存在' });
    const { summited = 0, max_altitude = 0, total_gain = 0, duration_sec = 0, ended_at } = req.body;
    const now = new Date().toISOString();
    const momentsRow = (await prisma.$queryRaw`SELECT COUNT(*) as c FROM expedition_moments WHERE expedition_id = ${expedition.id}`)[0];
    const momentsCount = Number(momentsRow.c);
    await prisma.$executeRaw`
      UPDATE user_expeditions_log SET
        status = 'completed',
        summited = ${summited ? 1 : 0},
        max_altitude = ${max_altitude},
        total_gain = ${total_gain},
        duration_sec = ${duration_sec},
        ended_at = ${ended_at || now},
        total_moments = ${momentsCount},
        updated_at = ${now}
      WHERE id = ${expedition.id}
    `;
    const updated = (await prisma.$queryRaw`SELECT * FROM user_expeditions_log WHERE id = ${expedition.id}`)[0];
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /:id/subscribe
router.post('/:id/subscribe', auth, async (req, res) => {
  try {
    const expedition = (await prisma.$queryRaw`SELECT id FROM user_expeditions_log WHERE id = ${Number(req.params.id)}`)[0];
    if (!expedition) return res.status(404).json({ error: '远征记录不存在' });
    await prisma.$executeRaw`INSERT OR IGNORE INTO expedition_subscribers (expedition_id, user_id) VALUES (${expedition.id}, ${req.user.id})`;
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
