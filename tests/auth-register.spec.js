/**
 * 注册 / 登录流程基础验证
 */
const { test, expect } = require('@playwright/test');
const { loginAsTestUser } = require('./helpers/navigation');

test.describe('登录注册流程', () => {
  test('点击登录按钮应弹出登录弹窗', async ({ page }) => {
    await page.goto('/summitlink');
    await page.waitForLoadState('networkidle');
    const loginBtn = page.locator('button:visible:has-text("登录"), button:visible:has-text("注册"), [data-action="login"]').first();
    if (await loginBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await loginBtn.click();
      await expect(page.locator('[x-show="showLogin"], .login-modal, #login-modal').first()).toBeVisible({ timeout: 5000 });
      return;
    }
    await expect(page.locator('nav button:has-text("我的"), [data-tab="me"]').first()).toBeVisible({ timeout: 5000 });
  });

  test('密码登录 Tab 应有手机号和密码输入框', async ({ page }) => {
    await page.goto('/summitlink');
    await page.waitForLoadState('networkidle');
    const loginBtn = page.locator('button:visible:has-text("登录"), [data-action="login"]').first();
    if (await loginBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await loginBtn.click();
      const loginBox = page.locator('[x-show="showLogin"]');
      const pwTab = loginBox.locator('button:has-text("密码登录")');
      if (await pwTab.isVisible({ timeout: 2000 }).catch(() => false)) await pwTab.click();
      await expect(loginBox.locator('input[type="tel"]').first()).toBeVisible({ timeout: 5000 });
      await expect(loginBox.locator('input[type="password"]').first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('正确凭证登录后「我的」Tab 应可见用户信息', async ({ page }) => {
    await page.goto('/summitlink');
    await page.waitForLoadState('networkidle');
    const loginBtn = page.locator('button:visible:has-text("登录"), button:visible:has-text("注册"), [data-action="login"]').first();
    if (await loginBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await loginAsTestUser(page);
    }
    await page.waitForTimeout(2000);
    await page.locator('nav button:has-text("我的"), [data-tab="me"]').first().click();
    await page.waitForTimeout(1000);
    const loginPrompt = page.locator('[x-show="currentPage === \'me\'"] button:has-text("登录")');
    const isLoginPromptVisible = await loginPrompt.isVisible({ timeout: 2000 }).catch(() => false);
    expect(isLoginPromptVisible).toBe(false);
  });
});
