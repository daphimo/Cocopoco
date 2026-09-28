(() => {
  const formatMoney = (cents, format) => {
    const value = (Number(cents || 0) / 100).toFixed(2);
    const [whole, decimal] = value.split('.');
    const amount = Number(whole).toLocaleString('en-IN');
    return (format || '{{ amount }}')
      .replace(/\{\{\s*amount_no_decimals\s*\}\}/, amount)
      .replace(/\{\{\s*amount\s*\}\}/, `${amount}.${decimal}`)
      .replace(/\{\{\s*amount_with_comma_separator\s*\}\}/, `${amount.replace(/,/g, '.')},${decimal}`);
  };

  const initialize = (bar) => {
    if (!bar || bar.dataset.initialized === 'true') return;
    bar.dataset.initialized = 'true';
    const productInfo = bar.closest('product-info');
    const mainBuyButton = productInfo?.querySelector('.main-product__buy-buttons .product-form__submit');
    const variantInput = bar.querySelector('[data-sticky-variant-id]');
    const quantityInput = bar.querySelector('.quantity__input');
    const submitButton = bar.querySelector('[type="submit"]');
    const buttonLabel = bar.querySelector('[data-sticky-button-label]');
    const price = bar.querySelector('[data-sticky-price]');
    const image = bar.querySelector('.sticky-product-checkout__image');
    const mode = bar.dataset.displayMode;
    const controller = new AbortController();
    bar._controller = controller;
    let frame;

    const setVisible = (visible) => {
      bar.classList.toggle('is-visible', visible);
      bar.setAttribute('aria-hidden', String(!visible));
    };
    const updateVisibility = () => {
      frame = null;
      if (mode === 'always') {
        setVisible(true);
        return;
      }
      setVisible(Boolean(mainBuyButton && mainBuyButton.getBoundingClientRect().bottom < 0));
    };
    const requestVisibilityUpdate = () => {
      if (!frame) frame = requestAnimationFrame(updateVisibility);
    };
    const updateVariant = (variant) => {
      if (!variant) return;
      const available = Boolean(variant.available);
      variantInput.value = variant.id;
      variantInput.disabled = !available;
      submitButton.disabled = !available;
      submitButton.setAttribute('aria-disabled', String(!available));
      buttonLabel.textContent = available ? window.variantStrings.addToCart : window.variantStrings.soldOut;
      if (price) price.textContent = formatMoney(variant.price, productInfo?.dataset.moneyFormat);
      const rule = variant.quantity_rule || {};
      quantityInput.min = rule.min || 1;
      quantityInput.dataset.min = rule.min || 1;
      quantityInput.step = rule.increment || 1;
      quantityInput.value = Math.max(Number(quantityInput.value) || 1, Number(rule.min) || 1);
      if (rule.max) {
        quantityInput.max = rule.max;
        quantityInput.dataset.max = rule.max;
      } else {
        quantityInput.removeAttribute('max');
        delete quantityInput.dataset.max;
      }
      const nextImage = variant.featured_media?.preview_image?.src;
      if (image && nextImage) {
        image.src = nextImage;
        image.removeAttribute('srcset');
      }
    };

    updateVisibility();
    window.addEventListener('scroll', requestVisibilityUpdate, { passive: true, signal: controller.signal });
    window.addEventListener('resize', requestVisibilityUpdate, { signal: controller.signal });
    if (typeof subscribe === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
      bar._variantUnsubscribe = subscribe(PUB_SUB_EVENTS.variantChange, ({ data }) => {
        if (String(data.sectionId) === String(bar.dataset.sectionId)) updateVariant(data.variant);
      });
    }
  };

  const initializeAll = (scope = document) => scope.querySelectorAll('[data-sticky-checkout]').forEach(initialize);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => initializeAll(), { once: true });
  else initializeAll();
  document.addEventListener('shopify:section:load', (event) => initializeAll(event.target));
  document.addEventListener('shopify:section:unload', (event) => {
    event.target.querySelectorAll('[data-sticky-checkout]').forEach((bar) => {
      bar._controller?.abort();
      bar._variantUnsubscribe?.();
    });
  });
})();
