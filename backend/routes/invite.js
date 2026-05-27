const express = require('express');
const rateLimit = require('express-rate-limit');
const prisma = require('../db/prisma');
const auth = require('../middleware/auth');

const router = express.Router();

const inviteReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: '请求过于频繁' },
  standardHeaders: true,
  legacyHeaders: false,
});

const INVITE_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateInviteCode() {
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += INVITE_CODE_CHARS[Math.floor(Math.random() * INVITE_CODE_CHARS.length)];
  }
  return code;
}

async function ensureUserInviteCode(userId, maxAttempts = 12) {
  const existingRows = await prisma.$queryRaw`SELECT invite_code FROM users WHERE id = ${userId} LIMIT 1`;
  const existingCode = existingRows?.[0]?.invite_code;
  if (existingCode) return existingCode;

  for (let i = 0; i < maxAttempts; i += 1) {
    const code = generateInviteCode();
    const conflictRows = await prisma.$queryRaw`SELECT id FROM users WHERE invite_code = ${code} LIMIT 1`;
    if (Array.isArray(conflictRows) && conflictRows.length) continue;
    try {
      await prisma.$executeRaw`UPDATE users SET invite_code = ${code} WHERE id = ${userId}`;
      return code;
    } catch (e) {
      const msg = String(e?.message || '').toLowerCase();
      if (!msg.includes('unique') && e?.code !== 'P2002') throw e;
    }
  }
  return null;
}

function maskName(name) {
  const n = String(name || '').trim();
  if (!n) return '***';
  if (n.length <= 1) return `${n}*`;
  if (n.length === 2) return `${n[0]}*`;
  return `${n[0]}${'*'.repeat(Math.min(3, n.length - 2))}${n.slice(-1)}`;
}

async function queryInviteStats(userId) {
  const [countRow] = await prisma.$queryRaw`SELECT COUNT(*) AS total_invited FROM invite_records WHERE inviter_id = ${userId}`;
  const [pointRow] = await prisma.$queryRaw`SELECT COALESCE(invite_reward_points, 0) AS total_points FROM users WHERE id = ${userId}`;
  return {
    totalInvited: Number(countRow?.total_invited || 0),
    totalPoints: Number(pointRow?.total_points || 0),
  };
}

router.get('/my-code', inviteReadLimiter, auth, async (req, res) => {
  try {
    const code = await ensureUserInviteCode(req.user.id);
    if (!code) return res.status(500).json({ error: '邀请码生成失败' });
    const { totalInvited, totalPoints } = await queryInviteStats(req.user.id);
    const appUrl = (process.env.APP_URL || 'https://summitlink.app').replace(/\/$/, '');
    res.json({
      code,
      inviteUrl: `${appUrl}/register?invite=${encodeURIComponent(code)}`,
      totalInvited,
      totalPoints,
    });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

router.get('/stats', inviteReadLimiter, auth, async (req, res) => {
  try {
    const stats = await queryInviteStats(req.user.id);
    res.json(stats);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

router.get('/records', inviteReadLimiter, auth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;
    const [rows, totalRows] = await Promise.all([
      prisma.$queryRaw`
        SELECT ir.id, ir.invitee_id, ir.invite_code, ir.reward_type, ir.reward_value, ir.rewarded_at, ir.created_at, u.name AS invitee_name
        FROM invite_records ir
        LEFT JOIN users u ON u.id = ir.invitee_id
        WHERE ir.inviter_id = ${req.user.id}
        ORDER BY ir.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `,
      prisma.$queryRaw`SELECT COUNT(*) AS total FROM invite_records WHERE inviter_id = ${req.user.id}`,
    ]);
    res.json({
      records: (rows || []).map((r) => ({
        id: r.id,
        inviteeId: r.invitee_id,
        inviteeName: maskName(r.invitee_name || '用户'),
        inviteCode: r.invite_code,
        rewardType: r.reward_type,
        rewardValue: Number(r.reward_value || 0),
        rewardedAt: r.rewarded_at,
        createdAt: r.created_at,
      })),
      total: Number(totalRows?.[0]?.total || 0),
      page,
      limit,
    });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
