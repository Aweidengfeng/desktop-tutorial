const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const auth = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

const poolReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: '请求过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
});

const claimLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: '操作过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
});

// GET /api/customs/pool — 向导/俱乐部查看平台定制订单公共池（需登录）
router.get('/pool', poolReadLimiter, auth, async (req, res) => {
  try {
    const guide = (await prisma.$queryRaw`SELECT id, name FROM guides WHERE user_id = ${req.user.id} AND status = 'approved'`)[0];
    const club = (await prisma.$queryRaw`SELECT id, name FROM clubs WHERE creator_id = ${req.user.id}`)[0];
    if (!guide && !club) return res.status(403).json({ error: '只有向导或俱乐部可以查看定制池' });

    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const lim = parseInt(limit);
    const orders = await prisma.$queryRaw`
      SELECT co.*, u.name as user_name, u.avatar as user_avatar
      FROM custom_orders co
      LEFT JOIN users u ON u.id = co.user_id
      WHERE co.receiver_type = 'platform' AND co.status = 'pending'
      ORDER BY co.created_at DESC LIMIT ${lim} OFFSET ${offset}
    `;
    const totalRow = (await prisma.$queryRaw`SELECT COUNT(*) as cnt FROM custom_orders WHERE receiver_type = 'platform' AND status = 'pending'`)[0];
    const total = Number(totalRow.cnt);
    res.json({ orders, total, page: parseInt(page), limit: lim });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/customs/:id/claim — 向导/俱乐部认领平台定制订单
router.post('/:id/claim', claimLimiter, auth, async (req, res) => {
  try {
    const order = (await prisma.$queryRaw`SELECT * FROM custom_orders WHERE id = ${Number(req.params.id)}`)[0];
    if (!order) return res.status(404).json({ error: '申请不存在' });
    if (order.receiver_type !== 'platform') return res.status(400).json({ error: '该订单不在公共池中' });
    if (order.status !== 'pending') return res.status(400).json({ error: '该订单已被认领或关闭' });

    const guide = (await prisma.$queryRaw`SELECT id, name FROM guides WHERE user_id = ${req.user.id} AND status = 'approved'`)[0];
    const club = (await prisma.$queryRaw`SELECT id, name FROM clubs WHERE creator_id = ${req.user.id}`)[0];
    if (!guide && !club) return res.status(403).json({ error: '只有向导或俱乐部可以认领定制订单' });

    const rType = guide ? 'guide' : 'club';
    const rId = guide ? guide.id : club.id;
    const rName = guide ? guide.name : club.name;
    await prisma.$executeRaw`UPDATE custom_orders SET receiver_type = ${rType}, receiver_id = ${rId}, receiver_name = ${rName} WHERE id = ${Number(req.params.id)}`;

    // 通知客户
    await prisma.$executeRaw`INSERT INTO notifications (user_id, type, content, related_id) VALUES (${order.user_id}, 'custom_claimed', ${`${rName} 接受了您关于 [${order.peak_name}] 的定制申请，请查看消息`}, ${order.id})`;

    const updated = (await prisma.$queryRaw`SELECT * FROM custom_orders WHERE id = ${Number(req.params.id)}`)[0];
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/customs/admin/all — 管理员查看所有定制申请（需要JWT + is_admin）
router.get('/admin/all', auth, async (req, res) => {
  try {
    const user = (await prisma.$queryRaw`SELECT is_admin FROM users WHERE id = ${req.user.id}`)[0];
    if (!user || !user.is_admin) return res.status(403).json({ error: '无权限' });
    const { receiver_type, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let sql = `
      SELECT co.*, u.name as user_name, u.avatar as user_avatar
      FROM custom_orders co
      LEFT JOIN users u ON u.id = co.user_id
    `;
    const params = [];
    if (receiver_type) {
      sql += ' WHERE co.receiver_type = ?';
      params.push(receiver_type);
    }
    sql += ' ORDER BY co.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);
    const orders = await prisma.$queryRawUnsafe(sql, ...params);
    res.json(orders);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/customs — 提交定制攀登申请（需登录）
router.post('/', auth, async (req, res) => {
  try {
    const { peak_name, preferred_date, group_size, notes, contact_phone, receiver_type, receiver_id } = req.body;
    if (!peak_name || !contact_phone) {
      return res.status(400).json({ error: '山峰名称和联系电话不能为空' });
    }
    const rType = receiver_type || 'platform';
    let rId = receiver_id || null;
    let rName = '平台客服';
    if (rType === 'guide' && rId) {
      const guide = (await prisma.$queryRaw`SELECT name FROM guides WHERE id = ${Number(rId)}`)[0];
      if (!guide) return res.status(400).json({ error: '向导不存在' });
      rName = guide.name;
    } else if (rType === 'club' && rId) {
      const club = (await prisma.$queryRaw`SELECT name FROM clubs WHERE id = ${Number(rId)}`)[0];
      if (!club) return res.status(400).json({ error: '俱乐部不存在' });
      rName = club.name;
    } else {
      rId = null;
    }
    const inserted = await prisma.$queryRaw`
      INSERT INTO custom_orders (user_id, peak_name, preferred_date, group_size, notes, contact_phone, receiver_type, receiver_id, receiver_name)
      VALUES (${req.user.id}, ${peak_name}, ${preferred_date || null}, ${group_size || 1}, ${notes || null}, ${contact_phone},
              ${rType}, ${rId}, ${rName})
      RETURNING id
    `;
    const order = (await prisma.$queryRaw`SELECT * FROM custom_orders WHERE id = ${inserted[0].id}`)[0];
    res.json(order);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/customs — 获取当前用户的定制申请列表（需登录）
router.get('/', auth, async (req, res) => {
  try {
    const orders = await prisma.$queryRaw`
      SELECT * FROM custom_orders WHERE user_id = ${req.user.id} ORDER BY created_at DESC
    `;
    res.json(orders);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/customs/:id — 获取定制申请详情（需登录）
router.get('/:id', auth, async (req, res) => {
  try {
    const order = (await prisma.$queryRaw`
      SELECT * FROM custom_orders WHERE id = ${Number(req.params.id)} AND user_id = ${req.user.id}
    `)[0];
    if (!order) return res.status(404).json({ error: '申请不存在' });
    res.json(order);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/customs/:id/cancel — 取消定制申请（需登录）
router.put('/:id/cancel', auth, async (req, res) => {
  try {
    const order = (await prisma.$queryRaw`
      SELECT * FROM custom_orders WHERE id = ${Number(req.params.id)} AND user_id = ${req.user.id}
    `)[0];
    if (!order) return res.status(404).json({ error: '申请不存在' });
    if (order.status === 'cancelled') {
      return res.status(400).json({ error: '申请已取消' });
    }
    await prisma.$executeRaw`UPDATE custom_orders SET status = 'cancelled' WHERE id = ${Number(req.params.id)}`;
    res.json({ success: true, message: '申请已取消' });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
