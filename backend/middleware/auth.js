const jwt = require('jsonwebtoken');
const { setSentryUser } = require('./sentry');
const prisma = require('../db/prisma');

module.exports = async function authMiddleware(req, res, next) {
  const DEFAULT_SECRET = 'summitlink_dev_secret_do_not_use_in_production';
  const secret = process.env.JWT_SECRET || DEFAULT_SECRET;
  if (process.env.NODE_ENV === 'production' && secret === DEFAULT_SECRET) {
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
    req.user = { id: decoded.id };
    setSentryUser(req.user);

    // 检查账号是否处于注销冷静期，如是则阻止写操作
    const writeMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
    if (writeMethods.includes(req.method)) {
      try {
        const user = await prisma.user.findUnique({ where: { id: decoded.id }, select: { deletedAt: true } });
        if (user && user.deletedAt && user.deletedAt > new Date()) {
          // 允许撤销注销申请接口和认证相关接口通过
          const isCancelDeletion = req.path === '/cancel-deletion' || req.path.endsWith('/cancel-deletion');
          const isAuthPath = /^\/?(api\/)?auth(\/|$)/.test(req.path);
          if (!isCancelDeletion && !isAuthPath) {
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
