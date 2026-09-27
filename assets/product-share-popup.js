if (!customElements.get('cust-share-popup')) {
  customElements.define('cust-share-popup', class extends HTMLElement {
    connectedCallback() {
      if (this.dataset.initialized === 'true') return;
      this.dataset.initialized = 'true';
      this.dialog = this.querySelector('[data-share-dialog]');
      this.trigger = this.querySelector('[data-share-open]');
      this.trigger?.addEventListener('click', () => this.dialog?.showModal());
      this.querySelector('[data-share-close]')?.addEventListener('click', () => this.dialog?.close());
      this.dialog?.addEventListener('click', (event) => {
        const bounds = this.dialog.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) this.dialog.close();
      });
      this.dialog?.addEventListener('close', () => this.trigger?.focus());
      this.querySelector('[data-share-copy]')?.addEventListener('click', () => this.copy());
    }

    async copy() {
      const input = this.querySelector('[data-share-url]');
      const button = this.querySelector('[data-share-copy]');
      const status = this.querySelector('[data-share-status]');
      try {
        if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(input.value);
        else { input.select(); document.execCommand('copy'); input.setSelectionRange(0, 0); }
        button.textContent = button.dataset.copiedLabel;
        status.textContent = button.dataset.copiedLabel;
        window.setTimeout(() => { button.textContent = button.dataset.copyLabel; }, 2000);
      } catch (error) {
        input.focus(); input.select();
      }
    }
  });
}
