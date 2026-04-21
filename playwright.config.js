/**
 * Playwright 测试配置
 * 针对 SummitLink 线上地址进行 E2E 测试
 */

const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  // 测试文件目录
  testDir: './tests',
  // 只匹配 E2E 测试文件（API 测试由 node 直接运行）
  testMatch: '**/*.spec.js',

  // 全局超时：30 秒
  timeout: 30000,
  // 断言超时
  expect: {
    timeout: 10000,
  },

  // 失败后最多重试 1 次（CI 环境网络可能不稳定）
  retries: process.env.CI ? 1 : 0,

  // 并发工作进程数
  workers: process.env.CI ? 1 : undefined,

  // 测试报告
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'playwright-report/results.json' }],
  ],

  use: {
    // 基础 URL（所有测试的 baseURL）
    baseURL: process.env.BASE_URL || (process.env.CI ? 'http://localhost:8080' : 'https://precious-miracle-production.up.railway.app'),

    // 浏览器视口大小
    viewport: { width: 1280, height: 720 },

    // 失败时自动截图
    screenshot: 'only-on-failure',

    // 失败时录制视频
    video: 'on-first-retry',

    // 失败时保存 trace（方便调试）
    trace: 'on-first-retry',

    // 请求超时
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },

  // 测试浏览器：只用 Chromium（减少 CI 时间）
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
