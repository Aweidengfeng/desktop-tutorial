const express = require('express');
const router = express.Router();
const db = require('../db/database');
const auth = require('../middleware/auth');
const { GUIDE_CERT_LEVELS, CLUB_CERT_LEVELS } = require('../utils/certLevels');

// GET /api/certification/levels — 公开接口，返回所有认证等级和年费信息
router.get('/levels', (req, res) => {
  res.json({ guide: GUIDE_CERT_LEVELS, club: CLUB_CERT_LEVELS });
});

// GET /api/certification/guide/status — 查询当前用户向导认证状态（需 auth）
router.get('/guide/status', auth, (req, res) => {
  try {
    const guide = db.prepare(`
      SELECT id, name, cert_level, cert_expires_at, cert_year_fee, listing_fee_paid,
             status, specialty, region, rating, reviews, created_at
      FROM guides WHERE user_id = ?
    `).get(req.user.id);
    if (!guide) {
      return res.json({ certified: false, guide: null });
    }
    const levelInfo = GUIDE_CERT_LEVELS[guide.cert_level] || GUIDE_CERT_LEVELS.basic;
    const now = new Date();
    const expiresAt = guide.cert_expires_at ? new Date(guide.cert_expires_at) : null;
    const isActive = guide.status === 'approved' && expiresAt && expiresAt > now;
    const application = db.prepare(
      "SELECT id, cert_level, status, created_at FROM guide_applications WHERE user_id = ? ORDER BY created_at DESC LIMIT 1"
    ).get(req.user.id);
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

// GET /api/certification/club/status — 查询当前用户俱乐部认证状态（需 auth）
router.get('/club/status', auth, (req, res) => {
  try {
    const club = db.prepare(`
      SELECT id, name, cert_level, cert_expires_at, cert_year_fee, listing_fee_paid,
             verified, specialty, region, rating, created_at
      FROM clubs WHERE creator_id = ?
    `).get(req.user.id);
    if (!club) {
      return res.json({ certified: false, club: null });
    }
    const levelInfo = CLUB_CERT_LEVELS[club.cert_level] || CLUB_CERT_LEVELS.standard;
    const now = new Date();
    const expiresAt = club.cert_expires_at ? new Date(club.cert_expires_at) : null;
    const isActive = club.verified === 1 && expiresAt && expiresAt > now;
    const application = db.prepare(
      "SELECT id, cert_level, status, created_at FROM club_applications WHERE user_id = ? ORDER BY created_at DESC LIMIT 1"
    ).get(req.user.id);
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

// POST /api/certification/guide/apply — 提交向导认证申请
router.post('/guide/apply', auth, (req, res) => {
  try {
    const { certLevel = 'basic', name, cert, specialty, languages, dayRate, region } = req.body;
    if (!name) return res.status(400).json({ error: '姓名不能为空' });
    if (!GUIDE_CERT_LEVELS[certLevel]) {
      return res.status(400).json({ error: '无效的认证等级' });
    }
    const existing = db.prepare(
      "SELECT id, status FROM guide_applications WHERE user_id = ? AND status = 'pending'"
    ).get(req.user.id);
    if (existing) {
      return res.status(400).json({ error: '您已有待审核的申请，请等待审核结果' });
    }
    const yearFee = GUIDE_CERT_LEVELS[certLevel].yearFee;
    db.prepare(`
      INSERT INTO guide_applications (user_id, name, cert, specialty, languages, day_rate, region, cert_level)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.user.id, name, cert || '', specialty || '', languages || '', dayRate || 0, region || '', certLevel);
    const existingGuide = db.prepare('SELECT id FROM guides WHERE user_id = ?').get(req.user.id);
    if (!existingGuide) {
      db.prepare(`
        INSERT INTO guides (user_id, name, cert, specialty, languages, day_rate, region, status, cert_level, cert_year_fee)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
      `).run(req.user.id, name, cert || '', specialty || '', languages || '', dayRate || 0, region || '', certLevel, yearFee);
    } else {
      db.prepare(`
        UPDATE guides SET status='pending', name=?, cert=?, specialty=?, languages=?, day_rate=?, region=?, cert_level=?, cert_year_fee=?
        WHERE user_id=?
      `).run(name, cert || '', specialty || '', languages || '', dayRate || 0, region || '', certLevel, yearFee, req.user.id);
    }
    res.json({ success: true, message: '申请已提交，7天内审核完成', certLevel, yearFee });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/certification/club/apply — 提交俱乐部认证申请
router.post('/club/apply', auth, (req, res) => {
  try {
    const { certLevel = 'standard', name, region, specialty, type, contact, wechat, website, certUrl, description } = req.body;
    if (!name) return res.status(400).json({ error: '俱乐部名称不能为空' });
    if (!CLUB_CERT_LEVELS[certLevel]) {
      return res.status(400).json({ error: '无效的认证等级' });
    }
    const existing = db.prepare(
      "SELECT id, status FROM club_applications WHERE user_id = ? AND status = 'pending'"
    ).get(req.user.id);
    if (existing) {
      return res.status(400).json({ error: '您已有待审核的申请，请等待审核结果' });
    }
    const yearFee = CLUB_CERT_LEVELS[certLevel].yearFee;
    db.prepare(`
      INSERT INTO club_applications (user_id, club_name, description, specialty, region, type, contact, wechat, website, cert_url, cert_level)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.user.id, name, description || '', specialty || '', region || '', type || '综合', contact || '', wechat || '', website || '', certUrl || '', certLevel);
    res.json({ success: true, message: '申请已提交，7天内审核完成', certLevel, yearFee });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
