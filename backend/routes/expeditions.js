/**
 * @file expeditions.js
 * @description 商业攀登（远征）路由 — A7 模块
 *
 * 接口概览：
 *   POST   /api/expeditions                         已审核通过向导/俱乐部发布远征
 *   GET    /api/expeditions                         查询远征列表
 *   GET    /api/expeditions/:id                     远征详情
 *   PUT    /api/expeditions/:id                     发布者修改（仅 pending 可改）
 *   POST   /api/expeditions/:id/order               用户下单
 *   GET    /api/expeditions/orders/my               我的订单
 *   POST   /api/expeditions/orders/:id/mock-pay     内测：模拟支付推进到 paid 状态
 *                                                  TODO: 替换为真实支付（B2 阶段）
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const db = require('../db/database');
const auth = require('../middleware/auth');

// 下单限流：每分钟最多20次，防止刷单
const orderLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: '操作过于频繁，请稍后再试' },
});

// ── 工具函数 ────────────────────────────────────────────────────

/**
 * 检查当前用户是否为已审核通过的向导或俱乐部，并返回 publisher 信息。
 * @returns {{ type: 'guide'|'club', id: number } | null}
 */
function getPublisher(userId) {
  const guide = db.prepare("SELECT id FROM guides WHERE user_id = ? AND status = 'approved'").get(userId);
  if (guide) return { type: 'guide', id: guide.id };
  const club = db.prepare("SELECT id FROM clubs WHERE creator_id = ? AND verified = 1 AND status = 'active'").get(userId);
  if (club) return { type: 'club', id: club.id };
  return null;
}

// ── 订单相关路由（放在 /:id 之前，防止 'orders' 被当作 id 解析）────

