'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');
const rateLimit = require('express-rate-limit');

const adminV2ReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

function registerAdminV2Page(app, { rootPath, htmlPageLimiter }) {
  const adminV2File = path.join(rootPath, 'dist-admin', 'index.html');
  if (!fs.existsSync(adminV2File)) return false;

  app.get('/admin-v2', adminV2ReadLimiter, htmlPageLimiter, (req, res) => {
    fs.readFile(adminV2File, 'utf8', (err, html) => {
      if (err) return res.status(500).send('Internal Server Error');
      const injected = `<script>
        window.__API_BASE__ = ${JSON.stringify(process.env.API_BASE || '')};
        window.__ENV = ${JSON.stringify(process.env.NODE_ENV || 'production')};
        window.__SENTRY_DSN = ${JSON.stringify(process.env.SENTRY_DSN || '')};
      </script>`;
      const assetFixedHtml = html
        .replace(/(["'])\/assets\//g, '$1/admin-v2-assets/')
        .replace(/(["'])assets\//g, '$1admin-v2-assets/');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.send(assetFixedHtml.replace('</head>', injected + '\n</head>'));
    });
  });

  app.use('/admin-v2-assets', express.static(path.join(rootPath, 'dist-admin', 'assets')));
  console.log('✅ Admin v2 (React) 已启用: /admin-v2');
  return true;
}

module.exports = { registerAdminV2Page };
