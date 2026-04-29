/**
 * 阿里云内容安全图片审核
 * 生产环境：调用阿里云内容安全 2.0 HTTP API（HMAC-SHA256 签名）
 * 开发/测试环境：直接放行
 *
 * 环境变量：
 *   ALIYUN_ACCESS_KEY_ID      — 阿里云 AccessKeyId
 *   ALIYUN_ACCESS_KEY_SECRET  — 阿里云 AccessKeySecret
 *   ALIYUN_GREEN_REGION       — 地域（默认 cn-shanghai）
 */

const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Resolve the expected uploads directory for path validation
const uploadsDir = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(__dirname, '..', 'uploads');

/**
 * 使用阿里云 API v3 签名规范构建 Authorization 头
 */
function buildAliyunAuth(method, path, headers, body, accessKeyId, accessKeySecret) {
  const signedHeaderNames = Object.keys(headers)
    .map(h => h.toLowerCase())
    .filter(h => h === 'host' || h === 'content-type' || h.startsWith('x-acs-'))
    .sort();

  const canonicalHeaders = signedHeaderNames
    .map(h => {
      const orig = Object.keys(headers).find(k => k.toLowerCase() === h);
      return `${h}:${headers[orig]}\n`;
    })
    .join('');

  const signedHeadersStr = signedHeaderNames.join(';');
  const hashedBody = crypto.createHash('sha256').update(body || '').digest('hex');
  const canonicalRequest = [method, path, '', canonicalHeaders, signedHeadersStr, hashedBody].join('\n');

  const date = headers['x-acs-date'] || headers['X-Acs-Date'];
  const hashedCanonical = crypto.createHash('sha256').update(canonicalRequest).digest('hex');
  const stringToSign = `ACS3-HMAC-SHA256\n${date}\n${hashedCanonical}`;
  const signature = crypto.createHmac('sha256', accessKeySecret).update(stringToSign).digest('hex');

  return `ACS3-HMAC-SHA256 Credential=${accessKeyId},SignedHeaders=${signedHeadersStr},Signature=${signature}`;
}

/**
 * 审核单个图片文件（通过文件路径）
 * @param {string} filePath — 磁盘上的文件绝对路径
 * @returns {Promise<{suggestion: 'pass'|'review'|'block'}>}
 */
async function reviewImageFile(filePath) {
  if (process.env.NODE_ENV !== 'production' || !process.env.ALIYUN_ACCESS_KEY_ID) {
    return { suggestion: 'pass' };
  }

  const accessKeyId = process.env.ALIYUN_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET || '';
  const region = process.env.ALIYUN_GREEN_REGION || 'cn-shanghai';
  const host = `green-cip.${region}.aliyuncs.com`;
  const apiPath = '/api/v1/greenings/image';

  // Validate that filePath is within the expected uploads directory (prevent path traversal)
  const resolvedPath = path.resolve(filePath);
  const resolvedUploadsDir = path.resolve(uploadsDir);
  if (!resolvedPath.startsWith(resolvedUploadsDir + path.sep) && resolvedPath !== resolvedUploadsDir) {
    console.error('[contentSafety] 非法文件路径，拒绝审核:', filePath);
    return { suggestion: 'pass' };
  }

  let imageBase64;
  try {
    imageBase64 = fs.readFileSync(resolvedPath).toString('base64');
  } catch (e) {
    console.error('[contentSafety] 读取文件失败，放行：', e.message);
    return { suggestion: 'pass' };
  }

  const serviceParameters = JSON.stringify({ imageBase64, dataId: crypto.randomUUID() });
  const bodyStr = JSON.stringify({ service: 'baselineCheck', serviceParameters });

  const now = new Date();
  // ISO 8601 format for x-acs-date header (e.g. 2026-04-29T12:00:00Z)
  const dateHeader = now.toISOString().replace(/\.\d{3}Z$/, 'Z');

  const headers = {
    'host': host,
    'content-type': 'application/json',
    'x-acs-version': '2022-03-02',
    'x-acs-action': 'ImageModeration',
    'x-acs-date': dateHeader,
  };

  const auth = buildAliyunAuth('POST', apiPath, headers, bodyStr, accessKeyId, accessKeySecret);

  return new Promise((resolve) => {
    const reqHeaders = { ...headers, Authorization: auth, 'Content-Length': Buffer.byteLength(bodyStr) };
    const options = {
      hostname: host,
      path: apiPath,
      method: 'POST',
      headers: reqHeaders,
      timeout: 8000,
    };

    const req = https.request(options, (resp) => {
      let data = '';
      resp.on('data', chunk => { data += chunk; });
      resp.on('end', () => {
        try {
          const json = JSON.parse(data);
          const suggestion = json?.data?.result?.suggestion || json?.Data?.Result?.Suggestion || 'pass';
          resolve({ suggestion: suggestion.toLowerCase() });
        } catch (e) {
          console.error('[contentSafety] 解析响应失败，放行：', e.message);
          resolve({ suggestion: 'pass' });
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      console.error('[contentSafety] 请求超时，放行');
      resolve({ suggestion: 'pass' });
    });

    req.on('error', (e) => {
      console.error('[contentSafety] 请求失败，放行：', e.message);
      resolve({ suggestion: 'pass' });
    });

    req.write(bodyStr);
    req.end();
  });
}

/**
 * Express 中间件（保留兼容性，仅在文件已写盘时有意义）
 * 推荐改用 reviewImageFile(filePath) 在 multer 写盘后调用
 */
const checkImageSafety = async (req, res, next) => {
  next();
};

module.exports = { checkImageSafety, reviewImageFile };
