const express = require('express');
const router = express.Router();
const db = require('../db/database');
const auth = require('../middleware/auth');

// GET /api/guides
router.get('/', (req, res) => {
  try {
    const guides = db.prepare(`
      SELECT id, name, avatar, flag, nationality, rating, reviews,
             specialty, day_rate as dayRate
      FROM guides WHERE status = 'approved'
      ORDER BY rating DESC
    `).all();
    res.json(guides);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/guides/my/profile — 已登录向导查看自己的主页数据
router.get('/my/profile', auth, (req, res) => {
  try {
    const guide = db.prepare('SELECT * FROM guides WHERE user_id = ?').get(req.user.id);
    if (!guide) return res.status(404).json({ error: '您尚未成为向导' });
    if (guide.peaks_led) {
      try { guide.peaks_led = JSON.parse(guide.peaks_led); } catch(e) { guide.peaks_led = []; }
    } else {
      guide.peaks_led = [];
    }
    res.json(guide);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/guides/my/profile — 已登录向导更新主页
router.put('/my/profile', auth, (req, res) => {
  try {
    const guide = db.prepare('SELECT * FROM guides WHERE user_id = ?').get(req.user.id);
    if (!guide) return res.status(404).json({ error: '您尚未成为向导' });
    const { bio, peaks_led, cover_image, wechat, experience_years } = req.body;
    const peaksLedStr = peaks_led ? JSON.stringify(peaks_led) : guide.peaks_led;
    db.prepare(`
      UPDATE guides SET bio=?, peaks_led=?, cover_image=?, wechat=?, experience_years=?
      WHERE user_id=?
    `).run(
      bio !== undefined ? bio : guide.bio,
      peaksLedStr,
      cover_image !== undefined ? cover_image : guide.cover_image,
      wechat !== undefined ? wechat : guide.wechat,
      experience_years !== undefined ? experience_years : guide.experience_years,
      req.user.id
    );
    const updated = db.prepare('SELECT * FROM guides WHERE user_id = ?').get(req.user.id);
    if (updated.peaks_led) {
      try { updated.peaks_led = JSON.parse(updated.peaks_led); } catch(e) { updated.peaks_led = []; }
    } else {
      updated.peaks_led = [];
    }
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/guides/me — 查看自己的申请/向导状态（需要JWT）
// 注意：此路由必须在 /:id 之前注册，防止 'me' 被当作 id
router.get('/me', auth, (req, res) => {
  try {
    const guide = db.prepare('SELECT * FROM guides WHERE user_id = ?').get(req.user.id);
    if (!guide) {
      const app = db.prepare('SELECT * FROM guide_applications WHERE user_id = ? ORDER BY id DESC LIMIT 1').get(req.user.id);
      if (!app) return res.json({ status: 'none' });
      return res.json(app);
    }
    if (guide.peaks_led) {
      try { guide.peaks_led = JSON.parse(guide.peaks_led); } catch(e) { guide.peaks_led = []; }
    } else { guide.peaks_led = []; }
    res.json(guide);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/guides/me — 更新自己的资料（仅 pending 状态可改）
// 注意：此路由必须在 /:id 之前注册
router.put('/me', auth, (req, res) => {
  try {
    const guide = db.prepare('SELECT * FROM guides WHERE user_id = ?').get(req.user.id);
    if (!guide) return res.status(404).json({ error: '您尚未提交向导申请' });
    if (guide.status !== 'pending') {
      return res.status(400).json({ error: '只有待审核状态才能修改资料' });
    }
    const { bio, peaks_led, cover_image, wechat, experience_years, real_name, certifications, specialties } = req.body;
    const peaksLedStr = peaks_led ? JSON.stringify(peaks_led) : guide.peaks_led;
    const certsStr = certifications ? JSON.stringify(certifications) : guide.certifications;
    db.prepare(`
      UPDATE guides SET
        bio = COALESCE(?, bio),
        peaks_led = COALESCE(?, peaks_led),
        cover_image = COALESCE(?, cover_image),
        wechat = COALESCE(?, wechat),
        experience_years = COALESCE(?, experience_years),
        real_name = COALESCE(?, real_name),
        certifications = COALESCE(?, certifications),
        specialties = COALESCE(?, specialties)
      WHERE user_id = ?
    `).run(bio || null, peaksLedStr, cover_image || null, wechat || null,
           experience_years || null, real_name || null, certsStr, specialties || null,
           req.user.id);
    const updated = db.prepare('SELECT * FROM guides WHERE user_id = ?').get(req.user.id);
    if (updated.peaks_led) {
      try { updated.peaks_led = JSON.parse(updated.peaks_led); } catch(e) { updated.peaks_led = []; }
    } else { updated.peaks_led = []; }
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/guides/:id — 向导详情
router.get('/:id', (req, res) => {
  try {
    const guide = db.prepare('SELECT * FROM guides WHERE id = ? AND status = ?').get(req.params.id, 'approved');
    if (!guide) return res.status(404).json({ error: '向导不存在' });
    if (guide.peaks_led) {
      try { guide.peaks_led = JSON.parse(guide.peaks_led); } catch(e) { guide.peaks_led = []; }
    } else {
      guide.peaks_led = [];
    }
    res.json(guide);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/guides/:id/expeditions — 向导带队记录列表
router.get('/:id/expeditions', (req, res) => {
  try {
    const expeditions = db.prepare(`
      SELECT * FROM guide_expeditions WHERE guide_id = ?
      ORDER BY date DESC LIMIT 20
    `).all(req.params.id);
    res.json(expeditions);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/guides/:id/reviews — 向导评价列表
router.get('/:id/reviews', (req, res) => {
  try {
    const reviews = db.prepare(`
      SELECT * FROM reviews WHERE target_type = 'guide' AND target_id = ?
      ORDER BY created_at DESC LIMIT 30
    `).all(req.params.id);
    res.json(reviews);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/guides/:id/review — 提交评价（需登录）
router.post('/:id/review', auth, (req, res) => {
  try {
    const guide = db.prepare('SELECT * FROM guides WHERE id = ?').get(req.params.id);
    if (!guide) return res.status(404).json({ error: '向导不存在' });
    const { rating, content } = req.body;
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: '评分必须在1-5之间' });
    const user = db.prepare('SELECT name, avatar FROM users WHERE id = ?').get(req.user.id);
    db.prepare(`
      INSERT INTO reviews (target_type, target_id, user_id, user_name, user_avatar, rating, content)
      VALUES ('guide', ?, ?, ?, ?, ?, ?)
    `).run(req.params.id, req.user.id, user ? user.name : '', user ? user.avatar : '', rating, content || '');
    // 更新向导评分（取所有评价的平均分）
    const avgResult = db.prepare(`
      SELECT AVG(rating) as avg_rating, COUNT(*) as cnt
      FROM reviews WHERE target_type = 'guide' AND target_id = ?
    `).get(req.params.id);
    if (avgResult) {
      db.prepare('UPDATE guides SET rating = ?, reviews = ? WHERE id = ?')
        .run(Math.round(avgResult.avg_rating * 10) / 10, avgResult.cnt, req.params.id);
    }
    res.json({ success: true, message: '评价已提交' });
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) {
      return res.status(400).json({ error: '您已经评价过该向导' });
    }
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/guides/apply（需要JWT）
router.post('/apply', auth, (req, res) => {
  try {
    const { name, cert, specialty, languages, dayRate, region } = req.body;
    if (!name) return res.status(400).json({ error: '姓名不能为空' });
    // 检查是否已有申请
    const existing = db.prepare("SELECT id, status FROM guide_applications WHERE user_id = ?").get(req.user.id);
    if (existing && existing.status === 'pending') {
      return res.status(400).json({ error: '您已有待审核的申请，请等待审核结果' });
    }
    // 插入申请记录
    db.prepare(`
      INSERT INTO guide_applications (user_id, name, cert, specialty, languages, day_rate, region)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(req.user.id, name, cert, specialty, languages, dayRate, region);
    // 同时插入或更新向导表（待审核）
    const existingGuide = db.prepare('SELECT id FROM guides WHERE user_id = ?').get(req.user.id);
    if (!existingGuide) {
      db.prepare(`
        INSERT INTO guides (user_id, name, cert, specialty, languages, day_rate, region, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
      `).run(req.user.id, name, cert, specialty, languages, dayRate, region);
    } else {
      db.prepare("UPDATE guides SET status = 'pending', name=?, cert=?, specialty=?, languages=?, day_rate=?, region=? WHERE user_id=?")
        .run(name, cert, specialty, languages, dayRate, region, req.user.id);
    }
    res.json({ success: true, message: '申请已提交，7天内审核完成' });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/guides/:id/posts — 向导动态帖子
router.get('/:id/posts', (req, res) => {
  try {
    const posts = db.prepare(`
      SELECT * FROM guide_posts WHERE guide_id = ? ORDER BY created_at DESC LIMIT 20
    `).all(req.params.id);
    if (posts.length === 0) {
      return res.json([
        { id: 1, guide_id: req.params.id, author_name: '向导', author_avatar: 'https://i.pravatar.cc/150?u=guide_post1', content: '🏔️ 今天成功带队登顶！天气绝佳，能见度极好，可以清晰看到周边群峰。感谢队员们的信任和配合！', image: 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=400', location: '高山营地', likes: 98, created_at: new Date(Date.now() - 86400000).toISOString() },
        { id: 2, guide_id: req.params.id, author_name: '向导', author_avatar: 'https://i.pravatar.cc/150?u=guide_post2', content: '分享一些高海拔适应技巧：爬高睡低是黄金法则，充足的水分补充非常重要。有问题欢迎留言！', image: null, location: null, likes: 156, created_at: new Date(Date.now() - 259200000).toISOString() },
        { id: 3, guide_id: req.params.id, author_name: '向导', author_avatar: 'https://i.pravatar.cc/150?u=guide_post3', content: '新一期攀登培训班开始报名！适合有基础的攀登爱好者，涵盖冰雪技术、绳索操作等核心技能。', image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400', location: '培训基地', likes: 74, created_at: new Date(Date.now() - 432000000).toISOString() },
      ]);
    }
    res.json(posts);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/guides/:id/photos — 向导相册
router.get('/:id/photos', (req, res) => {
  try {
    const photos = db.prepare(`
      SELECT * FROM guide_photos WHERE guide_id = ? ORDER BY created_at DESC LIMIT 30
    `).all(req.params.id);
    if (photos.length === 0) {
      return res.json([
        { id: 1, guide_id: req.params.id, url: 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=400', caption: '珠峰登顶' },
        { id: 2, guide_id: req.params.id, url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400', caption: 'K2 攀登途中' },
        { id: 3, guide_id: req.params.id, url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400', caption: '阿尔卑斯攀登' },
        { id: 4, guide_id: req.params.id, url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=400', caption: '高山营地风光' },
        { id: 5, guide_id: req.params.id, url: 'https://images.unsplash.com/photo-1521336575822-6da63fb45455?w=400', caption: '冰川穿越' },
        { id: 6, guide_id: req.params.id, url: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=400', caption: '队员登顶庆祝' },
      ]);
    }
    res.json(photos);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/guides/payment — 向导入驻支付（预留，后续完善）
// TODO: 接入真实支付系统（支付宝/微信支付）
router.post('/payment', auth, (req, res) => {
  try {
    const { guide_application_id, amount, payment_method } = req.body;
    if (!guide_application_id || !amount) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    // TODO: 调用支付接口，生成订单
    const mockOrderId = 'GUIDE_PAY_' + Date.now() + '_' + req.user.id;
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

module.exports = router;
