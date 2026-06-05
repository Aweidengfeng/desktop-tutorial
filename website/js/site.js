(function () {
  const APP_DEADLINE = '2026-10-15T23:59:59Z';

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
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  function animateCounter(el) {
    const target = Number(el.dataset.counterTarget || 0);
    const duration = Number(el.dataset.counterDuration || 1400);
    const suffix = el.dataset.counterSuffix || '';
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
    container.className = type === 'error' ? 'form-error' : 'form-success';
    container.textContent = message;
    container.classList.remove('hidden');
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
    const subject = `SummitLink form submission (${endpoint || 'website'})`;
    const flatten = (v) => String(v).replace(/[\r\n]+/g, ' ').trim();
    const body = Object.entries(payload)
      .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.map(flatten).join(', ') : flatten(value)}`)
      .join('\n');
    return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  function showMailtoFallback(container, form, payload) {
    if (!container) return;
    container.className = 'form-error';
    container.textContent = 'We could not reach our server right now. ';
    const link = document.createElement('a');
    link.href = buildMailtoFallback(form, payload);
    link.textContent = 'Send your details by email instead';
    link.className = 'text-sky-300 underline';
    container.appendChild(link);
    container.append('. Your information was not lost.');
    container.classList.remove('hidden');
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
        submitButton.textContent = 'Submitting...';
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error('Request failed');

      if (successPanel) {
        const name = payload.fullName || payload.name || 'Climber';
        const email = payload.email || 'your email';
        const customMessage = form.dataset.successTemplate
          ? form.dataset.successTemplate
              .replaceAll('{name}', name)
              .replaceAll('{email}', email)
          : 'Thank you! We received your submission.';
        successPanel.textContent = customMessage;
        successPanel.classList.remove('hidden');
      }

      setMessage(messageTarget, 'Submission successful.', 'success');
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
