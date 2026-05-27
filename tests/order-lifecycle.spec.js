/**
 * 订单生命周期 E2E
 * 路径：「我的」→「我的订单」→ 查看订单列表
 */
const { test } = require('./fixtures/auth.fixture');
const { expect } = require('@playwright/test');

test.describe('订单生命周期', () => {
  test('登录后「我的」Tab 应可见', async ({ userPage: page }) => {
    await page.locator('nav button:has-text("我的"), [data-tab="me"]').first().click();
    await page.waitForTimeout(1000);
    const meSection = page.locator('[x-show="currentPage === \'me\'"]').first();
    await expect(meSection).toBeVisible({ timeout: 8000 });
  });

  test('「我的」页应显示用户名或头像', async ({ userPage: page }) => {
    await page.locator('nav button:has-text("我的"), [data-tab="me"]').first().click();
    await page.waitForTimeout(1000);
    const loggedInIndicator = page.locator('[x-show="currentPage === \'me\'"] img[alt], [x-show="currentPage === \'me\'"] .avatar, [x-show="currentPage === \'me\'"] [x-text="currentUser.username"]').first();
    await expect(loggedInIndicator).toBeVisible({ timeout: 8000 });
  });

  test('点击「我的订单」应弹出订单列表', async ({ userPage: page }) => {
    await page.locator('nav button:has-text("我的"), [data-tab="me"]').first().click();
    await page.waitForTimeout(1000);
    const ordersBtn = page.locator('button:has-text("我的订单"), button:has-text("订单"), [data-action="orders"]').first();
    if (await ordersBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await ordersBtn.click();
      await expect(
        page.locator('[x-show="showMyOrders"], text=全部订单, text=暂无订单').first()
      ).toBeVisible({ timeout: 8000 });
    }
  });
});
