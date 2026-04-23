const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const auth = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

const readLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, message: { error: '请求太频繁' }, standardHeaders: true, legacyHeaders: false });
const writeLimiter = rateLimit({ windowMs: 60 * 1000, max: 15, message: { error: '操作太频繁' }, standardHeaders: true, legacyHeaders: false });

// GET /api/mountains/categories
router.get('/categories', readLimiter, async (req, res) => {
  try {
    const [asiaCount] = await prisma.$queryRaw`SELECT COUNT(*) as cnt FROM peaks WHERE continent = '亚洲' AND altitude >= 7000`;
    const [asiaMax] = await prisma.$queryRaw`SELECT MAX(altitude) as max FROM peaks WHERE continent = '亚洲'`;
    const [saCount] = await prisma.$queryRaw`SELECT COUNT(*) as cnt FROM peaks WHERE continent = '南美洲'`;
    const [saMax] = await prisma.$queryRaw`SELECT MAX(altitude) as max FROM peaks WHERE continent = '南美洲'`;
    const [afCount] = await prisma.$queryRaw`SELECT COUNT(*) as cnt FROM peaks WHERE continent = '非洲'`;
    const [afMax] = await prisma.$queryRaw`SELECT MAX(altitude) as max FROM peaks WHERE continent = '非洲'`;
    const [euCount] = await prisma.$queryRaw`SELECT COUNT(*) as cnt FROM peaks WHERE continent = '欧洲'`;
    const [euMax] = await prisma.$queryRaw`SELECT MAX(altitude) as max FROM peaks WHERE continent = '欧洲'`;
    const categories = [
      {
        id: 'himalaya',
        name: '喜马拉雅山脉',
        nameEn: 'Himalaya',
        description: '世界最高山脉，8000米级巨峰云集',
        peaks: Number(asiaCount.cnt),
        maxAltitude: Number(asiaMax.max) || 0,
      },
      {
        id: 'andes',
        name: '安第斯山脉',
        nameEn: 'Andes',
        description: '南美洲脊梁，阿空加瓜峰耸立其中',
        peaks: Number(saCount.cnt),
        maxAltitude: Number(saMax.max) || 0,
      },
      {
        id: 'africa',
        name: '非洲之巅',
        nameEn: 'African Peaks',
        description: '乞力马扎罗等非洲标志性高峰',
        peaks: Number(afCount.cnt),
        maxAltitude: Number(afMax.max) || 0,
      },
      {
        id: 'europe',
        name: '欧洲阿尔卑斯',
        nameEn: 'European Alps',
        description: '欧洲经典技术攀登目的地',
        peaks: Number(euCount.cnt),
        maxAltitude: Number(euMax.max) || 0,
      },
    ];
    res.json(categories);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/mountains/:id/detail
router.get('/:id/detail', readLimiter, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [peak] = await prisma.$queryRaw`SELECT * FROM peaks WHERE id = ${id}`;
    if (!peak) return res.status(404).json({ error: '山峰不存在' });
    const [fp] = await prisma.$queryRaw`SELECT COUNT(*) as cnt FROM mountain_footprints WHERE peak_id = ${id}`;
    const [wl] = await prisma.$queryRaw`SELECT COUNT(*) as cnt FROM mountain_wishlists WHERE peak_id = ${id}`;
    res.json({
      ...peak,
      routes_json: peak.routes_json ? JSON.parse(peak.routes_json) : [],
      stories_json: peak.stories_json ? JSON.parse(peak.stories_json) : [],
      footprint_count: Number(fp.cnt),
      wishlist_count: Number(wl.cnt),
    });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/mountains/:id/wishlist
router.post('/:id/wishlist', writeLimiter, auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [peak] = await prisma.$queryRaw`SELECT id FROM peaks WHERE id = ${id}`;
    if (!peak) return res.status(404).json({ error: '山峰不存在' });
    const { note } = req.body;
    await prisma.$executeRaw`INSERT OR IGNORE INTO mountain_wishlists (user_id, peak_id, note) VALUES (${req.user.id}, ${id}, ${note || null})`;
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// DELETE /api/mountains/:id/wishlist
router.delete('/:id/wishlist', writeLimiter, auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.$executeRaw`DELETE FROM mountain_wishlists WHERE user_id = ${req.user.id} AND peak_id = ${id}`;
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/mountains/:id/footprint
router.post('/:id/footprint', writeLimiter, auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [peak] = await prisma.$queryRaw`SELECT id FROM peaks WHERE id = ${id}`;
    if (!peak) return res.status(404).json({ error: '山峰不存在' });
    const { summit_date, story, photo } = req.body;
    await prisma.$executeRaw`
      INSERT INTO mountain_footprints (user_id, peak_id, summit_date, story, photo)
      VALUES (${req.user.id}, ${id}, ${summit_date || null}, ${story || null}, ${photo || null})
    `;
    const [fp] = await prisma.$queryRaw`
      SELECT * FROM mountain_footprints WHERE user_id = ${req.user.id} AND peak_id = ${id} ORDER BY id DESC LIMIT 1
    `;
    res.json({ success: true, id: fp.id });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/mountains/:id/footprints
router.get('/:id/footprints', readLimiter, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const footprints = await prisma.$queryRaw`
      SELECT mf.*, u.name as user_name, u.avatar as user_avatar
      FROM mountain_footprints mf
      JOIN users u ON u.id = mf.user_id
      WHERE mf.peak_id = ${id}
      ORDER BY mf.created_at DESC
    `;
    res.json(footprints);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
