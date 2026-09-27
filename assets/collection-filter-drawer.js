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
