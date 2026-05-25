const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { getRegionConfig } = require('../lib/region');

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

const PAGE_STYLE = `
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f9fafb;color:#1f2937;line-height:1.7}
    .container{max-width:800px;margin:0 auto;padding:40px 24px 120px}
    header{background:#3b82f6;color:#fff;padding:32px 24px 24px;text-align:center;margin-bottom:40px}
    header h1{font-size:2rem;font-weight:700;letter-spacing:-0.5px}
    header p{font-size:.95rem;opacity:.85;margin-top:6px}
    h2{font-size:1.1rem;font-weight:700;color:#3b82f6;margin:32px 0 10px;padding-bottom:6px;border-bottom:2px solid #dbeafe}
    h3{font-size:.95rem;font-weight:600;color:#374151;margin:18px 0 6px}
    p{margin-bottom:12px;font-size:.95rem}
    ul,ol{padding-left:22px;margin-bottom:12px;font-size:.95rem}
    li{margin-bottom:4px}
    a{color:#3b82f6;text-decoration:none}
    a:hover{text-decoration:underline}
    .badge{display:inline-block;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:6px;padding:2px 10px;font-size:.8rem;font-weight:600;margin-bottom:8px}
    .callout{background:#eff6ff;border-left:4px solid #3b82f6;padding:14px 18px;border-radius:0 8px 8px 0;margin:16px 0;font-size:.9rem}
    table{width:100%;border-collapse:collapse;font-size:.88rem;margin-bottom:16px}
    th{background:#3b82f6;color:#fff;padding:8px 12px;text-align:left}
    td{padding:8px 12px;border-bottom:1px solid #e5e7eb}
    tr:nth-child(even) td{background:#f3f4f6}
    @media(max-width:600px){header h1{font-size:1.5rem}.container{padding:24px 16px 100px}}
  </style>`;

