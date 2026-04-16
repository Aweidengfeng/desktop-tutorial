const jwt = require('jsonwebtoken');

module.exports = function adminAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未提供认证Token' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const secret = process.env.JWT_SECRET || 'summitlink_dev_secret_do_not_use_in_production';
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
