/**
 * SummitLink Icon Generator
 * 从单一源图片生成所有平台所需的应用图标
 *
 * 使用方法：
 *   node scripts/generate-icons.js [source-image]
 *
 * 默认源图片：assets/icon-source.png（1024×1024 px）
 *
 * 依赖：sharp（npm install sharp --save-dev 在根目录）
 * 如果没有 sharp，脚本会提示安装方法并退出
 */

const path = require('path');
const fs = require('fs');

const SOURCE = process.argv[2] || path.join(__dirname, '../assets/icon-source.png');
const ROOT = path.join(__dirname, '..');

// ── Icon specs ──────────────────────────────────────────────────────────────

const IOS_ICONS = [
  // iPhone
  { size: 20,   scale: 1, name: 'Icon-20.png' },
  { size: 20,   scale: 2, name: 'Icon-20@2x.png' },
  { size: 20,   scale: 3, name: 'Icon-20@3x.png' },
  { size: 29,   scale: 1, name: 'Icon-29.png' },
  { size: 29,   scale: 2, name: 'Icon-29@2x.png' },
  { size: 29,   scale: 3, name: 'Icon-29@3x.png' },
  { size: 40,   scale: 1, name: 'Icon-40.png' },
  { size: 40,   scale: 2, name: 'Icon-40@2x.png' },
  { size: 40,   scale: 3, name: 'Icon-40@3x.png' },
  { size: 60,   scale: 2, name: 'Icon-60@2x.png' },
  { size: 60,   scale: 3, name: 'Icon-60@3x.png' },
  // iPad
  { size: 76,   scale: 1, name: 'Icon-76.png' },
  { size: 76,   scale: 2, name: 'Icon-76@2x.png' },
  { size: 83.5, scale: 2, name: 'Icon-83.5@2x.png' },
  // App Store
  { size: 1024, scale: 1, name: 'Icon-1024.png' },
];

const ANDROID_ICONS = [
  { density: 'mdpi',    size: 48  },
  { density: 'hdpi',    size: 72  },
  { density: 'xhdpi',   size: 96  },
  { density: 'xxhdpi',  size: 144 },
  { density: 'xxxhdpi', size: 192 },
];

const ANDROID_ROUND_ICONS = [
  { density: 'mdpi',    size: 48  },
  { density: 'hdpi',    size: 72  },
  { density: 'xhdpi',   size: 96  },
  { density: 'xxhdpi',  size: 144 },
  { density: 'xxxhdpi', size: 192 },
];

const PWA_ICONS = [
  { size: 72  },
  { size: 96  },
  { size: 128 },
  { size: 144 },
  { size: 152 },
  { size: 192 },
  { size: 384 },
  { size: 512 },
];

// Google Play Feature Graphic placeholder size
const PLAY_STORE_ICON = { size: 512, name: 'play-store-icon-512.png' };

// ── Paths ────────────────────────────────────────────────────────────────────

const PATHS = {
  ios:         path.join(ROOT, 'ios/App/App/Assets.xcassets/AppIcon.appiconset'),
  android:     path.join(ROOT, 'android/app/src/main/res'),
  pwa:         path.join(ROOT, 'assets/icons'),
  playstore:   path.join(ROOT, 'assets'),
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`  📁 Created: ${path.relative(ROOT, dir)}`);
  }
}

function px(size, scale = 1) {
  return Math.round(size * scale);
}

async function generateIcon(sharp, source, outputPath, size) {
  await sharp(source)
    .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toFile(outputPath);
}

async function generateRoundIcon(sharp, source, outputPath, size) {
  // Create circular mask
  const radius = Math.floor(size / 2);
  const circleSvg = `<svg width="${size}" height="${size}">
    <circle cx="${radius}" cy="${radius}" r="${radius}" fill="white"/>
  </svg>`;

  await sharp(source)
    .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .composite([{
      input: Buffer.from(circleSvg),
      blend: 'dest-in'
    }])
    .png()
    .toFile(outputPath);
}

// ── Contents.json for Xcode ───────────────────────────────────────────────

function generateContentsJson(icons) {
  const result = {
    images: icons.map(icon => {
      let idiom = 'iphone';
      if (icon.size === 76 || icon.size === 83.5) idiom = 'ipad';
      if (icon.size === 1024) idiom = 'ios-marketing';
      return {
        filename: icon.name,
        idiom,
        scale: `${icon.scale}x`,
        size: `${icon.size}x${icon.size}`
      };
    }),
    info: { author: 'xcode', version: 1 }
  };

  return JSON.stringify(result, null, 2);
}

// ── PWA manifest update ────────────────────────────────────────────────────

