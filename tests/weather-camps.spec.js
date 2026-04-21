// tests/weather-camps.spec.js
const { test, expect } = require('@playwright/test');
const { gotoTab } = require('./helpers/navigation');

test.describe('营地天气功能', () => {
  test('天气搜索框输入珠穆朗玛峰应显示营地分层结果', async ({ page }) => {
    await page.goto('/summitlink');
    await page.waitForLoadState('networkidle');
    // 天气搜索框在探索页（PR #43 后藏在非激活 Tab 里）
    await gotoTab(page, 'explore');
    // 等待天气搜索框可见（Alpine.js 初始化完成）
    const weatherInput = page.locator('input[placeholder*="搜索全球任意地点天气"]');
    await weatherInput.waitFor({ state: 'visible', timeout: 10000 });
    await weatherInput.fill('珠穆朗玛峰');
    await page.locator('button:has-text("搜索")').click();
    // 应当显示结果区域
    await expect(page.locator('[x-show="showWeatherSearchResult"]')).toBeVisible({ timeout: 15000 });
    // 应当显示营地名称（至少显示大本营）
    await expect(page.locator('text=大本营 EBC')).toBeVisible({ timeout: 10000 });
  });

  test('天气搜索框输入不存在地点应显示错误提示而非空白', async ({ page }) => {
    await page.goto('/summitlink');
    await page.waitForLoadState('networkidle');
    // 天气搜索框在探索页（PR #43 后藏在非激活 Tab 里）
    await gotoTab(page, 'explore');
    // 等待天气搜索框可见
    const weatherInput = page.locator('input[placeholder*="搜索全球任意地点天气"]');
    await weatherInput.waitFor({ state: 'visible', timeout: 10000 });
    await weatherInput.fill('xxxxxxxxxnotexist12345');
    await page.locator('button:has-text("搜索")').click();
    await expect(page.locator('[x-show="showWeatherSearchResult"]')).toBeVisible({ timeout: 15000 });
    // 不应出现空白，应有错误提示文字
    const resultBox = page.locator('[x-show="showWeatherSearchResult"] .bg-slate-800');
    await expect(resultBox).toBeVisible({ timeout: 10000 });
  });
});
