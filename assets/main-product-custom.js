(() => {
  const storageKey = 'shopify_last_collection';
  const subscriptions = new WeakMap();
  const formatMoney = (cents, format) => {
    const value = (Number(cents || 0) / 100).toFixed(2);
    const [whole, decimal] = value.split('.');
    const amount = Number(whole).toLocaleString('en-IN');
    return (format || '{{ amount }}').replace(/\{\{\s*amount_no_decimals\s*\}\}/, amount).replace(/\{\{\s*amount\s*\}\}/, `${amount}.${decimal}`).replace(/\{\{\s*amount_with_comma_separator\s*\}\}/, `${amount.replace(/,/g, '.')},${decimal}`);
  };
  const initBreadcrumb = (root) => {
    const link = root.querySelector('[data-product-collection-link]');
    if (!link) return;
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey));
      if (stored?.title && stored?.url && typeof stored.url === 'string' && stored.url.startsWith('/collections/')) {
        link.textContent = stored.title;
        link.href = stored.url;
      }
    } catch (_) {}
  };
  const setPanel = (trigger, panel, open) => {
    trigger.setAttribute('aria-expanded', String(open));
    panel.classList.toggle('is-open', open);
  };
  const init = (root) => {
    if (!root || root.dataset.customProductReady === 'true') return;
    root.dataset.customProductReady = 'true';
    initBreadcrumb(root);
    const controller = new AbortController();
    root.querySelectorAll('[data-product-collapsible]').forEach((item) => {
      const trigger = item.querySelector('[data-collapsible-trigger]');
      const panel = item.querySelector('[data-collapsible-panel]');
      if (!trigger || !panel) return;
      setPanel(trigger, panel, trigger.getAttribute('aria-expanded') === 'true');
      trigger.addEventListener('click', () => setPanel(trigger, panel, trigger.getAttribute('aria-expanded') !== 'true'), { signal: controller.signal });
    });
    let unsubscribe;
    if (typeof subscribe === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
      unsubscribe = subscribe(PUB_SUB_EVENTS.variantChange, ({ data }) => {
        if (String(data.sectionId) !== String(root.dataset.section)) return;
        const price = root.querySelector('[data-atc-price]');
        if (!price) return;
        price.textContent = data.variant?.available ? `· ${formatMoney(data.variant.price, root.dataset.moneyFormat)}` : '';
        price.hidden = !data.variant?.available;
      });
    }
    subscriptions.set(root, { controller, unsubscribe });
  };
  const destroy = (root) => {
    const state = subscriptions.get(root);
    state?.controller.abort();
    state?.unsubscribe?.();
    subscriptions.delete(root);
  };
  const initAll = (scope = document) => scope.querySelectorAll('product-info.main-product').forEach(init);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => initAll(), { once: true });
  else initAll();
  document.addEventListener('shopify:section:load', (event) => initAll(event.target));
  document.addEventListener('shopify:section:unload', (event) => event.target.querySelectorAll('product-info.main-product').forEach(destroy));
})();
