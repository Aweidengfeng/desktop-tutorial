const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const auth = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

// 上传速率限制：每分钟最多 20 次
const uploadRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: '上传过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
});

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

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error('只允许上传图片文件（jpg/png/gif/webp）'));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB 单文件上限
});

// POST /api/upload — 单张图片上传（需要JWT）
router.post('/', uploadRateLimit, auth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '未收到文件' });
  const url = '/uploads/' + req.file.filename;
  res.json({ url, filename: req.file.filename });
});

// POST /api/upload/multiple — 多张图片上传（最多9张，需要JWT）
router.post('/multiple', uploadRateLimit, auth, upload.array('files', 9), (req, res) => {
  if (!req.files || req.files.length === 0) return res.status(400).json({ error: '未收到文件' });
  const urls = req.files.map(f => '/uploads/' + f.filename);
  res.json({ urls });
});

module.exports = router;
