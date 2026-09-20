(() => {
  if (window.headerPopupController) return;

  const focusableSelector = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
  let activePopup = null;
  let activeTrigger = null;
  let previousBodyOverflow = '';
  let closeTimer = null;

  const closeMobileDrawer = () => {
    const header = document.querySelector('[data-cp-header].is-drawer-open');
    header?.querySelector('[data-drawer-close]')?.click();
  };

  const closeCartDrawer = () => {
    const drawer = document.querySelector('cart-drawer');
    if (drawer && typeof drawer.close === 'function' && drawer.classList.contains('active')) drawer.close();
  };

  const unlockScroll = () => {
    document.body.classList.remove('header-popup-open');
    document.body.style.overflow = previousBodyOverflow;
  };

  const closePopup = (restoreFocus = true) => {
    if (!activePopup) return;
    const popup = activePopup;
    const trigger = activeTrigger;
    activePopup = null;
    activeTrigger = null;
    popup.classList.remove('is-open');
    popup.setAttribute('aria-hidden', 'true');
    unlockScroll();
    window.clearTimeout(closeTimer);
    closeTimer = window.setTimeout(() => {
      popup.hidden = true;
      if (restoreFocus && trigger?.isConnected) trigger.focus();
    }, 200);
  };

  const openPopup = (id, trigger) => {
    const popup = document.querySelector(`[data-popup-id="${CSS.escape(id)}"]`);
    if (!popup) return;
    if (activePopup) closePopup(false);
    closeMobileDrawer();
    closeCartDrawer();
    activePopup = popup;
    activeTrigger = trigger;
    previousBodyOverflow = document.body.style.overflow;
    document.body.classList.add('header-popup-open');
    document.body.style.overflow = 'hidden';
    popup.hidden = false;
    popup.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => {
      popup.classList.add('is-open');
      popup.querySelector('[data-popup-close]')?.focus();
    });
  };

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-popup-trigger]');
    if (trigger) {
      event.preventDefault();
      openPopup(trigger.dataset.popupTarget, trigger);
      return;
    }
    if (event.target.closest('[data-popup-close]') || event.target.matches('[data-popup-overlay]')) {
      event.preventDefault();
      closePopup();
      return;
    }
    if (activePopup && event.target.closest('#cart-icon-bubble, [data-drawer-open]')) closePopup(false);
  });

  document.addEventListener('keydown', (event) => {
    if (!activePopup) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closePopup();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...activePopup.querySelectorAll(focusableSelector)].filter((element) => !element.hidden && element.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  document.addEventListener('shopify:section:unload', () => closePopup(false));
  window.headerPopupController = { open: openPopup, close: closePopup };
})();
