(() => {
  const subscriptions = new WeakMap();

  const setActiveMedia = (root, variant, behavior = 'smooth') => {
    const mediaId = variant?.featured_media?.id;
    if (!mediaId) return;

    const gallery = root.querySelector('.main-product__media-slider');
    const activeSlide = gallery?.querySelector(
      `[data-media-id="${CSS.escape(`${root.dataset.section}-${mediaId}`)}"]`
    );
    if (!gallery || !activeSlide) return;

    gallery.querySelectorAll('.main-product__media-slide--primary').forEach((slide) => {
      slide.classList.remove('main-product__media-slide--primary');
    });
    activeSlide.classList.add('main-product__media-slide--primary');

    if (window.matchMedia('(max-width: 749px)').matches) {
      gallery.scrollTo({ left: 0, behavior });
    }
  };

  const getSelectedVariant = (root) => {
    try {
      return JSON.parse(root.querySelector('[data-selected-variant]')?.textContent || 'null');
    } catch {
      return null;
    }
  };

  const initialize = (root) => {
    if (!root || subscriptions.has(root)) return;
    setActiveMedia(root, getSelectedVariant(root), 'auto');

    if (typeof subscribe !== 'function' || typeof PUB_SUB_EVENTS === 'undefined') return;
    const unsubscribe = subscribe(PUB_SUB_EVENTS.variantChange, ({ data }) => {
      if (String(data.sectionId) !== String(root.dataset.section)) return;
      setActiveMedia(root, data.variant);
    });
    subscriptions.set(root, unsubscribe);
  };

  const initializeAll = (scope = document) => {
    scope.querySelectorAll('product-info.main-product').forEach(initialize);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initializeAll(), { once: true });
  } else {
    initializeAll();
  }

  document.addEventListener('shopify:section:load', (event) => initializeAll(event.target));
  document.addEventListener('shopify:section:unload', (event) => {
    event.target.querySelectorAll('product-info.main-product').forEach((root) => {
      subscriptions.get(root)?.();
      subscriptions.delete(root);
    });
  });
})();
