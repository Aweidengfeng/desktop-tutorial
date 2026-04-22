const express = require('express');
const router = express.Router();
const db = require('../db/database');
const auth = require('../middleware/auth');

// POST /api/follows（关注用户，需要JWT）
router.post('/', auth, (req, res) => {
  try {
    const { target_id } = req.body;
    if (!target_id) return res.status(400).json({ error: '请提供目标用户ID' });
    if (parseInt(target_id) === req.user.id) return res.status(400).json({ error: '不能关注自己' });
    const target = db.prepare('SELECT id FROM users WHERE id = ?').get(target_id);
    if (!target) return res.status(404).json({ error: '用户不存在' });
    const existing = db.prepare('SELECT id FROM follows WHERE follower_id = ? AND following_id = ?').get(req.user.id, target_id);
    if (existing) return res.status(400).json({ error: '已关注该用户' });
    db.prepare('INSERT INTO follows (follower_id, following_id) VALUES (?, ?)').run(req.user.id, target_id);
    db.prepare('UPDATE users SET following = following + 1 WHERE id = ?').run(req.user.id);
    db.prepare('UPDATE users SET followers = followers + 1 WHERE id = ?').run(target_id);
    res.json({ success: true, message: '关注成功' });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// DELETE /api/follows/:target_id（取消关注，需要JWT）
router.delete('/:target_id', auth, (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM follows WHERE follower_id = ? AND following_id = ?').get(req.user.id, req.params.target_id);
    if (!existing) return res.status(404).json({ error: '未关注该用户' });
    db.prepare('DELETE FROM follows WHERE follower_id = ? AND following_id = ?').run(req.user.id, req.params.target_id);
    db.prepare('UPDATE users SET following = MAX(0, following - 1) WHERE id = ?').run(req.user.id);
    db.prepare('UPDATE users SET followers = MAX(0, followers - 1) WHERE id = ?').run(req.params.target_id);
    res.json({ success: true, message: '已取消关注' });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/follows/status/:target_id（检查关注状态，需要JWT）
router.get('/status/:target_id', auth, (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM follows WHERE follower_id = ? AND following_id = ?').get(req.user.id, req.params.target_id);
    res.json({ following: !!existing });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/follows/my-following — 获取当前用户关注的人列表
router.get('/my-following', auth, (req, res) => {
  try {
    const following = db.prepare(`
      SELECT u.id, u.name, u.avatar, u.level
      FROM follows f JOIN users u ON u.id = f.following_id
      WHERE f.follower_id = ? ORDER BY f.created_at DESC LIMIT 50
    `).all(req.user.id);
    res.json(following);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
