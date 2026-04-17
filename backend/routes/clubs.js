const express = require('express');
const router = express.Router();
const db = require('../db/database');
const auth = require('../middleware/auth');

// GET /api/clubs
router.get('/', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 100);
    const clubs = db.prepare(`
      SELECT id, name, description, cover, specialty, region, type,
             members_count as members, expeditions, verified, founded, status, created_at
      FROM clubs WHERE status = 'active' ORDER BY members_count DESC LIMIT ?
    `).all(limit);
    res.json(clubs);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/clubs/:id — 俱乐部详情
router.get('/:id', (req, res) => {
  try {
    const club = db.prepare(`
      SELECT id, name, description, cover, specialty, region, type,
             members_count as members, expeditions, verified, founded, status, creator_id,
             contact, wechat, website, cover_image, logo, created_at
      FROM clubs WHERE id = ?
    `).get(req.params.id);
    if (!club) return res.status(404).json({ error: '俱乐部不存在' });
    res.json(club);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/clubs/:id/activities — 俱乐部活动/套餐列表
router.get('/:id/activities', (req, res) => {
  try {
    const { type } = req.query;
    let sql = 'SELECT * FROM club_activities WHERE club_id = ? AND status != ?';
    const params = [req.params.id, 'deleted'];
    if (type) { sql += ' AND type = ?'; params.push(type); }
    sql += ' ORDER BY created_at DESC';
    const activities = db.prepare(sql).all(...params);
    res.json(activities);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/clubs/:id/members — 俱乐部成员列表
router.get('/:id/members', (req, res) => {
  try {
    const members = db.prepare(`
      SELECT cm.id, cm.user_id, cm.role, cm.joined_at,
             u.name, u.avatar, u.level
      FROM club_members cm
      JOIN users u ON u.id = cm.user_id
      WHERE cm.club_id = ?
      ORDER BY cm.joined_at ASC LIMIT 20
    `).all(req.params.id);
    res.json(members);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/clubs/:id/reviews — 俱乐部评价列表
router.get('/:id/reviews', (req, res) => {
  try {
    const reviews = db.prepare(`
      SELECT * FROM reviews WHERE target_type = 'club' AND target_id = ?
      ORDER BY created_at DESC LIMIT 30
    `).all(req.params.id);
    res.json(reviews);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/clubs/:id/review — 提交评价（需登录）
router.post('/:id/review', auth, (req, res) => {
  try {
    const club = db.prepare('SELECT * FROM clubs WHERE id = ?').get(req.params.id);
    if (!club) return res.status(404).json({ error: '俱乐部不存在' });
    const { rating, content } = req.body;
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: '评分必须在1-5之间' });
    const user = db.prepare('SELECT name, avatar FROM users WHERE id = ?').get(req.user.id);
    db.prepare(`
      INSERT INTO reviews (target_type, target_id, user_id, user_name, user_avatar, rating, content)
      VALUES ('club', ?, ?, ?, ?, ?, ?)
    `).run(req.params.id, req.user.id, user ? user.name : '', user ? user.avatar : '', rating, content || '');
    res.json({ success: true, message: '评价已提交' });
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) {
      return res.status(400).json({ error: '您已经评价过该俱乐部' });
    }
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/clubs/:id/activity — 俱乐部发布活动/套餐（需是创建者或管理员）
router.post('/:id/activity', auth, (req, res) => {
  try {
    const club = db.prepare('SELECT * FROM clubs WHERE id = ?').get(req.params.id);
    if (!club) return res.status(404).json({ error: '俱乐部不存在' });
    const member = db.prepare('SELECT role FROM club_members WHERE club_id = ? AND user_id = ?').get(req.params.id, req.user.id);
    const isCreator = club.creator_id === req.user.id;
    const isAdmin = member && (member.role === 'admin' || member.role === 'founder');
    if (!isCreator && !isAdmin) return res.status(403).json({ error: '无权发布活动，仅俱乐部创建者或管理员可操作' });
    const { title, description, cover, type, mountain, region, price, max_members, start_date, end_date, difficulty, includes } = req.body;
    if (!title) return res.status(400).json({ error: '请填写活动标题' });
    const includesStr = includes ? JSON.stringify(includes) : null;
    const result = db.prepare(`
      INSERT INTO club_activities (club_id, title, description, cover, type, mountain, region, price, max_members, start_date, end_date, difficulty, includes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.params.id, title, description || '', cover || '', type || 'activity', mountain || '', region || '', price || 0, max_members || 10, start_date || '', end_date || '', difficulty || '', includesStr);
    const activity = db.prepare('SELECT * FROM club_activities WHERE id = ?').get(result.lastInsertRowid);
    res.json(activity);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/clubs/:id/activity/:actId — 更新活动
router.put('/:id/activity/:actId', auth, (req, res) => {
  try {
    const club = db.prepare('SELECT * FROM clubs WHERE id = ?').get(req.params.id);
    if (!club) return res.status(404).json({ error: '俱乐部不存在' });
    const member = db.prepare('SELECT role FROM club_members WHERE club_id = ? AND user_id = ?').get(req.params.id, req.user.id);
    const isCreator = club.creator_id === req.user.id;
    const isAdmin = member && (member.role === 'admin' || member.role === 'founder');
    if (!isCreator && !isAdmin) return res.status(403).json({ error: '无权操作' });
    const { title, description, cover, type, mountain, region, price, max_members, start_date, end_date, difficulty, includes, status } = req.body;
    const act = db.prepare('SELECT * FROM club_activities WHERE id = ? AND club_id = ?').get(req.params.actId, req.params.id);
    if (!act) return res.status(404).json({ error: '活动不存在' });
    const includesStr = includes ? JSON.stringify(includes) : act.includes;
    db.prepare(`
      UPDATE club_activities SET title=?, description=?, cover=?, type=?, mountain=?, region=?, price=?, max_members=?, start_date=?, end_date=?, difficulty=?, includes=?, status=?
      WHERE id=?
    `).run(
      title || act.title, description !== undefined ? description : act.description,
      cover !== undefined ? cover : act.cover, type || act.type,
      mountain !== undefined ? mountain : act.mountain, region !== undefined ? region : act.region,
      price !== undefined ? price : act.price, max_members || act.max_members,
      start_date !== undefined ? start_date : act.start_date, end_date !== undefined ? end_date : act.end_date,
      difficulty !== undefined ? difficulty : act.difficulty, includesStr, status || act.status,
      req.params.actId
    );
    const updated = db.prepare('SELECT * FROM club_activities WHERE id = ?').get(req.params.actId);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// DELETE /api/clubs/:id/activity/:actId — 删除活动
router.delete('/:id/activity/:actId', auth, (req, res) => {
  try {
    const club = db.prepare('SELECT * FROM clubs WHERE id = ?').get(req.params.id);
    if (!club) return res.status(404).json({ error: '俱乐部不存在' });
    const member = db.prepare('SELECT role FROM club_members WHERE club_id = ? AND user_id = ?').get(req.params.id, req.user.id);
    const isCreator = club.creator_id === req.user.id;
    const isAdmin = member && (member.role === 'admin' || member.role === 'founder');
    if (!isCreator && !isAdmin) return res.status(403).json({ error: '无权操作' });
    const result = db.prepare("UPDATE club_activities SET status='ended' WHERE id=? AND club_id=?").run(req.params.actId, req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: '活动不存在' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/clubs（需要JWT）
router.post('/', auth, (req, res) => {
  try {
    const { name, description, cover, specialty, region, type } = req.body;
    if (!name) return res.status(400).json({ error: '请填写俱乐部名称' });
    const result = db.prepare(`
      INSERT INTO clubs (name, description, cover, specialty, region, type, creator_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(name, description || '', cover || '', specialty || '', region || '', type || '综合', req.user.id);
    db.prepare('INSERT INTO club_members (club_id, user_id, role) VALUES (?, ?, ?)').run(result.lastInsertRowid, req.user.id, 'founder');
    db.prepare('UPDATE clubs SET members_count = 1 WHERE id = ?').run(result.lastInsertRowid);
    const club = db.prepare('SELECT * FROM clubs WHERE id = ?').get(result.lastInsertRowid);
    res.json(club);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/clubs/:id — 更新俱乐部信息（需是创建者）
router.put('/:id', auth, (req, res) => {
  try {
    const club = db.prepare('SELECT * FROM clubs WHERE id = ?').get(req.params.id);
    if (!club) return res.status(404).json({ error: '俱乐部不存在' });
    const member = db.prepare('SELECT role FROM club_members WHERE club_id = ? AND user_id = ?').get(req.params.id, req.user.id);
    const isCreator = club.creator_id === req.user.id;
    const isAdmin = member && (member.role === 'admin' || member.role === 'founder');
    if (!isCreator && !isAdmin) return res.status(403).json({ error: '无权限修改俱乐部信息' });
    const { name, description, cover, specialty, region, type, contact, wechat, website, cover_image, logo } = req.body;
    db.prepare(`
      UPDATE clubs SET name=?, description=?, cover=?, specialty=?, region=?, type=?,
                       contact=?, wechat=?, website=?, cover_image=?, logo=?
      WHERE id=?
    `).run(
      name || club.name, description !== undefined ? description : club.description,
      cover !== undefined ? cover : club.cover, specialty !== undefined ? specialty : club.specialty,
      region !== undefined ? region : club.region, type || club.type,
      contact !== undefined ? contact : club.contact, wechat !== undefined ? wechat : club.wechat,
      website !== undefined ? website : club.website, cover_image !== undefined ? cover_image : club.cover_image,
      logo !== undefined ? logo : club.logo,
      req.params.id
    );
    const updated = db.prepare('SELECT * FROM clubs WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/clubs/:id/join（需要JWT）
router.post('/:id/join', auth, (req, res) => {
  try {
    const club = db.prepare('SELECT * FROM clubs WHERE id = ?').get(req.params.id);
    if (!club) return res.status(404).json({ error: '俱乐部不存在' });
    const existing = db.prepare('SELECT id FROM club_members WHERE club_id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (existing) return res.status(400).json({ error: '您已是该俱乐部成员' });
    db.prepare('INSERT INTO club_members (club_id, user_id) VALUES (?, ?)').run(req.params.id, req.user.id);
    db.prepare('UPDATE clubs SET members_count = members_count + 1 WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: '成功加入俱乐部' });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// DELETE /api/clubs/:id/join（退出俱乐部，需要JWT）
router.delete('/:id/join', auth, (req, res) => {
  try {
    const member = db.prepare('SELECT * FROM club_members WHERE club_id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!member) return res.status(404).json({ error: '您不是该俱乐部成员' });
    if (member.role === 'founder') return res.status(400).json({ error: '创始人不能退出俱乐部' });
    db.prepare('DELETE FROM club_members WHERE club_id = ? AND user_id = ?').run(req.params.id, req.user.id);
    db.prepare('UPDATE clubs SET members_count = MAX(0, members_count - 1) WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: '已退出俱乐部' });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
