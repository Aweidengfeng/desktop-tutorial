const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../utils/jwtSecret');

module.exports = function adminAuth(req, res, next) {
  const token = req.cookies?.adminToken ||
    (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
  if (!token) {
    return res.status(401).json({ error: '未提供认证Token' });
  }
  try {
    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret);
    if (!decoded.isAdmin) {
      return res.status(403).json({ error: '无管理员权限' });
    }
    req.admin = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Token无效或已过期' });
  }
};
