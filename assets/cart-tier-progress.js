if (!customElements.get('cart-tier-progress')) {
  class CartTierProgress extends HTMLElement {
    connectedCallback() {
      const configElement = this.querySelector('[data-cart-tier-config]');
      if (!configElement) return;

      try {
        const config = JSON.parse(configElement.textContent);
        const tiers = Array.isArray(config.tiers)
          ? config.tiers.filter((tier) => Number(tier.threshold) > 0)
          : [];
        if (!tiers.length) return;

        const cartAmount = Math.max(0, Number(config.cartAmount) || 0);
        const unlockedCount = tiers.filter((tier) => cartAmount >= tier.threshold).length;
        const targetTier = tiers[unlockedCount] || tiers[tiers.length - 1];
        const remaining = Math.max(0, targetTier.threshold - cartAmount);
        const template = unlockedCount === tiers.length ? targetTier.afterMessage : targetTier.beforeMessage;
        const message = String(template || '')
          .replaceAll('{amount}', this.formatMoney(remaining, config.moneyFormat))
          .replaceAll('{discount}', String(targetTier.discount ?? ''))
          .replaceAll('{threshold}', this.formatMoney(targetTier.threshold, config.moneyFormat));

        const status = this.querySelector('[data-tier-status]');
        if (status) status.textContent = message;

        const progress = this.calculateProgress(cartAmount, tiers, unlockedCount);
        const previous = CartTierProgress.state;
        if (previous) {
          this.style.setProperty('--cart-tier-progress', `${previous.progress}%`);
          requestAnimationFrame(() => {
            this.classList.add('is-ready');
            this.style.setProperty('--cart-tier-progress', `${progress}%`);
            if (unlockedCount > previous.unlockedCount) {
              this.querySelectorAll('[data-tier-marker]')[unlockedCount - 1]?.classList.add('is-newly-unlocked');
            }
          });
        } else {
          this.classList.add('is-ready');
          this.style.setProperty('--cart-tier-progress', `${progress}%`);
        }

        CartTierProgress.state = { progress, unlockedCount };
      } catch (error) {
        console.error('Unable to initialize cart tier progress', error);
      }
    }

    calculateProgress(cartAmount, tiers, unlockedCount) {
      if (unlockedCount === tiers.length) return 100;
      const targetPosition = ((unlockedCount + 1) / tiers.length) * 100;
      const previousPosition = (unlockedCount / tiers.length) * 100;
      const previousThreshold = unlockedCount ? tiers[unlockedCount - 1].threshold : 0;
      const interval = tiers[unlockedCount].threshold - previousThreshold;
      const intervalProgress = interval > 0 ? Math.min(1, Math.max(0, (cartAmount - previousThreshold) / interval)) : 0;
      return previousPosition + (targetPosition - previousPosition) * intervalProgress;
    }

    formatMoney(cents, format) {
      const value = (Number(cents) / 100).toFixed(2);
      const [whole, decimals] = value.split('.');
      const amount = Number(whole).toLocaleString(document.documentElement.lang || undefined);
      const replacements = {
        amount: `${amount}.${decimals}`,
        amount_no_decimals: amount,
        amount_with_comma_separator: `${amount.replaceAll(',', '.')},${decimals}`,
        amount_no_decimals_with_comma_separator: amount.replaceAll(',', '.'),
        amount_with_space_separator: `${amount.replaceAll(',', ' ')},${decimals}`,
        amount_no_decimals_with_space_separator: amount.replaceAll(',', ' '),
        amount_with_apostrophe_separator: `${amount.replaceAll(',', "'")}.${decimals}`,
      };

      const moneyFormat = String(format || '{{ amount }}');
      const formatted = moneyFormat.replace(/\{\{\s*(\w+)\s*\}\}/, (_match, key) => replacements[key] ?? replacements.amount);
      const template = document.createElement('template');
      template.innerHTML = formatted;
      return template.content.textContent || formatted;
    }
  }

  customElements.define('cart-tier-progress', CartTierProgress);
}
