const jwt = require('jsonwebtoken');
const { setSentryUser } = require('./sentry');

module.exports = function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未提供认证Token' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const secret = process.env.JWT_SECRET || 'summitlink_dev_secret_do_not_use_in_production';
    const decoded = jwt.verify(token, secret);
    req.user = { id: decoded.id };
    setSentryUser(req.user);
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Token无效或已过期' });
  }
};
