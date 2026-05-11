/**
 * SummitLink Pre-Release Checklist
 * 上架前自检：验证所有必要配置和文件都已就绪
 * 使用: node scripts/pre-release-check.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const checks = [];

function check(category, name, fn) {
  try {
    const result = fn();
    checks.push({ category, name, pass: !!result, note: typeof result === 'string' ? result : '' });
  } catch (err) {
    checks.push({ category, name, pass: false, note: err.message });
  }
}

function fileExists(relPath) {
  return fs.existsSync(path.join(ROOT, relPath));
}

function fileContains(relPath, substring) {
  if (!fileExists(relPath)) return false;
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8').includes(substring);
}

check('Backend', 'package.json exists', () => fileExists('backend/package.json'));
check('Backend', 'prisma/schema.prisma exists', () => fileExists('backend/prisma/schema.prisma'));
check('Backend', '.env.example exists', () => fileExists('backend/.env.example'));
check('Backend', 'app.js exists', () => fileExists('backend/app.js'));
check('Backend', 'JWT_SECRET in .env.example', () => fileContains('backend/.env.example', 'JWT_SECRET'));
check('Backend', 'DATABASE_URL in .env.example', () => fileContains('backend/.env.example', 'DATABASE_URL'));
check('Backend', 'STRIPE_SECRET_KEY in .env.example', () => fileContains('backend/.env.example', 'STRIPE_SECRET_KEY'));
check('Backend', 'SENTRY_DSN in .env.example', () => fileContains('backend/.env.example', 'SENTRY_DSN'));

check('Security', 'helmet middleware used', () => fileContains('backend/app.js', 'helmet'));
check('Security', 'rate limiting middleware used', () => fileContains('backend/app.js', 'rateLimit') || fileExists('backend/middleware/rateLimiter.js'));
check('Security', 'AES encryption module exists', () => fileExists('backend/utils/encryption.js') || fileExists('backend/lib/encryption.js'));
check('Security', '.env not committed', () => !fileExists('backend/.env'));
check('Security', '.gitignore has .env', () => fileContains('.gitignore', '.env'));

check('Frontend', 'index.html exists', () => fileExists('index.html'));
check('Frontend', 'service worker exists', () => fileExists('sw.js') || fileExists('service-worker.js'));
check('Frontend', 'manifest.json exists', () => fileExists('manifest.json') || fileExists('site.webmanifest'));
check('Frontend', 'GDPR banner in index.html', () => fileContains('index.html', 'gdpr') || fileContains('index.html', 'GDPR') || fileContains('index.html', 'cookie'));

check('Legal', 'Privacy policy page exists', () => fileExists('legal/privacy.html') || fileContains('backend/app.js', '/legal/privacy'));
check('Legal', 'Terms of service page exists', () => fileExists('legal/terms.html') || fileContains('backend/app.js', '/legal/terms'));

check('Mobile', 'capacitor.config.json exists', () => fileExists('capacitor.config.json') || fileExists('capacitor.config.ts'));
check('Mobile', 'iOS ExportOptions.plist exists', () => fileExists('ios/ExportOptions.plist'));
check('Mobile', 'Android build workflow exists', () => fileExists('.github/workflows/build-android.yml'));
check('Mobile', 'iOS build workflow exists', () => fileExists('.github/workflows/build-ios.yml'));

check('App Store', 'App icon SVG exists', () => fileExists('assets/icon.svg') || fileExists('assets/icons/icon.svg') || fileExists('resources/icon.svg'));
check('App Store', 'Screenshot templates exist', () => fileExists('screenshots/template-ios.html'));
check('App Store', 'App Store copy exists', () => fileExists('APP_STORE_COPY.md'));
check('App Store', 'Privacy policy URL in copy', () => fileContains('APP_STORE_COPY.md', 'privacy') || fileContains('APP_STORE_COPY.md', 'Privacy'));

check('CI/CD', 'Railway deploy workflow exists', () => fileExists('.github/workflows/deploy-railway.yml'));
check('CI/CD', 'Smoke test script exists', () => fileExists('scripts/smoke-test.js'));
check('CI/CD', 'MOBILE_BUILD_GUIDE.md exists', () => fileExists('MOBILE_BUILD_GUIDE.md'));

check('Docs', 'README.md exists', () => fileExists('README.md'));
check('Docs', 'CHANGELOG.md exists', () => fileExists('CHANGELOG.md'));
check('Docs', 'TASK_PLAN.md exists', () => fileExists('TASK_PLAN.md'));

console.log('\n🔍 SummitLink Pre-Release Checklist\n');
console.log('='.repeat(60));

let currentCat = '';
let totalPass = 0;
let totalFail = 0;

checks.forEach((c) => {
  if (c.category !== currentCat) {
    currentCat = c.category;
    console.log(`\n📂 ${c.category}`);
  }
  const icon = c.pass ? '✅' : '❌';
  const note = c.note ? ` (${c.note})` : '';
  console.log(`  ${icon} ${c.name}${note}`);
  if (c.pass) totalPass++; else totalFail++;
});

console.log('\n' + '='.repeat(60));
console.log(`\n📊 总计: ${totalPass + totalFail} 项  ✅ 通过: ${totalPass}  ❌ 未通过: ${totalFail}`);

if (totalFail === 0) {
  console.log('\n🎉 全部检查通过！可以提交 App Store/Google Play 审核了。');
} else {
  console.log(`\n⚠️  还有 ${totalFail} 项需要处理后再提交。`);
  const failing = checks.filter((c) => !c.pass);
  console.log('\n需要处理的项目：');
  failing.forEach((c) => console.log(`  ❌ [${c.category}] ${c.name}`));
}

console.log('');
