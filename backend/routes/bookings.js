const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const auth = require('../middleware/auth');
const rateLimit = require('express-rate-limit');
const { writeLimiter } = require('../middleware/rateLimits');
const { sendMail, bookingConfirmEmail } = require('../middleware/mailer');
const { sendPush } = require('../lib/pushSender');

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

// GET /api/bookings/my
router.get('/my', auth, async (req, res) => {
  try {
    const bookings = await prisma.$queryRaw`
      SELECT id, mountain, guide_id, guide_name, club_id, club_name, type,
             date, members, notes, amount, status, confirmed_at, rejected_reason, created_at
      FROM bookings WHERE user_id = ${req.user.id} ORDER BY created_at DESC
    `;
    res.json(bookings);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/bookings/incoming
router.get('/incoming', auth, async (req, res) => {
  try {
    const guide = (await prisma.$queryRaw`SELECT id FROM guides WHERE user_id = ${req.user.id}`)[0];
    const clubs = await prisma.$queryRaw`SELECT id FROM clubs WHERE creator_id = ${req.user.id}`;
    const clubIds = clubs.map(c => c.id);

    let bookings = [];
    if (guide) {
      const guideBookings = await prisma.$queryRaw`
        SELECT b.*, u.name as requester_name, u.avatar as requester_avatar
        FROM bookings b LEFT JOIN users u ON u.id = b.user_id
        WHERE b.guide_id = ${guide.id} ORDER BY b.created_at DESC
      `;
      bookings = bookings.concat(guideBookings);
    }
    if (clubIds.length > 0) {
      const placeholders = clubIds.map(() => '?').join(',');
      const clubBookings = await prisma.$queryRawUnsafe(
        `SELECT b.*, u.name as requester_name, u.avatar as requester_avatar
         FROM bookings b LEFT JOIN users u ON u.id = b.user_id
         WHERE b.club_id IN (${placeholders}) ORDER BY b.created_at DESC`,
        ...clubIds
      );
      bookings = bookings.concat(clubBookings);
    }
    bookings.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json(bookings);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/bookings/pool
router.get('/pool', poolReadLimiter, auth, async (req, res) => {
  try {
    const { page = 1, limit = 20, mountain } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let sql = `
      SELECT b.id, b.mountain, b.type, b.date, b.members, b.amount, b.created_at,
             u.name as requester_name, u.avatar as requester_avatar
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
    const bookings = await prisma.$queryRawUnsafe(sql, ...params);

    let countSql = `SELECT COUNT(*) as cnt FROM bookings WHERE pool = 1 AND status = 'pending'`;
    const countParams = [];
    if (mountain) {
      countSql += ' AND mountain LIKE ?';
      countParams.push(`%${mountain}%`);
    }
    const countRow = (await prisma.$queryRawUnsafe(countSql, ...countParams))[0];
    const total = Number(countRow.cnt);
    res.json({ bookings, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/bookings
router.post('/', writeLimiter, auth, async (req, res) => {
  try {
    const { mountain, guide_id, guide_name, club_id, club_name, date, members, notes, type } = req.body;
    if (!mountain || !date) return res.status(400).json({ error: '请填写山峰和日期' });
    if (new Date(date) <= new Date()) return res.status(400).json({ error: '日期必须是未来日期' });
    if (guide_id) {
      const dup = (await prisma.$queryRaw`SELECT id FROM bookings WHERE user_id=${req.user.id} AND guide_id=${guide_id} AND date=${date} AND status!=${'rejected'}`)[0];
      if (dup) return res.status(400).json({ error: '您已预约过该向导在此日期的服务' });
    }
    const memberCount = parseInt(members) || 1;
    const amount = memberCount * 3000;
    const isPool = !guide_id && !club_id ? 1 : 0;
    const bookingType = type || (guide_id ? 'guide' : club_id ? 'club' : 'pool');
    const [{ id: newBookingId }] = await prisma.$queryRaw`
      INSERT INTO bookings (user_id, mountain, guide_id, guide_name, club_id, club_name, type, date, members, notes, amount, pool)
      VALUES (${req.user.id}, ${mountain}, ${guide_id || null}, ${guide_name || ''}, ${club_id || null}, ${club_name || ''}, ${bookingType}, ${date}, ${memberCount}, ${notes || ''}, ${amount}, ${isPool})
      RETURNING id
    `;
    const id = Number(newBookingId);
    const booking = (await prisma.$queryRaw`SELECT * FROM bookings WHERE id = ${id}`)[0];

    const requester = (await prisma.$queryRaw`SELECT name FROM users WHERE id = ${req.user.id}`)[0];
    const requesterName = requester ? requester.name : '用户';
    if (guide_id) {
      const guide = (await prisma.$queryRaw`SELECT user_id FROM guides WHERE id = ${guide_id}`)[0];
      if (guide && guide.user_id) {
        await prisma.$executeRaw`INSERT INTO notifications (user_id, type, content, related_id) VALUES (${guide.user_id}, ${'booking_request'}, ${`${requesterName} 预约了您 [${mountain}] [${date}]`}, ${booking.id})`;
      }
    }
    if (club_id) {
      const club = (await prisma.$queryRaw`SELECT creator_id FROM clubs WHERE id = ${club_id}`)[0];
      if (club && club.creator_id) {
        await prisma.$executeRaw`INSERT INTO notifications (user_id, type, content, related_id) VALUES (${club.creator_id}, ${'booking_request'}, ${`${requesterName} 预约了您 [${mountain}] [${date}]`}, ${booking.id})`;
      }
    }
    res.json(booking);
    // 异步发送预约确认邮件（不阻断响应）
    prisma.$queryRaw`SELECT name, email FROM users WHERE id = ${req.user.id}`.then(rows => {
      const user = rows[0];
      if (user?.email) {
        const guideOrClub = guide_name || club_name || '平台';
        sendMail({ to: user.email, ...bookingConfirmEmail({ userName: user.name || requesterName, peakName: mountain, date, guideOrClub, orderNo: String(id) }) }).catch(() => {});
      }
    }).catch(() => {});
    // 异步推送新预约通知（不阻断响应）
    setImmediate(async () => {
      try {
        let recipientUserId = null;
        if (guide_id) {
          const guide = (await prisma.$queryRaw`SELECT user_id FROM guides WHERE id = ${guide_id}`)[0];
          if (guide) recipientUserId = guide.user_id;
        } else if (club_id) {
          const club = (await prisma.$queryRaw`SELECT creator_id FROM clubs WHERE id = ${club_id}`)[0];
          if (club) recipientUserId = club.creator_id;
        }
        if (recipientUserId) {
          const tokens = await prisma.$queryRawUnsafe(
            `SELECT push_token as token, push_platform as platform FROM users WHERE id = ? AND push_token IS NOT NULL AND push_platform IS NOT NULL`,
            recipientUserId
          );
          if (tokens.length > 0) {
            await sendPush(tokens, {
              title: '📅 新预约通知',
              body: `${requesterName} 预约了 [${mountain}] (${date})`,
              data: { type: 'booking_request', bookingId: String(booking.id) },
            });
          }
        }
      } catch (pushErr) {
        console.warn('[Booking] 推送通知失败:', pushErr.message);
      }
    });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/bookings/:id/confirm
router.put('/:id/confirm', auth, async (req, res) => {
  try {
    const booking = (await prisma.$queryRaw`SELECT * FROM bookings WHERE id = ${Number(req.params.id)}`)[0];
    if (!booking) return res.status(404).json({ error: '预约不存在' });
    if (booking.status !== 'pending') return res.status(400).json({ error: '只能确认待处理的预约' });

    let authorized = false;
    if (booking.guide_id) {
      const guide = (await prisma.$queryRaw`SELECT user_id FROM guides WHERE id = ${booking.guide_id}`)[0];
      if (guide && guide.user_id === req.user.id) authorized = true;
    }
    if (booking.club_id) {
      const club = (await prisma.$queryRaw`SELECT creator_id FROM clubs WHERE id = ${booking.club_id}`)[0];
      if (club && club.creator_id === req.user.id) authorized = true;
    }
    if (!authorized) return res.status(403).json({ error: '无权操作此预约' });

    const now = new Date().toISOString();
    await prisma.$executeRaw`UPDATE bookings SET status='confirmed', confirmed_at=${now} WHERE id=${Number(req.params.id)}`;
    await prisma.$executeRaw`INSERT INTO notifications (user_id, type, content, related_id) VALUES (${booking.user_id}, ${'booking_confirmed'}, ${`您的预约 [${booking.mountain}] [${booking.date}] 已被确认 ✅`}, ${booking.id})`;

    res.json({ success: true, message: '预约已确认' });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/bookings/:id/reject
router.put('/:id/reject', auth, async (req, res) => {
  try {
    const booking = (await prisma.$queryRaw`SELECT * FROM bookings WHERE id = ${Number(req.params.id)}`)[0];
    if (!booking) return res.status(404).json({ error: '预约不存在' });
    if (booking.status !== 'pending') return res.status(400).json({ error: '只能拒绝待处理的预约' });

    let authorized = false;
    if (booking.guide_id) {
      const guide = (await prisma.$queryRaw`SELECT user_id FROM guides WHERE id = ${booking.guide_id}`)[0];
      if (guide && guide.user_id === req.user.id) authorized = true;
    }
    if (booking.club_id) {
      const club = (await prisma.$queryRaw`SELECT creator_id FROM clubs WHERE id = ${booking.club_id}`)[0];
      if (club && club.creator_id === req.user.id) authorized = true;
    }
    if (!authorized) return res.status(403).json({ error: '无权操作此预约' });

    const reason = req.body.reason || '对方暂时无法安排';
    await prisma.$executeRaw`UPDATE bookings SET status='rejected', rejected_reason=${reason} WHERE id=${Number(req.params.id)}`;
    await prisma.$executeRaw`INSERT INTO notifications (user_id, type, content, related_id) VALUES (${booking.user_id}, ${'booking_rejected'}, ${`您的预约 [${booking.mountain}] [${booking.date}] 未被接受：${reason}`}, ${booking.id})`;

    res.json({ success: true, message: '预约已拒绝' });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/bookings/:id/claim
router.post('/:id/claim', claimLimiter, auth, async (req, res) => {
  try {
    const booking = (await prisma.$queryRaw`SELECT * FROM bookings WHERE id = ${Number(req.params.id)}`)[0];
    if (!booking) return res.status(404).json({ error: '预约不存在' });
    if (!booking.pool) return res.status(400).json({ error: '该预约不在公共池中' });
    if (booking.status !== 'pending') return res.status(400).json({ error: '该预约已被认领或关闭' });

    const guide = (await prisma.$queryRaw`SELECT id, name FROM guides WHERE user_id = ${req.user.id} AND status = ${'approved'}`)[0];
    const club = (await prisma.$queryRaw`SELECT id, name FROM clubs WHERE creator_id = ${req.user.id}`)[0];
    if (!guide && !club) return res.status(403).json({ error: '只有向导或俱乐部可以认领预约' });

    if (guide) {
      await prisma.$executeRaw`UPDATE bookings SET pool = 0, guide_id = ${guide.id}, guide_name = ${guide.name}, type = 'guide' WHERE id = ${Number(req.params.id)}`;
      await prisma.$executeRaw`INSERT INTO notifications (user_id, type, content, related_id) VALUES (${booking.user_id}, ${'booking_claimed'}, ${`向导 ${guide.name} 主动联系了您关于 [${booking.mountain}] 的预约，请查看消息`}, ${booking.id})`;
    } else {
      await prisma.$executeRaw`UPDATE bookings SET pool = 0, club_id = ${club.id}, club_name = ${club.name}, type = 'club' WHERE id = ${Number(req.params.id)}`;
      await prisma.$executeRaw`INSERT INTO notifications (user_id, type, content, related_id) VALUES (${booking.user_id}, ${'booking_claimed'}, ${`俱乐部 ${club.name} 主动联系了您关于 [${booking.mountain}] 的预约，请查看消息`}, ${booking.id})`;
    }

    const updated = (await prisma.$queryRaw`SELECT * FROM bookings WHERE id = ${Number(req.params.id)}`)[0];
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/bookings/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const booking = (await prisma.$queryRaw`
      SELECT b.*, u.name as requester_name, u.avatar as requester_avatar
      FROM bookings b LEFT JOIN users u ON u.id = b.user_id
      WHERE b.id = ${Number(req.params.id)} AND (b.user_id = ${req.user.id} OR b.pool = 1 OR EXISTS (
        SELECT 1 FROM guides g WHERE g.id = b.guide_id AND g.user_id = ${req.user.id}
      ) OR EXISTS (
        SELECT 1 FROM clubs c WHERE c.id = b.club_id AND c.creator_id = ${req.user.id}
      ))
    `)[0];
    if (!booking) return res.status(404).json({ error: '预约不存在' });
    res.json(booking);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
