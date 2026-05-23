const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const adminAuth = require('../middleware/adminAuth');

async function ensureAdminMessageTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS support_tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      subject TEXT,
      content TEXT NOT NULL,
      status TEXT DEFAULT 'open',
      priority TEXT DEFAULT 'normal',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS ticket_replies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL,
      sender_type TEXT NOT NULL,
      sender_id TEXT,
      content TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT,
      content TEXT,
      related_id INTEGER,
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

router.get('/messages/unread-count', adminAuth, async (_req, res) => {
  try {
    await ensureAdminMessageTables();
    const row = (await prisma.$queryRaw`SELECT COUNT(*) AS c FROM support_tickets WHERE status = 'open'`)[0];
    res.json({ count: Number(row?.c || 0) });
  } catch (e) {
    if (String(e.message || '').includes('no such table')) {
      return res.json({ count: 0 });
    }
    res.status(500).json({ error: '服务器错误' });
  }
});

router.get('/messages', adminAuth, async (req, res) => {
  try {
    await ensureAdminMessageTables();
    const status = String(req.query.status || '');
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const offset = (page - 1) * limit;
    const where = status ? 'WHERE t.status = ?' : '';
    const params = status ? [status, limit, offset] : [limit, offset];
    const tickets = await prisma.$queryRawUnsafe(
      `SELECT t.*, u.name AS user_name
       FROM support_tickets t
       LEFT JOIN users u ON u.id = t.user_id
       ${where}
       ORDER BY t.updated_at DESC, t.created_at DESC
       LIMIT ? OFFSET ?`,
      ...params
    );
    const countRow = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*) AS c FROM support_tickets ${status ? 'WHERE status = ?' : ''}`,
      ...(status ? [status] : [])
    );
    res.json({ tickets, total: Number(countRow?.[0]?.c || 0), page, limit });
  } catch (e) {
    if (String(e.message || '').includes('no such table')) {
      return res.json({ tickets: [], total: 0, page: 1, limit: 20 });
    }
    res.status(500).json({ error: '服务器错误' });
  }
});

router.get('/messages/:id', adminAuth, async (req, res) => {
  try {
    await ensureAdminMessageTables();
    const ticket = (await prisma.$queryRaw`
      SELECT t.*, u.name AS user_name
      FROM support_tickets t
      LEFT JOIN users u ON u.id = t.user_id
      WHERE t.id = ${Number(req.params.id)}
    `)[0];
    if (!ticket) return res.status(404).json({ error: '工单不存在' });

    const replies = await prisma.$queryRaw`
      SELECT id, ticket_id, sender_type, sender_id, content, is_read, created_at
      FROM ticket_replies
      WHERE ticket_id = ${Number(req.params.id)}
      ORDER BY created_at ASC, id ASC
    `;
    await prisma.$executeRaw`
      UPDATE ticket_replies
      SET is_read = 1
      WHERE ticket_id = ${Number(req.params.id)} AND sender_type = 'user'
    `;
    res.json({ ...ticket, replies });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

router.post('/messages/:id/reply', adminAuth, async (req, res) => {
  try {
    await ensureAdminMessageTables();
    const content = String(req.body?.content || '').trim();
    if (!content) return res.status(400).json({ error: 'content 不能为空' });
    const ticket = (await prisma.$queryRaw`SELECT * FROM support_tickets WHERE id = ${Number(req.params.id)}`)[0];
    if (!ticket) return res.status(404).json({ error: '工单不存在' });

    const inserted = await prisma.$queryRaw`
      INSERT INTO ticket_replies (ticket_id, sender_type, sender_id, content, is_read)
      VALUES (${Number(req.params.id)}, 'admin', ${req.admin?.username || 'admin'}, ${content}, 1)
      RETURNING id
    `;
    await prisma.$executeRaw`
      UPDATE support_tickets
      SET status = 'replied', updated_at = CURRENT_TIMESTAMP
      WHERE id = ${Number(req.params.id)}
    `;
    try {
      if (ticket.user_id) {
        await prisma.$executeRaw`
          INSERT INTO notifications (user_id, type, content, related_id)
          VALUES (${ticket.user_id}, 'support_reply', ${content}, ${Number(req.params.id)})
        `;
      }
    } catch (_) {}
    res.json({ success: true, reply_id: inserted?.[0]?.id });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

router.put('/messages/:id/close', adminAuth, async (req, res) => {
  try {
    await ensureAdminMessageTables();
    const affected = await prisma.$executeRaw`
      UPDATE support_tickets
      SET status = 'closed', updated_at = CURRENT_TIMESTAMP
      WHERE id = ${Number(req.params.id)}
    `;
    if (!affected) return res.status(404).json({ error: '工单不存在' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

router.post('/broadcast', adminAuth, async (req, res) => {
  try {
    await ensureAdminMessageTables();
    const title = String(req.body?.title || '').trim();
    const content = String(req.body?.content || '').trim();
    if (!title || !content) {
      return res.status(400).json({ error: 'title 和 content 不能为空' });
    }

    let userIds = Array.isArray(req.body?.user_ids)
      ? req.body.user_ids.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
      : [];
    if (!userIds.length) {
      const rows = await prisma.$queryRaw`SELECT id FROM users`;
      userIds = rows.map((row) => Number(row.id)).filter(Boolean);
    }

    for (const userId of userIds) {
      await prisma.$executeRaw`
        INSERT INTO notifications (user_id, type, content, related_id)
        VALUES (${userId}, 'system_broadcast', ${`${title}\n${content}`}, NULL)
      `;
    }
    res.json({ success: true, sent: userIds.length });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
