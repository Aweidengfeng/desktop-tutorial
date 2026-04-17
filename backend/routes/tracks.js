const express = require('express');
const router = express.Router();
const db = require('../db/database');
const auth = require('../middleware/auth');

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

module.exports = router;
