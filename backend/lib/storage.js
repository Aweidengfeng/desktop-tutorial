const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

function normalizeOptions(optionsOrRegion, fallbackRegion = 'us') {
  if (typeof optionsOrRegion === 'string') return { region: optionsOrRegion };
  return { region: fallbackRegion, ...(optionsOrRegion || {}) };
}

function normalizeKey(key) {
  return String(key || randomUUID()).replace(/^\/+/, '');
}

function encodeKeyForUrl(key) {
  return normalizeKey(key)
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/');
}

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

function buildLocalUrl(key) {
  return `/uploads/${encodeKeyForUrl(key)}`;
}

function resolveCosBucket() {
  const bucket = String(process.env.COS_BUCKET || '').trim();
  const appId = String(process.env.TENCENT_CLOUD_APPID || '').trim();
  if (!bucket) return '';
  if (/-\d+$/.test(bucket) || !appId) return bucket;
  return `${bucket}-${appId}`;
}

function resolveCosRegion() {
  return process.env.COS_REGION || process.env.TENCENT_CLOUD_REGION || 'ap-beijing';
}

function isCosConfigured() {
  return !!(
    resolveCosBucket() &&
    resolveCosRegion() &&
    process.env.COS_SECRET_ID &&
    process.env.COS_SECRET_KEY
  );
}

function buildCosOriginUrl(key) {
  const bucket = resolveCosBucket();
  const region = resolveCosRegion();
  return `https://${bucket}.cos.${region}.myqcloud.com/${encodeKeyForUrl(key)}`;
}

function buildCosPublicUrl(key) {
  const cdnDomain = String(process.env.COS_CDN_DOMAIN || '').trim();
  if (cdnDomain) return `${cdnDomain.replace(/\/$/, '')}/${encodeKeyForUrl(key)}`;
  return buildCosOriginUrl(key);
}

function getCosClient() {
  const COS = require('cos-nodejs-sdk-v5');
  return new COS({
    SecretId: process.env.COS_SECRET_ID,
    SecretKey: process.env.COS_SECRET_KEY,
  });
}

function callCos(method, params) {
  const client = getCosClient();
  return new Promise((resolve, reject) => {
    client[method](params, (error, data) => (error ? reject(error) : resolve(data)));
  });
}

function getS3Bucket() {
  return process.env.S3_BUCKET_US || process.env.S3_BUCKET;
}

function getS3Region() {
  return process.env.S3_REGION_US || process.env.S3_REGION || 'us-east-1';
}

function getS3Runtime() {
  const bucket = getS3Bucket();
  const region = getS3Region();
  if (!bucket) return null;

  let clientModule;
  try {
    clientModule = require('@aws-sdk/client-s3');
  } catch (_) {
    return null;
  }

  let presignerModule = null;
  try {
    presignerModule = require('@aws-sdk/s3-request-presigner');
  } catch (_) {
    presignerModule = null;
  }

  return {
    bucket,
    region,
    presignerModule,
    ...clientModule,
  };
}

function buildS3PublicUrl(key) {
  const bucket = getS3Bucket();
  const region = getS3Region();
  const cdnHost = process.env.CDN_HOST_US || '';
  if (cdnHost) return `${cdnHost.replace(/\/$/, '')}/${encodeKeyForUrl(key)}`;
  return `https://${bucket}.s3.${region}.amazonaws.com/${encodeKeyForUrl(key)}`;
}

const localProvider = {
  async uploadFile(buffer, key) {
    const uploadsDir = getLocalUploadsDir();
    const safeKey = normalizeKey(key);
    const targetPath = path.join(uploadsDir, safeKey);
    ensureParentDir(targetPath);
    fs.writeFileSync(targetPath, buffer);
    return { provider: 'local', key: safeKey, url: buildLocalUrl(safeKey) };
  },

  async getSignedUrl(key) {
    return buildLocalUrl(key);
  },

  async deleteFile(key) {
    const targetPath = path.join(getLocalUploadsDir(), normalizeKey(key));
    if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
    return { provider: 'local', key: normalizeKey(key), deleted: true };
  },

  async moveFile(fromKey, toKey) {
    const uploadsDir = getLocalUploadsDir();
    const sourcePath = path.join(uploadsDir, normalizeKey(fromKey));
    const targetPath = path.join(uploadsDir, normalizeKey(toKey));
    ensureParentDir(targetPath);
    fs.renameSync(sourcePath, targetPath);
    return { provider: 'local', key: normalizeKey(toKey), url: buildLocalUrl(toKey) };
  },
};

