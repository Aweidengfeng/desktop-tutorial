import { defaultLanguage, supportedLanguages, translations, getCopy } from './i18n.js';

const state = {
  language: defaultLanguage,
  billing: 'monthly'
};

function currentPage() {
  return document.body?.dataset.page || 'home';
}

function injectShell() {
  const headerHost = document.querySelector('[data-site-header]');
  const footerHost = document.querySelector('[data-site-footer]');
  if (headerHost) {
    headerHost.innerHTML = `
      <header class="site-header fixed inset-x-0 top-0 z-50 px-4 py-4">
        <div class="header-shell glass-panel mx-auto max-w-7xl rounded-[28px] px-5 py-4 transition-all duration-500">
          <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div class="flex flex-wrap items-center gap-4">
              <a href="./index.html" class="flex items-center gap-3">
                <span class="flex h-11 w-11 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10">
                  <svg viewBox="0 0 64 64" class="h-7 w-7" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8 52L28 14L38 30L46 20L56 52H8Z" fill="url(#logo-gradient)"/>
                    <defs>
                      <linearGradient id="logo-gradient" x1="10" y1="14" x2="54" y2="54" gradientUnits="userSpaceOnUse">
                        <stop stop-color="#4FACFE"/>
                        <stop offset="1" stop-color="#F5A623"/>
                      </linearGradient>
                    </defs>
                  </svg>
                </span>
                <div>
                  <div class="font-display text-lg font-bold tracking-[0.18em] text-white">SummitLink</div>
                  <div class="text-[11px] uppercase tracking-[0.34em] text-white/40">Global Alpine Platform</div>
                </div>
              </a>
              <nav class="flex flex-wrap items-center gap-2 text-sm text-white/70">
                ${['home', 'climbers', 'guides', 'corporate', 'peaks', 'pricing', 'apply', 'contact'].map((page) => `
                  <a href="./${page === 'home' ? 'index' : page}.html" data-nav-link="${page}" class="rounded-full px-3 py-2 transition hover:bg-white/5 hover:text-white" data-i18n="nav.${page}"></a>
                `).join('')}
              </nav>
            </div>
            <div class="flex flex-wrap items-center gap-3">
              <select data-language-selector class="form-select w-auto min-w-[130px] bg-black/40 py-2 pr-10 text-sm">
                <option value="zh">中文</option>
                <option value="en">English</option>
                <option value="es">Español</option>
                <option value="ja">日本語</option>
              </select>
              <a href="./apply.html#guide" class="rounded-full border border-white/10 px-4 py-2 text-sm text-white/80 transition hover:border-white/20 hover:bg-white/5" data-i18n="nav.guideCta"></a>
              <a href="./corporate.html" class="rounded-full border border-white/10 px-4 py-2 text-sm text-white/80 transition hover:border-white/20 hover:bg-white/5" data-i18n="nav.corporateCta"></a>
              <a href="./climbers.html" class="rounded-full bg-gradient-to-r from-sky-400 to-amber-400 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_0_40px_rgba(79,172,254,0.35)] transition hover:-translate-y-0.5" data-i18n="nav.experienceCta"></a>
            </div>
          </div>
        </div>
      </header>
    `;
  }
  if (footerHost) {
    footerHost.innerHTML = `
      <footer class="site-footer mt-24">
        <div class="mx-auto grid max-w-7xl gap-10 px-4 py-12 md:grid-cols-[1.4fr_0.8fr_0.8fr]">
          <div class="space-y-4">
            <div class="flex items-center gap-3">
              <span class="flex h-11 w-11 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10">
                <svg viewBox="0 0 64 64" class="h-7 w-7" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 52L28 14L38 30L46 20L56 52H8Z" fill="url(#footer-gradient)"/>
                  <defs>
                    <linearGradient id="footer-gradient" x1="10" y1="14" x2="54" y2="54" gradientUnits="userSpaceOnUse">
                      <stop stop-color="#4FACFE"/>
                      <stop offset="1" stop-color="#F5A623"/>
                    </linearGradient>
                  </defs>
                </svg>
              </span>
              <div>
                <div class="font-display text-lg font-bold tracking-[0.18em] text-white">SummitLink</div>
                <div class="text-xs text-white/40">Since 2026</div>
              </div>
            </div>
            <p class="max-w-xl text-sm leading-7 text-white/60" data-i18n="footer.tagline"></p>
            <div class="space-y-1 text-sm text-white/50">
              <p>🇨🇳 <span data-i18n="footer.nodeCn"></span></p>
              <p>🌍 <span data-i18n="footer.nodeGlobal"></span></p>
              <p data-icp-only>📄 <span data-i18n="footer.icp"></span></p>
            </div>
          </div>
          <div>
            <h3 class="mb-4 text-sm font-semibold uppercase tracking-[0.24em] text-white/50" data-i18n="footer.quickLinks"></h3>
            <div class="grid gap-2 text-sm text-white/70">
              <a class="transition hover:text-white" href="./index.html" data-i18n="nav.home"></a>
              <a class="transition hover:text-white" href="./peaks.html" data-i18n="nav.peaks"></a>
              <a class="transition hover:text-white" href="./pricing.html" data-i18n="nav.pricing"></a>
              <a class="transition hover:text-white" href="./apply.html" data-i18n="nav.apply"></a>
            </div>
          </div>
          <div>
            <h3 class="mb-4 text-sm font-semibold uppercase tracking-[0.24em] text-white/50" data-i18n="footer.contact"></h3>
            <div class="space-y-2 text-sm text-white/70">
              <p>hello@summitlink.com</p>
              <p>guides@summitlink.com</p>
              <p>corporate@summitlink.com</p>
              <p class="pt-2 text-white/40" data-i18n="footer.rights"></p>
            </div>
          </div>
        </div>
      </footer>
    `;
  }
}

