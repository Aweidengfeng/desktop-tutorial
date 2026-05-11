/**
 * SummitLink App Store 截图自动生成脚本
 * 使用: node screenshots/capture.js
 * 依赖: npm install -D puppeteer
 */
const path = require('path');
const fs = require('fs');

async function captureScreenshots() {
  let puppeteer;
  try {
    puppeteer = require('puppeteer');
  } catch (e) {
    console.error('请先安装 puppeteer: npm install -D puppeteer');
    process.exit(1);
  }

  const outputDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const configs = [
    {
      name: 'ios',
      template: 'template-ios.html',
      width: 1290,
      height: 2796,
      screens: 5
    },
    {
      name: 'android',
      template: 'template-android.html',
      width: 1080,
      height: 1920,
      screens: 5
    }
  ];

  const browser = await puppeteer.launch({ headless: 'new' });

  for (const config of configs) {
    const page = await browser.newPage();
    await page.setViewport({ width: config.width, height: config.height, deviceScaleFactor: 1 });

    const templatePath = path.join(__dirname, config.template);
    await page.goto(`file://${templatePath}`);
    await page.waitForSelector('.screen');

    console.log(`📸 Generating ${config.name} screenshots...`);

    for (let i = 1; i <= config.screens; i++) {
      await page.evaluate((screenId) => {
        document.querySelector(`#screen${screenId}`).scrollIntoView();
      }, i);

      const element = await page.$(`#screen${i}`);
      if (element) {
        const outputPath = path.join(outputDir, `${config.name}-screen${i}.png`);
        await element.screenshot({ path: outputPath });
        console.log(`  ✅ Saved: ${outputPath}`);
      }
    }

    await page.close();
  }

  await browser.close();
  console.log('\n🎉 All screenshots generated in screenshots/output/');
  console.log('📁 Ready for App Store Connect and Google Play Console upload!');
}

captureScreenshots().catch(console.error);
