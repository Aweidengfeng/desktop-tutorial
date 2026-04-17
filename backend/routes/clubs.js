const express = require('express');
const router = express.Router();
const db = require('../db/database');
const auth = require('../middleware/auth');

// POST /api/clubs/apply — 提交俱乐部入驻申请（需要JWT）
router.post('/apply', auth, (req, res) => {
  try {
    const { club_name, description, specialty, region, type, contact, wechat, website, cert_url } = req.body;
    if (!club_name || !contact) return res.status(400).json({ error: '俱乐部名称和联系方式不能为空' });
    const existing = db.prepare("SELECT id FROM club_applications WHERE user_id = ? AND status = 'pending'").get(req.user.id);
    if (existing) return res.status(400).json({ error: '您已有待审核的申请，请等待审核结果' });
    const result = db.prepare(`
      INSERT INTO club_applications (user_id, club_name, description, specialty, region, type, contact, wechat, website, cert_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.user.id, club_name, description || null, specialty || null, region || null,
           type || '综合', contact, wechat || null, website || null, cert_url || null);
    const application = db.prepare('SELECT * FROM club_applications WHERE id = ?').get(result.lastInsertRowid);
    res.json(application);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/clubs/apply/status — 查询当前用户申请状态（需要JWT）
router.get('/apply/status', auth, (req, res) => {
  try {
    const application = db.prepare(`
      SELECT * FROM club_applications WHERE user_id = ? ORDER BY created_at DESC LIMIT 1
    `).get(req.user.id);
    if (!application) return res.json({ status: 'none' });
    res.json(application);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/clubs/featured — 精选俱乐部（首页展示，最多6个认证且活跃的俱乐部）
// 注意：此路由必须在 /:id 之前注册
router.get('/featured', (req, res) => {
  try {
    const clubs = db.prepare(`
      SELECT id, name, description, cover, specialty, region, type,
             members_count as members, expeditions, verified, founded, status, created_at
      FROM clubs
      WHERE status = 'active'
      ORDER BY verified DESC, members_count DESC
      LIMIT 6
    `).all();
    if (clubs.length < 3) {
      const mockClubs = [
        { id: 'm1', name: '中国高山协会', description: '专注于中国高山探险和技术攀登的专业协会', cover: 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=400', specialty: '8000米峰', members: 1280, expeditions: 45, verified: 1, type: '专业' },
        { id: 'm2', name: '阿尔派探险俱乐部', description: '综合性俱乐部，提供从初级到专业的培训和远征服务', cover: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400', specialty: '技术攀登', members: 560, expeditions: 28, verified: 1, type: '综合' },
        { id: 'm3', name: '北京户外探险队', description: '以休闲户外和中低海拔攀登为主，适合初学者', cover: 'https://images.unsplash.com/photo-1521336575822-6da63fb45455?w=400', specialty: '中低海拔', members: 890, expeditions: 120, verified: 1, type: '休闲' },
        { id: 'm4', name: '喜马拉雅探险队', description: '专业的喜马拉雅远征组织，曾多次带队登顶8000米峰', cover: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400', specialty: '喜马拉雅', members: 320, expeditions: 18, verified: 1, type: '专业' },
        { id: 'm5', name: '成都山地俱乐部', description: '专注于川西高原和横断山脉攀登的本地俱乐部', cover: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=400', specialty: '川西高原', members: 450, expeditions: 67, verified: 0, type: '区域' },
        { id: 'm6', name: '丝路登山协会', description: '西北地区攀登爱好者的聚集地，专注昆仑山、天山攀登', cover: 'https://images.unsplash.com/photo-1522163182402-834f871fd851?w=400', specialty: '昆仑/天山', members: 230, expeditions: 35, verified: 0, type: '区域' },
      ];
      return res.json(mockClubs.slice(0, 6));
    }
    res.json(clubs);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

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

// GET /api/clubs/:id/members/:userId — 俱乐部成员详情（需要JWT）
router.get('/:id/members/:userId', auth, (req, res) => {
  try {
    const member = db.prepare(`
      SELECT cm.id, cm.club_id, cm.user_id, cm.role, cm.joined_at,
             u.name, u.avatar, u.level
      FROM club_members cm
      JOIN users u ON u.id = cm.user_id
      WHERE cm.club_id = ? AND cm.user_id = ?
    `).get(req.params.id, req.params.userId);
    if (!member) return res.status(404).json({ error: '成员不存在' });
    const climbCount = db.prepare('SELECT COUNT(*) as cnt FROM tracks WHERE user_id = ?').get(req.params.userId);
    res.json({ ...member, climb_count: climbCount ? climbCount.cnt : 0 });
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

// GET /api/clubs/:id/posts — 俱乐部动态帖子
router.get('/:id/posts', (req, res) => {
  try {
    const posts = db.prepare(`
      SELECT * FROM club_posts WHERE club_id = ? ORDER BY created_at DESC LIMIT 20
    `).all(req.params.id);
    if (posts.length === 0) {
      return res.json([
        { id: 1, club_id: req.params.id, author_name: '俱乐部管理员', author_avatar: 'https://i.pravatar.cc/150?u=club_admin', content: '🏔️ 本次远征圆满结束！感谢所有队员的努力与配合，期待下次一起出发！', image: 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=400', location: '珠穆朗玛峰大本营', likes: 128, created_at: new Date(Date.now() - 86400000).toISOString() },
        { id: 2, club_id: req.params.id, author_name: '队长张磊', author_avatar: 'https://i.pravatar.cc/150?u=guide1', content: '新一季攀登计划已发布！名额有限，感兴趣的小伙伴抓紧报名～', image: null, location: null, likes: 56, created_at: new Date(Date.now() - 172800000).toISOString() },
        { id: 3, club_id: req.params.id, author_name: '向导扎西', author_avatar: 'https://i.pravatar.cc/150?u=guide2', content: '分享一些攀登技巧：高海拔适应期不宜操之过急，循序渐进才是关键 🧗', image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400', location: '加德满都', likes: 89, created_at: new Date(Date.now() - 259200000).toISOString() },
      ]);
    }
    res.json(posts);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/clubs/:id/photos — 俱乐部图片相册
router.get('/:id/photos', (req, res) => {
  try {
    const photos = db.prepare(`
      SELECT * FROM club_photos WHERE club_id = ? ORDER BY created_at DESC LIMIT 30
    `).all(req.params.id);
    if (photos.length === 0) {
      return res.json([
        { id: 1, club_id: req.params.id, url: 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=400', caption: '珠峰大本营' },
        { id: 2, club_id: req.params.id, url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400', caption: 'K2 远征途中' },
        { id: 3, club_id: req.params.id, url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400', caption: '队员合影' },
        { id: 4, club_id: req.params.id, url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=400', caption: '山顶日落' },
        { id: 5, club_id: req.params.id, url: 'https://images.unsplash.com/photo-1521336575822-6da63fb45455?w=400', caption: '冰川营地' },
        { id: 6, club_id: req.params.id, url: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=400', caption: '高山攀登' },
      ]);
    }
    res.json(photos);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/clubs/:id/guides — 俱乐部旗下向导列表
router.get('/:id/guides', (req, res) => {
  try {
    const guides = db.prepare(`
      SELECT g.id, g.name, g.avatar, g.flag, g.nationality, g.rating, g.reviews,
             g.specialty, g.day_rate as dayRate, g.affiliation_type as affiliationType,
             g.affiliation_club_id as affiliationClubId, g.experience_years as experienceYears
      FROM guides g
      WHERE g.affiliation_club_id = ? AND g.status = 'approved'
      ORDER BY g.rating DESC
    `).all(req.params.id);
    res.json(guides);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/clubs/payment — 俱乐部入驻支付（预留，后续完善）
// TODO: 接入真实支付系统（支付宝/微信支付）
router.post('/payment', auth, (req, res) => {
  try {
    const { club_application_id, amount, payment_method } = req.body;
    if (!club_application_id || !amount) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    // TODO: 调用支付接口，生成订单
    const mockOrderId = 'CLUB_PAY_' + Date.now() + '_' + req.user.id;
    res.json({
      success: true,
      order_id: mockOrderId,
      amount,
      payment_method: payment_method || 'alipay',
      status: 'pending',
      message: '支付订单已创建，请完成支付',
      // TODO: 返回支付跳转 URL / 二维码
      pay_url: null,
    });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/clubs/:id/guides — 俱乐部下的向导列表
router.get('/:id/guides', (req, res) => {
  try {
    const guides = db.prepare(`
      SELECT id, name, avatar, flag, nationality, rating, reviews,
             specialty, day_rate as dayRate, cert, experience_years,
             total_expeditions, bio, peaks_led
      FROM guides
      WHERE (affiliation_club_id = ? OR user_id IN (
        SELECT user_id FROM club_members WHERE club_id = ?
      )) AND status = 'approved'
      ORDER BY rating DESC
    `).all(req.params.id, req.params.id);
    res.json(guides);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/clubs/:id — 更新俱乐部信息（创建者或管理员）
router.put('/:id', auth, (req, res) => {
  try {
    const club = db.prepare('SELECT * FROM clubs WHERE id = ?').get(req.params.id);
    if (!club) return res.status(404).json({ error: '俱乐部不存在' });
    const adminUser = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(req.user.id);
    if (club.creator_id !== req.user.id && !(adminUser && adminUser.is_admin)) {
      return res.status(403).json({ error: '无权操作' });
    }
    const { name, description, cover, specialty, region, type, contact, wechat, website, logo, intro, price_list, rating, verified } = req.body;
    db.prepare(`
      UPDATE clubs SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        cover = COALESCE(?, cover),
        specialty = COALESCE(?, specialty),
        region = COALESCE(?, region),
        type = COALESCE(?, type),
        contact = COALESCE(?, contact),
        wechat = COALESCE(?, wechat),
        website = COALESCE(?, website),
        logo = COALESCE(?, logo),
        intro = COALESCE(?, intro),
        price_list = COALESCE(?, price_list),
        rating = COALESCE(?, rating),
        verified = COALESCE(?, verified)
      WHERE id = ?
    `).run(name || null, description || null, cover || null,
           specialty || null, region || null, type || null,
           contact || null, wechat || null, website || null,
           logo || null, intro || null,
           price_list ? (typeof price_list === 'string' ? price_list : JSON.stringify(price_list)) : null,
           rating || null, verified !== undefined ? (verified ? 1 : 0) : null,
           req.params.id);
    const updated = db.prepare('SELECT * FROM clubs WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// DELETE /api/clubs/:id — 删除俱乐部（管理员）
router.delete('/:id', auth, (req, res) => {
  try {
    const adminUser = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(req.user.id);
    if (!adminUser || !adminUser.is_admin) return res.status(403).json({ error: '无权操作' });
    db.prepare("UPDATE clubs SET status = 'deleted' WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/clubs — 管理员创建俱乐部
router.post('/', auth, (req, res) => {
  try {
    const adminUser = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(req.user.id);
    if (!adminUser || !adminUser.is_admin) return res.status(403).json({ error: '无权操作' });
    const { name, description, cover, specialty, region, type, contact, wechat, website, logo } = req.body;
    if (!name) return res.status(400).json({ error: '俱乐部名称不能为空' });
    const result = db.prepare(`
      INSERT INTO clubs (name, description, cover, specialty, region, type, contact, wechat, website, logo, creator_id, verified)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(name, description || '', cover || '', specialty || '', region || '', type || '综合',
           contact || '', wechat || '', website || '', logo || '', req.user.id);
    const club = db.prepare('SELECT * FROM clubs WHERE id = ?').get(result.lastInsertRowid);
    res.json(club);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
