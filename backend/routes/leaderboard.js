const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const rateLimit = require('express-rate-limit');

const leaderboardLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false, message: { error: '请求过于频繁' } });

function normalizeLeader(l) {
  return {
    ...l,
    id: typeof l.id === 'bigint' ? Number(l.id) : l.id,
    summit_count: Number(l.summit_count),
    max_elevation: Number(l.max_elevation),
    total_distance: l.total_distance !== undefined ? Number(l.total_distance) : undefined,
  };
}

// GET /api/leaderboard — 多维度攀登榜单
router.get('/', leaderboardLimiter, async (req, res) => {
  try {
    const { sort = 'count', period = 'month', month, peak_type, scope = 'user' } = req.query;

    // 排序字段白名单，防止 SQL 注入
    const sortFieldMap = {
      elevation: 'MAX(COALESCE(t.max_elevation, t.elevation, 0))',
      distance:  'SUM(COALESCE(t.distance_km, t.distance, 0))',
      count:     'COUNT(t.id)',
    };
    const sortKey = Object.prototype.hasOwnProperty.call(sortFieldMap, sort) ? sort : 'count';
    const sortField = sortFieldMap[sortKey];

    // 构建时间范围 WHERE 条件
    let timeWhere = '';
    const params = [];
    if (period === 'week') {
      timeWhere = "AND date(t.date) >= date('now', 'weekday 0', '-6 days')";
    } else if (period === 'year') {
      timeWhere = "AND strftime('%Y', t.date) = strftime('%Y', 'now')";
    } else if (period === 'all') {
      timeWhere = '';
    } else {
      // 默认 month
      const targetMonth = month || new Date().toISOString().slice(0, 7);
      timeWhere = "AND strftime('%Y-%m', t.date) = ?";
      params.push(targetMonth);
    }

    // 构建峰种 JOIN 与 WHERE 条件
    let peakJoin = '';
    let peakWhere = '';
    const peakTypeMap = {
      '8000ers':    '8000ers',
      'continental': 'continental',
      'world':      'world',
      'alpine':     'alpine',
    };
    if (peak_type && Object.prototype.hasOwnProperty.call(peakTypeMap, peak_type)) {
      peakJoin  = 'LEFT JOIN peaks p ON p.name = t.peak_name';
      peakWhere = "AND (p.type = ? OR p.category = ?)";
      params.push(peakTypeMap[peak_type], peakTypeMap[peak_type]);
    }

    const antiCheatWhere = `
      AND COALESCE(t.flagged, 0) = 0
      AND COALESCE(t.reward_granted, 1) = 1
    `;

    let rawLeaders;
    if (scope === 'club') {
      const sql = `
        SELECT c.id, c.name, c.cover as avatar, c.specialty as level,
               COUNT(t.id) as summit_count,
               MAX(COALESCE(t.max_elevation, t.elevation, 0)) as max_elevation,
               ROUND(SUM(COALESCE(t.distance_km, t.distance, 0)), 1) as total_distance,
               MAX(COALESCE(t.peak_name, t.name, '')) as best_peak
        FROM tracks t
        JOIN club_members cm ON cm.user_id = t.user_id
        JOIN clubs c ON c.id = cm.club_id
        ${peakJoin}
        WHERE 1=1
          ${timeWhere}
          ${antiCheatWhere}
          ${peakWhere}
        GROUP BY c.id
        ORDER BY ${sortField} DESC
        LIMIT 20
      `;
      rawLeaders = await prisma.$queryRawUnsafe(sql, ...params);
    } else {
      const sql = `
        SELECT u.id, u.name, u.avatar, u.level,
               COUNT(t.id) as summit_count,
               MAX(COALESCE(t.max_elevation, t.elevation, 0)) as max_elevation,
               ROUND(SUM(COALESCE(t.distance_km, t.distance, 0)), 1) as total_distance,
               MAX(COALESCE(t.peak_name, t.name, '')) as best_peak
        FROM tracks t
        JOIN users u ON u.id = t.user_id
        ${peakJoin}
        WHERE 1=1
          ${timeWhere}
          ${antiCheatWhere}
          ${peakWhere}
        GROUP BY u.id
        ORDER BY ${sortField} DESC
        LIMIT 20
      `;
      rawLeaders = await prisma.$queryRawUnsafe(sql, ...params);
    }

    const leaders = rawLeaders.map(normalizeLeader);
    const targetMonth = (period === 'month') ? (month || new Date().toISOString().slice(0, 7)) : null;
    res.json({ month: targetMonth, period, sort: sortKey, scope, peak_type: peak_type || null, leaders });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/leaderboard/monthly — 兼容旧版月榜（只保留一份）
router.get('/monthly', leaderboardLimiter, async (req, res) => {
  try {
    const targetMonth = new Date().toISOString().slice(0, 7);
    const rawLeaders = await prisma.$queryRawUnsafe(`
      SELECT u.id, u.name, u.avatar, u.level,
             COUNT(t.id) as summit_count,
             MAX(COALESCE(t.max_elevation, t.elevation, 0)) as max_elevation,
             MAX(COALESCE(t.peak_name, t.name, '')) as best_peak
      FROM tracks t
      JOIN users u ON u.id = t.user_id
      WHERE strftime('%Y-%m', t.date) = ?
        AND COALESCE(t.flagged, 0) = 0
        AND COALESCE(t.reward_granted, 1) = 1
      GROUP BY u.id
      ORDER BY COUNT(t.id) DESC
      LIMIT 10
    `, targetMonth);
    const leaders = rawLeaders.map(l => ({
      ...l,
      id: typeof l.id === 'bigint' ? Number(l.id) : l.id,
      summit_count: Number(l.summit_count),
      max_elevation: Number(l.max_elevation),
    }));
    res.json(leaders);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
