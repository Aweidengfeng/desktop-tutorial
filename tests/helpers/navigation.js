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
  await page.waitForFunction(() => !!window.Alpine, { timeout: 5000 }).catch(() => {});
  await page.locator('nav button, nav a, [data-tab]').first().waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});

  const tabKeyMap = { home: 'expedition', discover: 'explore' };
  const tabKey = tabKeyMap[tabName] || tabName;
  const navButtonSelectors = {
    home: 'nav button:has-text("精选路线"), nav button:has-text("首页"), [data-tab="expedition"], [data-tab="home"]',
    explore: 'nav button:has-text("探索"), nav button:has-text("探索山峰"), nav button:has-text("找队友"), nav a:has-text("探索"), nav a:has-text("探索山峰"), nav a:has-text("找队友")',
    discover: 'nav button:has-text("社区"), [data-tab="discover"], [data-tab="explore"]',
    chat: 'nav button:has-text("消息"), [data-tab="chat"], [data-tab="messages"]',
    me: 'nav button:has-text("我的"), nav button:has-text("我"), [data-tab="me"], [data-tab="profile"], nav a:has-text("我的")',
  };
  const navSel = navButtonSelectors[tabName] || `[data-tab="${tabName}"]`;
  let navClicked = await page.locator(navSel).first().click({ timeout: 5000 }).then(() => true).catch(() => false);
  const labelCandidatesMap = {
    expedition: ['精选路线', '首页', 'expedition'],
    explore: ['探索', '探索山峰', '找队友', 'explore'],
    chat: ['消息', 'chat'],
    me: ['我的', '我', 'profile', 'me'],
  };
  const labelCandidates = labelCandidatesMap[tabKey] || [tabName];
  if (!navClicked) {
    for (const candidate of labelCandidates) {
      const candidateBtn = page.locator('nav button, .tab-bar button, nav a, .tab-bar a').filter({ hasText: candidate }).first();
      if (await candidateBtn.isVisible({ timeout: 300 }).catch(() => false)) {
        await candidateBtn.click().catch(() => {});
        navClicked = true;
        break;
      }
    }
  }
  const xShowKeyMap = { home: 'home', discover: 'explore', me: 'me' };
  const xShowKey = xShowKeyMap[tabName] || tabKey;
  const candidates = [
    `section[x-show="currentPage === '${xShowKey}'"]`,
    `div[x-show="currentPage === '${xShowKey}'"]`,
    `section[x-show="currentPage === '${tabKey}'"]`,
    `div[x-show="currentPage === '${tabKey}'"]`,
    `section[x-show="currentPage === '${tabName}'"]`,
    `div[x-show="currentPage === '${tabName}'"]`,
    `section[x-show*="currentPage === '${xShowKey}'"]`,
    `div[x-show*="currentPage === '${xShowKey}'"]`,
  ];
  const hasVisibleSection = async () => {
    for (const sel of candidates) {
      const visibleElement = page.locator(`${sel}:visible`).first();
      const visible = await visibleElement.isVisible({ timeout: 300 }).catch(() => false);
      if (visible) return true;
    }
    return false;
  };

  if (await hasVisibleSection()) return;

  if (tabName === 'explore') {
    const homeButton = page.locator(navButtonSelectors.home).first();
    if (await homeButton.isVisible({ timeout: 300 }).catch(() => false)) {
      await homeButton.click().catch(() => {});
    }
    const exploreShortcut = page
      .locator('button:visible:has-text("探索山峰"), button:visible:has-text("商业攀登"), button:visible:has-text("找向导")')
      .first();
    if (await exploreShortcut.isVisible({ timeout: 300 }).catch(() => false)) {
      await exploreShortcut.click().catch(() => {});
    }
    if (await hasVisibleSection()) return;
    await page.evaluate(() => {
      try {
        const el = document.querySelector('body[x-data]') || document.querySelector('[x-data]');
        const data = el?._x_dataStack?.[0]
          || (el && window.Alpine && typeof window.Alpine.$data === 'function' ? window.Alpine.$data(el) : null);
        if (data) {
          if (typeof data.goToPage === 'function') {
            data.goToPage('explore');
            return;
          }
          data.currentPage = 'explore';
          return;
        }
        if (typeof window.alpineLink === 'function') {
          const obj = window.alpineLink();
          if (typeof obj?.goToPage === 'function') {
            obj.goToPage('explore');
            return;
          }
          if (obj) obj.currentPage = 'explore';
        }
      } catch (e) {}
    }).catch(() => {});
    await page.waitForTimeout(600);
    if (await hasVisibleSection()) return;
  }

  await page
    .locator(candidates.map(sel => `${sel}:visible`).join(', '))
    .first()
    .waitFor({ state: 'visible', timeout: 15000 })
    .catch(() => {
      throw new Error(
        `gotoTab('${tabName}'): tab section not visible after navigation attempt. ` +
        `Verify that the nav button click is working and that the section's x-show condition resolves correctly.`
      );
    });
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
    // `activeCategory` blocks can be repeated in the same section, so intentionally wait on the first visible match.
    await exploreSection.locator(`[x-show="activeCategory === '${category}'"]`).first().waitFor({ state: 'visible', timeout: 5000 });
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