function t(key) {
  return getCopy(state.language, key);
}

function resolveLanguage() {
  const stored = window.localStorage.getItem('summitlink-language');
  if (stored && supportedLanguages.includes(stored)) {
    return stored;
  }
  const browser = navigator.language?.toLowerCase() || '';
  if (browser.startsWith('zh')) return 'zh';
  if (browser.startsWith('es')) return 'es';
  if (browser.startsWith('ja')) return 'ja';
  return defaultLanguage;
}

function setTextContent(selector, updater) {
  document.querySelectorAll(selector).forEach(updater);
}

function setLanguage(language) {
  if (!translations[language]) return;
  state.language = language;
  window.localStorage.setItem('summitlink-language', language);
  document.documentElement.lang = language;
  setTextContent('[data-i18n]', (element) => {
    element.textContent = t(element.dataset.i18n);
  });
  setTextContent('[data-i18n-html]', (element) => {
    element.innerHTML = t(element.dataset.i18nHtml);
  });
  setTextContent('[data-i18n-placeholder]', (element) => {
    element.setAttribute('placeholder', t(element.dataset.i18nPlaceholder));
  });
  setTextContent('option[data-i18n]', (element) => {
    element.textContent = t(element.dataset.i18n);
  });
  setTextContent('[data-language-selector]', (element) => {
    element.value = language;
  });
  const pageTitleKey = document.body?.dataset.pageTitle;
  if (pageTitleKey) {
    document.title = `${t(pageTitleKey)} · SummitLink`;
  }
  updateBillingTexts();
  updateCalculator();
  updateIcp();
  document.dispatchEvent(new CustomEvent('summitlink:languagechange', { detail: { language } }));
}

function updateIcp() {
  document.querySelectorAll('[data-icp-only]').forEach((element) => {
    element.style.display = state.language === 'zh' ? '' : 'none';
  });
}

function initLanguageSelectors() {
  document.querySelectorAll('[data-language-selector]').forEach((select) => {
    select.addEventListener('change', (event) => setLanguage(event.target.value));
  });
}

function initHeaderState() {
  const header = document.querySelector('.site-header');
  if (!header) return;
  const update = () => {
    header.classList.toggle('scrolled', window.scrollY > 18);
  };
  update();
  window.addEventListener('scroll', update, { passive: true });
}

function initActiveNav() {
  document.querySelectorAll('[data-nav-link]').forEach((link) => {
    if (link.dataset.navLink === currentPage()) {
      link.classList.add('bg-white/10', 'text-white');
    }
  });
}

