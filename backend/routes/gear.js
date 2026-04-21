const express = require('express');
const router = express.Router();
const db = require('../db/database');
const auth = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

const gearReadLimiter = rateLimit({ windowMs: 60 * 1000, max: 100 });
const gearWriteLimiter = rateLimit({ windowMs: 60 * 1000, max: 20 });

// GET /api/gear?mode=buy&category=全部
router.get('/', gearReadLimiter, (req, res) => {
  try {
    const { mode, category } = req.query;
    let sql = `
      SELECT g.id, g.name, g.brand, g.price, g.condition_text as condition,
             g.image, g.description, g.mode, g.category, g.seller_id,
             u.name as seller, u.avatar as sellerAvatar
      FROM gear g
      LEFT JOIN users u ON u.id = g.seller_id
      WHERE 1=1
    `;
    const params = [];
    if (mode && mode !== 'all') { sql += ' AND g.mode = ?'; params.push(mode); }
    if (category && category !== '全部') { sql += ' AND g.category = ?'; params.push(category); }
    sql += ' ORDER BY g.created_at DESC';
    res.json(db.prepare(sql).all(...params));
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/gear/orders/mine — 查看我的装备订单（需要JWT）
// 注意：此路由必须在 /:id 之前
router.get('/orders/mine', gearReadLimiter, auth, (req, res) => {
  try {
    const orders = db.prepare(`
      SELECT go.*, g.image as gear_image, g.name as gear_name_db, g.brand
      FROM gear_orders go
      LEFT JOIN gear g ON g.id = go.gear_id
      WHERE go.buyer_id = ?
      ORDER BY go.created_at DESC
    `).all(req.user.id);
    res.json(orders);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/gear/:id — 单件装备详情
router.get('/:id', gearReadLimiter, (req, res) => {
  try {
    const item = db.prepare(`
      SELECT g.id, g.name, g.brand, g.price, g.condition_text as condition,
             g.image, g.description, g.mode, g.category, g.seller_id,
             u.name as seller, u.avatar as sellerAvatar
      FROM gear g
      LEFT JOIN users u ON u.id = g.seller_id
      WHERE g.id = ?
    `).get(req.params.id);
    if (!item) return res.status(404).json({ error: '商品不存在' });
    res.json(item);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/gear（需要JWT）
router.post('/', gearWriteLimiter, auth, (req, res) => {
  try {
    const { name, brand, price, condition, image, description, mode, category } = req.body;
    const result = db.prepare(`
      INSERT INTO gear (seller_id, name, brand, price, condition_text, image, description, mode, category)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.user.id, name, brand, price, condition, image || '', description || '', mode || 'buy', category || '');
    const item = db.prepare(`
      SELECT id, name, brand, price, condition_text as condition,
             image, description, mode, category FROM gear WHERE id = ?
    `).get(result.lastInsertRowid);
    res.json(item);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/gear/:id/order — 购买装备，创建装备订单（需要JWT）
router.post('/:id/order', gearWriteLimiter, auth, (req, res) => {
  try {
    const item = db.prepare('SELECT * FROM gear WHERE id = ?').get(req.params.id);
    if (!item) return res.status(404).json({ error: '商品不存在' });
    const { address, receiver_name, receiver_phone, notes } = req.body;
    const orderNo = 'GR' + Date.now() + Math.floor(Math.random() * 1000);
    const result = db.prepare(`
      INSERT INTO gear_orders (order_no, gear_id, gear_name, buyer_id, seller_id, amount, address, receiver_name, receiver_phone, notes, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid')
    `).run(orderNo, item.id, item.name, req.user.id, item.seller_id || null, item.price, address || null, receiver_name || null, receiver_phone || null, notes || null);
    // 通知卖家（若有）
    if (item.seller_id) {
      try {
        db.prepare("INSERT INTO notifications (user_id, type, title, body, link) VALUES (?, 'gear_order', ?, ?, ?)")
          .run(item.seller_id, '装备订单通知', `您的装备 ${item.name} 已被购买，订单号 ${orderNo}`, '/summitlink?page=orders');
      } catch(e) {}
    }
    const order = db.prepare('SELECT * FROM gear_orders WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, order, orderNo });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/gear/orders/:orderId/ship — 卖家填写发货信息（需要JWT）
router.post('/orders/:orderId/ship', gearWriteLimiter, auth, (req, res) => {
  try {
    const order = db.prepare('SELECT * FROM gear_orders WHERE id = ?').get(req.params.orderId);
    if (!order) return res.status(404).json({ error: '订单不存在' });
    if (order.seller_id !== req.user.id) return res.status(403).json({ error: '无权操作此订单' });
    const { shipping_carrier, tracking_number } = req.body;
    if (!tracking_number) return res.status(400).json({ error: '请填写快递单号' });
    db.prepare(`
      UPDATE gear_orders SET shipping_carrier=?, tracking_number=?, shipping_status='shipped', shipped_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(shipping_carrier || '顺丰', tracking_number, order.id);
    // 通知买家
    try {
      db.prepare("INSERT INTO notifications (user_id, type, title, body, link) VALUES (?, 'gear_shipped', ?, ?, ?)")
        .run(order.buyer_id, '装备已发货', `您购买的 ${order.gear_name} 已发货，快递单号：${tracking_number}（${shipping_carrier || '顺丰'}）`, '/summitlink?page=orders');
    } catch(e) {}
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/gear/orders/:orderId/confirm — 买家确认收货（需要JWT）
router.post('/orders/:orderId/confirm', gearWriteLimiter, auth, (req, res) => {
  try {
    const order = db.prepare('SELECT * FROM gear_orders WHERE id = ?').get(req.params.orderId);
    if (!order) return res.status(404).json({ error: '订单不存在' });
    if (order.buyer_id !== req.user.id) return res.status(403).json({ error: '无权操作此订单' });
    if (order.shipping_status !== 'shipped') return res.status(400).json({ error: '订单尚未发货' });
    db.prepare(`
      UPDATE gear_orders SET shipping_status='delivered', status='completed', delivered_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(order.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
