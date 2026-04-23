const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const auth = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

const usersReadLimiter = rateLimit({
  windowMs: 60 * 1000, max: 60,
  message: { error: '请求过于频繁' }, standardHeaders: true, legacyHeaders: false,
});
const usersWriteLimiter = rateLimit({
  windowMs: 60 * 1000, max: 20,
  message: { error: '操作过于频繁' }, standardHeaders: true, legacyHeaders: false,
});

// GET /api/users/:id/achievements — 用户成就
router.get('/:id/achievements', usersReadLimiter, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const achievements = await prisma.$queryRaw`
      SELECT * FROM user_achievements WHERE user_id = ${userId} ORDER BY earned_at DESC
    `;
    if (achievements.length === 0) {
      return res.json([
        { id: 1, name: '初次登顶', description: '完成人生第一次登顶', icon: '🏔️', earned_at: null },
        { id: 2, name: '探索者', description: '加入SummitLink平台', icon: '🧭', earned_at: new Date().toISOString() },
      ]);
    }
    res.json(achievements);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/users/:id/membership — 会员信息
router.get('/:id/membership', usersReadLimiter, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const [user] = await prisma.$queryRaw`
      SELECT id, name, level, summits, expeditions, followers, following, created_at
      FROM users WHERE id = ${userId}
    `;
    if (!user) return res.status(404).json({ error: '用户不存在' });

    const points = (user.summits || 0) * 200 + (user.expeditions || 0) * 100;
    let memberLevel = '探索者';
    let memberColor = '#6b7280';
    let benefits = ['基础功能', '社区动态'];
    if (points >= 10000) {
      memberLevel = '传奇攀登者'; memberColor = '#f59e0b';
      benefits = ['全功能解锁', '专属客服', '优先预约', '折扣权益', '专属徽章'];
    } else if (points >= 5000) {
      memberLevel = '专家攀登者'; memberColor = '#8b5cf6';
      benefits = ['全功能解锁', '优先预约', '部分折扣', '专属徽章'];
    } else if (points >= 2000) {
      memberLevel = '中级攀登者'; memberColor = '#3b82f6';
      benefits = ['大部分功能', '社区优先', '装备折扣'];
    } else if (points >= 500) {
      memberLevel = '初级攀登者'; memberColor = '#10b981';
      benefits = ['基础功能', '社区动态', '攻略阅读'];
    }

    res.json({
      user_id: user.id,
      member_level: memberLevel,
      member_color: memberColor,
      points,
      benefits,
      summits: user.summits || 0,
      expeditions: user.expeditions || 0,
      followers: user.followers || 0,
      following: user.following || 0,
      since: user.created_at,
    });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/users/:id/summits — 用户登顶记录
router.get('/:id/summits', usersReadLimiter, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const summits = await prisma.$queryRaw`
      SELECT id, peak_name, altitude, date, notes, image, created_at
      FROM user_summits WHERE user_id = ${userId} ORDER BY date DESC
    `;
    res.json(summits);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/users/summits — 新增登顶记录
router.post('/summits', usersWriteLimiter, auth, async (req, res) => {
  try {
    const { peak_name, altitude, date, notes, image } = req.body;
    if (!peak_name) return res.status(400).json({ error: '山峰名称不能为空' });
    await prisma.$executeRaw`
      INSERT INTO user_summits (user_id, peak_name, altitude, date, notes, image)
      VALUES (${req.user.id}, ${peak_name}, ${altitude || 0}, ${date || ''}, ${notes || ''}, ${image || ''})
    `;
    // 更新 users.summits 计数
    const [{ cnt }] = await prisma.$queryRaw`SELECT COUNT(*) as cnt FROM user_summits WHERE user_id = ${req.user.id}`;
    await prisma.$executeRaw`UPDATE users SET summits = ${Number(cnt)} WHERE id = ${req.user.id}`;
    const [summit] = await prisma.$queryRaw`
      SELECT * FROM user_summits WHERE user_id = ${req.user.id} ORDER BY id DESC LIMIT 1
    `;
    res.json(summit);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/users/:id/expeditions — 用户远征记录
router.get('/:id/expeditions', usersReadLimiter, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const expeditions = await prisma.$queryRaw`
      SELECT id, name, description, date, image, created_at
      FROM user_expeditions WHERE user_id = ${userId} ORDER BY date DESC
    `;
    res.json(expeditions);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/users/expeditions — 新增远征记录
router.post('/expeditions', usersWriteLimiter, auth, async (req, res) => {
  try {
    const { name, description, date, image } = req.body;
    if (!name) return res.status(400).json({ error: '远征名称不能为空' });
    await prisma.$executeRaw`
      INSERT INTO user_expeditions (user_id, name, description, date, image)
      VALUES (${req.user.id}, ${name}, ${description || ''}, ${date || ''}, ${image || ''})
    `;
    const [{ cnt }] = await prisma.$queryRaw`SELECT COUNT(*) as cnt FROM user_expeditions WHERE user_id = ${req.user.id}`;
    await prisma.$executeRaw`UPDATE users SET expeditions = ${Number(cnt)} WHERE id = ${req.user.id}`;
    const [exp] = await prisma.$queryRaw`
      SELECT * FROM user_expeditions WHERE user_id = ${req.user.id} ORDER BY id DESC LIMIT 1
    `;
    res.json(exp);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/users/:id/followers — 粉丝列表
router.get('/:id/followers', usersReadLimiter, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const followers = await prisma.$queryRaw`
      SELECT u.id, u.name, u.avatar, u.level
      FROM follows f JOIN users u ON u.id = f.follower_id
      WHERE f.following_id = ${userId} ORDER BY f.created_at DESC
    `;
    res.json(followers);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/users/:id/following — 关注列表
router.get('/:id/following', usersReadLimiter, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const following = await prisma.$queryRaw`
      SELECT u.id, u.name, u.avatar, u.level
      FROM follows f JOIN users u ON u.id = f.following_id
      WHERE f.follower_id = ${userId} ORDER BY f.created_at DESC
    `;
    res.json(following);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/users/follow — 关注用户
router.post('/follow', usersWriteLimiter, auth, async (req, res) => {
  try {
    const followee_id = parseInt(req.body.followee_id);
    if (!followee_id) return res.status(400).json({ error: '关注目标不能为空' });
    if (followee_id === req.user.id) return res.status(400).json({ error: '不能关注自己' });
    await prisma.$executeRaw`INSERT OR IGNORE INTO follows (follower_id, following_id) VALUES (${req.user.id}, ${followee_id})`;
    const [{ cnt: followingCnt }] = await prisma.$queryRaw`SELECT COUNT(*) as cnt FROM follows WHERE follower_id = ${req.user.id}`;
    const [{ cnt: followersCnt }] = await prisma.$queryRaw`SELECT COUNT(*) as cnt FROM follows WHERE following_id = ${followee_id}`;
    await prisma.$executeRaw`UPDATE users SET following = ${Number(followingCnt)} WHERE id = ${req.user.id}`;
    await prisma.$executeRaw`UPDATE users SET followers = ${Number(followersCnt)} WHERE id = ${followee_id}`;
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// DELETE /api/users/follow — 取消关注
router.delete('/follow', usersWriteLimiter, auth, async (req, res) => {
  try {
    const followee_id = parseInt(req.body.followee_id);
    await prisma.$executeRaw`DELETE FROM follows WHERE follower_id = ${req.user.id} AND following_id = ${followee_id}`;
    const [{ cnt: followingCnt }] = await prisma.$queryRaw`SELECT COUNT(*) as cnt FROM follows WHERE follower_id = ${req.user.id}`;
    const [{ cnt: followersCnt }] = await prisma.$queryRaw`SELECT COUNT(*) as cnt FROM follows WHERE following_id = ${followee_id}`;
    await prisma.$executeRaw`UPDATE users SET following = ${Number(followingCnt)} WHERE id = ${req.user.id}`;
    await prisma.$executeRaw`UPDATE users SET followers = ${Number(followersCnt)} WHERE id = ${followee_id}`;
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/users/:id — 获取用户基本资料（公开）
router.get('/:id', usersReadLimiter, async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const [user] = await prisma.$queryRaw`
      SELECT id, name, username, avatar, bio, level, summits, expeditions, followers, following, created_at FROM users WHERE id = ${userId}
    `;
    if (!user) return res.status(404).json({ error: '用户不存在' });
    let is_following = false;
    const authHeader = req.headers['authorization'];
    if (authHeader) {
      try {
        const jwt = require('jsonwebtoken');
        const token = authHeader.split(' ')[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
        const [followRow] = await prisma.$queryRaw`SELECT 1 as v FROM follows WHERE follower_id = ${payload.id} AND following_id = ${userId}`;
        is_following = !!followRow;
      } catch(e) {}
    }
    res.json({ ...user, is_following });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/users/:id/posts — 获取用户发布的动态
router.get('/:id/posts', usersReadLimiter, async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const offset = (page - 1) * limit;
    const posts = await prisma.$queryRaw`
      SELECT * FROM posts WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
    `;
    res.json(posts);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;

