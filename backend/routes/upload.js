const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const auth = require('../middleware/auth');
const { uploadLimiter } = require('../middleware/rateLimits');

// 确保上传目录存在（支持 UPLOADS_DIR 环境变量覆盖路径）
const uploadDir = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(process.cwd(), 'backend', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const name = crypto.randomUUID() + ext;
    cb(null, name);
  },
});

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/x-m4v', 'video/mpeg'];
const ALLOWED_GPX_TYPES = ['application/gpx+xml', 'application/xml', 'text/xml', 'application/octet-stream'];

const imageFilter = (req, file, cb) => {
  if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) cb(null, true);
  else cb(new Error('只允许上传图片文件（jpg/png/gif/webp）'));
};

const videoFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_VIDEO_TYPES.includes(file.mimetype) || ext === '.mp4' || ext === '.mov' || ext === '.m4v') {
    cb(null, true);
  } else {
    cb(new Error('只允许上传视频文件（mp4/mov/m4v）'));
  }
};

const gpxFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === '.gpx' || ALLOWED_GPX_TYPES.includes(file.mimetype)) cb(null, true);
  else cb(new Error('只允许上传 GPX 轨迹文件'));
};

const upload = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB 单文件上限（图片）
});

const uploadVideo = multer({
  storage,
  fileFilter: videoFilter,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB（视频）
});

const uploadGpx = multer({
  storage,
  fileFilter: gpxFilter,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB（GPX文件）
});

// POST /api/upload — 单张图片上传（需要JWT）
router.post('/', uploadLimiter, auth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '未收到文件' });
  const url = '/uploads/' + req.file.filename;
  res.json({ url, filename: req.file.filename });
});

// POST /api/upload/multiple — 多张图片上传（最多9张，需要JWT）
router.post('/multiple', uploadLimiter, auth, upload.array('files', 9), (req, res) => {
  if (!req.files || req.files.length === 0) return res.status(400).json({ error: '未收到文件' });
  const urls = req.files.map(f => '/uploads/' + f.filename);
  res.json({ urls });
});

// POST /api/upload/video — 视频上传（最多200MB，需要JWT）
router.post('/video', uploadLimiter, auth, uploadVideo.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '未收到视频文件' });
  const url = '/uploads/' + req.file.filename;
  res.json({ url, filename: req.file.filename, size: req.file.size });
});

// POST /api/upload/gpx — GPX轨迹文件上传（解析后返回轨迹点，需要JWT）
router.post('/gpx', uploadLimiter, auth, uploadGpx.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '未收到 GPX 文件' });
  try {
    const content = fs.readFileSync(req.file.path, 'utf8');
    // Simple GPX parser: extract trkpt elements using matchAll
    const points = [];
    const trkptRe = /<trkpt\s+lat="([^"]+)"\s+lon="([^"]+)"[^>]*>([\s\S]*?)<\/trkpt>/g;
    for (const m of content.matchAll(trkptRe)) {
      const lat = parseFloat(m[1]);
      const lng = parseFloat(m[2]);
      const inner = m[3];
      const eleMatch = inner.match(/<ele>([\d.]+)<\/ele>/);
      const timeMatch = inner.match(/<time>([^<]+)<\/time>/);
      const point = { lat, lng };
      if (eleMatch) point.ele = parseFloat(eleMatch[1]);
      if (timeMatch) point.ts = new Date(timeMatch[1]).getTime();
      points.push(point);
    }
    // Extract track name
    const nameMatch = content.match(/<name>([^<]+)<\/name>/);
    const trackName = nameMatch ? nameMatch[1].trim() : req.file.originalname.replace('.gpx', '');
    // Clean up temp file
    fs.unlink(req.file.path, () => {});
    res.json({ name: trackName, points, count: points.length });
  } catch (e) {
    fs.unlink(req.file.path, () => {});
    res.status(400).json({ error: 'GPX 文件解析失败，请检查文件格式' });
  }
});

module.exports = router;
