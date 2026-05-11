/**
 * Universal Links middleware
 *
 * Serves /.well-known/apple-app-site-association (iOS Universal Links)
 * and /.well-known/assetlinks.json (Android App Links) with the correct
 * Content-Type: application/json header and no caching.
 *
 * Apple requires the AASA file to be served without any redirect and with
 * Content-Type: application/json.
 *
 * Template tokens in the on-disk files are substituted at request time from
 * environment variables, so secrets are not committed to the repository:
 *   ${APPLE_TEAM_ID}              → process.env.APPLE_TEAM_ID
 *   ${ANDROID_SHA256_FINGERPRINT} → process.env.ANDROID_SHA256_FINGERPRINT
 *                                    (comma-separated list of SHA-256 fingerprints)
 *
 * If a token cannot be resolved, the middleware logs a warning and falls back
 * to the literal token (so local dev still produces a parseable JSON file).
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

let _warnedMissing = new Set();

function substituteTokens(content, filename) {
  const appleTeamId = process.env.APPLE_TEAM_ID || '';
  // assetlinks supports multiple fingerprints (comma-separated env var → JSON array of strings)
  const sha256Raw = process.env.ANDROID_SHA256_FINGERPRINT || '';
  const sha256List = sha256Raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  let result = content;

  if (result.includes('${APPLE_TEAM_ID}')) {
    if (appleTeamId) {
      result = result.split('${APPLE_TEAM_ID}').join(appleTeamId);
    } else if (!_warnedMissing.has('APPLE_TEAM_ID:' + filename)) {
      console.warn(`[universalLinks] ${filename} references \${APPLE_TEAM_ID} but env var is not set`);
      _warnedMissing.add('APPLE_TEAM_ID:' + filename);
    }
  }

  if (result.includes('${ANDROID_SHA256_FINGERPRINT_LIST}')) {
    // Allow callers to embed a full JSON array via a single token: "${ANDROID_SHA256_FINGERPRINT_LIST}"
    if (sha256List.length > 0) {
      // Build comma-separated, properly JSON-escaped quoted strings to inject inside the array brackets
      const jsonArray = sha256List.map(s => JSON.stringify(s)).join(',');
      result = result.split('"${ANDROID_SHA256_FINGERPRINT_LIST}"').join(jsonArray);
    } else if (!_warnedMissing.has('ANDROID_SHA256:' + filename)) {
      console.warn(`[universalLinks] ${filename} references ANDROID_SHA256_FINGERPRINT_LIST but env var is not set`);
      _warnedMissing.add('ANDROID_SHA256:' + filename);
    }
  }

  if (result.includes('${ANDROID_SHA256_FINGERPRINT}')) {
    if (sha256List.length > 0) {
      result = result.split('${ANDROID_SHA256_FINGERPRINT}').join(sha256List[0]);
    } else if (!_warnedMissing.has('ANDROID_SHA256_SINGLE:' + filename)) {
      console.warn(`[universalLinks] ${filename} references \${ANDROID_SHA256_FINGERPRINT} but env var is not set`);
      _warnedMissing.add('ANDROID_SHA256_SINGLE:' + filename);
    }
  }

  return result;
}

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
      const substituted = substituteTokens(data, filename);
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.send(substituted);
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
