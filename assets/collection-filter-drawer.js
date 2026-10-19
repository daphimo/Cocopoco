if (!customElements.get('collection-filter-drawer')) {
  customElements.define('collection-filter-drawer', class extends HTMLElement {
    connectedCallback() {
      if (this.dataset.initialized === 'true') return;
      this.dataset.initialized = 'true';
      this.dialog = this.querySelector('[data-filter-dialog]');
      this.trigger = this.querySelector('[data-filter-open]');
      this.trigger?.addEventListener('click', () => this.open());
      this.querySelectorAll('[data-filter-close]').forEach((button) => button.addEventListener('click', () => this.close()));
      this.dialog?.addEventListener('cancel', (event) => { event.preventDefault(); this.close(); });
      this.dialog?.addEventListener('click', (event) => { if (event.target === this.dialog) this.close(); });
      this.querySelectorAll('[data-filter-group]').forEach((group) => this.bindFilterGroup(group));
      this.querySelectorAll('[data-price-range]').forEach((range) => this.bindPriceRange(range));
      this.querySelector('form')?.addEventListener('submit', () => {
        this.querySelectorAll('[data-price-range]').forEach((range) => {
          const min = range.querySelector('[data-price-min]');
          const max = range.querySelector('[data-price-max]');
          if (Number(min.value) === Number(min.min)) min.disabled = true;
          if (Number(max.value) === Number(max.max)) max.disabled = true;
        });
      });
    }

    open() {
      if (!this.dialog) return;
      this.previousOverflow = document.body.style.overflow;
      this.dialog.showModal();
      document.body.style.overflow = 'hidden';
      requestAnimationFrame(() => this.dialog.classList.add('is-open'));
    }

    close() {
      if (!this.dialog?.open) return;
      this.dialog.classList.remove('is-open');
      document.body.style.overflow = this.previousOverflow || '';
      window.setTimeout(() => { if (this.dialog.open) this.dialog.close(); this.trigger?.focus(); }, 240);
    }

    bindFilterGroup(group) {
      const toggle = group.querySelector('[data-filter-group-toggle]');
      const content = group.querySelector('[data-filter-group-content]');
      if (!toggle || !content) return;

      const isOpen = group.classList.contains('is-open');
      toggle.setAttribute('aria-expanded', String(isOpen));
      content.style.height = isOpen ? 'auto' : '0px';

      toggle.addEventListener('click', () => {
        const willOpen = !group.classList.contains('is-open');
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        toggle.setAttribute('aria-expanded', String(willOpen));

        if (willOpen) {
          group.classList.add('is-open');
          content.style.height = '0px';
          content.offsetHeight;
          if (reducedMotion) {
            content.style.height = 'auto';
            return;
          }
          requestAnimationFrame(() => {
            content.style.height = `${content.scrollHeight}px`;
          });
          content.addEventListener('transitionend', (event) => {
            if (event.target === content && group.classList.contains('is-open')) content.style.height = 'auto';
          }, { once: true });
          return;
        }

        content.style.height = `${content.scrollHeight}px`;
        content.offsetHeight;
        group.classList.remove('is-open');
        if (reducedMotion) {
          content.style.height = '0px';
          return;
        }
        requestAnimationFrame(() => {
          content.style.height = '0px';
        });
      });
    }

    bindPriceRange(range) {
      const min = range.querySelector('[data-price-min]');
      const max = range.querySelector('[data-price-max]');
      const minOutput = range.querySelector('[data-price-min-output]');
      const maxOutput = range.querySelector('[data-price-max-output]');
      const ceiling = Number(max.max) || 1;
      const symbol = range.dataset.currency || '';
      const update = (source) => {
        if (Number(min.value) > Number(max.value)) {
          if (source === min) min.value = max.value;
          else max.value = min.value;
        }
        const minPercent = (Number(min.value) / ceiling) * 100;
        const maxPercent = (Number(max.value) / ceiling) * 100;
        range.style.setProperty('--price-min-position', `${minPercent}%`);
        range.style.setProperty('--price-max-position', `${maxPercent}%`);
        minOutput.textContent = `${symbol}${Number(min.value).toLocaleString()}`;
        maxOutput.textContent = `${symbol}${Number(max.value).toLocaleString()}`;
      };
      min.addEventListener('input', () => update(min));
      max.addEventListener('input', () => update(max));
      update();
    }
  });
}
