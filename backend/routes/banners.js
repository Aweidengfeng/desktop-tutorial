const express = require('express');
const router = express.Router();
const db = require('../db/database');
const adminAuth = require('../middleware/adminAuth');

// GET /api/banners — 获取激活的Banner列表（按sort_order排序）
router.get('/', (req, res) => {
  try {
    const banners = db.prepare(
      `SELECT * FROM banners WHERE is_active = 1 ORDER BY sort_order ASC`
    ).all();
    res.json(banners);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/banners — 创建Banner（admin only）
router.post('/', adminAuth, (req, res) => {
  try {
    const { title, subtitle, image_url, link_type, link_target, gradient_from, gradient_to, sort_order, is_active } = req.body;
    if (!title || !image_url) return res.status(400).json({ error: '请填写标题和图片URL' });
    const result = db.prepare(`
      INSERT INTO banners (title, subtitle, image_url, link_type, link_target, gradient_from, gradient_to, sort_order, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      title, subtitle || '', image_url,
      link_type || 'none', link_target || '',
      gradient_from || '#1e4f60', gradient_to || '#0f172a',
      sort_order !== undefined ? sort_order : 99,
      is_active !== undefined ? (is_active ? 1 : 0) : 1
    );
    const banner = db.prepare('SELECT * FROM banners WHERE id = ?').get(result.lastInsertRowid);
    res.json(banner);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/banners/:id — 更新Banner（admin only）
router.put('/:id', adminAuth, (req, res) => {
  try {
    const banner = db.prepare('SELECT * FROM banners WHERE id = ?').get(req.params.id);
    if (!banner) return res.status(404).json({ error: 'Banner不存在' });
    const { title, subtitle, image_url, link_type, link_target, gradient_from, gradient_to, sort_order, is_active } = req.body;
    db.prepare(`
      UPDATE banners SET title=?, subtitle=?, image_url=?, link_type=?, link_target=?,
        gradient_from=?, gradient_to=?, sort_order=?, is_active=?
      WHERE id=?
    `).run(
      title !== undefined ? title : banner.title,
      subtitle !== undefined ? subtitle : banner.subtitle,
      image_url !== undefined ? image_url : banner.image_url,
      link_type !== undefined ? link_type : banner.link_type,
      link_target !== undefined ? link_target : banner.link_target,
      gradient_from !== undefined ? gradient_from : banner.gradient_from,
      gradient_to !== undefined ? gradient_to : banner.gradient_to,
      sort_order !== undefined ? sort_order : banner.sort_order,
      is_active !== undefined ? (is_active ? 1 : 0) : banner.is_active,
      req.params.id
    );
    const updated = db.prepare('SELECT * FROM banners WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// DELETE /api/banners/:id — 删除Banner（admin only）
router.delete('/:id', adminAuth, (req, res) => {
  try {
    const result = db.prepare('DELETE FROM banners WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Banner不存在' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
