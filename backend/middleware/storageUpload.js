/**
 * storageUpload.js — 对象存储上传中间件（渐进增强）
 * 若未配置 COS，则降级为本地磁盘存储（现有逻辑）。
 *
 * 环境变量：
 *   COS_BUCKET         腾讯云 COS Bucket 名称
 *   COS_REGION         如 ap-beijing
 *   COS_SECRET_ID      腾讯云 SecretId
 *   COS_SECRET_KEY     腾讯云 SecretKey
 *   COS_CDN_DOMAIN     （可选）CDN 域名，如 https://cdn.unsummit.cn
 */
const path = require('path');
const crypto = require('crypto');
const { uploadFile } = require('../lib/storage');

const CLOUD_STORAGE_ENABLED = !!(
  process.env.COS_BUCKET &&
  process.env.COS_REGION &&
  process.env.COS_SECRET_ID &&
  process.env.COS_SECRET_KEY
);

/**
 * 上传 Buffer 到对象存储，返回公开访问 URL
 * @param {Buffer} buffer 文件内容
 * @param {string} originalname 原始文件名（用于获取扩展名）
 * @param {string} [folder='uploads'] 存储路径前缀
 * @param {string} [contentType] MIME 类型
 * @returns {Promise<string>} 公开 URL
 */
async function uploadToStorage(buffer, originalname, folder = 'uploads', contentType = 'application/octet-stream') {
  const ext = path.extname(originalname) || '.jpg';
  const key = `${folder}/${crypto.randomUUID()}${ext}`;
  const result = await uploadFile(buffer, key, { region: 'cn', contentType });
  return result.url;
}

/**
 * 从磁盘文件安全读取 buffer，仅允许读取 allowedDir 内的文件
 * @param {string} filePath multer 写盘后的文件路径
 * @param {string} allowedDir 受控上传目录（绝对路径）
 * @returns {Buffer|null}
 */
function safeReadFile(filePath, allowedDir) {
  const fs = require('fs');
  const resolved = path.resolve(filePath);
  const dir = path.resolve(allowedDir);
  if (!resolved.startsWith(dir + path.sep) && resolved !== dir) {
    console.error('[storage] 路径越界，拒绝读取:', resolved);
    return null;
  }
  try {
    const buf = fs.readFileSync(resolved);
    try { fs.unlinkSync(resolved); } catch (e) { console.warn('[storage] 临时文件删除失败:', e.message); }
    return buf;
  } catch (e) {
    return null;
  }
}

/**
 * 为已挂载到 req 上的文件执行对象存储上传，并将 f.storageUrl 设为公开 URL。
 * 若文件已有 buffer（memoryStorage），直接上传；
 * 若文件在磁盘（diskStorage），从 allowedDir 内安全读取后上传。
 * @param {object[]} files multer 文件对象数组
 * @param {string} [allowedDir] 允许读取的磁盘目录（diskStorage 时使用）
 * @returns {Promise<void>}
 */
async function uploadFilesToStorage(files, allowedDir) {
  for (const f of files) {
    let buf = f.buffer || null;
    if (!buf && f.path && allowedDir) {
      buf = safeReadFile(f.path, allowedDir);
    }
    if (buf) {
      f.storageUrl = await uploadToStorage(buf, f.originalname, 'uploads', f.mimetype || 'application/octet-stream');
    }
  }
}

/**
 * Express 中间件：将 req.file / req.files 上传到对象存储，
 * 并将各文件的 storageUrl 设为公开 URL。
 * 若对象存储未启用，直接 next()（降级本地存储）。
 * @param {string} [allowedDir] 磁盘存储时允许读取的目录（绑定到路由时传入）
 */
function storageUploadMiddleware(allowedDir) {
  return async function (req, res, next) {
    if (!CLOUD_STORAGE_ENABLED) return next();
    if (!req.file && (!req.files || req.files.length === 0)) return next();
    try {
      const files = req.file ? [req.file] : req.files;
      await uploadFilesToStorage(files, allowedDir);
      next();
    } catch (e) {
      console.error('[storage] 上传失败，降级本地存储:', e.message);
      next();
    }
  };
}

module.exports = { CLOUD_STORAGE_ENABLED, uploadToStorage, uploadFilesToStorage, storageUploadMiddleware };
