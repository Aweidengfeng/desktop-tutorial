/**
 * Shared navigation helpers for Playwright E2E tests.
 * Centralises UI-navigation logic so tests stay resilient to future
 * layout changes (e.g. extra tabs added by a PR).
 */

/**
 * Click a bottom-nav tab by logical name and wait for its section to appear.
 * @param {import('@playwright/test').Page} page
 * @param {'home'|'explore'|'discover'|'chat'|'me'} tabName
 */
async function gotoTab(page, tabName) {
  // Ensure we are on the app page before trying to click nav
  if (!page.url().includes('/summitlink')) {
    await page.goto('/summitlink');
    await page.waitForLoadState('networkidle');
  }

  const tabKeyMap = { home: 'expedition', discover: 'explore' };
  const tabKey = tabKeyMap[tabName] || tabName;
  let navigatedByShortcut = false;
  if (tabName === 'explore' || tabName === 'discover') {
    const exploreShortcut = page.locator('button:has-text("天气查询"), button:has-text("探索山峰")').first();
    if (await exploreShortcut.isVisible({ timeout: 1500 }).catch(() => false)) {
      await exploreShortcut.click({ timeout: 5000 }).catch(() => {});
      navigatedByShortcut = true;
    }
  }
  const navButtonSelectors = {
    home: 'nav button:has-text("精选路线"), nav button:has-text("首页"), [data-tab="expedition"], [data-tab="home"]',
    explore: 'nav button:has-text("探索"), nav button:has-text("找队友"), [data-tab="explore"]',
    discover: 'nav button:has-text("探索"), nav button:has-text("找队友"), [data-tab="explore"], [data-tab="discover"]',
    chat: 'nav button:has-text("消息"), [data-tab="chat"], [data-tab="messages"]',
    me: 'nav button:has-text("我的"), nav button:has-text("我"), [data-tab="me"], [data-tab="profile"]',
  };
  const navSel = navButtonSelectors[tabName] || `[data-tab="${tabName}"]`;
  if (!navigatedByShortcut) {
    await page.locator(navSel).first().click({ timeout: 5000 }).catch(() => {});
  }
  const labelCandidatesMap = {
    expedition: ['精选路线', '首页', 'expedition'],
    explore: ['探索', '社区', '发现', '找队友', 'explore'],
    chat: ['消息', 'chat'],
    me: ['我的', '我', 'profile', 'me'],
  };
  const labelCandidates = labelCandidatesMap[tabKey] || [tabName];
  let btn = page.locator(`button[data-tab="${tabKey}"]`).first();
  let clicked = false;
  if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await btn.click().catch(() => {});
    clicked = true;
  } else {
    for (const candidate of labelCandidates) {
      const candidateBtn = page.locator('nav button, .tab-bar button, nav a, .tab-bar a').filter({ hasText: candidate }).first();
      if (await candidateBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
        btn = candidateBtn;
        await btn.click().catch(() => {});
        clicked = true;
        break;
      }
    }
  }
  if (!clicked && !navigatedByShortcut) {
    await page.locator(navSel).first().click({ timeout: 5000 }).catch(() => {});
  }
  const xShowKeyMap = { home: 'home', discover: 'explore', me: 'profile' };
  const xShowKey = xShowKeyMap[tabName] || tabKey;
  const candidates = [
    `section[x-show="currentPage === '${xShowKey}'"]`,
    `div[x-show="currentPage === '${xShowKey}'"]`,
    `section[x-show="currentPage === '${tabKey}'"]`,
    `div[x-show="currentPage === '${tabKey}'"]`,
    `section[x-show="currentPage === '${tabName}'"]`,
    `div[x-show="currentPage === '${tabName}'"]`,
  ];

  for (const sel of candidates) {
    const locator = page.locator(sel);
    const count = await locator.count();
    for (let i = 0; i < count; i++) {
      const visible = await locator.nth(i).isVisible({ timeout: 2000 }).catch(() => false);
      if (visible) return;
    }
  }

  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    for (const sel of candidates) {
      const locator = page.locator(sel);
      const count = await locator.count();
      for (let i = 0; i < count; i++) {
        if (await locator.nth(i).isVisible().catch(() => false)) return;
      }
    }
    await page.waitForTimeout(150);
  }

  await page.locator(candidates.join(', ')).first().waitFor({ state: 'visible', timeout: 2000 });
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
    const exploreSection = page.locator(`section[x-show*="currentPage === 'explore'"]`).first();
    await exploreSection.waitFor({ state: 'visible', timeout: 8000 });
    await exploreSection.locator(`button:has-text("${catLabel}")`).first().click();
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
  const loginBtn = page.locator('button:visible:has-text("登录"), button:visible:has-text("注册"), [data-action="login"]').first();
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
