const jwt = require('jsonwebtoken');
const { setSentryUser } = require('./sentry');
const prisma = require('../db/prisma');
const { getJwtSecret, DEV_ONLY_FALLBACK_SECRET } = require('../utils/jwtSecret');

module.exports = async function authMiddleware(req, res, next) {
  let secret;
  try {
    secret = getJwtSecret();
  } catch (e) {
    console.error('[auth] FATAL: JWT_SECRET is not configured securely in production!');
    return res.status(500).json({ error: '服务器配置错误' });
  }
  if (process.env.NODE_ENV === 'production' && secret === DEV_ONLY_FALLBACK_SECRET) {
    console.error('[auth] FATAL: JWT_SECRET is using the default value in production!');
    return res.status(500).json({ error: '服务器配置错误' });
  }

  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未提供认证Token' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, secret);
    req.user = { id: decoded.id, isAdmin: !!decoded.isAdmin };
    setSentryUser(req.user);

    // 检查账号是否处于注销冷静期，如是则阻止写操作
    const writeMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
    if (writeMethods.includes(req.method)) {
      try {
        const user = await prisma.user.findUnique({ where: { id: decoded.id }, select: { deletedAt: true } });
        if (user && user.deletedAt && user.deletedAt > new Date()) {
          // 仅允许撤销注销申请的接口通过（精确匹配，防止路径前缀绕过）
          const isCancelDeletion = req.path === '/cancel-deletion' || req.path === '/api/auth/cancel-deletion';
          if (!isCancelDeletion) {
            return res.status(423).json({ error: '账号正在注销审核期，如需继续使用请先撤销注销申请' });
          }
        }
      } catch (_) {
        // DB 查询失败时不阻断请求
      }
    }

    next();
  } catch (e) {
    return res.status(401).json({ error: 'Token无效或已过期' });
  }
};