function initRevealObserver() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  document.querySelectorAll('[data-reveal]').forEach((element) => {
    element.classList.add('reveal');
    observer.observe(element);
  });
}

function animateCounter(element) {
  if (element.dataset.animated === 'true') return;
  element.dataset.animated = 'true';
  const target = Number(element.dataset.count || 0);
  const suffix = element.dataset.suffix || '';
  const prefix = element.dataset.prefix || '';
  const duration = 1400;
  const start = performance.now();
  const tick = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = Math.floor(target * eased);
    element.textContent = `${prefix}${value.toLocaleString()}${suffix}`;
    if (progress < 1) {
      requestAnimationFrame(tick);
    }
  };
  requestAnimationFrame(tick);
}

function initCounters() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });
  document.querySelectorAll('[data-count]').forEach((element) => observer.observe(element));
}

function initParticles() {
  document.querySelectorAll('.particles').forEach((container) => {
    if (container.dataset.ready === 'true') return;
    container.dataset.ready = 'true';
    const amount = Number(container.dataset.particles || 36);
    for (let i = 0; i < amount; i += 1) {
      const particle = document.createElement('span');
      const size = (Math.random() * 4 + 2).toFixed(2);
      particle.style.width = `${size}px`;
      particle.style.height = `${size}px`;
      particle.style.left = `${Math.random() * 100}%`;
      particle.style.bottom = `${Math.random() * 30 - 10}%`;
      particle.style.opacity = `${Math.random() * 0.55 + 0.15}`;
      particle.style.animationDuration = `${Math.random() * 16 + 12}s`;
      particle.style.animationDelay = `${Math.random() * -20}s`;
      particle.style.setProperty('--drift-x', `${Math.random() * 80 - 40}px`);
      particle.style.setProperty('--travel-y', `${Math.random() * 420 + 160}px`);
      container.appendChild(particle);
    }
  });
}

function initParallax() {
  const layers = document.querySelectorAll('[data-parallax]');
  if (!layers.length) return;
  const update = () => {
    const offset = window.scrollY;
    layers.forEach((layer) => {
      const speed = Number(layer.dataset.parallax || 0.15);
      layer.style.transform = `translate3d(0, ${offset * speed}px, 0)`;
    });
  };
  update();
  window.addEventListener('scroll', update, { passive: true });
}

function initHeroTabs() {
  const buttons = [...document.querySelectorAll('[data-hero-tab]')];
  const panels = [...document.querySelectorAll('[data-hero-panel]')];
  if (!buttons.length || !panels.length) return;
  const activate = (tab) => {
    buttons.forEach((button) => button.classList.toggle('is-active', button.dataset.heroTab === tab));
    panels.forEach((panel) => {
      const active = panel.dataset.heroPanel === tab;
      panel.classList.toggle('hidden', !active);
      panel.classList.toggle('animate-[fade_0.4s_ease]', active);
    });
  };
  buttons.forEach((button) => button.addEventListener('click', () => activate(button.dataset.heroTab)));
  activate(buttons[0].dataset.heroTab);
}

function updateCalculator() {
  const rateInput = document.querySelector('[data-guide-rate]');
  const daysInput = document.querySelector('[data-guide-days]');
  const output = document.querySelector('[data-guide-income]');
  if (!rateInput || !daysInput || !output) return;
  const rate = Number(rateInput.value || 0);
  const days = Number(daysInput.value || 0);
  const total = rate * days;
  output.textContent = total.toLocaleString();
}

function initCalculator() {
  const fields = document.querySelectorAll('[data-guide-rate], [data-guide-days]');
  if (!fields.length) return;
  fields.forEach((field) => field.addEventListener('input', updateCalculator));
  updateCalculator();
}

function updateBillingTexts() {
  const isYearly = state.billing === 'yearly';
  document.querySelectorAll('[data-price]').forEach((element) => {
    const raw = element.dataset[isYearly ? 'yearly' : 'monthly'];
    const prefix = element.dataset.prefix || '';
    const numeric = Number(raw);
    element.textContent = Number.isFinite(numeric) ? `${prefix}${numeric}` : raw;
  });
  document.querySelectorAll('[data-billing-suffix]').forEach((element) => {
    element.textContent = t(isYearly ? 'common.perYear' : 'common.perMonth');
  });
  document.querySelectorAll('[data-billing-note]').forEach((element) => {
    element.textContent = t(isYearly ? 'common.billedYearly' : 'common.billedMonthly');
  });
}