function updateManifest(pwaIcons) {
  const manifestPath = path.join(ROOT, 'manifest.json');
  const webmanifestPath = path.join(ROOT, 'site.webmanifest');

  const iconEntries = pwaIcons.map(({ size }) => ({
    src: `assets/icons/icon-${size}x${size}.png`,
    sizes: `${size}x${size}`,
    type: 'image/png',
    // Icons ≥192px are marked maskable; ensure the source has a 40% safe-zone
    // inset so Android doesn't crop important content when applying its mask.
    purpose: size >= 192 ? 'any maskable' : 'any'
  }));

  const manifestData = {
    name: 'SummitLink',
    short_name: 'SummitLink',
    description: 'Connect with climbers, discover routes, book guides worldwide',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#1a56db',
    orientation: 'portrait-primary',
    icons: iconEntries,
    categories: ['sports', 'travel', 'navigation'],
    lang: 'en'
  };

  const targetPath = fs.existsSync(manifestPath) ? manifestPath :
                     fs.existsSync(webmanifestPath) ? webmanifestPath : manifestPath;

  fs.writeFileSync(targetPath, JSON.stringify(manifestData, null, 2));
  console.log(`  📄 Updated: ${path.relative(ROOT, targetPath)}`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🎨 SummitLink Icon Generator\n');

  // Check for sharp
  let sharp;
  try {
    sharp = require('sharp');
  } catch {
    console.error('❌ sharp is not installed.\n');
    console.log('Install it with:');
    console.log('  npm install sharp --save-dev\n');
    console.log('Or use the fallback SVG-to-PNG method:');
    console.log('  npm install canvas --save-dev');
    console.log('  (then re-run this script)\n');
    process.exit(1);
  }

  // Check source file
  if (!fs.existsSync(SOURCE)) {
    console.error(`❌ Source image not found: ${SOURCE}\n`);
    console.log('Please provide a 1024×1024 px PNG or specify a path:');
    console.log('  node scripts/generate-icons.js path/to/your-icon.png\n');
    console.log('Requirements:');
    console.log('  - Minimum size: 1024×1024 px');
    console.log('  - Format: PNG');
    console.log('  - No rounded corners (the OS applies them)');
    console.log('  - Transparent or white background\n');
    process.exit(1);
  }

  // Validate source dimensions
  const metadata = await sharp(SOURCE).metadata();
  console.log(`📸 Source: ${SOURCE}`);
  console.log(`   Size: ${metadata.width}×${metadata.height} px\n`);

  if (metadata.width < 1024 || metadata.height < 1024) {
    console.warn(`⚠️  Source image is smaller than 1024×1024. Quality may be degraded.`);
  }

  let generated = 0;

  // ── iOS Icons ──
  console.log('📱 Generating iOS icons...');
  ensureDir(PATHS.ios);

  for (const icon of IOS_ICONS) {
    const size = px(icon.size, icon.scale);
    const outputPath = path.join(PATHS.ios, icon.name);
    await generateIcon(sharp, SOURCE, outputPath, size);
    console.log(`  ✅ ${icon.name} (${size}×${size})`);
    generated++;
  }

  // Write Contents.json
  const contentsPath = path.join(PATHS.ios, 'Contents.json');
  fs.writeFileSync(contentsPath, generateContentsJson(IOS_ICONS));
  console.log(`  📄 Contents.json updated`);

  // ── Android Icons ──
  console.log('\n🤖 Generating Android icons...');

  for (const icon of ANDROID_ICONS) {
    const dir = path.join(PATHS.android, `mipmap-${icon.density}`);
    ensureDir(dir);
    const outputPath = path.join(dir, 'ic_launcher.png');
    await generateIcon(sharp, SOURCE, outputPath, icon.size);
    console.log(`  ✅ mipmap-${icon.density}/ic_launcher.png (${icon.size}×${icon.size})`);
    generated++;
  }

  for (const icon of ANDROID_ROUND_ICONS) {
    const dir = path.join(PATHS.android, `mipmap-${icon.density}`);
    ensureDir(dir);
    const outputPath = path.join(dir, 'ic_launcher_round.png');
    await generateRoundIcon(sharp, SOURCE, outputPath, icon.size);
    console.log(`  ✅ mipmap-${icon.density}/ic_launcher_round.png (${icon.size}×${icon.size})`);
    generated++;
  }

  // Play Store icon
  console.log('\n🏪 Generating Play Store icon...');
  ensureDir(PATHS.playstore);
  const playStorePath = path.join(PATHS.playstore, PLAY_STORE_ICON.name);
  await generateIcon(sharp, SOURCE, playStorePath, PLAY_STORE_ICON.size);
  console.log(`  ✅ ${PLAY_STORE_ICON.name} (512×512)`);
  generated++;

  // ── PWA Icons ──
  console.log('\n🌐 Generating PWA icons...');
  ensureDir(PATHS.pwa);

  for (const icon of PWA_ICONS) {
    const outputPath = path.join(PATHS.pwa, `icon-${icon.size}x${icon.size}.png`);
    await generateIcon(sharp, SOURCE, outputPath, icon.size);
    console.log(`  ✅ icon-${icon.size}x${icon.size}.png`);
    generated++;
  }

  // Update manifest
  updateManifest(PWA_ICONS);

  // ── Summary ──
  console.log(`\n🎉 Done! Generated ${generated} icons.\n`);
  console.log('📂 Output locations:');
  console.log(`  iOS:       ${path.relative(ROOT, PATHS.ios)}`);
  console.log(`  Android:   ${path.relative(ROOT, PATHS.android)}/mipmap-*/`);
  console.log(`  PWA:       ${path.relative(ROOT, PATHS.pwa)}`);
  console.log(`  Play Store: assets/play-store-icon-512.png\n`);
  console.log('Next steps:');
  console.log('  1. Open Xcode → verify icons appear in AppIcon asset catalog');
  console.log('  2. Run `npx cap sync` to sync icons to native projects');
  console.log('  3. Build and verify icons on device/simulator\n');
}

main().catch(err => {
  console.error('\n💥 Icon generation failed:', err.message);
  process.exit(1);
});
