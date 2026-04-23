const express = require('express');
const router = express.Router();
const db = require('../db/database');
const auth = require('../middleware/auth');

// GET /api/bookings/my（需要JWT）
router.get('/my', auth, (req, res) => {
  try {
    const bookings = db.prepare(`
      SELECT id, mountain, guide_id, guide_name, club_id, club_name, type,
             date, members, notes, amount, status, confirmed_at, rejected_reason, created_at
      FROM bookings WHERE user_id = ? ORDER BY created_at DESC
    `).all(req.user.id);
    res.json(bookings);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/bookings/incoming — 向导/俱乐部查看收到的预约
router.get('/incoming', auth, (req, res) => {
  try {
    // 查找该用户是向导的预约
    const guide = db.prepare('SELECT id FROM guides WHERE user_id = ?').get(req.user.id);
    // 查找该用户是创建者的俱乐部
    const clubs = db.prepare('SELECT id FROM clubs WHERE creator_id = ?').all(req.user.id);
    const clubIds = clubs.map(c => c.id);

    let bookings = [];
    if (guide) {
      const guideBookings = db.prepare(`
        SELECT b.*, u.name as requester_name, u.avatar as requester_avatar
        FROM bookings b LEFT JOIN users u ON u.id = b.user_id
        WHERE b.guide_id = ? ORDER BY b.created_at DESC
      `).all(guide.id);
      bookings = bookings.concat(guideBookings);
    }
    if (clubIds.length > 0) {
      const placeholders = clubIds.map(() => '?').join(',');
      const clubBookings = db.prepare(`
        SELECT b.*, u.name as requester_name, u.avatar as requester_avatar
        FROM bookings b LEFT JOIN users u ON u.id = b.user_id
        WHERE b.club_id IN (${placeholders}) ORDER BY b.created_at DESC
      `).all(...clubIds);
      bookings = bookings.concat(clubBookings);
    }
    // 按创建时间倒序
    bookings.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json(bookings);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/bookings/pool — 向导/俱乐部查看公共池（未选向导或俱乐部）预约
router.get('/pool', auth, (req, res) => {
  try {
    const { page = 1, limit = 20, mountain } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let sql = `
      SELECT b.*, u.name as requester_name, u.avatar as requester_avatar
      FROM bookings b LEFT JOIN users u ON u.id = b.user_id
      WHERE b.pool = 1 AND b.status = 'pending'
    `;
    const params = [];
    if (mountain) {
      sql += ' AND b.mountain LIKE ?';
      params.push(`%${mountain}%`);
    }
    sql += ' ORDER BY b.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);
    const bookings = db.prepare(sql).all(...params);
    const total = db.prepare(
      `SELECT COUNT(*) as cnt FROM bookings WHERE pool = 1 AND status = 'pending'${mountain ? ' AND mountain LIKE ?' : ''}`
    ).get(...(mountain ? [`%${mountain}%`] : [])).cnt;
    res.json({ bookings, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/bookings（需要JWT）
router.post('/', auth, (req, res) => {
  try {
    const { mountain, guide_id, guide_name, club_id, club_name, date, members, notes, type } = req.body;
    if (!mountain || !date) return res.status(400).json({ error: '请填写山峰和日期' });
    // 验证日期必须是未来
    if (new Date(date) <= new Date()) return res.status(400).json({ error: '日期必须是未来日期' });
    // 同一用户对同一向导同一日期不能重复预约
    if (guide_id) {
      const dup = db.prepare('SELECT id FROM bookings WHERE user_id=? AND guide_id=? AND date=? AND status!=?').get(req.user.id, guide_id, date, 'rejected');
      if (dup) return res.status(400).json({ error: '您已预约过该向导在此日期的服务' });
    }
    const memberCount = parseInt(members) || 1;
    const amount = memberCount * 3000;
    // 未选向导/俱乐部则进入公共池
    const isPool = !guide_id && !club_id ? 1 : 0;
    const bookingType = type || (guide_id ? 'guide' : club_id ? 'club' : 'pool');
    const result = db.prepare(`
      INSERT INTO bookings (user_id, mountain, guide_id, guide_name, club_id, club_name, type, date, members, notes, amount, pool)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.user.id, mountain, guide_id || null, guide_name || '', club_id || null, club_name || '', bookingType, date, memberCount, notes || '', amount, isPool);
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(result.lastInsertRowid);

    // 发送通知给向导或俱乐部创建者
    const requester = db.prepare('SELECT name FROM users WHERE id = ?').get(req.user.id);
    const requesterName = requester ? requester.name : '用户';
    if (guide_id) {
      const guide = db.prepare('SELECT user_id FROM guides WHERE id = ?').get(guide_id);
      if (guide && guide.user_id) {
        db.prepare(`INSERT INTO notifications (user_id, type, content, related_id) VALUES (?, 'booking_request', ?, ?)`)
          .run(guide.user_id, `${requesterName} 预约了您 [${mountain}] [${date}]`, booking.id);
      }
    }
    if (club_id) {
      const club = db.prepare('SELECT creator_id FROM clubs WHERE id = ?').get(club_id);
      if (club && club.creator_id) {
        db.prepare(`INSERT INTO notifications (user_id, type, content, related_id) VALUES (?, 'booking_request', ?, ?)`)
          .run(club.creator_id, `${requesterName} 预约了您 [${mountain}] [${date}]`, booking.id);
      }
    }

    res.json(booking);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/bookings/:id/confirm — 确认预约
router.put('/:id/confirm', auth, (req, res) => {
  try {
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
    if (!booking) return res.status(404).json({ error: '预约不存在' });
    if (booking.status !== 'pending') return res.status(400).json({ error: '只能确认待处理的预约' });

    // 验证权限：向导 user_id 或 俱乐部 creator_id
    let authorized = false;
    if (booking.guide_id) {
      const guide = db.prepare('SELECT user_id FROM guides WHERE id = ?').get(booking.guide_id);
      if (guide && guide.user_id === req.user.id) authorized = true;
    }
    if (booking.club_id) {
      const club = db.prepare('SELECT creator_id FROM clubs WHERE id = ?').get(booking.club_id);
      if (club && club.creator_id === req.user.id) authorized = true;
    }
    if (!authorized) return res.status(403).json({ error: '无权操作此预约' });

    const now = new Date().toISOString();
    db.prepare("UPDATE bookings SET status='confirmed', confirmed_at=? WHERE id=?").run(now, req.params.id);
    // 通知用户
    db.prepare(`INSERT INTO notifications (user_id, type, content, related_id) VALUES (?, 'booking_confirmed', ?, ?)`)
      .run(booking.user_id, `您的预约 [${booking.mountain}] [${booking.date}] 已被确认 ✅`, booking.id);

    res.json({ success: true, message: '预约已确认' });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/bookings/:id/reject — 拒绝预约
router.put('/:id/reject', auth, (req, res) => {
  try {
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
    if (!booking) return res.status(404).json({ error: '预约不存在' });
    if (booking.status !== 'pending') return res.status(400).json({ error: '只能拒绝待处理的预约' });

    // 验证权限
    let authorized = false;
    if (booking.guide_id) {
      const guide = db.prepare('SELECT user_id FROM guides WHERE id = ?').get(booking.guide_id);
      if (guide && guide.user_id === req.user.id) authorized = true;
    }
    if (booking.club_id) {
      const club = db.prepare('SELECT creator_id FROM clubs WHERE id = ?').get(booking.club_id);
      if (club && club.creator_id === req.user.id) authorized = true;
    }
    if (!authorized) return res.status(403).json({ error: '无权操作此预约' });

    const reason = req.body.reason || '对方暂时无法安排';
    db.prepare("UPDATE bookings SET status='rejected', rejected_reason=? WHERE id=?").run(reason, req.params.id);
    // 通知用户
    db.prepare(`INSERT INTO notifications (user_id, type, content, related_id) VALUES (?, 'booking_rejected', ?, ?)`)
      .run(booking.user_id, `您的预约 [${booking.mountain}] [${booking.date}] 未被接受：${reason}`, booking.id);

    res.json({ success: true, message: '预约已拒绝' });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/bookings/:id/claim — 向导/俱乐部认领公共池预约
router.post('/:id/claim', auth, (req, res) => {
  try {
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
    if (!booking) return res.status(404).json({ error: '预约不存在' });
    if (!booking.pool) return res.status(400).json({ error: '该预约不在公共池中' });
    if (booking.status !== 'pending') return res.status(400).json({ error: '该预约已被认领或关闭' });

    // 确认操作者是向导或俱乐部创建者
    const guide = db.prepare('SELECT id, name FROM guides WHERE user_id = ? AND status = ?').get(req.user.id, 'approved');
    const club = db.prepare('SELECT id, name FROM clubs WHERE creator_id = ?').get(req.user.id);
    if (!guide && !club) return res.status(403).json({ error: '只有向导或俱乐部可以认领预约' });

    if (guide) {
      db.prepare(`UPDATE bookings SET pool = 0, guide_id = ?, guide_name = ?, type = 'guide' WHERE id = ?`)
        .run(guide.id, guide.name, req.params.id);
      // 通知客户
      db.prepare(`INSERT INTO notifications (user_id, type, content, related_id) VALUES (?, 'booking_claimed', ?, ?)`)
        .run(booking.user_id, `向导 ${guide.name} 主动联系了您关于 [${booking.mountain}] 的预约，请查看消息`, booking.id);
    } else {
      db.prepare(`UPDATE bookings SET pool = 0, club_id = ?, club_name = ?, type = 'club' WHERE id = ?`)
        .run(club.id, club.name, req.params.id);
      db.prepare(`INSERT INTO notifications (user_id, type, content, related_id) VALUES (?, 'booking_claimed', ?, ?)`)
        .run(booking.user_id, `俱乐部 ${club.name} 主动联系了您关于 [${booking.mountain}] 的预约，请查看消息`, booking.id);
    }

    const updated = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/bookings/:id（需要JWT）
router.get('/:id', auth, (req, res) => {
  try {
    const booking = db.prepare(`
      SELECT b.*, u.name as requester_name, u.avatar as requester_avatar
      FROM bookings b LEFT JOIN users u ON u.id = b.user_id
      WHERE b.id = ? AND (b.user_id = ? OR b.pool = 1 OR EXISTS (
        SELECT 1 FROM guides g WHERE g.id = b.guide_id AND g.user_id = ?
      ) OR EXISTS (
        SELECT 1 FROM clubs c WHERE c.id = b.club_id AND c.creator_id = ?
      ))
    `).get(req.params.id, req.user.id, req.user.id, req.user.id);
    if (!booking) return res.status(404).json({ error: '预约不存在' });
    res.json(booking);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
