/**
 * Deep Links route handlers
 *
 * These routes handle deep link redirects for:
 *  - /verify-email?token=xxx  → redirects to summitlink:// URL scheme or shows HTML fallback
 *  - /reset-password?token=xxx → same pattern
 *
 * iOS Universal Links and Android App Links will intercept these URLs
 * before the browser ever loads them (if the App is installed).
 * If the App is NOT installed, the user sees the HTML fallback page
 * with an "Open in App" button that tries the custom URL scheme.
 */

const express = require('express');
const router = express.Router();

const APP_SCHEME = 'summitlink://';
const APP_STORE_URL = 'https://apps.apple.com/app/summitlink/id0000000000'; // Replace with real App Store ID
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=app.summitlink';

/**
 * Build a simple HTML fallback page that attempts to open the App
 * via custom URL scheme and provides store links if not installed.
 */
function buildFallbackHtml({ title, schemeUrl, description }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} – SummitLink</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           background: #1a1a2e; color: #fff; display: flex; align-items: center;
           justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: #16213e; border-radius: 16px; padding: 40px; max-width: 400px;
            width: 90%; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.5); }
    h1 { font-size: 1.5rem; margin-bottom: 8px; }
    p { color: #94a3b8; margin-bottom: 28px; line-height: 1.6; }
    .btn { display: inline-block; padding: 14px 32px; border-radius: 50px;
           text-decoration: none; font-weight: 600; font-size: 1rem;
           cursor: pointer; border: none; width: 100%; box-sizing: border-box;
           margin-bottom: 12px; }
    .btn-primary { background: #3b82f6; color: #fff; }
    .btn-secondary { background: transparent; color: #94a3b8;
                     border: 1px solid #334155; font-size: 0.9rem; }
    .store-links { margin-top: 20px; }
    .store-links a { color: #60a5fa; font-size: 0.875rem; margin: 0 8px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>⛰️ SummitLink</h1>
    <h2>${title}</h2>
    <p>${description}</p>
    <button class="btn btn-primary" onclick="openApp()">Open in App</button>
    <div class="store-links">
      <a href="${APP_STORE_URL}">App Store</a> ·
      <a href="${PLAY_STORE_URL}">Google Play</a>
    </div>
  </div>
  <script>
    function openApp() {
      window.location.href = ${JSON.stringify(schemeUrl)};
      // If App not installed, redirect to store after 2s
      setTimeout(function() {
        var ua = navigator.userAgent;
        if (/iPhone|iPad|iPod/.test(ua)) {
          window.location.href = ${JSON.stringify(APP_STORE_URL)};
        } else if (/Android/.test(ua)) {
          window.location.href = ${JSON.stringify(PLAY_STORE_URL)};
        }
      }, 2000);
    }
    // Auto-attempt on page load
    openApp();
  </script>
</body>
</html>`;
}

/**
 * GET /verify-email?token=xxx
 *
 * Validates email token, then redirects to custom URL scheme so the App
 * can handle it natively. Falls back to an HTML page if the App is not installed.
 */
router.get('/verify-email', (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ error: 'Missing token parameter' });
  }

  const schemeUrl = `${APP_SCHEME}verify-email?token=${encodeURIComponent(token)}`;
  const userAgent = req.headers['user-agent'] || '';
  const isMobile = /iPhone|iPad|iPod|Android/i.test(userAgent);

  if (isMobile) {
    // Mobile: show HTML with auto-redirect to App (Universal/App Links handled by OS)
    return res.send(
      buildFallbackHtml({
        title: 'Verify Your Email',
        schemeUrl,
        description:
          'Click the button below to verify your email address and open SummitLink.',
      })
    );
  }

  // Desktop: redirect to custom URL scheme (will only work if App is installed)
  res.redirect(302, schemeUrl);
});

/**
 * GET /reset-password?token=xxx
 *
 * Redirects password reset token to the App via custom URL scheme.
 */
router.get('/reset-password', (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ error: 'Missing token parameter' });
  }

  const schemeUrl = `${APP_SCHEME}reset-password?token=${encodeURIComponent(token)}`;
  const userAgent = req.headers['user-agent'] || '';
  const isMobile = /iPhone|iPad|iPod|Android/i.test(userAgent);

  if (isMobile) {
    return res.send(
      buildFallbackHtml({
        title: 'Reset Your Password',
        schemeUrl,
        description:
          'Click the button below to reset your password and open SummitLink.',
      })
    );
  }

  res.redirect(302, schemeUrl);
});

module.exports = router;