const cosProvider = {
  async uploadFile(buffer, key, options = {}) {
    if (!isCosConfigured()) return localProvider.uploadFile(buffer, key, options);
    const safeKey = normalizeKey(key);
    await callCos('putObject', {
      Bucket: resolveCosBucket(),
      Region: resolveCosRegion(),
      Key: safeKey,
      Body: buffer,
      ContentType: options.contentType || 'application/octet-stream',
    });
    return { provider: 'cos', key: safeKey, url: buildCosPublicUrl(safeKey) };
  },

  async getSignedUrl(key, expiresIn = 3600) {
    if (!isCosConfigured()) return localProvider.getSignedUrl(key, expiresIn);
    const client = getCosClient();
    return client.getObjectUrl({
      Bucket: resolveCosBucket(),
      Region: resolveCosRegion(),
      Key: normalizeKey(key),
      Sign: true,
      Expires: expiresIn,
    });
  },

  async deleteFile(key) {
    if (!isCosConfigured()) return localProvider.deleteFile(key);
    const safeKey = normalizeKey(key);
    await callCos('deleteObject', {
      Bucket: resolveCosBucket(),
      Region: resolveCosRegion(),
      Key: safeKey,
    });
    return { provider: 'cos', key: safeKey, deleted: true };
  },

  async moveFile(fromKey, toKey) {
    if (!isCosConfigured()) return localProvider.moveFile(fromKey, toKey);
    const sourceKey = normalizeKey(fromKey);
    const targetKey = normalizeKey(toKey);
    const bucket = resolveCosBucket();
    const region = resolveCosRegion();
    await callCos('putObjectCopy', {
      Bucket: bucket,
      Region: region,
      Key: targetKey,
      CopySource: `${bucket}.cos.${region}.myqcloud.com/${encodeKeyForUrl(sourceKey)}`,
    });
    await callCos('deleteObject', {
      Bucket: bucket,
      Region: region,
      Key: sourceKey,
    });
    return { provider: 'cos', key: targetKey, url: buildCosPublicUrl(targetKey) };
  },
};

const s3Provider = {
  async uploadFile(buffer, key, options = {}) {
    const runtime = getS3Runtime();
    if (!runtime) return localProvider.uploadFile(buffer, key, options);

    const { S3Client, PutObjectCommand, bucket, region } = runtime;
    const safeKey = normalizeKey(key);
    const client = new S3Client({ region });
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: safeKey,
      Body: buffer,
      ContentType: options.contentType || 'application/octet-stream',
    }));
    return { provider: 's3', key: safeKey, url: buildS3PublicUrl(safeKey) };
  },

  async getSignedUrl(key, expiresIn = 3600) {
    const runtime = getS3Runtime();
    if (!runtime) return localProvider.getSignedUrl(key, expiresIn);

    const { S3Client, GetObjectCommand, presignerModule, region, bucket } = runtime;
    if (presignerModule && typeof presignerModule.getSignedUrl === 'function') {
      const client = new S3Client({ region });
      return presignerModule.getSignedUrl(client, new GetObjectCommand({
        Bucket: bucket,
        Key: normalizeKey(key),
      }), { expiresIn });
    }
    return buildS3PublicUrl(key);
  },

  async deleteFile(key) {
    const runtime = getS3Runtime();
    if (!runtime) return localProvider.deleteFile(key);

    const { S3Client, DeleteObjectCommand, region, bucket } = runtime;
    const safeKey = normalizeKey(key);
    const client = new S3Client({ region });
    await client.send(new DeleteObjectCommand({
      Bucket: bucket,
      Key: safeKey,
    }));
    return { provider: 's3', key: safeKey, deleted: true };
  },

  async moveFile(fromKey, toKey) {
    const runtime = getS3Runtime();
    if (!runtime) return localProvider.moveFile(fromKey, toKey);

    const { S3Client, CopyObjectCommand, DeleteObjectCommand, region, bucket } = runtime;
    const sourceKey = normalizeKey(fromKey);
    const targetKey = normalizeKey(toKey);
    const client = new S3Client({ region });
    await client.send(new CopyObjectCommand({
      Bucket: bucket,
      Key: targetKey,
      CopySource: `${bucket}/${sourceKey}`,
    }));
    await client.send(new DeleteObjectCommand({
      Bucket: bucket,
      Key: sourceKey,
    }));
    return { provider: 's3', key: targetKey, url: buildS3PublicUrl(targetKey) };
  },
};

function getStorageProvider(region) {
  if (String(process.env.STORAGE_PROVIDER || '').toLowerCase() === 'local') return localProvider;
  if (region === 'cn') return cosProvider;
  return s3Provider;
}

async function uploadFile(buffer, key, options = {}) {
  const resolved = normalizeOptions(options);
  return getStorageProvider(resolved.region).uploadFile(buffer, key, resolved);
}

async function getSignedUrl(key, expiresIn = 3600, options = {}) {
  const resolved = normalizeOptions(options);
  return getStorageProvider(resolved.region).getSignedUrl(key, expiresIn, resolved);
}

async function deleteFile(key, options = {}) {
  const resolved = normalizeOptions(options);
  return getStorageProvider(resolved.region).deleteFile(key, resolved);
}

async function moveFile(fromKey, toKey, options = {}) {
  const resolved = normalizeOptions(options);
  return getStorageProvider(resolved.region).moveFile(fromKey, toKey, resolved);
}

module.exports = { uploadFile, getSignedUrl, deleteFile, moveFile, getStorageProvider };
