const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { getJwtSecret } = require('../utils/jwtSecret');

// 仅这些方法被视为安全（不修改服务端状态），无需 CSRF 校验
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// 常量时间字符串比较，避免计时侧信道；长度不同直接返回 false（timingSafeEqual 要求等长）
function timingSafeEqualStr(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// 下发双提交（double-submit）CSRF 令牌 Cookie。该 Cookie 必须可被前端 JS 读取
// （httpOnly:false），以便前端在状态变更请求时回填到 X-CSRF-Token 头。
function issueCsrfCookie(res) {
  const token = crypto.randomBytes(32).toString('hex');
  res.cookie('adminCsrf', token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
  return token;
}

module.exports = function adminAuth(req, res, next) {
  const cookieToken = req.cookies?.adminToken;
  const bearerToken = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null;
  // 优先使用 Bearer（API/移动端客户端）；否则回退到 Cookie 会话（浏览器后台）
  const token = bearerToken || cookieToken;
  if (!token) {
    return res.status(401).json({ error: '未提供认证Token' });
  }

  let decoded;
  try {
    const secret = getJwtSecret();
    decoded = jwt.verify(token, secret);
  } catch (e) {
    return res.status(401).json({ error: 'Token无效或已过期' });
  }
  if (!decoded.isAdmin) {
    return res.status(403).json({ error: '无管理员权限' });
  }

  // CSRF 防护：仅对“基于 Cookie 的会话”生效。Authorization 头不会被浏览器自动附带，
  // 因此使用 ****** CSRF，予以豁免（统一为 ****** CSRF Token 方案）。
  const usingCookieSession = !bearerToken && !!cookieToken;
  if (usingCookieSession && !SAFE_METHODS.has(req.method)) {
    const csrfCookie = req.cookies?.adminCsrf;
    const csrfHeader = req.headers['x-csrf-token'];
    if (!csrfCookie || !timingSafeEqualStr(csrfCookie, csrfHeader)) {
      return res.status(403).json({ error: 'CSRF 校验失败，请刷新页面后重试' });
    }
  } else if (usingCookieSession && !req.cookies?.adminCsrf) {
    // 安全方法（GET 等）时，若旧会话尚无 CSRF Cookie 则惰性补发，
    // 使存量登录会话在执行状态变更前先获得令牌，避免被动失效。
    issueCsrfCookie(res);
  }

  req.admin = decoded;
  next();
};

module.exports.issueCsrfCookie = issueCsrfCookie;
module.exports.timingSafeEqualStr = timingSafeEqualStr;
