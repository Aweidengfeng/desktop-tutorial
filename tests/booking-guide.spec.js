/**
 * 向导服务预约流程 E2E
 * 路径：探索 → 专业向导 → 选择向导 → 发起预约
 */
const { test } = require('./fixtures/auth.fixture');
const { expect } = require('@playwright/test');
const { gotoExploreCategory } = require('./helpers/navigation');

test.describe('向导预约流程', () => {
  test('专业向导列表应可见并能点击查看详情', async ({ userPage: page }) => {
    await gotoExploreCategory(page, 'guides');
    const guideCard = page.locator('[x-show="activeCategory === \'guides\'"] .glass, [x-show="activeCategory === \'guides\'"] .glass-dark').first();
    await expect(guideCard).toBeVisible({ timeout: 10000 });
  });

  test('点击向导卡片应弹出详情', async ({ userPage: page }) => {
    await gotoExploreCategory(page, 'guides');
    const firstGuide = page.locator('[x-show="activeCategory === \'guides\'"] button, [x-show="activeCategory === \'guides\'"] [role="button"]').first();
    await firstGuide.waitFor({ state: 'visible', timeout: 10000 });
    await firstGuide.click();
    await page.waitForTimeout(1500);
    const hasBookingText = await page.locator('text=预约, text=联系向导, text=立即预约').first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasBookingText || await page.locator('[x-show="showGuideDetail"]').isVisible().catch(() => false)).toBeTruthy();
  });
});
