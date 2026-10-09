(() => {
  const mq = window.matchMedia('(max-width: 749px)');
  const instances = new WeakMap();
  const setState = (toggle, panel, open) => {
    toggle.setAttribute('aria-expanded', String(open));
    panel.setAttribute('aria-hidden', String(!open));
    panel.classList.toggle('is-open', open);
  };
  const init = (footer) => {
    if (!footer || footer.dataset.accordionReady === 'true') return;
    footer.dataset.accordionReady = 'true';
    const controller = new AbortController();
    const menus = [...footer.querySelectorAll('[data-footer-menu]')];
    menus.forEach((menu) => {
      const toggle = menu.querySelector('[data-footer-toggle]');
      const panel = menu.querySelector('[data-footer-panel]');
      if (!toggle || !panel) return;
      setState(toggle, panel, false);
      toggle.addEventListener('click', () => {
        if (mq.matches) setState(toggle, panel, toggle.getAttribute('aria-expanded') !== 'true');
      }, { signal: controller.signal });
    });
    const sync = () => menus.forEach((menu) => {
      const toggle = menu.querySelector('[data-footer-toggle]');
      const panel = menu.querySelector('[data-footer-panel]');
      if (!toggle || !panel) return;
      const desktop = !mq.matches;
      panel.classList.toggle('is-desktop', desktop);
      setState(toggle, panel, desktop);
    });
    sync();
    mq.addEventListener?.('change', sync, { signal: controller.signal });
    instances.set(footer, controller);
  };
  const initAll = (scope = document) => scope.querySelectorAll('[data-custom-footer]').forEach(init);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => initAll(), { once: true });
  else initAll();
  document.addEventListener('shopify:section:load', (event) => initAll(event.target));
  document.addEventListener('shopify:section:unload', (event) => event.target.querySelectorAll('[data-custom-footer]').forEach((footer) => {
    instances.get(footer)?.abort();
    instances.delete(footer);
  }));
})();