function initBillingToggle() {
  const toggle = document.querySelector('[data-billing-toggle]');
  if (!toggle) return;
  toggle.addEventListener('change', () => {
    state.billing = toggle.checked ? 'yearly' : 'monthly';
    updateBillingTexts();
  });
  updateBillingTexts();
}

function validateRequiredFields(form) {
  let valid = true;
  form.querySelectorAll('[required]').forEach((field) => {
    const empty = !String(field.value || '').trim();
    field.classList.toggle('invalid-field', empty);
    if (empty) valid = false;
    field.addEventListener('input', () => field.classList.remove('invalid-field'), { once: true });
    field.addEventListener('change', () => field.classList.remove('invalid-field'), { once: true });
  });
  return valid;
}

function ensureUiOverlays() {
  if (!document.querySelector('[data-toast-stack]')) {
    const toastStack = document.createElement('div');
    toastStack.className = 'toast-stack';
    toastStack.dataset.toastStack = 'true';
    document.body.appendChild(toastStack);
  }
  if (!document.querySelector('[data-modal-backdrop]')) {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.dataset.modalBackdrop = 'true';
    backdrop.innerHTML = `
      <div class="modal-card glass-panel text-white">
        <div class="mb-3 text-xs uppercase tracking-[0.28em] text-white/40">SummitLink</div>
        <h3 class="mb-3 text-2xl font-black" data-modal-title></h3>
        <p class="mb-6 text-sm leading-7 text-white/70" data-modal-body></p>
        <button type="button" class="rounded-full bg-gradient-to-r from-sky-400 to-amber-400 px-5 py-2.5 text-sm font-semibold text-slate-950" data-modal-close></button>
      </div>
    `;
    document.body.appendChild(backdrop);
    const closeButton = backdrop.querySelector('[data-modal-close]');
    closeButton.addEventListener('click', () => backdrop.classList.remove('is-open'));
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) backdrop.classList.remove('is-open');
    });
  }
}

function showToast(keyOrText) {
  ensureUiOverlays();
  const message = keyOrText.includes('.') ? t(keyOrText) : keyOrText;
  const stack = document.querySelector('[data-toast-stack]');
  const toast = document.createElement('div');
  toast.className = 'toast-card';
  toast.textContent = message;
  stack.appendChild(toast);
  window.setTimeout(() => {
    toast.remove();
  }, 3000);
}

function showModal({ title, message }) {
  ensureUiOverlays();
  const backdrop = document.querySelector('[data-modal-backdrop]');
  backdrop.querySelector('[data-modal-title]').textContent = title.includes('.') ? t(title) : title;
  backdrop.querySelector('[data-modal-body]').textContent = message.includes('.') ? t(message) : message;
  backdrop.querySelector('[data-modal-close]').textContent = t('common.close');
  backdrop.classList.add('is-open');
}

function initGenericForms() {
  document.querySelectorAll('form[data-mock-form]:not([data-application-form])').forEach((form) => {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!validateRequiredFields(form)) {
        showToast('common.completeRequired');
        return;
      }
      form.reset();
      showModal({
        title: form.dataset.successTitleKey || 'contact.successTitle',
        message: form.dataset.successBodyKey || 'contact.successBody'
      });
    });
  });
}

function initPaymentBadges() {
  document.querySelectorAll('[data-payment-method]').forEach((button) => {
    button.addEventListener('click', () => showToast('common.paymentComingSoon'));
  });
}

function exposeApi() {
  window.SummitLinkSite = {
    t,
    showToast,
    showModal,
    validateRequiredFields,
    getLanguage: () => state.language,
    setLanguage
  };
}

document.addEventListener('DOMContentLoaded', () => {
  injectShell();
  initLanguageSelectors();
  initHeaderState();
  initActiveNav();
  initRevealObserver();
  initCounters();
  initParticles();
  initParallax();
  initHeroTabs();
  initCalculator();
  initBillingToggle();
  initGenericForms();
  initPaymentBadges();
  exposeApi();
  state.language = resolveLanguage();
  setLanguage(state.language);
});
