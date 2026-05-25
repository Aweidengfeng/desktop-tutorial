const path = require('path');

const BLOCKED_STATIC_FILES = new Set([
  '/config.json',
  '/api_test.js',
  '/db_test.js',
  '/frontend_test.js',
  '/run_all_tests.js',
  '/audit-clickables.json',
  '/playwright.config.js',
  '/vite.config.js',
  '/vite.admin.config.js',
  '/tsconfig.admin.json',
  '/railpack.toml',
  '/railway.toml',
  '/docker-compose.prod.yml',
  '/docker-compose.cn.yml',
]);

function normalizeStaticRequestPath(requestPath) {
  return path.posix.normalize(decodeURIComponent(requestPath));
}

function getInvestorPageToken(req) {
  if (typeof req.query.token === 'string' && req.query.token) {
    return req.query.token;
  }

  if (typeof req.headers.authorization !== 'string') {
    return '';
  }

  const authorization = req.headers.authorization.trimStart();
  if (authorization.slice(0, 6).toLowerCase() !== 'bearer') {
    return '';
  }

  const separator = authorization[6];
  if (!separator || !' \t'.includes(separator)) {
    return '';
  }

  return authorization.slice(7).trim();
}

module.exports = {
  BLOCKED_STATIC_FILES,
  normalizeStaticRequestPath,
  getInvestorPageToken,
};
