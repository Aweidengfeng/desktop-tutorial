document.addEventListener('DOMContentLoaded', () => {
  const api = window.SummitLinkSite;
  const buttons = [...document.querySelectorAll('[data-apply-tab]')];
  const panels = [...document.querySelectorAll('[data-apply-panel]')];

  const activate = (tab) => {
    buttons.forEach((button) => button.classList.toggle('is-active', button.dataset.applyTab === tab));
    panels.forEach((panel) => {
      panel.classList.toggle('hidden', panel.dataset.applyPanel !== tab);
    });
    if (location.hash !== `#${tab}`) {
      history.replaceState(null, '', `#${tab}`);
    }
  };

  buttons.forEach((button) => {
    button.addEventListener('click', () => activate(button.dataset.applyTab));
  });

  const initialTab = location.hash.replace('#', '') === 'corporate' ? 'corporate' : 'guide';
  activate(initialTab);

  window.addEventListener('hashchange', () => {
    activate(location.hash.replace('#', '') === 'corporate' ? 'corporate' : 'guide');
  });

  document.querySelectorAll('form[data-application-form]').forEach((form) => {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      let valid = api.validateRequiredFields(form);

      if (form.dataset.applicationForm === 'corporate') {
        const wrap = form.querySelector('[data-business-group]');
        const checked = form.querySelectorAll('input[name="businessType"]:checked').length;
        wrap?.classList.toggle('invalid-field', checked === 0);
        if (checked === 0) {
          valid = false;
        }
        form.querySelectorAll('input[name="businessType"]').forEach((checkbox) => {
          checkbox.addEventListener('change', () => wrap?.classList.remove('invalid-field'), { once: true });
        });
      }

      if (!valid) {
        api.showToast('common.completeRequired');
        return;
      }

      form.reset();
      api.showModal({
        title: 'apply.successTitle',
        message: 'apply.successBody'
      });
      if (form.dataset.applicationForm === 'corporate') {
        const wrap = form.querySelector('[data-business-group]');
        wrap?.classList.remove('invalid-field');
      }
    });
  });
});
