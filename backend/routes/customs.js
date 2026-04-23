const express = require('express');
const router = express.Router();
const db = require('../db/database');
const auth = require('../middleware/auth');

// GET /api/customs/pool — 向导/俱乐部查看平台定制订单公共池（需登录）
router.get('/pool', auth, (req, res) => {
  try {
    const guide = db.prepare('SELECT id, name FROM guides WHERE user_id = ? AND status = ?').get(req.user.id, 'approved');
    const club = db.prepare('SELECT id, name FROM clubs WHERE creator_id = ?').get(req.user.id);
    if (!guide && !club) return res.status(403).json({ error: '只有向导或俱乐部可以查看定制池' });

    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const orders = db.prepare(`
      SELECT co.*, u.name as user_name, u.avatar as user_avatar
      FROM custom_orders co
      LEFT JOIN users u ON u.id = co.user_id
      WHERE co.receiver_type = 'platform' AND co.status = 'pending'
      ORDER BY co.created_at DESC LIMIT ? OFFSET ?
    `).all(parseInt(limit), offset);
    const total = db.prepare(
      "SELECT COUNT(*) as cnt FROM custom_orders WHERE receiver_type = 'platform' AND status = 'pending'"
    ).get().cnt;
    res.json({ orders, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/customs/:id/claim — 向导/俱乐部认领平台定制订单
router.post('/:id/claim', auth, (req, res) => {
  try {
    const order = db.prepare('SELECT * FROM custom_orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: '申请不存在' });
    if (order.receiver_type !== 'platform') return res.status(400).json({ error: '该订单不在公共池中' });
    if (order.status !== 'pending') return res.status(400).json({ error: '该订单已被认领或关闭' });

    const guide = db.prepare('SELECT id, name FROM guides WHERE user_id = ? AND status = ?').get(req.user.id, 'approved');
    const club = db.prepare('SELECT id, name FROM clubs WHERE creator_id = ?').get(req.user.id);
    if (!guide && !club) return res.status(403).json({ error: '只有向导或俱乐部可以认领定制订单' });

    const rType = guide ? 'guide' : 'club';
    const rId = guide ? guide.id : club.id;
    const rName = guide ? guide.name : club.name;
    db.prepare('UPDATE custom_orders SET receiver_type = ?, receiver_id = ?, receiver_name = ? WHERE id = ?')
      .run(rType, rId, rName, req.params.id);

    // 通知客户
    db.prepare(`INSERT INTO notifications (user_id, type, content, related_id) VALUES (?, 'custom_claimed', ?, ?)`)
      .run(order.user_id, `${rName} 接受了您关于 [${order.peak_name}] 的定制申请，请查看消息`, order.id);

    const updated = db.prepare('SELECT * FROM custom_orders WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/customs/admin/all — 管理员查看所有定制申请（需要JWT + is_admin）
router.get('/admin/all', auth, (req, res) => {
  try {
    const user = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(req.user.id);
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
    const orders = db.prepare(sql).all(...params);
    res.json(orders);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/customs — 提交定制攀登申请（需登录）
router.post('/', auth, (req, res) => {
  try {
    const { peak_name, preferred_date, group_size, notes, contact_phone, receiver_type, receiver_id } = req.body;
    if (!peak_name || !contact_phone) {
      return res.status(400).json({ error: '山峰名称和联系电话不能为空' });
    }
    const rType = receiver_type || 'platform';
    let rId = receiver_id || null;
    let rName = '平台客服';
    if (rType === 'guide' && rId) {
      const guide = db.prepare('SELECT name FROM guides WHERE id = ?').get(rId);
      if (!guide) return res.status(400).json({ error: '向导不存在' });
      rName = guide.name;
    } else if (rType === 'club' && rId) {
      const club = db.prepare('SELECT name FROM clubs WHERE id = ?').get(rId);
      if (!club) return res.status(400).json({ error: '俱乐部不存在' });
      rName = club.name;
    } else {
      rId = null;
    }
    const result = db.prepare(`
      INSERT INTO custom_orders (user_id, peak_name, preferred_date, group_size, notes, contact_phone, receiver_type, receiver_id, receiver_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.user.id, peak_name, preferred_date || null, group_size || 1, notes || null, contact_phone,
           rType, rId, rName);
    const order = db.prepare('SELECT * FROM custom_orders WHERE id = ?').get(result.lastInsertRowid);
    res.json(order);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/customs — 获取当前用户的定制申请列表（需登录）
router.get('/', auth, (req, res) => {
  try {
    const orders = db.prepare(`
      SELECT * FROM custom_orders WHERE user_id = ? ORDER BY created_at DESC
    `).all(req.user.id);
    res.json(orders);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/customs/:id — 获取定制申请详情（需登录）
router.get('/:id', auth, (req, res) => {
  try {
    const order = db.prepare(`
      SELECT * FROM custom_orders WHERE id = ? AND user_id = ?
    `).get(req.params.id, req.user.id);
    if (!order) return res.status(404).json({ error: '申请不存在' });
    res.json(order);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/customs/:id/cancel — 取消定制申请（需登录）
router.put('/:id/cancel', auth, (req, res) => {
  try {
    const order = db.prepare(`
      SELECT * FROM custom_orders WHERE id = ? AND user_id = ?
    `).get(req.params.id, req.user.id);
    if (!order) return res.status(404).json({ error: '申请不存在' });
    if (order.status === 'cancelled') {
      return res.status(400).json({ error: '申请已取消' });
    }
    db.prepare(`UPDATE custom_orders SET status = 'cancelled' WHERE id = ?`).run(req.params.id);
    res.json({ success: true, message: '申请已取消' });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
