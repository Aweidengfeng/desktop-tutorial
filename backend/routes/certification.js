const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const prisma = require('../db/prisma');
const auth = require('../middleware/auth');
const { GUIDE_CERT_LEVELS, CLUB_CERT_LEVELS } = require('../utils/certLevels');

const certReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: '请求过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
});

const certWriteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: '提交过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
});

// GET /api/certification/levels
router.get('/levels', certReadLimiter, (req, res) => {
  res.json({ guide: GUIDE_CERT_LEVELS, club: CLUB_CERT_LEVELS });
});

// GET /api/certification/guide/status
router.get('/guide/status', certReadLimiter, auth, async (req, res) => {
  try {
    const guide = (await prisma.$queryRaw`
      SELECT id, name, cert_level, cert_expires_at, cert_year_fee, listing_fee_paid,
             status, specialty, region, rating, reviews, created_at
      FROM guides WHERE user_id = ${req.user.id}
    `)[0];
    if (!guide) {
      return res.json({ certified: false, guide: null });
    }
    const levelInfo = GUIDE_CERT_LEVELS[guide.cert_level] || GUIDE_CERT_LEVELS.basic;
    const now = new Date();
    const expiresAt = guide.cert_expires_at ? new Date(guide.cert_expires_at) : null;
    const isActive = guide.status === 'approved' && expiresAt && expiresAt > now;
    const application = (await prisma.$queryRaw`
      SELECT id, cert_level, status, created_at FROM guide_applications WHERE user_id = ${req.user.id} ORDER BY created_at DESC LIMIT 1
    `)[0];
    res.json({
      certified: isActive,
      guide,
      levelInfo,
      application: application || null,
    });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/certification/club/status
router.get('/club/status', certReadLimiter, auth, async (req, res) => {
  try {
    const club = (await prisma.$queryRaw`
      SELECT id, name, cert_level, cert_expires_at, cert_year_fee, listing_fee_paid,
             verified, status, specialty, region, rating, created_at
      FROM clubs WHERE creator_id = ${req.user.id}
    `)[0];
    if (!club) {
      return res.json({ certified: false, club: null });
    }
    const levelInfo = CLUB_CERT_LEVELS[club.cert_level] || CLUB_CERT_LEVELS.standard;
    const now = new Date();
    const expiresAt = club.cert_expires_at ? new Date(club.cert_expires_at) : null;
    const isActive = club.verified === 1 && expiresAt && expiresAt > now;
    const application = (await prisma.$queryRaw`
      SELECT id, cert_level, status, created_at FROM club_applications WHERE user_id = ${req.user.id} ORDER BY created_at DESC LIMIT 1
    `)[0];
    res.json({
      certified: isActive,
      club,
      levelInfo,
      application: application || null,
    });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/certification/guide/apply
router.post('/guide/apply', certWriteLimiter, auth, async (req, res) => {
  try {
    const { certLevel = 'basic', name, cert, specialty, languages, dayRate, region } = req.body;
    if (!name) return res.status(400).json({ error: '姓名不能为空' });
    if (!GUIDE_CERT_LEVELS[certLevel]) {
      return res.status(400).json({ error: '无效的认证等级' });
    }
    const existing = (await prisma.$queryRaw`
      SELECT id, status FROM guide_applications WHERE user_id = ${req.user.id} AND status = 'pending'
    `)[0];
    if (existing) {
      return res.status(400).json({ error: '您已有待审核的申请，请等待审核结果' });
    }
    const yearFee = GUIDE_CERT_LEVELS[certLevel].yearFee;
    await prisma.$executeRaw`
      INSERT INTO guide_applications (user_id, name, cert, specialty, languages, day_rate, region, cert_level)
      VALUES (${req.user.id}, ${name}, ${cert || ''}, ${specialty || ''}, ${languages || ''}, ${dayRate || 0}, ${region || ''}, ${certLevel})
    `;
    const existingGuide = (await prisma.$queryRaw`SELECT id FROM guides WHERE user_id = ${req.user.id}`)[0];
    if (!existingGuide) {
      await prisma.$executeRaw`
        INSERT INTO guides (user_id, name, cert, specialty, languages, day_rate, region, status, cert_level, cert_year_fee)
        VALUES (${req.user.id}, ${name}, ${cert || ''}, ${specialty || ''}, ${languages || ''}, ${dayRate || 0}, ${region || ''}, 'pending', ${certLevel}, ${yearFee})
      `;
    } else {
      await prisma.$executeRaw`
        UPDATE guides SET status='pending', name=${name}, cert=${cert || ''}, specialty=${specialty || ''}, languages=${languages || ''}, day_rate=${dayRate || 0}, region=${region || ''}, cert_level=${certLevel}, cert_year_fee=${yearFee}
        WHERE user_id=${req.user.id}
      `;
    }
    res.json({ success: true, message: '申请已提交，7天内审核完成', certLevel, yearFee });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/certification/club/apply
router.post('/club/apply', certWriteLimiter, auth, async (req, res) => {
  try {
    const { certLevel = 'standard', name, region, specialty, type, contact, wechat, website, certUrl, description } = req.body;
    if (!name) return res.status(400).json({ error: '俱乐部名称不能为空' });
    if (!CLUB_CERT_LEVELS[certLevel]) {
      return res.status(400).json({ error: '无效的认证等级' });
    }
    const existing = (await prisma.$queryRaw`
      SELECT id, status FROM club_applications WHERE user_id = ${req.user.id} AND status = 'pending'
    `)[0];
    if (existing) {
      return res.status(400).json({ error: '您已有待审核的申请，请等待审核结果' });
    }
    const yearFee = CLUB_CERT_LEVELS[certLevel].yearFee;
    await prisma.$executeRaw`
      INSERT INTO club_applications (user_id, club_name, description, specialty, region, type, contact, wechat, website, cert_url, cert_level)
      VALUES (${req.user.id}, ${name}, ${description || ''}, ${specialty || ''}, ${region || ''}, ${type || '综合'}, ${contact || ''}, ${wechat || ''}, ${website || ''}, ${certUrl || ''}, ${certLevel})
    `;
    res.json({ success: true, message: '申请已提交，7天内审核完成', certLevel, yearFee });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
