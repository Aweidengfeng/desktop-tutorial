/**
 * 商业远征报名流程 E2E
 * 路径：探索 → 商业攀登 → 选择远征队 → 查看详情
 */
const { test } = require('./fixtures/auth.fixture');
const { expect } = require('@playwright/test');
const { gotoExploreCategory } = require('./helpers/navigation');

test.describe('商业远征报名流程', () => {
  test('商业攀登列表加载后应有内容', async ({ userPage: page }) => {
    await gotoExploreCategory(page, 'commercial');
    const section = page.locator('[x-show="activeCategory === \'commercial\'"]').first();
    await section.waitFor({ state: 'visible', timeout: 10000 });
    await expect(page.locator('button:has-text("全部")').first()).toBeVisible();
    await expect(page.locator('button:has-text("向导")').first()).toBeVisible();
    await expect(page.locator('button:has-text("俱乐部")').first()).toBeVisible();
  });

  test('切换「向导」筛选后应显示服务山峰信息', async ({ userPage: page }) => {
    await gotoExploreCategory(page, 'commercial');
    await page.locator('[x-show="activeCategory === \'commercial\'"] button:has-text("向导")').first().click();
    await expect(page.locator('text=服务山峰：').first()).toBeVisible({ timeout: 10000 });
  });

  test('切换「俱乐部」筛选后应显示攀登山峰信息', async ({ userPage: page }) => {
    await gotoExploreCategory(page, 'commercial');
    await page.locator('[x-show="activeCategory === \'commercial\'"] button:has-text("俱乐部")').first().click();
    await expect(page.locator('text=攀登山峰：').first()).toBeVisible({ timeout: 10000 });
  });
});
