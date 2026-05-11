/**
 * Convert SVG icon to 1024×1024 PNG for use as icon source
 * 使用方法：node scripts/convert-svg-to-png.js [input.svg] [output.png]
 */

const path = require('path');
const fs = require('fs');

const input = process.argv[2] || path.join(__dirname, '../assets/icon-source-placeholder.svg');
const output = process.argv[3] || path.join(__dirname, '../assets/icon-source.png');

async function convert() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch {
    console.error('❌ sharp not installed. Run: npm install sharp --save-dev');
    process.exit(1);
  }

  if (!fs.existsSync(input)) {
    console.error(`❌ Input file not found: ${input}`);
    process.exit(1);
  }

  console.log(`\n🔄 Converting SVG → PNG`);
  console.log(`   Input:  ${input}`);
  console.log(`   Output: ${output}`);

  await sharp(input)
    .resize(1024, 1024)
    .png()
    .toFile(output);

  console.log(`\n✅ Done! ${output} (1024×1024 px)`);
  console.log('\nNext: node scripts/generate-icons.js\n');
}

convert().catch(err => {
  console.error('💥 Conversion failed:', err.message);
  process.exit(1);
});
