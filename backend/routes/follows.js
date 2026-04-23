const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const auth = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

const followsWriteLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false, message: { error: '操作过于频繁' } });
const followsReadLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false, message: { error: '请求过于频繁' } });

// POST /api/follows（关注用户，需要JWT）
router.post('/', followsWriteLimiter, auth, async (req, res) => {
  try {
    const target_id = parseInt(req.body.target_id);
    if (!target_id) return res.status(400).json({ error: '请提供目标用户ID' });
    if (target_id === req.user.id) return res.status(400).json({ error: '不能关注自己' });
    const [target] = await prisma.$queryRaw`SELECT id FROM users WHERE id = ${target_id}`;
    if (!target) return res.status(404).json({ error: '用户不存在' });
    const [existing] = await prisma.$queryRaw`
      SELECT id FROM follows WHERE follower_id = ${req.user.id} AND following_id = ${target_id}
    `;
    if (existing) return res.status(400).json({ error: '已关注该用户' });
    await prisma.$executeRaw`INSERT INTO follows (follower_id, following_id) VALUES (${req.user.id}, ${target_id})`;
    await prisma.$executeRaw`UPDATE users SET following = following + 1 WHERE id = ${req.user.id}`;
    await prisma.$executeRaw`UPDATE users SET followers = followers + 1 WHERE id = ${target_id}`;
    res.json({ success: true, message: '关注成功' });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// DELETE /api/follows/:target_id（取消关注，需要JWT）
router.delete('/:target_id', followsWriteLimiter, auth, async (req, res) => {
  try {
    const target_id = parseInt(req.params.target_id);
    const [existing] = await prisma.$queryRaw`
      SELECT id FROM follows WHERE follower_id = ${req.user.id} AND following_id = ${target_id}
    `;
    if (!existing) return res.status(404).json({ error: '未关注该用户' });
    await prisma.$executeRaw`DELETE FROM follows WHERE follower_id = ${req.user.id} AND following_id = ${target_id}`;
    await prisma.$executeRaw`UPDATE users SET following = MAX(0, following - 1) WHERE id = ${req.user.id}`;
    await prisma.$executeRaw`UPDATE users SET followers = MAX(0, followers - 1) WHERE id = ${target_id}`;
    res.json({ success: true, message: '已取消关注' });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/follows/status/:target_id（检查关注状态，需要JWT）
router.get('/status/:target_id', followsReadLimiter, auth, async (req, res) => {
  try {
    const target_id = parseInt(req.params.target_id);
    const [existing] = await prisma.$queryRaw`
      SELECT id FROM follows WHERE follower_id = ${req.user.id} AND following_id = ${target_id}
    `;
    res.json({ following: !!existing });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/follows/my-following — 获取当前用户关注的人列表
router.get('/my-following', followsReadLimiter, auth, async (req, res) => {
  try {
    const following = await prisma.$queryRaw`
      SELECT u.id, u.name, u.avatar, u.level
      FROM follows f JOIN users u ON u.id = f.following_id
      WHERE f.follower_id = ${req.user.id} ORDER BY f.created_at DESC LIMIT 50
    `;
    res.json(following);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
