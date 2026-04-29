const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const auth = require('../middleware/auth');
const { uploadLimiter } = require('../middleware/rateLimits');
const { checkImageSafety, reviewImageFile } = require('../middleware/contentSafety');
const prisma = require('../db/prisma');

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
router.post('/', uploadLimiter, auth, (req, res, next) => {
  upload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message || '文件类型不支持（仅支持 jpg/png/gif/webp）' });
    if (!req.file) return res.status(400).json({ error: '未收到文件' });
    // 内容安全审核（multer 写盘后调用，生产环境有效）
    try {
      const review = await reviewImageFile(req.file.path);
      if (review.suggestion === 'block') {
        fs.unlink(req.file.path, () => {});
        return res.status(400).json({ error: '图片内容违规，上传被拒绝' });
      }
      if (review.suggestion === 'review') {
        console.warn('[contentSafety] 图片需人工复审:', req.file.filename);
      }
    } catch (e) {
      console.error('[contentSafety] 审核异常，放行：', e.message);
    }
    const url = '/uploads/' + req.file.filename;
    prisma.$executeRaw`
      INSERT INTO images (url, filename, size, mime_type, owner_type, owner_id, field_name)
      VALUES (${url}, ${req.file.filename}, ${req.file.size || null}, ${req.file.mimetype || null}, ${'user'}, ${req.user.id}, ${null})
    `.catch((e) => console.error('[upload] images 记录写入失败:', e.message));
    res.json({ url, filename: req.file.filename });
  });
});

// POST /api/upload/multiple — 多张图片上传（最多9张，需要JWT）
router.post('/multiple', uploadLimiter, auth, (req, res, next) => {
  upload.array('files', 9)(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message || '文件类型不支持（仅支持 jpg/png/gif/webp）' });
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: '未收到文件' });
    // 内容安全审核：逐一审核每张图片
    for (const f of req.files) {
      try {
        const review = await reviewImageFile(f.path);
        if (review.suggestion === 'block') {
          // 删除所有已上传文件
          for (const rf of req.files) fs.unlink(rf.path, () => {});
          return res.status(400).json({ error: '图片内容违规，上传被拒绝' });
        }
        if (review.suggestion === 'review') {
          console.warn('[contentSafety] 图片需人工复审:', f.filename);
        }
      } catch (e) {
        console.error('[contentSafety] 审核异常，放行：', e.message);
      }
    }
    const urls = req.files.map(f => '/uploads/' + f.filename);
    for (const f of req.files) {
      prisma.$executeRaw`
        INSERT INTO images (url, filename, size, mime_type, owner_type, owner_id, field_name)
        VALUES (${'/uploads/' + f.filename}, ${f.filename}, ${f.size || null}, ${f.mimetype || null}, ${'user'}, ${req.user.id}, ${null})
      `.catch((e) => console.error('[upload] images 记录写入失败:', e.message));
    }
    res.json({ urls });
  });
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
