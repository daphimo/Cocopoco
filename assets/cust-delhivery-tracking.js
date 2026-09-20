(() => {
  const responseCache = new Map();
  const escapeHtml = (value) => { const node = document.createElement('span'); node.textContent = String(value ?? ''); return node.innerHTML; };
  const cleanStatus = (value) => String(value || '').trim().toLowerCase();
  const customerStatus = (value) => {
    const status = cleanStatus(value);
    if (!status) return 'Shipment Update';
    if (/undelivered|not delivered|pending/.test(status)) return 'Undelivered';
    if (/delivered/.test(status)) return 'Delivered';
    if (/out for delivery|dispatched to consignee/.test(status)) return 'Out for Delivery';
    if (/rto|return to origin/.test(status)) return 'RTO';
    if (/cancel/.test(status)) return 'Cancelled';
    if (/lost/.test(status)) return 'Lost';
    if (/picked up|pickup complete/.test(status)) return 'Picked Up';
    if (/ready for pickup|pickup scheduled/.test(status)) return 'Ready for Pickup';
    if (/manifest|order placed|shipment created/.test(status)) return 'Manifested';
    if (/confirmed/.test(status)) return 'Order Confirmed';
    if (/in transit|transit|bagged|connected|received at/.test(status)) return 'In Transit';
    return 'Shipment Update';
  };
  const statusCopy = (status) => ({
    Delivered: 'Your package has been delivered.',
    'Out for Delivery': 'Your package is on the way to you.',
    'In Transit': 'Your package is moving through the delivery network.',
    'Picked Up': 'Your package has been collected by Delhivery.',
    'Ready for Pickup': 'Your shipment is ready to be collected.',
    Manifested: 'Your shipment information has been received.',
    'Order Confirmed': 'Your shipment has been confirmed.',
    Undelivered: 'A delivery attempt needs attention.',
    RTO: 'The shipment is returning to its origin.',
    Cancelled: 'This shipment has been cancelled.',
    Lost: 'Please contact the store for assistance with this shipment.',
    'Shipment Update': 'A new shipment update is available.',
  }[status] || 'A new shipment update is available.');
  const formatDate = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat('en-IN', { day:'numeric', month:'short', year:'numeric', hour:'numeric', minute:'2-digit' }).format(date);
  };

  const initializeTracking = (root) => {
    if (!root || root.dataset.initialized === 'true') return;
    root.dataset.initialized = 'true';
    const form = root.querySelector('[data-cust-tracking-form]');
    const input = root.querySelector('[data-cust-tracking-input]');
    const submit = root.querySelector('[data-cust-tracking-submit]');
    const message = root.querySelector('[data-cust-tracking-message]');
    const results = root.querySelector('[data-cust-tracking-results]');
    const timelineWrap = root.querySelector('[data-cust-timeline-wrap]');
    let controller = null;
    if (!form || !input || !submit || !message || !results) return;

    const enabled = (name) => root.dataset[name] === 'true';
    const setLoading = (loading) => { root.classList.toggle('is-loading', loading); root.setAttribute('aria-busy', String(loading)); submit.disabled = loading; };
    const showMessage = (text) => { results.hidden = true; message.textContent = text; message.hidden = false; };
    const addFact = (container, label, value) => {
      if (!value) return;
      const item = document.createElement('div'); item.className = 'cust-delhivery-tracking__fact';
      item.innerHTML = `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`; container.appendChild(item);
    };
    const render = (data) => {
      if (!data?.success || !data.shipment) { showMessage(data?.code === 'NOT_FOUND' ? root.dataset.emptyMessage : root.dataset.errorMessage); return; }
      const shipment = data.shipment;
      const currentStatus = customerStatus(shipment.status);
      root.querySelector('[data-cust-current-status]').textContent = currentStatus;
      root.querySelector('[data-cust-status-copy]').textContent = enabled('showInstructions') && shipment.instructions ? shipment.instructions : statusCopy(currentStatus);
      const statusMeta = root.querySelector('[data-cust-status-meta]');
      const meta = [enabled('showLocation') ? shipment.location : '', enabled('showUpdated') ? formatDate(shipment.statusDateTime) : ''].filter(Boolean).join(' · ');
      statusMeta.textContent = meta; statusMeta.hidden = !meta;
      const direction = root.querySelector('[data-cust-direction]');
      direction.textContent = shipment.statusType === 'RT' ? 'Return shipment' : shipment.statusType === 'UD' ? 'Forward shipment' : '';
      direction.hidden = !direction.textContent;
      const facts = root.querySelector('[data-cust-tracking-facts]'); facts.replaceChildren();
      if (enabled('showAwb')) addFact(facts, 'AWB', shipment.awb);
      if (enabled('showReference')) addFact(facts, 'Order reference', shipment.reference);
      if (enabled('showLocation')) addFact(facts, 'Current location', shipment.location);
      if (enabled('showUpdated')) addFact(facts, 'Last updated', formatDate(shipment.statusDateTime));
      facts.hidden = !facts.children.length;
      const timeline = root.querySelector('[data-cust-timeline]'); timeline.replaceChildren();
      const events = Array.isArray(data.events) ? data.events : [];
      events.forEach((event, index) => {
        const item = document.createElement('li'); item.className = 'cust-delhivery-tracking__event';
        const eventStatus = customerStatus(event.status);
        const eventMeta = [formatDate(event.dateTime), event.location].filter(Boolean).join(' · ');
        item.innerHTML = `<span class="cust-delhivery-tracking__event-dot" aria-hidden="true">${index === 0 ? '●' : '✓'}</span><div><p class="cust-delhivery-tracking__event-title">${escapeHtml(eventStatus)}</p>${eventMeta ? `<p class="cust-delhivery-tracking__event-meta">${escapeHtml(eventMeta)}</p>` : ''}${enabled('showInstructions') && event.instructions ? `<p class="cust-delhivery-tracking__event-copy">${escapeHtml(event.instructions)}</p>` : ''}</div>`;
        timeline.appendChild(item);
      });
      timelineWrap.hidden = !enabled('showTimeline') || !events.length;
      message.hidden = true; results.hidden = false;
    };
    const track = async () => {
      const awb = input.value.trim();
      if (!awb) { showMessage('Please enter your tracking number.'); input.focus(); return; }
      if (awb.length > 64 || /[<>{}\s]/.test(awb)) { showMessage(root.dataset.emptyMessage); input.focus(); return; }
      if (!root.dataset.endpoint) { showMessage(root.dataset.errorMessage); return; }
      if (responseCache.has(awb)) { render(responseCache.get(awb)); return; }
      controller?.abort(); controller = new AbortController();
      message.textContent = root.dataset.loadingMessage; message.hidden = false; results.hidden = true; setLoading(true);
      try {
        const endpoint = new URL(root.dataset.endpoint, window.location.origin);
        if (endpoint.origin !== window.location.origin) throw new Error('Proxy must be same-origin');
        endpoint.searchParams.set('awb', awb);
        const response = await fetch(endpoint.toString(), { headers:{ Accept:'application/json' }, credentials:'same-origin', signal:controller.signal });
        let data = null; try { data = await response.json(); } catch (error) {}
        if (response.status === 404) data = { success:false, code:'NOT_FOUND' };
        else if (!response.ok) throw new Error(`Proxy returned ${response.status}`);
        responseCache.set(awb, data); render(data);
      } catch (error) {
        if (error.name !== 'AbortError') { console.warn('[Delhivery tracking] Tracking request failed.'); showMessage(root.dataset.errorMessage); }
      } finally { setLoading(false); controller = null; }
    };
    form.addEventListener('submit', (event) => { event.preventDefault(); if (!submit.disabled) track(); });
    const urlAwb = new URLSearchParams(window.location.search).get('awb')?.trim();
    if (urlAwb) { input.value = urlAwb; if (root.dataset.autoTrack === 'true') track(); }
  };

  const initAll = (scope = document) => scope.querySelectorAll('[data-cust-delhivery-tracking]').forEach(initializeTracking);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => initAll(), { once:true }); else initAll();
  document.addEventListener('shopify:section:load', (event) => initAll(event.target));
})();