// GET /api/expeditions/orders/my — 我的订单
router.get('/orders/my', auth, (req, res) => {
  try {
    const orders = db.prepare(`
      SELECT eo.*, e.title as expedition_title, e.cover_image, e.start_date, e.end_date
      FROM expedition_orders eo
      LEFT JOIN expeditions e ON e.id = eo.expedition_id
      WHERE eo.user_id = ?
      ORDER BY eo.created_at DESC
    `).all(req.user.id);
    res.json(orders);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/expeditions/orders/:id/mock-pay — 模拟支付（内测）
// TODO: 替换为真实支付（B2 阶段）
router.post('/orders/:id/mock-pay', auth, (req, res) => {
  try {
    const order = db.prepare('SELECT * FROM expedition_orders WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);
    if (!order) return res.status(404).json({ error: '订单不存在' });
    if (order.status !== 'pending_payment') {
      return res.status(400).json({ error: `订单状态为 ${order.status}，无法支付` });
    }
    const now = new Date().toISOString();
    db.prepare("UPDATE expedition_orders SET status = 'paid', paid_at = ? WHERE id = ?")
      .run(now, order.id);
    // 通知发布者（简单起见，写入 notifications）
    try {
      const expedition = db.prepare('SELECT publisher_type, publisher_id, title FROM expeditions WHERE id = ?')
        .get(order.expedition_id);
      if (expedition) {
        let notifyUserId = null;
        if (expedition.publisher_type === 'guide') {
          const g = db.prepare('SELECT user_id FROM guides WHERE id = ?').get(expedition.publisher_id);
          if (g) notifyUserId = g.user_id;
        } else if (expedition.publisher_type === 'club') {
          const c = db.prepare('SELECT creator_id FROM clubs WHERE id = ?').get(expedition.publisher_id);
          if (c) notifyUserId = c.creator_id;
        }
        if (notifyUserId) {
          db.prepare("INSERT INTO notifications (user_id, type, content, related_id) VALUES (?, 'order_paid', ?, ?)")
            .run(notifyUserId, `【新订单】${expedition.title} 已付款，订单号：${order.order_no}`, order.id);
        }
      }
    } catch (e) { /* 通知失败不影响主流程 */ }
    res.json({ success: true, status: 'paid', order_no: order.order_no });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// ── 主路由 ──────────────────────────────────────────────────────

// POST /api/expeditions — 已审核通过的向导/俱乐部发布商业攀登
router.post('/', auth, (req, res) => {
  try {
    const publisher = getPublisher(req.user.id);
    if (!publisher) {
      return res.status(403).json({ error: '只有已审核通过的向导或俱乐部才能发布商业攀登' });
    }
    const {
      peak_id, title, cover_image, gallery, route_name, difficulty,
      start_date, end_date, total_days, min_participants, max_participants,
      meeting_point, itinerary, included_services, excluded_services,
      base_price, currency, addons, early_bird_price, early_bird_deadline,
      group_discount, payment_stages, cancel_policy,
    } = req.body;
    if (!title || !base_price) return res.status(400).json({ error: '标题和基础价格不能为空' });
    // 获取该向导/俱乐部的 commission_rate
    let commission_rate = 0.15;
    if (publisher.type === 'guide') {
      const g = db.prepare('SELECT commission_rate FROM guides WHERE id = ?').get(publisher.id);
      if (g && g.commission_rate != null) commission_rate = g.commission_rate;
    } else {
      const c = db.prepare('SELECT commission_rate FROM clubs WHERE id = ?').get(publisher.id);
      if (c && c.commission_rate != null) commission_rate = c.commission_rate;
    }
    const now = new Date().toISOString();
    const result = db.prepare(`
      INSERT INTO expeditions (
        publisher_type, publisher_id, peak_id, title, cover_image, gallery,
        route_name, difficulty, start_date, end_date, total_days,
        min_participants, max_participants, meeting_point, itinerary,
        included_services, excluded_services, base_price, currency, addons,
        early_bird_price, early_bird_deadline, group_discount, payment_stages,
        cancel_policy, commission_rate, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `).run(
      publisher.type, publisher.id, peak_id || null, title,
      cover_image || null, gallery ? JSON.stringify(gallery) : null,
      route_name || null, difficulty || null,
      start_date || null, end_date || null, total_days || 0,
      min_participants || 1, max_participants || 10,
      meeting_point || null,
      itinerary ? JSON.stringify(itinerary) : null,
      included_services ? JSON.stringify(included_services) : null,
      excluded_services ? JSON.stringify(excluded_services) : null,
      base_price, currency || 'CNY',
      addons ? JSON.stringify(addons) : null,
      early_bird_price || null, early_bird_deadline || null,
      group_discount ? JSON.stringify(group_discount) : null,
      payment_stages ? JSON.stringify(payment_stages) : null,
      cancel_policy || null, commission_rate, now, now
    );
    const expedition = db.prepare('SELECT * FROM expeditions WHERE id = ?').get(result.lastInsertRowid);
    res.json(expedition);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/expeditions — 远征列表
router.get('/', (req, res) => {
  try {
    const { category, peak_id, publisher_type, status = 'published', page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where = [];
    const params = [];
    if (status) { where.push('e.status = ?'); params.push(status); }
    if (peak_id) { where.push('e.peak_id = ?'); params.push(parseInt(peak_id)); }
    if (publisher_type) { where.push('e.publisher_type = ?'); params.push(publisher_type); }
    const whereStr = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const expeditions = db.prepare(`
      SELECT e.*, p.name as peak_name
      FROM expeditions e
      LEFT JOIN peaks p ON p.id = e.peak_id
      ${whereStr}
      ORDER BY e.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), offset);
    const total = db.prepare(`SELECT COUNT(*) as c FROM expeditions e ${whereStr}`).get(...params).c;
    res.json({ expeditions, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/expeditions/:id — 远征详情
router.get('/:id', (req, res) => {
  try {
    const expedition = db.prepare(`
      SELECT e.*, p.name as peak_name, p.latitude, p.longitude
      FROM expeditions e
      LEFT JOIN peaks p ON p.id = e.peak_id
      WHERE e.id = ?
    `).get(req.params.id);
    if (!expedition) return res.status(404).json({ error: '远征不存在' });
    // 解析 JSON 字段
    ['gallery', 'itinerary', 'included_services', 'excluded_services', 'addons', 'group_discount', 'payment_stages'].forEach(field => {
      if (expedition[field]) {
        try { expedition[field] = JSON.parse(expedition[field]); } catch (e) {}
      }
    });
    res.json(expedition);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/expeditions/:id — 发布者修改（仅 pending 状态可改）
router.put('/:id', auth, (req, res) => {
  try {
    const expedition = db.prepare('SELECT * FROM expeditions WHERE id = ?').get(req.params.id);
    if (!expedition) return res.status(404).json({ error: '远征不存在' });
    const publisher = getPublisher(req.user.id);
    if (!publisher || publisher.type !== expedition.publisher_type || publisher.id !== expedition.publisher_id) {
      return res.status(403).json({ error: '无权修改该远征' });
    }
    if (expedition.status !== 'pending') {
      return res.status(400).json({ error: '只有待审核状态的远征才能修改' });
    }
    const { title, cover_image, base_price, difficulty, start_date, end_date } = req.body;
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE expeditions SET
        title = COALESCE(?, title),
        cover_image = COALESCE(?, cover_image),
        base_price = COALESCE(?, base_price),
        difficulty = COALESCE(?, difficulty),
        start_date = COALESCE(?, start_date),
        end_date = COALESCE(?, end_date),
        updated_at = ?
      WHERE id = ?
    `).run(title || null, cover_image || null, base_price || null, difficulty || null,
           start_date || null, end_date || null, now, expedition.id);
    const updated = db.prepare('SELECT * FROM expeditions WHERE id = ?').get(expedition.id);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/expeditions/:id/order — 用户下单
router.post('/:id/order', orderLimiter, auth, (req, res) => {
  try {
    const expedition = db.prepare("SELECT * FROM expeditions WHERE id = ? AND status = 'published'")
      .get(req.params.id);
    if (!expedition) return res.status(404).json({ error: '远征不存在或暂未开放报名' });
    const { participants = 1, selected_addons, contact_name, contact_phone, emergency_contact, emergency_phone, notes } = req.body;
    // 计算价格
    let subtotal = expedition.base_price * participants;
    let discount = 0;
    // 团队折扣
    if (expedition.group_discount) {
      try {
        const gd = typeof expedition.group_discount === 'string' ? JSON.parse(expedition.group_discount) : expedition.group_discount;
        if (participants >= (gd.min || 3)) {
          discount = subtotal * (1 - (gd.rate || 0.95));
        }
      } catch (e) {}
    }
    const total = subtotal - discount;
    const platform_fee = total * (expedition.commission_rate || 0.15);
    const publisher_income = total - platform_fee;
    const order_no = 'EX' + Date.now() + crypto.randomBytes(3).toString('hex').toUpperCase();
    const now = new Date().toISOString();
    const result = db.prepare(`
      INSERT INTO expedition_orders (
        order_no, expedition_id, user_id, participants, selected_addons,
        subtotal, discount, total, platform_fee, publisher_income,
        status, contact_name, contact_phone, emergency_contact, emergency_phone, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_payment', ?, ?, ?, ?, ?, ?)
    `).run(
      order_no, expedition.id, req.user.id, participants,
      selected_addons ? JSON.stringify(selected_addons) : null,
      subtotal, discount, total, platform_fee, publisher_income,
      contact_name || null, contact_phone || null,
      emergency_contact || null, emergency_phone || null, notes || null, now
    );
    const order = db.prepare('SELECT * FROM expedition_orders WHERE id = ?').get(result.lastInsertRowid);
    res.json(order);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
