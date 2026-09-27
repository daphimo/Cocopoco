(() => {
  if (window.__custHeroSliderBooted) return;
  window.__custHeroSliderBooted = true;

  const SCRIPT_ID = 'cust-splide-script';
  const STYLE_ID = 'cust-splide-style';
  const SCRIPT_URL = 'https://cdn.jsdelivr.net/npm/@splidejs/splide@4.1.4/dist/js/splide.min.js';
  const STYLE_URL = 'https://cdn.jsdelivr.net/npm/@splidejs/splide@4.1.4/dist/css/splide-core.min.css';
  const instances = new Map();

  const loadSplide = () => {
    if (window.Splide) return Promise.resolve(window.Splide);
    if (window.__custSplideLoader) return window.__custSplideLoader;

    if (!document.getElementById(STYLE_ID)) {
      const link = document.createElement('link');
      link.id = STYLE_ID;
      link.rel = 'stylesheet';
      link.href = STYLE_URL;
      document.head.appendChild(link);
    }

    window.__custSplideLoader = new Promise((resolve, reject) => {
      const existing = document.getElementById(SCRIPT_ID);
      if (existing) {
        existing.addEventListener('load', () => resolve(window.Splide), { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.src = SCRIPT_URL;
      script.defer = true;
      script.addEventListener('load', () => resolve(window.Splide), { once: true });
      script.addEventListener('error', reject, { once: true });
      document.head.appendChild(script);
    });
    return window.__custSplideLoader;
  };

  const updateControls = (root, slide) => {
    if (!slide) return;
    const styles = getComputedStyle(slide);
    ['nav-color', 'nav-background', 'pagination-color', 'pagination-active'].forEach((token) => {
      root.style.setProperty(`--cust-slider-${token}`, styles.getPropertyValue(`--cust-slide-${token}`));
    });
  };

  const mount = async (root) => {
    if (!root || root.dataset.initialized === 'true') return;
    const slider = root.querySelector('[data-cust-hero-splide]');
    const configNode = root.querySelector('[data-cust-hero-config]');
    if (!slider || !configNode) return;
    let options;
    try { options = JSON.parse(configNode.textContent); } catch (error) { return; }

    const slideCount = slider.querySelectorAll('.splide__slide').length;
    if (slideCount < 2) {
      slider.classList.add('is-static');
      updateControls(root, slider.querySelector('.splide__slide'));
      root.dataset.initialized = 'true';
      return;
    }

    try {
      const Splide = await loadSplide();
      if (!root.isConnected || !Splide) return;
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reducedMotion) options.autoplay = false;
      const instance = new Splide(slider, options);
      instance.on('mounted active moved', (slide) => {
        const active = slide?.slide || slider.querySelector('.splide__slide.is-active') || slider.querySelector('.splide__slide');
        updateControls(root, active);
      });
      instance.mount();
      instances.set(root.id, instance);
      root.dataset.initialized = 'true';
    } catch (error) {
      slider.classList.add('is-static');
    }
  };

  const mountAll = (scope = document) => scope.querySelectorAll('[data-cust-hero-slider]').forEach(mount);
  const unmount = (sectionId) => {
    const root = document.getElementById(`CustHeroSlider-${sectionId}`);
    const instance = root && instances.get(root.id);
    if (instance) instance.destroy(true);
    if (root) instances.delete(root.id);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => mountAll(), { once: true });
  else mountAll();
  document.addEventListener('shopify:section:load', (event) => mountAll(event.target));
  document.addEventListener('shopify:section:unload', (event) => unmount(event.detail.sectionId));
})();
