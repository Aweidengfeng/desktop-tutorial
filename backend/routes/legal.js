const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const rateLimit = require('express-rate-limit');

const legalLimiter = rateLimit({ windowMs: 60*1000, max: 30 });

const FOOTER = `
<footer style="position:fixed;bottom:0;left:0;right:0;background:#1f2937;color:#9ca3af;padding:12px 24px;font-size:12px;text-align:center;z-index:100;">
  © SummitLink · <a href="/legal/privacy" style="color:#60a5fa">隐私政策</a> · <a href="/legal/terms" style="color:#60a5fa">用户协议</a> · 投诉邮箱: support@summitlink.app
</footer>`;

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderMarkdown(md) {
  let html = md
    .replace(/^# (.+)$/gm, (_, t) => `<h1>${escapeHtml(t)}</h1>`)
    .replace(/^## (.+)$/gm, (_, t) => `<h2>${escapeHtml(t)}</h2>`)
    .replace(/^### (.+)$/gm, (_, t) => `<h3>${escapeHtml(t)}</h3>`)
    .replace(/\*\*(.+?)\*\*/g, (_, t) => `<strong>${escapeHtml(t)}</strong>`)
    .replace(/\*(.+?)\*/g, (_, t) => `<em>${escapeHtml(t)}</em>`)
    .replace(/\n\n/g, '</p><p>')
    .replace(/^- (.+)$/gm, (_, t) => `<li>${escapeHtml(t)}</li>`);
  return `<p>${html}</p>`;
}

function serveLegalPage(filePath, title) {
  return (req, res) => {
    fs.readFile(filePath, 'utf8', (err, content) => {
      if (err) return res.status(404).send('页面不存在');
      const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} - SummitLink</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.5.1/github-markdown-light.min.css">
<style>body{font-family:system-ui;max-width:800px;margin:60px auto 100px;padding:0 24px}h1{color:#1e40af}</style>
</head>
<body class="markdown-body">
${renderMarkdown(content)}
${FOOTER}
</body>
</html>`;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    });
  };
}

// Resolve legal files relative to this file: backend/routes/ -> ../../legal/
const legalDir = path.resolve(__dirname, '../../legal');

router.get('/privacy', legalLimiter, serveLegalPage(path.join(legalDir, 'PRIVACY_POLICY.md'), '隐私政策'));
router.get('/terms', legalLimiter, serveLegalPage(path.join(legalDir, 'TERMS_OF_SERVICE.md'), '用户协议'));
router.get('/data-processing', legalLimiter, serveLegalPage(path.join(legalDir, 'DATA_PROCESSING.md'), '数据处理说明'));

module.exports = router;
