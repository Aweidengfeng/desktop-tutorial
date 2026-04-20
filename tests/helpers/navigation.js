/**
 * Shared navigation helpers for Playwright E2E tests.
 * Centralises UI-navigation logic so tests stay resilient to future
 * layout changes (e.g. extra tabs added by a PR).
 */

/**
 * Click a bottom-nav tab by logical name.
 * @param {import('@playwright/test').Page} page
 * @param {'home'|'explore'|'chat'|'gear'|'me'} tabName
 */
async function gotoTab(page, tabName) {
  const nameMap = {
    home: '首页',
    explore: '探索',
    chat: '聊天',
    gear: '装备',
    me: '我的',
  };
  const label = nameMap[tabName] || tabName;
  await page.locator('nav button').filter({ hasText: label }).first().click();
  await page.waitForTimeout(300); // allow Alpine.js transition to settle
}

/**
 * Navigate to the explore page and activate a specific category tab.
 * @param {import('@playwright/test').Page} page
 * @param {'8000ers'|'continental'|'world'|'alpine'|'guides'|'commercial'} [category]
 */
async function gotoExploreCategory(page, category) {
  const categoryMap = {
    '8000ers': '八千米巨峰',
    continental: '洲最高峰',
    world: '世界经典',
    alpine: '技术攀登',
    guides: '专业向导',
    commercial: '商业攀登',
  };

  await gotoTab(page, 'explore');

  if (category && categoryMap[category]) {
    const catLabel = categoryMap[category];
    // Category buttons are inside the explore section scroll row
    await page.locator(`button:has-text("${catLabel}")`).first().click();
    await page.waitForTimeout(300);
  }
}

/**
 * Open the login modal and sign in with password login.
 * Handles the PR #43 "密码登录 / 短信验证码" tab inside the modal.
 * @param {import('@playwright/test').Page} page
 * @param {{ username?: string, password?: string }} [opts]
 */
async function loginAsTestUser(page, { username = '13800138000', password = '123456' } = {}) {
  // Open the login modal via the nav-bar button
  await page.locator('button:has-text("登录")').first().click();

  // Wait until the password input inside the modal is visible
  await page.locator('input[type="password"]').waitFor({ state: 'visible', timeout: 8000 });

  // Make sure the "密码登录" tab is active (PR #43 added a SMS tab)
  const passwordTab = page.locator('button:has-text("密码登录")');
  if (await passwordTab.isVisible().catch(() => false)) {
    await passwordTab.click();
    await page.waitForTimeout(200);
  }

  // Fill credentials
  await page.locator('input[type="tel"]').first().fill(username);
  await page.locator('input[type="password"]').first().fill(password);

  // Click the full-width primary submit button.
  // The tab buttons use `flex-1`, not `w-full`, so this selector is unique.
  await page.locator('[x-show="showLogin"] button.w-full').first().click();
}

module.exports = { gotoTab, gotoExploreCategory, loginAsTestUser };
