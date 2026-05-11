/**
 * Universal Links middleware
 *
 * Serves /.well-known/apple-app-site-association (iOS Universal Links)
 * and /.well-known/assetlinks.json (Android App Links) with the correct
 * Content-Type: application/json header and no caching.
 *
 * Apple requires the AASA file to be served without any redirect and with
 * Content-Type: application/json.
 */

const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');

const wellKnownDir = path.join(__dirname, '../../public/.well-known');

// Rate limit for /.well-known/ probes (Apple CDN and Google crawlers are expected,
// but excessive requests should still be throttled).
const wellKnownLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,            // 120 req/min per IP
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Serve a well-known file as JSON with appropriate headers.
 */
function serveWellKnown(filename) {
  return (req, res) => {
    const filePath = path.join(wellKnownDir, filename);
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        return res.status(404).json({ error: 'Not found' });
      }
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.send(data);
    });
  };
}

/**
 * Register /.well-known/ routes on the given Express app.
 * Must be called before any static file middleware or redirects.
 *
 * @param {import('express').Application} app
 */
function mountUniversalLinks(app) {
  // iOS Universal Links – must NOT redirect (Apple CDN probes this directly)
  app.get(
    '/.well-known/apple-app-site-association',
    wellKnownLimiter,
    serveWellKnown('apple-app-site-association')
  );

  // Android App Links
  app.get('/.well-known/assetlinks.json', wellKnownLimiter, serveWellKnown('assetlinks.json'));
}

module.exports = { mountUniversalLinks };
