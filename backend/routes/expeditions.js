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
const prisma = require('../db/prisma');
const auth = require('../middleware/auth');
const devOnly = require('../middleware/devOnly');

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
async function getPublisher(userId) {
  const [guide] = await prisma.$queryRaw`SELECT id FROM guides WHERE user_id = ${userId} AND status = 'approved'`;
  if (guide) return { type: 'guide', id: guide.id };
  const [club] = await prisma.$queryRaw`SELECT id FROM clubs WHERE creator_id = ${userId} AND verified = 1 AND status = 'active'`;
  if (club) return { type: 'club', id: club.id };
  return null;
}

// ── 订单相关路由（放在 /:id 之前，防止 'orders' 被当作 id 解析）────

// GET /api/expeditions/orders/my — 我的订单
router.get('/orders/my', auth, async (req, res) => {
  try {
    const orders = await prisma.$queryRaw`
      SELECT eo.*, e.title as expedition_title, e.cover_image, e.start_date, e.end_date
      FROM expedition_orders eo
      LEFT JOIN expeditions e ON e.id = eo.expedition_id
      WHERE eo.user_id = ${req.user.id}
      ORDER BY eo.created_at DESC
    `;
    res.json(orders);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/expeditions/orders/:id/mock-pay — 模拟支付（内测，生产环境已禁用）
// TODO: B2 阶段替换为真实支付（支付宝/Stripe）
router.post('/orders/:id/mock-pay', devOnly, auth, async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    const [order] = await prisma.$queryRaw`SELECT * FROM expedition_orders WHERE id = ${orderId} AND user_id = ${req.user.id}`;
    if (!order) return res.status(404).json({ error: '订单不存在' });
    if (order.status !== 'pending_payment') {
      return res.status(400).json({ error: `订单状态为 ${order.status}，无法支付` });
    }
    const now = new Date().toISOString();
    await prisma.$executeRaw`UPDATE expedition_orders SET status = 'paid', paid_at = ${now} WHERE id = ${order.id}`;
    // 通知发布者（简单起见，写入 notifications）
    try {
      const [expedition] = await prisma.$queryRaw`SELECT publisher_type, publisher_id, title FROM expeditions WHERE id = ${order.expedition_id}`;
      if (expedition) {
        let notifyUserId = null;
        if (expedition.publisher_type === 'guide') {
          const [g] = await prisma.$queryRaw`SELECT user_id FROM guides WHERE id = ${expedition.publisher_id}`;
          if (g) notifyUserId = g.user_id;
        } else if (expedition.publisher_type === 'club') {
          const [c] = await prisma.$queryRaw`SELECT creator_id FROM clubs WHERE id = ${expedition.publisher_id}`;
          if (c) notifyUserId = c.creator_id;
        }
        if (notifyUserId) {
          await prisma.$executeRaw`INSERT INTO notifications (user_id, type, content, related_id) VALUES (${notifyUserId}, 'order_paid', ${`【新订单】${expedition.title} 已付款，订单号：${order.order_no}`}, ${order.id})`;
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
router.post('/', auth, async (req, res) => {
  try {
    const publisher = await getPublisher(req.user.id);
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
      const [g] = await prisma.$queryRaw`SELECT commission_rate FROM guides WHERE id = ${publisher.id}`;
      if (g && g.commission_rate != null) commission_rate = g.commission_rate;
    } else {
      const [c] = await prisma.$queryRaw`SELECT commission_rate FROM clubs WHERE id = ${publisher.id}`;
      if (c && c.commission_rate != null) commission_rate = c.commission_rate;
    }
    const now = new Date().toISOString();
    const peakId = peak_id || null;
    const galleryStr = gallery ? JSON.stringify(gallery) : null;
    const itineraryStr = itinerary ? JSON.stringify(itinerary) : null;
    const includedStr = included_services ? JSON.stringify(included_services) : null;
    const excludedStr = excluded_services ? JSON.stringify(excluded_services) : null;
    const addonsStr = addons ? JSON.stringify(addons) : null;
    const gdStr = group_discount ? JSON.stringify(group_discount) : null;
    const psStr = payment_stages ? JSON.stringify(payment_stages) : null;
    const [{ id: newExpeditionId }] = await prisma.$queryRaw`
      INSERT INTO expeditions (
        publisher_type, publisher_id, peak_id, title, cover_image, gallery,
        route_name, difficulty, start_date, end_date, total_days,
        min_participants, max_participants, meeting_point, itinerary,
        included_services, excluded_services, base_price, currency, addons,
        early_bird_price, early_bird_deadline, group_discount, payment_stages,
        cancel_policy, commission_rate, status, created_at, updated_at
      ) VALUES (${publisher.type}, ${publisher.id}, ${peakId}, ${title},
        ${cover_image || null}, ${galleryStr},
        ${route_name || null}, ${difficulty || null},
        ${start_date || null}, ${end_date || null}, ${total_days || 0},
        ${min_participants || 1}, ${max_participants || 10},
        ${meeting_point || null}, ${itineraryStr}, ${includedStr}, ${excludedStr},
        ${base_price}, ${currency || 'CNY'}, ${addonsStr},
        ${early_bird_price || null}, ${early_bird_deadline || null},
        ${gdStr}, ${psStr}, ${cancel_policy || null}, ${commission_rate}, 'pending', ${now}, ${now})
      RETURNING id
    `;
    const [expedition] = await prisma.$queryRaw`SELECT * FROM expeditions WHERE id = ${newExpeditionId}`;
    res.json(expedition);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/expeditions — 远征列表
router.get('/', async (req, res) => {
  try {
    const { category, peak_id, publisher_type, status = 'published', page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where = [];
    const params = [];
    if (status) { where.push('e.status = ?'); params.push(status); }
    if (peak_id) { where.push('e.peak_id = ?'); params.push(parseInt(peak_id)); }
    if (publisher_type) { where.push('e.publisher_type = ?'); params.push(publisher_type); }
    const whereStr = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const expeditions = await prisma.$queryRawUnsafe(`
      SELECT e.*, p.name as peak_name
      FROM expeditions e
      LEFT JOIN peaks p ON p.id = e.peak_id
      ${whereStr}
      ORDER BY e.created_at DESC
      LIMIT ? OFFSET ?
    `, ...params, parseInt(limit), offset);
    const [totalRow] = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as c FROM expeditions e ${whereStr}`, ...params);
    const total = Number(totalRow.c);
    res.json({ expeditions, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/expeditions/:id — 远征详情
router.get('/:id', async (req, res) => {
  try {
    const expId = parseInt(req.params.id);
    const [expedition] = await prisma.$queryRaw`
      SELECT e.*, p.name as peak_name, p.latitude, p.longitude
      FROM expeditions e
      LEFT JOIN peaks p ON p.id = e.peak_id
      WHERE e.id = ${expId}
    `;
    if (!expedition) return res.status(404).json({ error: '远征不存在' });
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
router.put('/:id', auth, async (req, res) => {
  try {
    const expId = parseInt(req.params.id);
    const [expedition] = await prisma.$queryRaw`SELECT * FROM expeditions WHERE id = ${expId}`;
    if (!expedition) return res.status(404).json({ error: '远征不存在' });
    const publisher = await getPublisher(req.user.id);
    if (!publisher || publisher.type !== expedition.publisher_type || publisher.id !== expedition.publisher_id) {
      return res.status(403).json({ error: '无权修改该远征' });
    }
    if (expedition.status !== 'pending') {
      return res.status(400).json({ error: '只有待审核状态的远征才能修改' });
    }
    const { title, cover_image, base_price, difficulty, start_date, end_date } = req.body;
    const now = new Date().toISOString();
    await prisma.$executeRaw`
      UPDATE expeditions SET
        title = COALESCE(${title || null}, title),
        cover_image = COALESCE(${cover_image || null}, cover_image),
        base_price = COALESCE(${base_price || null}, base_price),
        difficulty = COALESCE(${difficulty || null}, difficulty),
        start_date = COALESCE(${start_date || null}, start_date),
        end_date = COALESCE(${end_date || null}, end_date),
        updated_at = ${now}
      WHERE id = ${expedition.id}
    `;
    const [updated] = await prisma.$queryRaw`SELECT * FROM expeditions WHERE id = ${expedition.id}`;
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/expeditions/:id/order — 用户下单
router.post('/:id/order', orderLimiter, auth, async (req, res) => {
  try {
    const expId = parseInt(req.params.id);
    const { participants = 1, selected_addons, contact_name, contact_phone, emergency_contact, emergency_phone, notes } = req.body;
    const participantCount = parseInt(participants) || 1;

    const order = await prisma.$transaction(async (tx) => {
      // 1. 加行锁查询团期（防止并发超额）
      const [expedition] = await tx.$queryRaw`
        SELECT id, title, base_price, commission_rate, max_participants, current_participants,
               group_discount, status
        FROM expeditions WHERE id = ${expId} FOR UPDATE
      `;
      if (!expedition) throw { status: 404, message: '远征不存在或暂未开放报名' };
      if (expedition.status !== 'published') throw { status: 404, message: '远征不存在或暂未开放报名' };

      // 2. 检查名额是否充足
      const currentCount = Number(expedition.current_participants) || 0;
      const maxCount = Number(expedition.max_participants) || 10;
      if (currentCount + participantCount > maxCount) {
        throw { status: 409, message: '名额已满，无法下单' };
      }

      let subtotal = (expedition.base_price || 0) * participantCount;
      let discount = 0;
      if (expedition.group_discount) {
        try {
          const gd = typeof expedition.group_discount === 'string' ? JSON.parse(expedition.group_discount) : expedition.group_discount;
          if (participantCount >= (gd.min || 3)) {
            discount = subtotal * (1 - (gd.rate || 0.95));
          }
        } catch (e) {}
      }
      const total = subtotal - discount;
      const platform_fee = total * (expedition.commission_rate || 0.15);
      const publisher_income = total - platform_fee;
      const order_no = 'EX' + Date.now() + crypto.randomBytes(3).toString('hex').toUpperCase();
      const now = new Date().toISOString();
      const addonsStr = selected_addons ? JSON.stringify(selected_addons) : null;

      // 3. 创建订单
      const [{ id: newOrderId }] = await tx.$queryRaw`
        INSERT INTO expedition_orders (
          order_no, expedition_id, user_id, participants, selected_addons,
          subtotal, discount, total, platform_fee, publisher_income,
          status, contact_name, contact_phone, emergency_contact, emergency_phone, notes, created_at
        ) VALUES (${order_no}, ${expId}, ${req.user.id}, ${participantCount}, ${addonsStr},
          ${subtotal}, ${discount}, ${total}, ${platform_fee}, ${publisher_income},
          'pending_payment', ${contact_name || null}, ${contact_phone || null},
          ${emergency_contact || null}, ${emergency_phone || null}, ${notes || null}, ${now})
        RETURNING id
      `;

      // 4. 递增参与人数（原子性保证）
      await tx.$executeRaw`
        UPDATE expeditions SET current_participants = current_participants + ${participantCount} WHERE id = ${expId}
      `;

      const [newOrder] = await tx.$queryRaw`SELECT * FROM expedition_orders WHERE id = ${newOrderId}`;
      return newOrder;
    });

    res.json(order);
  } catch (e) {
    if (e && e.status === 409) return res.status(409).json({ error: e.message });
    if (e && e.status === 404) return res.status(404).json({ error: e.message });
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/expeditions/:id/export.gpx — 导出攀登轨迹为 GPX 文件
router.get('/:id/export.gpx', async (req, res) => {
  try {
    const expId = parseInt(req.params.id);
    const [expedition] = await prisma.$queryRaw`SELECT * FROM expeditions WHERE id = ${expId} AND status = 'published'`;
    if (!expedition) return res.status(404).json({ error: '活动不存在' });
    const moments = await prisma.$queryRaw`SELECT lat, lng, altitude, recorded_at FROM expedition_moments WHERE expedition_id = ${expId} AND lat IS NOT NULL AND lng IS NOT NULL ORDER BY recorded_at ASC`;

    const trkpts = moments.map(m => {
      const ele = m.altitude ? `<ele>${m.altitude}</ele>` : '';
      const time = m.recorded_at ? `<time>${new Date(m.recorded_at).toISOString()}</time>` : '';
      return `    <trkpt lat="${m.lat}" lon="${m.lng}">${ele}${time}</trkpt>`;
    }).join('\n');

    const safeName = (expedition.title || 'expedition').replace(/[<>&"']/g, '');
    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="SummitLink" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${safeName}</name>
    <time>${new Date().toISOString()}</time>
  </metadata>
  <trk>
    <name>${safeName}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;
    res.setHeader('Content-Type', 'application/gpx+xml');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safeName)}.gpx"`);
    res.send(gpx);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/expeditions/:id/moments — 获取攀登时刻轨迹点（用于地图可视化）
router.get('/:id/moments', async (req, res) => {
  try {
    const expId = parseInt(req.params.id);
    const moments = await prisma.$queryRaw`SELECT id, lat, lng, altitude, type, media_url, content, recorded_at FROM expedition_moments WHERE expedition_id = ${expId} ORDER BY recorded_at ASC`;
    res.json(moments);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
