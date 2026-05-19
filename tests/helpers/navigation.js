/**
 * Shared navigation helpers for Playwright E2E tests.
 * Centralises UI-navigation logic so tests stay resilient to future
 * layout changes (e.g. extra tabs added by a PR).
 */

/**
 * Click a bottom-nav tab by logical name and wait for its section to appear.
 * @param {import('@playwright/test').Page} page
 * @param {'home'|'explore'|'chat'|'me'} tabName
 */
async function gotoTab(page, tabName) {
  // Ensure we are on the app page before trying to click nav
  if (!page.url().includes('/summitlink')) {
    await page.goto('/summitlink');
    await page.waitForLoadState('networkidle');
  }

  const nameMap = {
    home: '首页',
    explore: '探索',
    chat: '聊天',
    me: '我',
  };
  const label = nameMap[tabName] || tabName;
  const labelCandidates = tabName === 'explore' ? [label, '找队友'] : [label];
  let btn = page.locator(`button[data-tab="${tabName}"]`).first();
  if (!(await btn.isVisible({ timeout: 3000 }).catch(() => false))) {
    for (const candidate of labelCandidates) {
      const candidateBtn = page.locator(`nav button:has-text("${candidate}")`).first();
      if (await candidateBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
        btn = candidateBtn;
        break;
      }
    }
  }
  await btn.waitFor({ state: 'visible', timeout: 8000 });
  await btn.click();
  // Wait for the corresponding section to become visible (x-show sets display based on currentPage)
  await page.locator(`[x-show*="${tabName}"]`).first().waitFor({ state: 'visible', timeout: 8000 });
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
    // Wait for the category content section to become visible.
    // Use exact x-show attribute value to avoid strict mode violations
    // (e.g. 'commercial' appears in many other x-show expressions in the booking modal)
    await page.locator(`[x-show="activeCategory === '${category}'"]`).waitFor({ state: 'visible', timeout: 5000 });
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
  const loginBtn = page.locator('button:visible:has-text("登录"):not(:has-text("退出"))').first();
  await loginBtn.waitFor({ state: 'visible', timeout: 10000 });
  await loginBtn.click();

  // Scope all selectors to the login form container to avoid strict mode violations
  // caused by the register form having identical input types in the same DOM
  const loginBox = page.locator('[x-show="showLogin"]');

  // Wait until the password input inside the login modal is visible
  await loginBox.locator('input[type="password"]').waitFor({ state: 'visible', timeout: 8000 });

  // Make sure the "密码登录" tab is active (PR #43 added a SMS tab)
  const passwordTab = loginBox.locator('button:has-text("密码登录")');
  if (await passwordTab.isVisible().catch(() => false)) {
    await passwordTab.click();
    // Wait for the password input to remain visible after the tab switch
    await loginBox.locator('input[type="password"]').waitFor({ state: 'visible', timeout: 3000 });
  }

  // Fill credentials
  await loginBox.locator('input[type="tel"]').first().fill(username);
  await loginBox.locator('input[type="password"]').first().fill(password);

  // Click the full-width primary submit button.
  // The tab buttons use `flex-1`, not `w-full`, so this selector is unique.
  await page.locator('[x-show="showLogin"] button.w-full').first().click();
}

module.exports = { gotoTab, gotoExploreCategory, loginAsTestUser };
