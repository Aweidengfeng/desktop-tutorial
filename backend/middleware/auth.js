const jwt = require('jsonwebtoken');

module.exports = function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未提供认证Token' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'summitlink_secret_change_this_in_production');
    req.user = { id: decoded.id };
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Token无效或已过期' });
  }
};
