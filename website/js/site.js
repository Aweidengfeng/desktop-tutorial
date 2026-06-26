(function () {
  const APP_DEADLINE = '2026-10-15T23:59:59Z';

  // Absolute API origin for the lead-collection backend. The static site is served
  // from GitHub Pages (unsummit.cn) which has no backend, so form `data-api`
  // paths must be resolved against this origin. Override at runtime by setting
  // `window.SUMMITLINK_API_BASE` before this script loads.
  const API_BASE = (typeof window !== 'undefined' && window.SUMMITLINK_API_BASE) || '';
  const API_BASE_FALLBACKS = (typeof window !== 'undefined' && Array.isArray(window.SUMMITLINK_API_BASE_FALLBACKS))
    ? window.SUMMITLINK_API_BASE_FALLBACKS
    : [];
  const API_BASES = [...new Set(
    [API_BASE, ...API_BASE_FALLBACKS]
      .map((base) => String(base || '').trim())
      .filter(Boolean)
  )];

  // Resolve a form's relative `data-api` path into an absolute endpoint when an
  // API base is configured; otherwise fall back to the same-origin path.
  function resolveEndpoint(path, apiBase = API_BASE) {
    if (!path) return path;
    if (/^https?:\/\//i.test(path)) return path;
    if (!apiBase) return path;
    try {
      return new URL(path, apiBase).toString();
    } catch (e) {
      return path;
    }
  }

  function resolveEndpointCandidates(path) {
    if (!path) return [];
    if (/^https?:\/\//i.test(path) || !API_BASES.length) return [path];
    return API_BASES.map((base) => resolveEndpoint(path, base));
  }

  function initNav() {
    const nav = document.querySelector('.site-nav');
    const toggle = document.querySelector('[data-menu-toggle]');
    const mobileMenu = document.querySelector('[data-mobile-menu]');
    const page = document.body.dataset.page;

    if (toggle && mobileMenu) {
      toggle.addEventListener('click', () => {
        const open = mobileMenu.classList.toggle('open');
        toggle.setAttribute('aria-expanded', String(open));
      });
    }

    window.addEventListener('scroll', () => {
      if (!nav) return;
      nav.classList.toggle('scrolled', window.scrollY > 18);
    });

    document.querySelectorAll('[data-nav]').forEach((link) => {
      if (link.dataset.nav === page) {
        link.classList.add('active');
        link.setAttribute('aria-current', 'page');
      }
    });
  }

  function initReveal() {
    const nodes = document.querySelectorAll('[data-reveal]');
    if (!nodes.length) return;
    if (prefersReducedMotion()) {
      nodes.forEach((n) => n.classList.add('revealed'));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    nodes.forEach((n) => observer.observe(n));
  }

  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach((link) => {
      link.addEventListener('click', (event) => {
        const target = document.querySelector(link.getAttribute('href'));
        if (!target) return;
        event.preventDefault();
        target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
      });
    });
  }

  const reducedMotionQuery = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;

  function prefersReducedMotion() {
    return !!(reducedMotionQuery && reducedMotionQuery.matches);
  }

  function animateCounter(el) {
    const target = Number(el.dataset.counterTarget || 0);
    const suffix = el.dataset.counterSuffix || '';
    if (prefersReducedMotion()) {
      el.textContent = `${target.toLocaleString()}${suffix}`;
      return;
    }
    const duration = Number(el.dataset.counterDuration || 1400);
    const start = performance.now();

    function frame(now) {
      const progress = Math.min((now - start) / duration, 1);
      const value = Math.floor(progress * target);
      el.textContent = `${value.toLocaleString()}${suffix}`;
      if (progress < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function initCounters() {
    const counters = document.querySelectorAll('[data-counter-target]');
    if (!counters.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          animateCounter(entry.target);
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.35 }
    );
    counters.forEach((el) => observer.observe(el));
  }

  function renderDeadlineDiff() {
    const now = Date.now();
    const end = new Date(APP_DEADLINE).getTime();
    const diff = Math.max(end - now, 0);
    const totalSec = Math.floor(diff / 1000);

    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;

    document.querySelectorAll('[data-days-until-close]').forEach((el) => {
      el.textContent = `${days} days until applications close`;
    });

    document.querySelectorAll('[data-deadline-countdown]').forEach((container) => {
      const map = {
        days,
        hours,
        minutes,
        seconds
      };
      Object.entries(map).forEach(([k, v]) => {
        const node = container.querySelector(`[data-time="${k}"]`);
        if (node) node.textContent = String(v).padStart(2, '0');
      });
    });
  }

  function initCountdowns() {
    renderDeadlineDiff();
    setInterval(renderDeadlineDiff, 1000);
  }

  function setMessage(container, message, type) {
    if (!container) return;
    prepareLiveRegion(container, type === 'error' ? 'assertive' : 'polite');
    container.className = type === 'error' ? 'form-error' : 'form-success';
    container.textContent = message;
    container.classList.remove('hidden');
  }

  function prepareLiveRegion(container, mode = 'polite') {
    if (!container) return;
    container.setAttribute('aria-live', mode);
    container.setAttribute('aria-atomic', 'true');
    container.setAttribute('role', mode === 'assertive' ? 'alert' : 'status');
  }

  // Fallback inbox per form endpoint, used when the backend API is unreachable
  // (e.g. the static site is served without an API origin). Ensures leads are
  // never silently lost on submit failure.
  const FORM_FALLBACK_EMAIL = {
    '/api/contact': 'hello@summitlink.com',
    '/api/partnerships': 'partners@summitlink.com',
    '/api/applications/seven-summits': 'hello@summitlink.com',
    '/api/applications/guide': 'guides@summitlink.com'
  };

  function buildMailtoFallback(form, payload) {
    const endpoint = form.dataset.api || '';
    const to = FORM_FALLBACK_EMAIL[endpoint] || 'hello@summitlink.com';
    const subject = `SummitLink backup submission (${endpoint || 'website'})`;
    const flatten = (v) => String(v).replace(/[\r\n]+/g, ' ').trim();
    const body = Object.entries(payload)
      .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.map(flatten).join(', ') : flatten(value)}`)
      .join('\n');
    return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  function showMailtoFallback(container, form, payload) {
    if (!container) return;
    prepareLiveRegion(container, 'assertive');
    container.className = 'form-error';
    container.textContent = 'We could not reach the SummitLink API. Your submission was not stored yet. ';
    const link = document.createElement('a');
    link.href = buildMailtoFallback(form, payload);
    link.textContent = 'Send your details by email as a backup';
    link.className = 'text-sky-300 underline';
    container.appendChild(link);
    container.append('. Our team will manually route it to the right inbox.');
    container.classList.remove('hidden');
  }

  function getSuccessMessage(form, payload, result) {
    const name = payload.fullName || payload.name || 'there';
    const email = payload.email || 'your email';
    if (form.dataset.successTemplate) {
      return form.dataset.successTemplate
        .replaceAll('{name}', name)
        .replaceAll('{email}', email)
        .replaceAll('{nextSteps}', result.nextSteps || '');
    }
    const nextSteps = result.nextSteps || 'Our team will review your submission and follow up with next steps.';
    return `Thank you, ${name}. We received your submission and created a secure follow-up record. ${nextSteps} A confirmation email has been queued for ${email}.`;
  }

  function serializeForm(form) {
    const data = {};
    const formData = new FormData(form);
    for (const [key, value] of formData.entries()) {
      if (data[key]) {
        data[key] = Array.isArray(data[key]) ? [...data[key], value] : [data[key], value];
      } else {
        data[key] = value;
      }
    }
    form.querySelectorAll('input[type="checkbox"]').forEach((input) => {
      if (!input.name) return;
      if (!formData.has(input.name) && input.value === 'on') data[input.name] = false;
    });
    return data;
  }

  async function submitForm(form) {
    const endpoint = form.dataset.api;
    const messageTarget = form.querySelector('[data-form-message]');
    const successPanel = form.parentElement.querySelector('[data-form-success-panel]');
    const submitButton = form.querySelector('button[type="submit"]');
    const defaultLabel = submitButton ? submitButton.textContent : '';

    if (!endpoint) return;

    const payload = serializeForm(form);

    try {
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Sending...';
      }

      const endpointCandidates = resolveEndpointCandidates(endpoint);
      let response;
      let lastNetworkError;
      for (const url of endpointCandidates) {
        try {
          response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          break;
        } catch (networkError) {
          lastNetworkError = networkError;
        }
      }

      if (!response) {
        const failureDetail = lastNetworkError instanceof Error
          ? lastNetworkError.message
          : String(lastNetworkError || 'unknown network error');
        throw new Error(`No response received from ${endpointCandidates.length} API endpoint(s): ${failureDetail}`);
      }

      let result = {};
      try {
        result = await response.json();
      } catch (e) {
        result = {};
      }

      if (!response.ok) throw new Error(result.error || 'Request failed');

      if (successPanel) {
        prepareLiveRegion(successPanel, 'polite');
        successPanel.textContent = getSuccessMessage(form, payload, result);
        successPanel.classList.remove('hidden');
      }

      setMessage(messageTarget, 'Submission received. Check the next-step panel below.', 'success');
      form.reset();
    } catch (error) {
      showMailtoFallback(messageTarget, form, payload);
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = defaultLabel;
      }
    }
  }

  function initForms() {
    document.querySelectorAll('form[data-api]').forEach((form) => {
      prepareLiveRegion(form.querySelector('[data-form-message]'), 'polite');
      prepareLiveRegion(form.parentElement.querySelector('[data-form-success-panel]'), 'polite');
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        submitForm(form);
      });
    });
  }

  function initNotifyModal() {
    const modal = document.querySelector('[data-notify-modal]');
    if (!modal) return;
    const close = modal.querySelector('[data-notify-close]');
    const form = modal.querySelector('form');
    const panel = modal.querySelector('[data-notify-result]');

    function setOpen(open) {
      modal.classList.toggle('open', open);
      modal.setAttribute('aria-hidden', String(!open));
    }

    document.querySelectorAll('[data-notify-open]').forEach((btn) => {
      btn.addEventListener('click', () => setOpen(true));
    });

    if (close) close.addEventListener('click', () => setOpen(false));

    modal.addEventListener('click', (event) => {
      if (event.target === modal) setOpen(false);
    });

    if (form) {
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const email = new FormData(form).get('email');
        if (panel) {
          panel.textContent = `Thanks! We'll notify ${email} when SummitLink Mobile App launches.`;
          panel.classList.remove('hidden');
        }
        form.reset();
      });
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    initNav();
    initReveal();
    initSmoothScroll();
    initCounters();
    initCountdowns();
    initNotifyModal();
    initForms();
  });
})();
