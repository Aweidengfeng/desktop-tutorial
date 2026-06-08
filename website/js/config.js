/**
 * @file config.js
 * @description Runtime configuration for the static marketing website (GitHub Pages).
 *
 * The site is served statically from GitHub Pages (https://summitlink.cn) and has
 * NO same-origin backend. The lead-collection forms in `site.js` POST to relative
 * paths (e.g. `/api/contact`), which `site.js` resolves against `window.SUMMITLINK_API_BASE`.
 *
 * This file is the single source of truth for that origin. It MUST be loaded
 * BEFORE `site.js` on every page that contains a form.
 *
 * To point the site at a different backend (e.g. the overseas node, a staging API,
 * or a Railway preview domain), edit the value below and redeploy the website.
 *
 *   - Must be an absolute https origin (no trailing path).
 *   - Must NOT be empty and MUST NOT be localhost in production.
 *   - The backend MUST list this site's origin in CORS_ORIGINS.
 */
window.SUMMITLINK_API_BASE = 'https://api.summitlink.cn';
