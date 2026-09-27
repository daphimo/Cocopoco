if (!customElements.get('stock-notify')) {
  customElements.define('stock-notify', class extends HTMLElement {
    connectedCallback() {
      if (this.dataset.initialized === 'true') return;
      this.dataset.initialized = 'true';
      this.dialog = this.querySelector('[data-stock-notify-dialog]');
      this.form = this.querySelector('[data-stock-notify-form]');
      this.variants = JSON.parse(this.querySelector('[data-stock-notify-variants]')?.textContent || '[]');
      this.messages = JSON.parse(this.querySelector('[data-stock-notify-messages]')?.textContent || '{}');
      this.variant = this.variants.find((item) => String(item.id) === String(this.dataset.selectedVariantId));
      this.debug = this.dataset.debug === 'true';
      this.querySelector('[data-stock-notify-open]')?.addEventListener('click', () => this.open());
      this.querySelectorAll('[data-stock-notify-close]').forEach((button) => button.addEventListener('click', () => this.close()));
      this.dialog?.addEventListener('click', (event) => { if (event.target === this.dialog) this.close(); });
      this.dialog?.addEventListener('close', () => { document.body.style.overflow = this.previousOverflow || ''; this.querySelector('[data-stock-notify-open]')?.focus(); });
      this.form?.addEventListener('submit', (event) => this.submit(event));
      if (typeof subscribe === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
        this.unsubscribe = subscribe(PUB_SUB_EVENTS.variantChange, ({ data }) => {
          if (String(data.sectionId) !== String(this.dataset.sectionId)) return;
          this.updateVariant(data.variant);
        });
      }
      this.updateVariant(this.variant);
      this.log('Initialized');
    }

    disconnectedCallback() { this.unsubscribe?.(); }

    log(message, detail) { if (this.debug) console.debug(`[Stock Notify] ${message}`, detail || ''); }

    shouldNotify(variant) {
      if (!variant || this.dataset.enabled !== 'true') return false;
      return variant.available === false;
    }

    updateVariant(variant) {
      this.variant = variant || null;
      const visible = this.shouldNotify(this.variant);
      this.hidden = !visible;
      this.log('Selected variant', this.variant?.title);
      this.log('Variant ID', this.variant?.id);
      this.log('Inventory quantity', this.variant?.inventory_quantity);
      this.log('Variant available', this.variant?.available);
      this.log('Notify state', visible ? 'visible' : 'hidden');
      if (!this.variant) return;
      this.dataset.selectedVariantId = this.variant.id;
      this.querySelector('[data-stock-notify-variant]').textContent = this.variant.title;
      this.querySelector('[data-stock-notify-variant-id]').value = this.variant.id;
      this.querySelector('[data-stock-notify-variant-title]').value = this.variant.title;
      this.querySelector('[data-stock-notify-body]').value = `Stock Notify request for ${this.dataset.productTitle} — ${this.variant.title} (variant ${this.variant.id})`;
      this.resetResult();
    }

    open() {
      if (!this.variant || !this.shouldNotify(this.variant)) return;
      this.previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      this.dialog.showModal();
      this.querySelector('[data-stock-notify-email]')?.focus();
      this.log('Popup opened');
    }

    close() { if (this.dialog?.open) this.dialog.close(); }

    resetResult() {
      this.querySelector('[data-stock-notify-content]').hidden = false;
      this.querySelector('[data-stock-notify-success]').hidden = true;
      this.querySelector('[data-stock-notify-error]').hidden = true;
    }

    requestKey(email) { return `stock-notify:${email.toLowerCase()}:${this.variant.id}`; }
    isDuplicate(email) { try { return localStorage.getItem(this.requestKey(email)) === 'registered'; } catch (error) { return false; } }
    remember(email) { try { localStorage.setItem(this.requestKey(email), 'registered'); } catch (error) {} }
    maskEmail(email) { const [name, domain] = email.split('@'); return `${name.slice(0, 1)}***@${domain || ''}`; }

    async submit(event) {
      event.preventDefault();
      const email = this.querySelector('[data-stock-notify-email]');
      const error = this.querySelector('[data-stock-notify-error]');
      const submit = this.querySelector('[data-stock-notify-submit]');
      if (!email.checkValidity()) { email.reportValidity(); return; }
      if (this.isDuplicate(email.value)) { this.showSuccess(this.messages.duplicate); return; }
      submit.disabled = true; submit.classList.add('is-loading'); error.hidden = true;
      this.log('Submission started', this.maskEmail(email.value));
      try {
        let duplicate = false;
        if (this.dataset.endpoint) {
          const response = await fetch(this.dataset.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ email: email.value, product_id: this.dataset.productId, product_handle: this.dataset.productHandle, variant_id: String(this.variant.id), variant_title: this.variant.title }),
          });
          if (!response.ok) throw new Error('Registration failed');
          const result = await response.json();
          duplicate = result.duplicate === true;
          this.log('Submission response', { ok: true, duplicate });
        } else {
          const response = await fetch(this.form.action, { method: 'POST', body: new FormData(this.form), headers: { Accept: 'text/html' } });
          if (!response.ok) throw new Error('Contact submission failed');
          this.log('Submission response', { ok: true, fallback: 'contact' });
        }
        this.remember(email.value);
        this.showSuccess(duplicate ? this.messages.duplicate : this.messages.success);
        this.log('Notification request registered');
      } catch (requestError) {
        error.textContent = this.messages.error;
        error.hidden = false;
        this.log('Submission response', { ok: false });
      } finally {
        submit.disabled = false; submit.classList.remove('is-loading');
      }
    }

    showSuccess(message) {
      this.querySelector('[data-stock-notify-content]').hidden = true;
      this.querySelector('[data-stock-notify-success]').hidden = false;
      this.querySelector('[data-stock-notify-success-message]').textContent = message;
      this.querySelector('[data-stock-notify-success] button')?.focus();
    }
  });
}
