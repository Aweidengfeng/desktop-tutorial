const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const prisma = require('../db/prisma');
const auth = require('../middleware/auth');
const rateLimit = require('express-rate-limit');
const { validateTrack } = require('../utils/trackValidator');

// 坐标精度规范化（统一保留6位小数）
function normalizeCoord(v, decimals = 6) {
  const n = parseFloat(v);
  if (isNaN(n)) return null;
  return parseFloat(n.toFixed(decimals));
}

// 导出限流：每分钟最多30次
const exportLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: '请求过于频繁，请稍后再试' },
});

// GET /api/tracks — 获取轨迹列表（支持 user_id=me 过滤）
/**
 * @swagger
 * /api/tracks:
 *   get:
 *     tags: [轨迹]
 *     summary: 获取当前用户的轨迹列表
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 轨迹数组
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Track'
 *       401:
 *         description: 未登录
 *   post:
 *     tags: [轨迹]
 *     summary: 上传轨迹
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, points]
 *             properties:
 *               name: { type: string, description: 轨迹名称 }
 *               peak_name: { type: string }
 *               date: { type: string, format: date }
 *               distance: { type: number }
 *               elevation_gain: { type: number }
 *               duration: { type: integer }
 *               notes: { type: string }
 *               points:
 *                 type: array
 *                 description: GPS 坐标点数组
 *                 items:
 *                   type: object
 *                   properties:
 *                     lat: { type: number }
 *                     lng: { type: number }
 *                     ele: { type: number }
 *     responses:
 *       200:
 *         description: 轨迹创建成功
 *       400:
 *         description: 参数错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', auth, async (req, res) => {
  try {
    const tracks = await prisma.$queryRaw`
      SELECT id, name, peak_name, date, distance, distance_km, elevation, elevation_gain,
             max_elevation, start_elevation, duration, duration_minutes, weather, notes, image, points,
             is_manual, proof_images, created_at
      FROM tracks WHERE user_id = ${req.user.id}
      ORDER BY date DESC
    `;
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
router.get('/my', auth, async (req, res) => {
  try {
    const tracks = await prisma.$queryRaw`
      SELECT id, name, peak_name, date, distance, distance_km, elevation, elevation_gain,
             max_elevation, start_elevation, duration, duration_minutes, weather, notes, image, points,
             is_manual, proof_images
      FROM tracks WHERE user_id = ${req.user.id}
      ORDER BY date DESC
    `;
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
router.get('/:id', auth, async (req, res) => {
  try {
    const trackId = parseInt(req.params.id);
    const [track] = await prisma.$queryRaw`
      SELECT id, user_id, name, peak_name, date, distance, distance_km, elevation, elevation_gain,
             max_elevation, start_elevation, duration, duration_minutes, weather, notes, image, points,
             is_manual, proof_images, created_at
      FROM tracks WHERE id = ${trackId}
    `;
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
router.post('/', auth, async (req, res) => {
  try {
    const { name, peak_name, date, distance, distance_km, elevation, elevation_gain,
            max_elevation, start_elevation, duration, duration_minutes, weather, notes, image, points } = req.body;
    const rawPoints = Array.isArray(points) ? points : [];
    const pointsArr = rawPoints.map(p => ({
      lat: normalizeCoord(p.lat),
      lng: normalizeCoord(p.lng),
      ele: p.ele != null ? normalizeCoord(p.ele, 1) : null,
      ts: p.ts || null,
    })).filter(p => p.lat !== null && p.lng !== null);
    const pointsStr = pointsArr.length > 0 ? JSON.stringify(pointsArr) : null;
    const check = validateTrack(pointsArr);
    const flagged = check.ok ? 0 : 1;
    const flagReason = check.ok ? null : check.reason;
    const dist = distance || distance_km || 0;
    const distKm = distance_km || distance || 0;
    const elev = elevation || elevation_gain || 0;
    const elevGain = elevation_gain || elevation || 0;
    const [{ id: newTrackId }] = await prisma.$queryRaw`
      INSERT INTO tracks (user_id, name, peak_name, date, distance, distance_km, elevation, elevation_gain,
                          max_elevation, start_elevation, duration, duration_minutes, weather, notes, image, points, flagged, flag_reason)
      VALUES (${req.user.id}, ${name}, ${peak_name || name || ''}, ${date},
              ${dist}, ${distKm}, ${elev}, ${elevGain},
              ${max_elevation || 0}, ${start_elevation || 0},
              ${duration || ''}, ${duration_minutes || 0},
              ${weather || ''}, ${notes || ''}, ${image || ''}, ${pointsStr}, ${flagged}, ${flagReason})
      RETURNING id
    `;
    const [track] = await prisma.$queryRaw`
      SELECT id, name, peak_name, date, distance, distance_km, elevation, elevation_gain,
             max_elevation, start_elevation, duration, duration_minutes, weather, notes, image, points
      FROM tracks WHERE id = ${newTrackId}
    `;
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
router.post('/import-gpx', auth, async (req, res) => {
  try {
    const { name, peak_name, date, distance_km, elevation_gain, points, weather, notes } = req.body;
    if (!points || !Array.isArray(points) || points.length < 2) {
      return res.status(400).json({ error: '轨迹点数据不足，至少需要2个点' });
    }
    const normalizedPoints = points.map(p => ({
      lat: normalizeCoord(p.lat),
      lng: normalizeCoord(p.lng),
      ele: p.ele != null ? normalizeCoord(p.ele, 1) : null,
      ts: p.ts || null,
    })).filter(p => p.lat !== null && p.lng !== null);
    if (normalizedPoints.length < 2) {
      return res.status(400).json({ error: '轨迹点数据不足，至少需要2个有效点' });
    }
    const pointsStr = JSON.stringify(normalizedPoints);
    // 计算距离（若未提供）
    let distKm = parseFloat(distance_km) || 0;
    if (!distKm && normalizedPoints.length >= 2) {
      let total = 0;
      // Pre-convert latitudes to radians for efficiency
      const rads = normalizedPoints.map(p => ({ lat: p.lat * Math.PI / 180, lng: p.lng * Math.PI / 180 }));
      for (let i = 1; i < normalizedPoints.length; i++) {
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
      for (let i = 1; i < normalizedPoints.length; i++) {
        const diff = (normalizedPoints[i].ele || 0) - (normalizedPoints[i - 1].ele || 0);
        if (diff > 0) eleGain += diff;
      }
      eleGain = Math.round(eleGain);
    }
    const check = validateTrack(normalizedPoints);
    const flagged = check.ok ? 0 : 1;
    const flagReason = check.ok ? null : check.reason;
    const trackDate = date || new Date().toISOString().split('T')[0];
    const [{ id: newTrackId }] = await prisma.$queryRaw`
      INSERT INTO tracks (user_id, name, peak_name, date, distance, distance_km, elevation, elevation_gain,
                          points, weather, notes, flagged, flag_reason)
      VALUES (${req.user.id}, ${name || peak_name || '导入轨迹'}, ${peak_name || ''}, ${trackDate},
              ${distKm}, ${distKm}, ${eleGain}, ${eleGain}, ${pointsStr},
              ${weather || ''}, ${notes || ''}, ${flagged}, ${flagReason})
      RETURNING id
    `;
    const [track] = await prisma.$queryRaw`
      SELECT id, name, peak_name, date, distance_km, elevation_gain, points, created_at
      FROM tracks WHERE id = ${newTrackId}
    `;
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
router.post('/manual', auth, async (req, res) => {
  try {
    const { peak_name, date, altitude, notes, proof_images } = req.body;
    if (!peak_name) return res.status(400).json({ error: '山峰名称不能为空' });
    if (!date) return res.status(400).json({ error: '攀登日期不能为空' });
    const proofArr = Array.isArray(proof_images) ? proof_images : [];
    if (proofArr.length === 0) return res.status(400).json({ error: '请至少上传一张证明照片' });
    const proofStr = JSON.stringify(proofArr);
    const alt = altitude || 0;
    const [{ id: newTrackId }] = await prisma.$queryRaw`
      INSERT INTO tracks (user_id, name, peak_name, date, elevation, elevation_gain,
                          notes, image, is_manual, proof_images, flagged, flag_reason)
      VALUES (${req.user.id}, ${peak_name + ' 登顶记录'}, ${peak_name}, ${date},
              ${alt}, ${alt}, ${notes || ''}, ${proofArr[0] || ''}, 1, ${proofStr}, 0, NULL)
      RETURNING id
    `;
    const [track] = await prisma.$queryRaw`
      SELECT id, name, peak_name, date, elevation, notes, image, is_manual, proof_images, created_at
      FROM tracks WHERE id = ${newTrackId}
    `;
    track.proof_images = track.proof_images ? JSON.parse(track.proof_images) : [];
    // Also insert to summit_records for leaderboard
    try {
      const [user] = await prisma.$queryRaw`SELECT name, avatar FROM users WHERE id = ${req.user.id}`;
      await prisma.$executeRaw`
        INSERT INTO summit_records (user_id, name, avatar, peak, date)
        VALUES (${req.user.id}, ${user ? user.name : ''}, ${user ? user.avatar : ''}, ${peak_name}, ${date})
      `;
    } catch(e) {}
    res.json({ ...track, manual: true, rewardGranted: true });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// DELETE /api/tracks/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const trackId = parseInt(req.params.id);
    const [track] = await prisma.$queryRaw`SELECT * FROM tracks WHERE id = ${trackId}`;
    if (!track) return res.status(404).json({ error: '轨迹不存在' });
    if (track.user_id !== req.user.id) return res.status(403).json({ error: '无权删除' });
    await prisma.$executeRaw`DELETE FROM tracks WHERE id = ${trackId}`;
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
router.get('/:id/export', exportLimiter, async (req, res) => {
  try {
    const trackId = parseInt(req.params.id);
    const [track] = await prisma.$queryRaw`
      SELECT id, user_id, name, peak_name, date, points, is_public
      FROM tracks WHERE id = ${trackId}
    `;
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
