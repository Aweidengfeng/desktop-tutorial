// tests/weather-camps.spec.js
const { test, expect } = require('@playwright/test');

test.describe('营地天气功能', () => {
  test('天气搜索框输入珠穆朗玛峰应显示营地分层结果', async ({ page }) => {
    await page.goto('/');
    // 等待天气搜索框可用（Alpine.js 初始化完成）
    await page.waitForSelector('input[placeholder*="搜索全球任意地点天气"]');
    // 找到天气搜索框
    const weatherInput = page.locator('input[placeholder*="搜索全球任意地点天气"]');
    await weatherInput.fill('珠穆朗玛峰');
    await page.click('button:has-text("搜索")');
    // 应当显示结果区域
    await expect(page.locator('[x-show="showWeatherSearchResult"]')).toBeVisible({ timeout: 10000 });
    // 应当显示营地名称（至少显示大本营）
    await expect(page.locator('text=大本营 EBC')).toBeVisible({ timeout: 10000 });
  });

  test('天气搜索框输入不存在地点应显示错误提示而非空白', async ({ page }) => {
    await page.goto('/');
    // 等待天气搜索框可用（Alpine.js 初始化完成）
    await page.waitForSelector('input[placeholder*="搜索全球任意地点天气"]');
    const weatherInput = page.locator('input[placeholder*="搜索全球任意地点天气"]');
    await weatherInput.fill('xxxxxxxxxnotexist12345');
    await page.click('button:has-text("搜索")');
    await expect(page.locator('[x-show="showWeatherSearchResult"]')).toBeVisible({ timeout: 10000 });
    // 不应出现空白，应有错误提示文字
    const resultBox = page.locator('[x-show="showWeatherSearchResult"] .bg-slate-800');
    await expect(resultBox).toBeVisible({ timeout: 10000 });
  });
});
