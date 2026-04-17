const express = require('express');
const router = express.Router();
const db = require('../db/database');
const auth = require('../middleware/auth');

// GET /api/users/:id/achievements — 用户成就
router.get('/:id/achievements', (req, res) => {
  try {
    const achievements = db.prepare(`
      SELECT * FROM user_achievements WHERE user_id = ? ORDER BY earned_at DESC
    `).all(req.params.id);
    if (achievements.length === 0) {
      // 返回默认成就
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
router.get('/:id/membership', (req, res) => {
  try {
    const user = db.prepare(`
      SELECT id, name, level, summits, expeditions, followers, following, created_at
      FROM users WHERE id = ?
    `).get(req.params.id);
    if (!user) return res.status(404).json({ error: '用户不存在' });

    // 根据登顶数计算积分与等级
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
router.get('/:id/summits', (req, res) => {
  try {
    const summits = db.prepare(`
      SELECT id, peak_name, altitude, date, notes, image, created_at
      FROM user_summits WHERE user_id = ? ORDER BY date DESC
    `).all(req.params.id);
    res.json(summits);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/users/summits — 新增登顶记录
router.post('/summits', auth, (req, res) => {
  try {
    const { peak_name, altitude, date, notes, image } = req.body;
    if (!peak_name) return res.status(400).json({ error: '山峰名称不能为空' });
    const result = db.prepare(`
      INSERT INTO user_summits (user_id, peak_name, altitude, date, notes, image)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(req.user.id, peak_name, altitude || 0, date || '', notes || '', image || '');
    // 更新 users.summits 计数
    db.prepare('UPDATE users SET summits = (SELECT COUNT(*) FROM user_summits WHERE user_id = ?) WHERE id = ?')
      .run(req.user.id, req.user.id);
    const summit = db.prepare('SELECT * FROM user_summits WHERE id = ?').get(result.lastInsertRowid);
    res.json(summit);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/users/:id/expeditions — 用户远征记录
router.get('/:id/expeditions', (req, res) => {
  try {
    const expeditions = db.prepare(`
      SELECT id, name, description, date, image, created_at
      FROM user_expeditions WHERE user_id = ? ORDER BY date DESC
    `).all(req.params.id);
    res.json(expeditions);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/users/expeditions — 新增远征记录
router.post('/expeditions', auth, (req, res) => {
  try {
    const { name, description, date, image } = req.body;
    if (!name) return res.status(400).json({ error: '远征名称不能为空' });
    const result = db.prepare(`
      INSERT INTO user_expeditions (user_id, name, description, date, image)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.user.id, name, description || '', date || '', image || '');
    db.prepare('UPDATE users SET expeditions = (SELECT COUNT(*) FROM user_expeditions WHERE user_id = ?) WHERE id = ?')
      .run(req.user.id, req.user.id);
    const exp = db.prepare('SELECT * FROM user_expeditions WHERE id = ?').get(result.lastInsertRowid);
    res.json(exp);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/users/:id/followers — 粉丝列表
router.get('/:id/followers', (req, res) => {
  try {
    const followers = db.prepare(`
      SELECT u.id, u.name, u.avatar, u.level
      FROM follows f JOIN users u ON u.id = f.follower_id
      WHERE f.following_id = ? ORDER BY f.created_at DESC
    `).all(req.params.id);
    res.json(followers);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/users/:id/following — 关注列表
router.get('/:id/following', (req, res) => {
  try {
    const following = db.prepare(`
      SELECT u.id, u.name, u.avatar, u.level
      FROM follows f JOIN users u ON u.id = f.following_id
      WHERE f.follower_id = ? ORDER BY f.created_at DESC
    `).all(req.params.id);
    res.json(following);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/users/follow — 关注用户
router.post('/follow', auth, (req, res) => {
  try {
    const { followee_id } = req.body;
    if (!followee_id) return res.status(400).json({ error: '关注目标不能为空' });
    if (followee_id === req.user.id) return res.status(400).json({ error: '不能关注自己' });
    db.prepare('INSERT OR IGNORE INTO follows (follower_id, following_id) VALUES (?, ?)').run(req.user.id, followee_id);
    // 更新计数
    db.prepare('UPDATE users SET following = (SELECT COUNT(*) FROM follows WHERE follower_id = ?) WHERE id = ?').run(req.user.id, req.user.id);
    db.prepare('UPDATE users SET followers = (SELECT COUNT(*) FROM follows WHERE following_id = ?) WHERE id = ?').run(followee_id, followee_id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// DELETE /api/users/follow — 取消关注
router.delete('/follow', auth, (req, res) => {
  try {
    const { followee_id } = req.body;
    db.prepare('DELETE FROM follows WHERE follower_id = ? AND following_id = ?').run(req.user.id, followee_id);
    db.prepare('UPDATE users SET following = (SELECT COUNT(*) FROM follows WHERE follower_id = ?) WHERE id = ?').run(req.user.id, req.user.id);
    db.prepare('UPDATE users SET followers = (SELECT COUNT(*) FROM follows WHERE following_id = ?) WHERE id = ?').run(followee_id, followee_id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
