(() => {
  if (window.__cocopocoRecentlyViewedBooted) return;
  window.__cocopocoRecentlyViewedBooted = true;

  const STORAGE_KEY = 'cocopoco_recently_viewed';
  const roots = new WeakSet();

  const readHistory = () => {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(value) ? value.filter((handle) => typeof handle === 'string' && handle.length) : [];
    } catch (error) { return []; }
  };

  const saveCurrent = (handle, history) => {
    if (!handle) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify([handle, ...history.filter((item) => item !== handle)].slice(0, 12))); } catch (error) {}
  };

  const fetchCard = async (handle) => {
    const root = window.Shopify?.routes?.root || '/';
    const response = await fetch(`${root}products/${encodeURIComponent(handle)}?view=recent-card`, { headers: { Accept: 'text/html' } });
    if (!response.ok) return null;
    const documentNode = new DOMParser().parseFromString(await response.text(), 'text/html');
    return documentNode.querySelector('[data-recent-product-card]');
  };

  const mount = async (section) => {
    if (!section || roots.has(section)) return;
    roots.add(section);
    const current = section.dataset.productHandle;
    const history = readHistory();
    const handles = history.filter((handle) => handle !== current).slice(0, 4);
    saveCurrent(current, history);
    if (!handles.length) return;
    const grid = section.querySelector('[data-recently-viewed-grid]');
    const cards = await Promise.all(handles.map(fetchCard));
    cards.filter(Boolean).forEach((card) => grid.appendChild(document.importNode(card, true)));
    if (grid.children.length) section.hidden = false;
  };

  const mountAll = (scope = document) => scope.querySelectorAll('[data-recently-viewed]').forEach(mount);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => mountAll(), { once: true });
  else mountAll();
  document.addEventListener('shopify:section:load', (event) => mountAll(event.target));
})();
