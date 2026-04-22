const express = require('express');
const router = express.Router();
const db = require('../db/database');
const auth = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

const writeLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, message: { error: '操作太频繁' } });

// GET /api/mountains/categories
router.get('/categories', (req, res) => {
  try {
    const categories = [
      {
        id: 'himalaya',
        name: '喜马拉雅山脉',
        nameEn: 'Himalaya',
        description: '世界最高山脉，8000米级巨峰云集',
        peaks: db.prepare("SELECT COUNT(*) as cnt FROM peaks WHERE continent = '亚洲' AND altitude >= 7000").get().cnt,
        maxAltitude: db.prepare("SELECT MAX(altitude) as max FROM peaks WHERE continent = '亚洲'").get().max || 0,
      },
      {
        id: 'andes',
        name: '安第斯山脉',
        nameEn: 'Andes',
        description: '南美洲脊梁，阿空加瓜峰耸立其中',
        peaks: db.prepare("SELECT COUNT(*) as cnt FROM peaks WHERE continent = '南美洲'").get().cnt,
        maxAltitude: db.prepare("SELECT MAX(altitude) as max FROM peaks WHERE continent = '南美洲'").get().max || 0,
      },
      {
        id: 'africa',
        name: '非洲之巅',
        nameEn: 'African Peaks',
        description: '乞力马扎罗等非洲标志性高峰',
        peaks: db.prepare("SELECT COUNT(*) as cnt FROM peaks WHERE continent = '非洲'").get().cnt,
        maxAltitude: db.prepare("SELECT MAX(altitude) as max FROM peaks WHERE continent = '非洲'").get().max || 0,
      },
      {
        id: 'europe',
        name: '欧洲阿尔卑斯',
        nameEn: 'European Alps',
        description: '欧洲经典技术攀登目的地',
        peaks: db.prepare("SELECT COUNT(*) as cnt FROM peaks WHERE continent = '欧洲'").get().cnt,
        maxAltitude: db.prepare("SELECT MAX(altitude) as max FROM peaks WHERE continent = '欧洲'").get().max || 0,
      },
    ];
    res.json(categories);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/mountains/:id/detail
router.get('/:id/detail', (req, res) => {
  try {
    const peak = db.prepare('SELECT * FROM peaks WHERE id = ?').get(req.params.id);
    if (!peak) return res.status(404).json({ error: '山峰不存在' });
    const footprintCount = db.prepare('SELECT COUNT(*) as cnt FROM mountain_footprints WHERE peak_id = ?').get(req.params.id).cnt;
    const wishlistCount = db.prepare('SELECT COUNT(*) as cnt FROM mountain_wishlists WHERE peak_id = ?').get(req.params.id).cnt;
    res.json({
      ...peak,
      routes_json: peak.routes_json ? JSON.parse(peak.routes_json) : [],
      stories_json: peak.stories_json ? JSON.parse(peak.stories_json) : [],
      footprint_count: footprintCount,
      wishlist_count: wishlistCount,
    });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/mountains/:id/wishlist
router.post('/:id/wishlist', writeLimiter, auth, (req, res) => {
  try {
    const peak = db.prepare('SELECT id FROM peaks WHERE id = ?').get(req.params.id);
    if (!peak) return res.status(404).json({ error: '山峰不存在' });
    const { note } = req.body;
    db.prepare('INSERT OR IGNORE INTO mountain_wishlists (user_id, peak_id, note) VALUES (?, ?, ?)').run(req.user.id, req.params.id, note || null);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// DELETE /api/mountains/:id/wishlist
router.delete('/:id/wishlist', auth, (req, res) => {
  try {
    db.prepare('DELETE FROM mountain_wishlists WHERE user_id = ? AND peak_id = ?').run(req.user.id, req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/mountains/:id/footprint
router.post('/:id/footprint', writeLimiter, auth, (req, res) => {
  try {
    const peak = db.prepare('SELECT id FROM peaks WHERE id = ?').get(req.params.id);
    if (!peak) return res.status(404).json({ error: '山峰不存在' });
    const { summit_date, story, photo } = req.body;
    const result = db.prepare(`
      INSERT INTO mountain_footprints (user_id, peak_id, summit_date, story, photo)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.user.id, req.params.id, summit_date || null, story || null, photo || null);
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/mountains/:id/footprints
router.get('/:id/footprints', (req, res) => {
  try {
    const footprints = db.prepare(`
      SELECT mf.*, u.name as user_name, u.avatar as user_avatar
      FROM mountain_footprints mf
      JOIN users u ON u.id = mf.user_id
      WHERE mf.peak_id = ?
      ORDER BY mf.created_at DESC
    `).all(req.params.id);
    res.json(footprints);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
