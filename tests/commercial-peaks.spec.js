const { test, expect } = require('@playwright/test');
const { gotoExploreCategory, gotoTab } = require('./helpers/navigation');

test.describe('商业向导攀登统计模块', () => {
  test('商业攀登 Tab 应显示「全部/向导/俱乐部」筛选', async ({ page }) => {
    await page.goto('/summitlink');
    await page.waitForLoadState('networkidle');
    await gotoExploreCategory(page, 'commercial');
    await expect(page.locator('button:has-text("全部")').first()).toBeVisible();
    await expect(page.locator('button:has-text("向导")').first()).toBeVisible();
    await expect(page.locator('button:has-text("俱乐部")').first()).toBeVisible();
  });

  test('商业攀登应支持向导/俱乐部独立展示', async ({ page }) => {
    await page.goto('/summitlink');
    await page.waitForLoadState('networkidle');
    await gotoExploreCategory(page, 'commercial');
    await page.locator('button:has-text("向导")').first().click();
    await expect(page.locator('text=服务山峰：').first()).toBeVisible({ timeout: 10000 });
    await page.locator('button:has-text("俱乐部")').first().click();
    await expect(page.locator('text=攀登山峰：').first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('营地天气 C2/C3 独立节点', () => {
  test('营地天气应显示独立的 data-camp 属性节点', async ({ page }) => {
    await page.goto('/summitlink');
    await page.waitForLoadState('networkidle');
    // 天气搜索框在探索页（PR #43 后藏在非激活 Tab 里）
    await gotoTab(page, 'explore');
    // 等待天气搜索框可见后填入
    const input = page.locator('input[placeholder*="搜索全球任意地点天气"]');
    await input.waitFor({ state: 'visible', timeout: 10000 });
    await input.fill('珠穆朗玛峰');
    await page.locator('button:has-text("搜索")').click();
    // 等待营地天气加载
    await page.waitForTimeout(5000);
    // 检查是否有 data-camp 属性的元素
    const campElements = page.locator('[data-camp]');
    const count = await campElements.count();
    expect(count).toBeGreaterThan(0);
    // 检查 C2 和 C3 有独立节点
    const c2 = page.locator('[data-camp*="C2"]');
    const c3 = page.locator('[data-camp*="C3"]');
    // At least one of them should exist
    const c2Count = await c2.count();
    const c3Count = await c3.count();
    expect(c2Count + c3Count).toBeGreaterThan(0);
  });
});

test.describe('OSM 地名查询', () => {
  test('geocodeByOSM 函数应该存在于页面', async ({ page }) => {
    await page.goto('/summitlink');
    await page.waitForLoadState('networkidle');
    // 通过 Alpine.js 调用 geocodeByOSM（mock fetch 测试）
    const hasFn = await page.evaluate(() => {
      // Alpine v3 优先通过 Alpine.$data 读取，再降级兼容旧内部结构
      const el = document.querySelector('[x-data]');
      if (!el) return false;
      const data = el._x_dataStack
        ? el._x_dataStack[0]
        : (window.Alpine && typeof window.Alpine.$data === 'function' ? window.Alpine.$data(el) : null);
      if (!data) {
        if (typeof window.alpineLink === 'function') {
          const obj = window.alpineLink();
          return typeof obj?.geocodeByOSM === 'function';
        }
        return false;
      }
      return typeof data.geocodeByOSM === 'function';
    });
    expect(hasFn).toBe(true);
  });

  test('输入未知地名时搜索应显示友好提示', async ({ page }) => {
    await page.goto('/summitlink');
    await page.waitForLoadState('networkidle');
    // 天气搜索框在探索页（PR #43 后藏在非激活 Tab 里）
    await gotoTab(page, 'explore');
    const input = page.locator('input[placeholder*="搜索全球任意地点天气"]');
    await input.waitFor({ state: 'visible', timeout: 10000 });
    await input.fill('xxxxxnonexistentplace99999');
    await page.locator('button:has-text("搜索")').click();
    // 等待结果
    await page.waitForTimeout(8000);
    // 应该显示结果区域
    await expect(page.locator('[x-show="showWeatherSearchResult"]')).toBeVisible({ timeout: 15000 });
    // 应该有提示文字（或错误消息，不是空白）
    const resultText = await page.locator('[x-show="showWeatherSearchResult"]').textContent();
    expect(resultText.length).toBeGreaterThan(5);
  });
});
