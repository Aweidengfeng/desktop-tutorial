const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const auth = require('../middleware/auth');
const rateLimit = require('express-rate-limit');
const { validateTrack } = require('../utils/trackValidator');

// 导出限流：每分钟最多30次
const exportLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: '请求过于频繁，请稍后再试' },
});

// GET /api/tracks — 获取轨迹列表（支持 user_id=me 过滤）
router.get('/', auth, (req, res) => {
  try {
    const tracks = db.prepare(`
      SELECT id, name, peak_name, date, distance, distance_km, elevation, elevation_gain,
             max_elevation, start_elevation, duration, duration_minutes, weather, notes, image, points,
             is_manual, proof_images, created_at
      FROM tracks WHERE user_id = ?
      ORDER BY date DESC
    `).all(req.user.id);
    const parsed = tracks.map(t => ({
      ...t,
      points: t.points ? JSON.parse(t.points) : [],
      proof_images: t.proof_images ? JSON.parse(t.proof_images) : [],
    }));
    res.json(parsed);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/tracks/my（兼容旧接口）
router.get('/my', auth, (req, res) => {
  try {
    const tracks = db.prepare(`
      SELECT id, name, peak_name, date, distance, distance_km, elevation, elevation_gain,
             max_elevation, start_elevation, duration, duration_minutes, weather, notes, image, points,
             is_manual, proof_images
      FROM tracks WHERE user_id = ?
      ORDER BY date DESC
    `).all(req.user.id);
    const parsed = tracks.map(t => ({
      ...t,
      points: t.points ? JSON.parse(t.points) : [],
      proof_images: t.proof_images ? JSON.parse(t.proof_images) : [],
    }));
    res.json(parsed);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/tracks/:id — 获取轨迹详情
router.get('/:id', auth, (req, res) => {
  try {
    const track = db.prepare(`
      SELECT id, user_id, name, peak_name, date, distance, distance_km, elevation, elevation_gain,
             max_elevation, start_elevation, duration, duration_minutes, weather, notes, image, points,
             is_manual, proof_images, created_at
      FROM tracks WHERE id = ?
    `).get(req.params.id);
    if (!track) return res.status(404).json({ error: '轨迹不存在' });
    if (track.user_id !== req.user.id) return res.status(403).json({ error: '无权访问' });
    track.points = track.points ? JSON.parse(track.points) : [];
    track.proof_images = track.proof_images ? JSON.parse(track.proof_images) : [];
    res.json(track);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/tracks（需要JWT）
router.post('/', auth, (req, res) => {
  try {
    const { name, peak_name, date, distance, distance_km, elevation, elevation_gain,
            max_elevation, start_elevation, duration, duration_minutes, weather, notes, image, points } = req.body;
    const pointsArr = Array.isArray(points) ? points : [];
    const pointsStr = pointsArr.length > 0 ? JSON.stringify(pointsArr) : null;
    const check = validateTrack(pointsArr);
    const flagged = check.ok ? 0 : 1;
    const flagReason = check.ok ? null : check.reason;
    const result = db.prepare(`
      INSERT INTO tracks (user_id, name, peak_name, date, distance, distance_km, elevation, elevation_gain,
                          max_elevation, start_elevation, duration, duration_minutes, weather, notes, image, points, flagged, flag_reason)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.user.id, name, peak_name || name || '', date,
           distance || distance_km || 0, distance_km || distance || 0,
           elevation || elevation_gain || 0, elevation_gain || elevation || 0,
           max_elevation || 0, start_elevation || 0,
           duration || '', duration_minutes || 0,
           weather || '', notes || '', image || '', pointsStr, flagged, flagReason);
    const track = db.prepare(`
      SELECT id, name, peak_name, date, distance, distance_km, elevation, elevation_gain,
             max_elevation, start_elevation, duration, duration_minutes, weather, notes, image, points
      FROM tracks WHERE id = ?
    `).get(result.lastInsertRowid);
    track.points = track.points ? JSON.parse(track.points) : [];
    res.json({ ...track, flagged, rewardGranted: !flagged, ...(flagReason ? { flagReason } : {}) });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

/**
 * POST /api/tracks/import-gpx — 从已解析的GPX点数据导入轨迹（需要JWT）
 * 前端先调用 /api/upload/gpx 得到轨迹点数组，再调用此接口存库
 */
router.post('/import-gpx', auth, (req, res) => {
  try {
    const { name, peak_name, date, distance_km, elevation_gain, points, weather, notes } = req.body;
    if (!points || !Array.isArray(points) || points.length < 2) {
      return res.status(400).json({ error: '轨迹点数据不足，至少需要2个点' });
    }
    const pointsStr = JSON.stringify(points);
    // 计算距离（若未提供）
    let distKm = parseFloat(distance_km) || 0;
    if (!distKm && points.length >= 2) {
      let total = 0;
      // Pre-convert latitudes to radians for efficiency
      const rads = points.map(p => ({ lat: p.lat * Math.PI / 180, lng: p.lng * Math.PI / 180 }));
      for (let i = 1; i < points.length; i++) {
        const a = rads[i - 1], b = rads[i];
        const dLat = b.lat - a.lat;
        const dLng = b.lng - a.lng;
        const ha = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat) * Math.cos(b.lat) * Math.sin(dLng / 2) ** 2;
        total += 6371 * 2 * Math.atan2(Math.sqrt(ha), Math.sqrt(1 - ha));
      }
      distKm = Math.round(total * 10) / 10;
    }
    // 计算爬升（若未提供）
    let eleGain = parseFloat(elevation_gain) || 0;
    if (!eleGain) {
      for (let i = 1; i < points.length; i++) {
        const diff = (points[i].ele || 0) - (points[i - 1].ele || 0);
        if (diff > 0) eleGain += diff;
      }
      eleGain = Math.round(eleGain);
    }
    const check = validateTrack(points);
    const flagged = check.ok ? 0 : 1;
    const flagReason = check.ok ? null : check.reason;
    const trackDate = date || new Date().toISOString().split('T')[0];
    const result = db.prepare(`
      INSERT INTO tracks (user_id, name, peak_name, date, distance, distance_km, elevation, elevation_gain,
                          points, weather, notes, flagged, flag_reason)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.user.id, name || peak_name || '导入轨迹', peak_name || '', trackDate,
           distKm, distKm, eleGain, eleGain, pointsStr,
           weather || '', notes || '', flagged, flagReason);
    const track = db.prepare(`
      SELECT id, name, peak_name, date, distance_km, elevation_gain, points, created_at
      FROM tracks WHERE id = ?
    `).get(result.lastInsertRowid);
    track.points = track.points ? JSON.parse(track.points) : [];
    res.json({ ...track, imported: true, flagged, rewardGranted: !flagged });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

/**
 * POST /api/tracks/manual — 手动记录登顶（无GPS轨迹，需要JWT）
 * 适合真实攀登但无轨迹记录的情况，需提供照片等证明材料
 */
router.post('/manual', auth, (req, res) => {
  try {
    const { peak_name, date, altitude, notes, proof_images } = req.body;
    if (!peak_name) return res.status(400).json({ error: '山峰名称不能为空' });
    if (!date) return res.status(400).json({ error: '攀登日期不能为空' });
    const proofArr = Array.isArray(proof_images) ? proof_images : [];
    if (proofArr.length === 0) return res.status(400).json({ error: '请至少上传一张证明照片' });
    const proofStr = JSON.stringify(proofArr);
    const result = db.prepare(`
      INSERT INTO tracks (user_id, name, peak_name, date, elevation, elevation_gain,
                          notes, image, is_manual, proof_images, flagged, flag_reason)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 0, NULL)
    `).run(req.user.id, peak_name + ' 登顶记录', peak_name, date,
           altitude || 0, altitude || 0, notes || '', proofArr[0] || '', proofStr);
    const track = db.prepare(`
      SELECT id, name, peak_name, date, elevation, notes, image, is_manual, proof_images, created_at
      FROM tracks WHERE id = ?
    `).get(result.lastInsertRowid);
    track.proof_images = track.proof_images ? JSON.parse(track.proof_images) : [];
    // Also insert to summit_records for leaderboard
    try {
      const user = db.prepare('SELECT name, avatar FROM users WHERE id = ?').get(req.user.id);
      db.prepare(`
        INSERT INTO summit_records (user_id, name, avatar, peak, date)
        VALUES (?, ?, ?, ?, ?)
      `).run(req.user.id, user ? user.name : '', user ? user.avatar : '', peak_name, date);
    } catch(e) {}
    res.json({ ...track, manual: true, rewardGranted: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// DELETE /api/tracks/:id
router.delete('/:id', auth, (req, res) => {
  try {
    const track = db.prepare('SELECT * FROM tracks WHERE id = ?').get(req.params.id);
    if (!track) return res.status(404).json({ error: '轨迹不存在' });
    if (track.user_id !== req.user.id) return res.status(403).json({ error: '无权删除' });
    db.prepare('DELETE FROM tracks WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

/**
 * GET /api/tracks/:id/export?format=gpx|kml
 * 导出轨迹为 GPX 1.1 或 KML 2.2 格式。
 * 公开轨迹（is_public=1）任何人可下载；非公开轨迹仅作者可下载。
 */
router.get('/:id/export', exportLimiter, (req, res) => {
  try {
    const track = db.prepare(`
      SELECT id, user_id, name, peak_name, date, points, is_public
      FROM tracks WHERE id = ?
    `).get(req.params.id);
    if (!track) return res.status(404).json({ error: '轨迹不存在' });

    // 权限校验：非公开轨迹需要登录且是作者
    if (!track.is_public) {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(403).json({ error: '该轨迹非公开，请登录后访问' });
      }
      try {
        const JWT_SECRET = process.env.JWT_SECRET || 'summitlink_dev_secret_do_not_use_in_production';
        const payload = jwt.verify(authHeader.slice(7), JWT_SECRET);
        if (payload.id !== track.user_id) return res.status(403).json({ error: '无权下载该轨迹' });
      } catch (e) {
        return res.status(403).json({ error: '登录状态无效，请重新登录' });
      }
    }

    const format = (req.query.format || 'gpx').toLowerCase();
    const points = track.points ? JSON.parse(track.points) : [];
    const trackName = track.name || track.peak_name || '轨迹';

    if (format === 'gpx') {
      const trkpts = points.map(p => {
        const lat = p.lat || p[1] || 0;
        const lon = p.lng || p.lon || p[0] || 0;
        const ele = p.alt || p.ele || p[2] || 0;
        const timeVal = p.ts || p.time;
        const time = timeVal ? `<time>${new Date(timeVal).toISOString()}</time>` : '';
        return `    <trkpt lat="${lat}" lon="${lon}"><ele>${ele}</ele>${time}</trkpt>`;
      }).join('\n');
      const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="SummitLink" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${escapeXml(trackName)}</name></metadata>
  <trk>
    <name>${escapeXml(trackName)}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;
      res.setHeader('Content-Type', 'application/gpx+xml');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(trackName)}.gpx"`);
      return res.send(gpx);
    }

    if (format === 'kml') {
      const coords = points.map(p => {
        const lon = p.lng || p.lon || p[0] || 0;
        const lat = p.lat || p[1] || 0;
        const ele = p.alt || p.ele || p[2] || 0;
        return `${lon},${lat},${ele}`;
      }).join(' ');
      const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${escapeXml(trackName)}</name>
    <Placemark>
      <name>${escapeXml(trackName)}</name>
      <LineString>
        <tessellate>1</tessellate>
        <altitudeMode>clampToGround</altitudeMode>
        <coordinates>${coords}</coordinates>
      </LineString>
    </Placemark>
  </Document>
</kml>`;
      res.setHeader('Content-Type', 'application/vnd.google-earth.kml+xml');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(trackName)}.kml"`);
      return res.send(kml);
    }

    res.status(400).json({ error: 'format 参数必须为 gpx 或 kml' });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

/** 转义 XML 特殊字符 */
function escapeXml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

module.exports = router;
