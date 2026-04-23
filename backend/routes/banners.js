const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const adminAuth = require('../middleware/adminAuth');
const rateLimit = require('express-rate-limit');

const bannersReadLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false, message: { error: '请求过于频繁' } });
const bannersWriteLimiter = rateLimit({ windowMs: 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false, message: { error: '操作过于频繁' } });

// GET /api/banners — 获取激活的Banner列表（按sort_order排序）
router.get('/', bannersReadLimiter, async (req, res) => {
  try {
    const banners = await prisma.$queryRaw`SELECT * FROM banners WHERE is_active = 1 ORDER BY sort_order ASC`;
    res.json(banners);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/banners — 创建Banner（admin only）
router.post('/', bannersWriteLimiter, adminAuth, async (req, res) => {
  try {
    const { title, subtitle, image_url, link_type, link_target, gradient_from, gradient_to, sort_order, is_active } = req.body;
    if (!title || !image_url) return res.status(400).json({ error: '请填写标题和图片URL' });
    const so = sort_order !== undefined ? sort_order : 99;
    const ia = is_active !== undefined ? (is_active ? 1 : 0) : 1;
    const inserted = await prisma.$queryRaw`
      INSERT INTO banners (title, subtitle, image_url, link_type, link_target, gradient_from, gradient_to, sort_order, is_active)
      VALUES (${title}, ${subtitle || ''}, ${image_url},
        ${link_type || 'none'}, ${link_target || ''},
        ${gradient_from || '#1e4f60'}, ${gradient_to || '#0f172a'},
        ${so}, ${ia})
      RETURNING id
    `;
    const banner = (await prisma.$queryRaw`SELECT * FROM banners WHERE id = ${inserted[0].id}`)[0];
    res.json(banner);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/banners/:id — 更新Banner（admin only）
router.put('/:id', bannersWriteLimiter, adminAuth, async (req, res) => {
  try {
    const banner = (await prisma.$queryRaw`SELECT * FROM banners WHERE id = ${Number(req.params.id)}`)[0];
    if (!banner) return res.status(404).json({ error: 'Banner不存在' });
    const { title, subtitle, image_url, link_type, link_target, gradient_from, gradient_to, sort_order, is_active } = req.body;
    const t = title !== undefined ? title : banner.title;
    const s = subtitle !== undefined ? subtitle : banner.subtitle;
    const iu = image_url !== undefined ? image_url : banner.image_url;
    const lt = link_type !== undefined ? link_type : banner.link_type;
    const ltr = link_target !== undefined ? link_target : banner.link_target;
    const gf = gradient_from !== undefined ? gradient_from : banner.gradient_from;
    const gt = gradient_to !== undefined ? gradient_to : banner.gradient_to;
    const so = sort_order !== undefined ? sort_order : banner.sort_order;
    const ia = is_active !== undefined ? (is_active ? 1 : 0) : banner.is_active;
    await prisma.$executeRaw`
      UPDATE banners SET title=${t}, subtitle=${s}, image_url=${iu}, link_type=${lt}, link_target=${ltr},
        gradient_from=${gf}, gradient_to=${gt}, sort_order=${so}, is_active=${ia}
      WHERE id=${Number(req.params.id)}
    `;
    const updated = (await prisma.$queryRaw`SELECT * FROM banners WHERE id = ${Number(req.params.id)}`)[0];
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// DELETE /api/banners/:id — 删除Banner（admin only）
router.delete('/:id', bannersWriteLimiter, adminAuth, async (req, res) => {
  try {
    const changes = await prisma.$executeRaw`DELETE FROM banners WHERE id = ${Number(req.params.id)}`;
    if (changes === 0) return res.status(404).json({ error: 'Banner不存在' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
