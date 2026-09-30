(() => {
  const DELHIVERY_PINCODE_API_URL = 'https://track.delhivery.com/c/api/pin-codes/json/';

  const escapeHtml = (value) => {
    const node = document.createElement('span');
    node.textContent = String(value ?? '');
    return node.innerHTML;
  };

  const initChecker = (root) => {
    if (!root || root.dataset.initialized === 'true') return;
    root.dataset.initialized = 'true';
    const form = root.querySelector('[data-cust-pincode-form]');
    const input = root.querySelector('[data-cust-pincode-input]');
    const button = root.querySelector('[data-cust-pincode-submit]');
    const result = root.querySelector('[data-cust-pincode-result]');
    if (!form || !input || !button || !result) return;

    const messages = {
      loading: root.dataset.loadingText,
      success: root.dataset.successMessage,
      unavailable: root.dataset.unavailableMessage,
      invalid: root.dataset.invalidMessage,
      error: root.dataset.errorMessage,
    };
    const showCod = root.dataset.showCod === 'true';
    const showPrepaid = root.dataset.showPrepaid === 'true';
    const showLocation = root.dataset.showLocation === 'true';
    const cache = new Map();
    let activePincode = null;

    const setLoading = (loading) => {
      root.classList.toggle('is-loading', loading);
      root.setAttribute('aria-busy', String(loading));
      button.disabled = loading;
    };
    const render = (type, lines) => {
      result.className = `cust-pincode-checker__result is-${type}`;
      result.innerHTML = lines.map((line) => `<p class="cust-pincode-checker__status"><span class="cust-pincode-checker__symbol" aria-hidden="true">${type === 'success' ? '✓' : '✕'}</span><span>${escapeHtml(line)}</span></p>`).join('');
      result.hidden = false;
    };
    const renderResponse = (data, pincode) => {
      if (!data || !Array.isArray(data.delivery_codes)) throw new Error('Unexpected Delhivery response');
      const postalCode = data.delivery_codes[0]?.postal_code;
      if (!postalCode || typeof postalCode !== 'object') { render('error', [messages.unavailable]); return; }
      if (typeof postalCode.remarks !== 'string') throw new Error('Unexpected Delhivery response');
      const remarks = postalCode.remarks.trim();
      if (remarks !== '') { render('error', [messages.unavailable]); return; }
      const lines = [(messages.success || 'Delivery available to [pincode].').replace('[pincode]', pincode)];
      if (showLocation) {
        const location = [postalCode.city, postalCode.district, postalCode.state_code].filter(Boolean).filter((value, index, values) => values.indexOf(value) === index).join(', ');
        if (location) lines.push(`Delivering to ${location}`);
      }
      if (showCod && postalCode.cod === 'Y') lines.push('Cash on Delivery available');
      if (showPrepaid && postalCode.pre_paid === 'Y') lines.push('Online payment available');
      if (postalCode.is_oda === 'Y') lines.push('This is an out-of-delivery-area location; delivery may take longer.');
      render('success', lines);
    };

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const pincode = input.value.trim();
      if (!/^\d{6}$/.test(pincode)) { render('error', [messages.invalid]); input.focus(); return; }
      const token = root.dataset.delhiveryToken?.trim();
      if (!token) {
        render('error', [root.dataset.designMode === 'true' ? 'Pincode service is not configured.' : messages.error]);
        return;
      }
      if (cache.has(pincode)) { renderResponse(cache.get(pincode), pincode); return; }
      if (activePincode !== null) return;
      activePincode = pincode;
      result.className = 'cust-pincode-checker__result'; result.textContent = messages.loading; result.hidden = false;
      setLoading(true);
      try {
        const endpoint = new URL(DELHIVERY_PINCODE_API_URL);
        endpoint.searchParams.set('filter_codes', pincode);
        const response = await fetch(endpoint.toString(), {
          headers: { Accept: 'application/json', Authorization: `Token ${token}` },
        });
        if (!response.ok) throw new Error(`Delhivery returned ${response.status}`);
        const data = await response.json();
        renderResponse(data, pincode);
        cache.set(pincode, data);
      } catch (error) {
        console.warn('[Pincode checker] Serviceability request failed.');
        render('error', [messages.error]);
      } finally { setLoading(false); activePincode = null; }
    });
  };

  const initAll = (scope = document) => scope.querySelectorAll('[data-cust-pincode-checker]').forEach(initChecker);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => initAll(), { once: true });
  else initAll();
  document.addEventListener('shopify:section:load', (event) => initAll(event.target));
})();
