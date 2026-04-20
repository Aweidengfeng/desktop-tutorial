const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const auth = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

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
             max_elevation, start_elevation, duration, duration_minutes, weather, notes, image, points, created_at
      FROM tracks WHERE user_id = ?
      ORDER BY date DESC
    `).all(req.user.id);
    const parsed = tracks.map(t => ({ ...t, points: t.points ? JSON.parse(t.points) : [] }));
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
             max_elevation, start_elevation, duration, duration_minutes, weather, notes, image, points
      FROM tracks WHERE user_id = ?
      ORDER BY date DESC
    `).all(req.user.id);
    const parsed = tracks.map(t => ({ ...t, points: t.points ? JSON.parse(t.points) : [] }));
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
             max_elevation, start_elevation, duration, duration_minutes, weather, notes, image, points, created_at
      FROM tracks WHERE id = ?
    `).get(req.params.id);
    if (!track) return res.status(404).json({ error: '轨迹不存在' });
    if (track.user_id !== req.user.id) return res.status(403).json({ error: '无权访问' });
    track.points = track.points ? JSON.parse(track.points) : [];
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
    const result = db.prepare(`
      INSERT INTO tracks (user_id, name, peak_name, date, distance, distance_km, elevation, elevation_gain,
                          max_elevation, start_elevation, duration, duration_minutes, weather, notes, image, points)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.user.id, name, peak_name || name || '', date,
           distance || distance_km || 0, distance_km || distance || 0,
           elevation || elevation_gain || 0, elevation_gain || elevation || 0,
           max_elevation || 0, start_elevation || 0,
           duration || '', duration_minutes || 0,
           weather || '', notes || '', image || '', pointsStr);
    const track = db.prepare(`
      SELECT id, name, peak_name, date, distance, distance_km, elevation, elevation_gain,
             max_elevation, start_elevation, duration, duration_minutes, weather, notes, image, points
      FROM tracks WHERE id = ?
    `).get(result.lastInsertRowid);
    track.points = track.points ? JSON.parse(track.points) : [];
    res.json(track);
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
        const time = p.time ? `<time>${new Date(p.time).toISOString()}</time>` : '';
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
