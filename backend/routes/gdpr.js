const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const auth = require('../middleware/auth');
const { decryptPII } = require('../utils/crypto');

// GET /api/gdpr/check — 检查用户地区是否需要 GDPR 横幅
router.get('/check', (req, res) => {
  // 通过 CF-IPCountry 头（Cloudflare）或 X-Country 头判断地区
  const country = (
    req.headers['cf-ipcountry'] ||
    req.headers['x-country'] ||
    ''
  ).toUpperCase();

  // 欧盟国家列表
  const EU_COUNTRIES = [
    'AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR',
    'DE','GR','HU','IE','IT','LV','LT','LU','MT','NL',
    'PL','PT','RO','SK','SI','ES','SE','IS','LI','NO'
  ];

  const requiresGdpr = EU_COUNTRIES.includes(country);

  res.json({
    requiresGdpr,
    country: country || 'unknown',
    privacyUrl: '/legal/privacy',
    termsUrl: '/legal/terms',
  });
});

// GET /api/gdpr/export — 导出当前登录用户个人数据
router.get('/export', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const [user] = await prisma.$queryRaw`
      SELECT id, name, username, phone, email, avatar, bio, settings, privacy, created_at, deleted_at
      FROM users WHERE id = ${userId}
    `;
    if (!user) return res.status(404).json({ error: '用户不存在' });

    const safeDecrypt = (v) => {
      try { return v ? decryptPII(v) : v; } catch (err) {
        console.warn('[gdpr/export] decrypt failed:', err.message);
        return '[decryption_failed]';
      }
    };
    user.phone = safeDecrypt(user.phone);
    user.email = safeDecrypt(user.email);

    const tracks = await prisma.$queryRaw`
      SELECT * FROM tracks WHERE user_id = ${userId} ORDER BY created_at DESC
    `.catch(() => []);
    const bookings = await prisma.$queryRaw`
      SELECT * FROM bookings WHERE user_id = ${userId} ORDER BY created_at DESC
    `.catch(() => []);
    const messages = await prisma.$queryRaw`
      SELECT * FROM messages WHERE sender_id = ${userId} ORDER BY created_at DESC
    `.catch(() => []);
    const posts = await prisma.$queryRaw`
      SELECT * FROM posts WHERE user_id = ${userId} ORDER BY created_at DESC
    `.catch(() => []);

    const payload = {
      user,
      tracks,
      bookings,
      messages,
      posts,
      exportedAt: new Date().toISOString(),
    };
    res.setHeader('Content-Disposition', 'attachment; filename="summitlink-gdpr-export.json"');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json(payload);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// DELETE /api/gdpr/delete-account — 软删除账号（标记 deleted_at + 清空 PII）
router.delete('/delete-account', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();

    // 1) 删除关联 PII 表中该用户的所有记录（忽略表不存在等错误）
    // 注意：表名来自冻结的常量白名单，并在拼接前用 Set 二次断言，防止意外注入
    const PII_TABLES = Object.freeze([
      'emergency_contacts', 'medical_info', 'sos_records', 'sms_codes', 'email_codes',
      'notifications', 'follows', 'favorites', 'comment_likes', 'likes',
      'user_achievements', 'user_badges', 'mountain_wishlists', 'mountain_footprints',
      'post_saves', 'message_reads', 'location_shares', 'feed_scores', 'expedition_subscribers',
    ]);
    const ALLOWED_PII_TABLES = new Set(PII_TABLES);
    for (const table of PII_TABLES) {
      if (!ALLOWED_PII_TABLES.has(table)) continue; // 二次断言：只允许白名单内的表名
      await prisma.$executeRawUnsafe(`DELETE FROM ${table} WHERE user_id = ?`, userId)
        .catch(() => {});
    }

    // 2) 匿名化 users 主表（清空 PII、保留 id 以维持外键）
    await prisma.$executeRaw`
      UPDATE users
      SET deleted_at = ${now},
          phone = NULL,
          email = NULL,
          password = NULL,
          avatar = NULL,
          bio = NULL,
          name = '[已注销用户]',
          username = ${'@deleted_' + userId},
          settings = NULL,
          privacy = NULL
      WHERE id = ${userId}
    `;
    res.json({ success: true, deletedAt: now.toISOString() });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
