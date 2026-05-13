const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

function getLocalUploadsDir() {
  return process.env.UPLOADS_DIR
    ? path.resolve(process.env.UPLOADS_DIR)
    : path.join(__dirname, '..', 'uploads');
}

function ensureParentDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function uploadToLocal(buffer, key) {
  const uploadsDir = getLocalUploadsDir();
  const safeKey = String(key || randomUUID()).replace(/^\/+/, '');
  const targetPath = path.join(uploadsDir, safeKey);
  ensureParentDir(targetPath);
  fs.writeFileSync(targetPath, buffer);
  return { provider: 'local', key: safeKey, url: `/uploads/${safeKey}` };
}

async function uploadToOss(buffer, key, region) {
  if (!process.env.OSS_BUCKET || !process.env.OSS_ACCESS_KEY_ID || !process.env.OSS_ACCESS_KEY_SECRET) {
    return uploadToLocal(buffer, key);
  }

  let OSS;
  try {
    OSS = require('ali-oss');
  } catch (_) {
    return uploadToLocal(buffer, key);
  }

  const resolvedRegion = resolveOssRegion(region);
  const safeKey = String(key || randomUUID()).replace(/^\/+/, '');
  const client = new OSS({
    region: resolvedRegion,
    accessKeyId: process.env.OSS_ACCESS_KEY_ID,
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
    bucket: process.env.OSS_BUCKET,
    secure: true,
  });
  await client.put(safeKey, buffer);
  const cdnHost = process.env.OSS_CDN_HOST || '';
  const url = cdnHost
    ? `${cdnHost.replace(/\/$/, '')}/${safeKey}`
    : `https://${process.env.OSS_BUCKET}.${resolvedRegion}.aliyuncs.com/${safeKey}`;
  return { provider: 'oss', key: safeKey, url };
}

function resolveOssRegion(region) {
  if (region === 'cn') return process.env.OSS_REGION || 'oss-cn-beijing';
  return process.env.OSS_REGION_US || process.env.OSS_REGION || 'oss-us-east-1';
}

async function uploadToS3(buffer, key) {
  const bucket = process.env.S3_BUCKET_US || process.env.S3_BUCKET;
  const region = process.env.S3_REGION_US || process.env.S3_REGION || 'us-east-1';
  if (!bucket) return uploadToLocal(buffer, key);

  let S3Client;
  let PutObjectCommand;
  try {
    ({ S3Client, PutObjectCommand } = require('@aws-sdk/client-s3'));
  } catch (_) {
    console.warn('[storage] @aws-sdk/client-s3 is not installed, fallback to local storage.');
    return uploadToLocal(buffer, key);
  }

  const safeKey = String(key || randomUUID()).replace(/^\/+/, '');
  const client = new S3Client({ region });
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: safeKey,
    Body: buffer,
    ContentType: 'application/octet-stream',
  }));

  const cdnHost = process.env.CDN_HOST_US || '';
  const url = cdnHost
    ? `${cdnHost.replace(/\/$/, '')}/${safeKey}`
    : `https://${bucket}.s3.${region}.amazonaws.com/${safeKey}`;
  return { provider: 's3', key: safeKey, url };
}

async function uploadFile(buffer, key, region = 'us') {
  const provider = String(process.env.STORAGE_PROVIDER || '').toLowerCase();
  if (provider === 'local') return uploadToLocal(buffer, key);
  if (region === 'cn') return uploadToOss(buffer, key, 'cn');
  return uploadToS3(buffer, key);
}

module.exports = { uploadFile };
