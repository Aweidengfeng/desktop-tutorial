/**
 * ossUpload.js — 阿里云 OSS 上传中间件（渐进增强）
 * 若未配置 OSS_BUCKET，则降级为本地磁盘存储（现有逻辑）。
 *
 * 环境变量：
 *   OSS_BUCKET         阿里云 OSS Bucket 名称
 *   OSS_REGION         如 oss-cn-hangzhou
 *   OSS_ACCESS_KEY_ID  阿里云 AccessKeyId
 *   OSS_ACCESS_KEY_SECRET
 *   OSS_CDN_HOST       （可选）CDN 域名，如 https://cdn.summitlink.com
 */
const path = require('path');
const crypto = require('crypto');

const OSS_ENABLED = !!(
  process.env.OSS_BUCKET &&
  process.env.OSS_REGION &&
  process.env.OSS_ACCESS_KEY_ID &&
  process.env.OSS_ACCESS_KEY_SECRET
);

let ossClient = null;

function getOssClient() {
  if (ossClient) return ossClient;
  try {
    const OSS = require('ali-oss');
    ossClient = new OSS({
      region: process.env.OSS_REGION,
      accessKeyId: process.env.OSS_ACCESS_KEY_ID,
      accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
      bucket: process.env.OSS_BUCKET,
      secure: true,
    });
    return ossClient;
  } catch (e) {
    console.error('[OSS] ali-oss 未安装或初始化失败，降级为本地存储:', e.message);
    return null;
  }
}

/**
 * 上传 Buffer 到 OSS，返回公开访问 URL
 * @param {Buffer} buffer  文件内容
 * @param {string} originalname  原始文件名（用于获取扩展名）
 * @param {string} [folder='uploads']  OSS 路径前缀
 * @returns {Promise<string>}  公开 URL
 */
async function uploadToOss(buffer, originalname, folder = 'uploads') {
  const client = getOssClient();
  if (!client) throw new Error('OSS client not available');
  const ext = path.extname(originalname) || '.jpg';
  const key = `${folder}/${crypto.randomUUID()}${ext}`;
  await client.put(key, buffer);
  const cdnHost = process.env.OSS_CDN_HOST;
  if (cdnHost) return `${cdnHost.replace(/\/$/, '')}/${key}`;
  return `https://${process.env.OSS_BUCKET}.${process.env.OSS_REGION}.aliyuncs.com/${key}`;
}

/**
 * 从磁盘文件安全读取 buffer，仅允许读取 allowedDir 内的文件
 * @param {string} filePath  multer 写盘后的文件路径
 * @param {string} allowedDir  受控上传目录（绝对路径）
 * @returns {Buffer|null}
 */
function safeReadFile(filePath, allowedDir) {
  const fs = require('fs');
  const resolved = path.resolve(filePath);
  const dir = path.resolve(allowedDir);
  if (!resolved.startsWith(dir + path.sep) && resolved !== dir) {
    console.error('[OSS] 路径越界，拒绝读取:', resolved);
    return null;
  }
  try {
    const buf = fs.readFileSync(resolved);
    try { fs.unlinkSync(resolved); } catch (e) { console.warn('[OSS] 临时文件删除失败:', e.message); }
    return buf;
  } catch (e) {
    return null;
  }
}

/**
 * 为已挂载到 req 上的文件执行 OSS 上传，并将 f.ossUrl 设为公开 URL。
 * 若文件已有 buffer（memoryStorage），直接上传；
 * 若文件在磁盘（diskStorage），从 allowedDir 内安全读取后上传。
 * @param {object[]} files  multer 文件对象数组
 * @param {string} [allowedDir]  允许读取的磁盘目录（diskStorage 时使用）
 * @returns {Promise<void>}
 */
async function uploadFilesToOss(files, allowedDir) {
  for (const f of files) {
    let buf = f.buffer || null;
    if (!buf && f.path && allowedDir) {
      buf = safeReadFile(f.path, allowedDir);
    }
    if (buf) {
      f.ossUrl = await uploadToOss(buf, f.originalname);
    }
  }
}

/**
 * Express 中间件：将 req.file / req.files 上传到 OSS，
 * 并将各文件的 ossUrl 设为 OSS 公开 URL。
 * 若 OSS 未启用，直接 next()（降级本地存储）。
 * @param {string} [allowedDir]  磁盘存储时允许读取的目录（绑定到路由时传入）
 */
function ossUploadMiddleware(allowedDir) {
  return async function (req, res, next) {
    if (!OSS_ENABLED) return next();
    if (!req.file && (!req.files || req.files.length === 0)) return next();
    try {
      const files = req.file ? [req.file] : req.files;
      await uploadFilesToOss(files, allowedDir);
      next();
    } catch (e) {
      console.error('[OSS] 上传失败，降级本地存储:', e.message);
      next(); // 降级不阻断
    }
  };
}

module.exports = { OSS_ENABLED, uploadToOss, uploadFilesToOss, ossUploadMiddleware };