router.get('/privacy', legalLimiter, (req, res) => {
  const region = req.region || 'us';
  const regionHint = region === 'cn' ? '中国大陆节点（腾讯云）' : '国际节点（Railway）';
  const cnConfig = getRegionConfig('cn');
  const usConfig = getRegionConfig('us');
  const entityRows = `
  <tr><td><strong>中国大陆主体</strong></td><td>${cnConfig.legalEntity}</td><td>${cnConfig.socialCreditCode}</td><td>北京市通州区玉桥北里47号1层A2247号</td></tr>
  <tr><td><strong>海外主体</strong></td><td>${usConfig.legalEntity}</td><td>US Registration Pending</td><td>United States</td></tr>`;
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Privacy Policy - SummitLink</title>
${PAGE_STYLE}
</head>
<body>
<header>
  <h1>Privacy Policy</h1>
  <p>SummitLink — Summit Together &nbsp;|&nbsp; Last updated: 2026-05-03</p>
</header>
<div class="container">

<h2>1. 数据控制者 | Data Controller</h2>
<p>SummitLink operates the SummitLink mobile and web platform ("Service"). Questions about this policy can be directed to <a href="mailto:privacy@summitlink.app">privacy@summitlink.app</a>.</p>
<p><strong>Current request region:</strong> ${region}（${regionHint}）</p>
<table>
  <thead><tr><th>Entity Type</th><th>Legal Entity</th><th>Registration ID</th><th>Registered Address</th></tr></thead>
  <tbody>${entityRows}</tbody>
</table>

<h2>2. 数据收集 | Data We Collect</h2>
<p>We collect only the data necessary to provide, secure, and improve the Service:</p>
<table>
  <thead><tr><th>Category</th><th>Examples</th><th>Purpose</th></tr></thead>
  <tbody>
    <tr><td><strong>Account data</strong></td><td>Email address, phone number (optional)</td><td>Authentication &amp; account management</td></tr>
    <tr><td><strong>Location data</strong></td><td>GPS coordinates (foreground only, when sharing is active)</td><td>Real-time team safety, route tracking</td></tr>
    <tr><td><strong>Uploaded content</strong></td><td>Profile photos, summit photos, track files</td><td>Community features, route documentation</td></tr>
    <tr><td><strong>Usage data</strong></td><td>Pages visited, feature interactions, crash reports</td><td>Service improvement, error diagnosis</td></tr>
    <tr><td><strong>Device &amp; network</strong></td><td>IP address, OS version, browser / app version</td><td>Security, fraud prevention</td></tr>
  </tbody>
</table>
<div class="callout">We do <strong>not</strong> collect precise location in the background. GPS access is requested only when you actively start a live-tracking session.</div>

<h2>3. 数据使用目的 | How We Use Your Data</h2>
<ul>
  <li><strong>Service delivery</strong> — authentication, booking guides, club management, expedition coordination.</li>
  <li><strong>Safety</strong> — detect fraud, prevent abuse, and coordinate emergency rescues.</li>
  <li><strong>Experience improvement</strong> — anonymised, aggregated analytics to understand feature usage patterns.</li>
  <li><strong>Legal compliance</strong> — respond to lawful requests from courts or regulators.</li>
  <li><strong>Communications</strong> — transactional emails (booking confirmations, password resets). No unsolicited marketing without explicit consent.</li>
</ul>

<h2>4. 第三方共享 | Third-Party Sharing</h2>
<p>We <strong>never sell</strong> your personal data to third parties. We share data only with the following service providers, strictly for operating the platform:</p>
<table>
  <thead><tr><th>Service</th><th>Purpose</th><th>Region</th></tr></thead>
  <tbody>
    <tr><td>Railway</td><td>Cloud hosting &amp; database</td><td>US (or EU region on request)</td></tr>
    <tr><td>高德地图 (Amap)</td><td>Map tiles for China region</td><td>China</td></tr>
    <tr><td>Mapbox</td><td>Map tiles for international region</td><td>US</td></tr>
    <tr><td>Sentry</td><td>Crash reporting &amp; error monitoring</td><td>US</td></tr>
  </tbody>
</table>
<p>Each provider is bound by a Data Processing Agreement (DPA) or equivalent contractual safeguards.</p>

<h2>5. 数据存储与安全 | Data Storage &amp; Security</h2>
<ul>
  <li>All sensitive personal fields (email, phone number) are stored encrypted using <strong>AES-256-GCM</strong> with a unique per-value initialisation vector.</li>
  <li>Connections to the backend use <strong>TLS 1.2+</strong>.</li>
  <li>Passwords are never stored; we use token-based authentication.</li>
  <li>We retain your data for as long as your account is active, plus a 30-day deletion grace period.</li>
</ul>

<h2>6. GDPR 权利（欧盟/EEA用户）| GDPR Rights (EU/EEA Users)</h2>
<p>If you are located in the European Union or European Economic Area, you have the following rights under the General Data Protection Regulation (GDPR):</p>
<ul>
  <li><strong>Right of access</strong> — request a copy of all personal data we hold about you.</li>
  <li><strong>Right to rectification</strong> — correct inaccurate data.</li>
  <li><strong>Right to erasure</strong> — request deletion of your account and associated data.</li>
  <li><strong>Right to data portability</strong> — receive your data in a machine-readable format.</li>
  <li><strong>Right to object</strong> — object to processing based on legitimate interest.</li>
</ul>
<div class="callout">
  <strong>Exercise your rights via our in-app API:</strong><br>
  Export: <code>GET /api/gdpr/export</code><br>
  Delete account: <code>POST /api/auth/request-deletion</code>（24小时冷静期）或 <code>DELETE /api/gdpr/delete-account</code>（立即注销）
</div>

<h2>7. 儿童隐私 | Children's Privacy</h2>
<p>The Service is not directed at children under the age of 13. We do not knowingly collect personal information from children. If you believe a child has provided us with personal data, please contact <a href="mailto:privacy@summitlink.app">privacy@summitlink.app</a> and we will delete it promptly.</p>

<h2>8. 政策更新 | Policy Updates</h2>
<p>We may update this policy periodically. Significant changes will be communicated via in-app notification or email at least 30 days before taking effect. Continued use of the Service after the effective date constitutes acceptance of the revised policy.</p>

<h2>9. 联系方式 | Contact</h2>
<p>For privacy questions, data requests, or complaints:<br>
📧 <a href="mailto:privacy@summitlink.app">privacy@summitlink.app</a></p>

</div>
${FOOTER}
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

router.get('/terms', legalLimiter, (req, res) => {
  const region = req.region || 'us';
  const currentEntity = getRegionConfig(region).legalEntity;
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Terms of Service - SummitLink</title>
${PAGE_STYLE}
</head>
<body>
<header>
  <h1>Terms of Service</h1>
  <p>SummitLink — Summit Together &nbsp;|&nbsp; Effective date: 2026-05-03</p>
</header>
<div class="container">
<div class="callout"><strong>Contracting entity for this region:</strong> ${currentEntity}</div>

<h2>1. 服务描述 | About SummitLink</h2>
<p>SummitLink is a social and logistics platform for climbers and mountaineers. The platform enables users to:</p>
<ul>
  <li>Discover summits, routes, and real-world climber reviews.</li>
  <li>Connect with other climbers, follow routes, and share achievements.</li>
  <li>Book certified mountain guides for expeditions.</li>
  <li>Join or create climbing clubs and organise group expeditions.</li>
  <li>Share real-time location with team members for safety during outings.</li>
  <li>Exchange and rent gear within the community.</li>
</ul>

<h2>2. 账号注册 | Account Registration</h2>
<p>To use the Service you must create an account. You agree to:</p>
<ul>
  <li>Provide <strong>accurate and truthful information</strong> during registration.</li>
  <li>Keep your login credentials confidential.</li>
  <li>Notify us immediately at <a href="mailto:legal@summitlink.app">legal@summitlink.app</a> if you suspect unauthorised account access.</li>
  <li>Be at least 13 years old (or the minimum age required by the laws of your country).</li>
</ul>

<h2>3. 用户责任与安全 | User Responsibilities &amp; Safety</h2>
<p>Mountaineering, climbing, and outdoor activities carry <strong>inherent risks</strong>, including serious injury or death. By using SummitLink you acknowledge and accept that:</p>
<ul>
  <li>You are solely responsible for assessing your own physical fitness and skill level before any outdoor activity.</li>
  <li>Route information on SummitLink is user-generated; conditions change — always verify with current, authoritative sources before departure.</li>
  <li>You must comply with all applicable laws, regulations, and park/reserve rules at your destination.</li>
  <li>Real-time location sharing is a supplementary safety tool; it does not substitute professional rescue services or proper equipment.</li>
</ul>

<h2>4. 禁止行为 | Prohibited Conduct</h2>
<p>You must not:</p>
<ul>
  <li>Post <strong>false, misleading, or fabricated</strong> route conditions, reviews, or guide credentials.</li>
  <li>Upload content that infringes third-party intellectual property rights.</li>
  <li>Harass, threaten, or intimidate other users.</li>
  <li>Use the Service for any commercial purpose not expressly authorised.</li>
  <li>Attempt to reverse-engineer, scrape, or disrupt the platform.</li>
  <li>Impersonate another person, guide, or organisation.</li>
</ul>
<p>Violations may result in immediate account suspension without refund.</p>

<h2>5. 付款条款 | Payments &amp; Refunds</h2>
<ul>
  <li>International payments may be processed by <strong>Stripe, Inc.</strong>; China mainland payments may be processed through <strong>WeChat Pay</strong> or <strong>Alipay</strong> subject to local compliance.</li>
  <li>All prices are displayed inclusive of applicable taxes where required by law.</li>
  <li><strong>Refund policy:</strong> Full refunds are available if cancelled more than 72 hours before the scheduled activity. Cancellations within 72 hours are subject to a 50% cancellation fee. No refund is issued for no-shows.</li>
  <li>Guides may set their own additional cancellation terms, which take precedence if more restrictive.</li>
  <li>Currency conversion is handled by Stripe; SummitLink is not responsible for exchange-rate fluctuations.</li>
</ul>

<h2>6. 免责声明 | Disclaimer of Liability</h2>
<div class="callout">
  <strong>SummitLink is an information and logistics platform, not an outdoor activity operator.</strong> We do not organise, supervise, or lead any climbing or hiking activities.
</div>
<p>To the maximum extent permitted by law, SummitLink, its affiliates, and employees:</p>
<ul>
  <li>Accept <strong>no liability</strong> for accidents, injuries, deaths, property damage, or losses arising from outdoor activities facilitated through the platform.</li>
  <li>Make no warranties that route data, weather information, or guide reviews are accurate, complete, or up to date.</li>
  <li>Are not responsible for the conduct, qualifications, or actions of independent guides listed on the platform.</li>
</ul>

<h2>7. 知识产权 | Intellectual Property</h2>
<p>You retain ownership of content you upload. By posting content, you grant SummitLink a non-exclusive, worldwide, royalty-free licence to display and distribute that content solely within the platform. SummitLink's trademarks, logo, and proprietary software remain our exclusive property.</p>

<h2>8. 终止 | Termination</h2>
<p>You may delete your account at any time via Settings → Account → Delete Account (or via <code>DELETE /api/users/me</code>). We may suspend or terminate accounts that violate these Terms. Termination does not affect accrued rights or obligations.</p>

<h2>9. 争议解决 | Governing Law &amp; Dispute Resolution</h2>
<p>These Terms are governed by the <strong>laws of the People's Republic of China</strong>. Any disputes shall first be resolved through good-faith negotiation. If unresolved within 30 days, disputes shall be submitted to the competent people's court at SummitLink's registered address.</p>

<h2>10. 联系方式 | Contact</h2>
<p>For legal enquiries:<br>
📧 <a href="mailto:legal@summitlink.app">legal@summitlink.app</a></p>

</div>
${FOOTER}
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

router.get('/data-processing', legalLimiter, serveLegalPage(path.join(legalDir, 'DATA_PROCESSING.md'), '数据处理说明'));

module.exports = router;
