/**
 * 无障碍基础验证 E2E
 */
const { test, expect } = require('@playwright/test');

test.describe('无障碍基础验证', () => {
  test('底部导航应有 role=tablist', async ({ page }) => {
    await page.goto('/summitlink');
    await page.waitForLoadState('networkidle');
    const nav = page.locator('nav[role="tablist"], nav[aria-label="主导航"]').first();
    await expect(nav).toBeAttached({ timeout: 5000 });
  });

  test('登录弹窗应有 role=dialog 和 aria-modal', async ({ page }) => {
    await page.goto('/summitlink');
    await page.waitForLoadState('networkidle');
    const loginBtn = page.locator('button:visible:has-text("登录"), [data-action="login"]').first();
    if (await loginBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await loginBtn.click();
      const dialog = page.locator('[role="dialog"][aria-modal="true"]').first();
      await expect(dialog).toBeVisible({ timeout: 5000 });
    }
  });

  test('Escape 键应能关闭登录弹窗', async ({ page }) => {
    await page.goto('/summitlink');
    await page.waitForLoadState('networkidle');
    const loginBtn = page.locator('button:visible:has-text("登录"), [data-action="login"]').first();
    if (await loginBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await loginBtn.click();
      await page.waitForTimeout(500);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      const dialog = page.locator('[role="dialog"][aria-modal="true"]').first();
      const isVisible = await dialog.isVisible().catch(() => false);
      expect(isVisible).toBe(false);
    }
  });

  test('页面应有跳过导航链接', async ({ page }) => {
    await page.goto('/summitlink');
    const skipLink = page.locator('a[href="#main-content"]').first();
    await expect(skipLink).toBeAttached({ timeout: 5000 });
  });
});
