const { test: base } = require('@playwright/test');
const { loginAsTestUser } = require('../helpers/navigation');

const test = base.extend({
  userPage: async ({ page }, use) => {
    await page.goto('/summitlink');
    await page.waitForLoadState('networkidle');
    const loginBtn = page.locator('button:visible:has-text("登录"), button:visible:has-text("注册"), [data-action="login"]').first();
    const canLogin = await loginBtn.isVisible({ timeout: 3000 }).catch(() => false);
    if (canLogin) {
      await loginAsTestUser(page, { username: '13800138000', password: '123456' });
      await page.waitForTimeout(1500);
    }
    await use(page);
  },
});

module.exports = { test };
