// ---------------------------------------------------------------
// Shared API helper.
// Uses text/plain Content-Type on purpose: Apps Script Web Apps
// don't handle CORS preflight, so we avoid triggering one by not
// sending application/json.
// ---------------------------------------------------------------
(function () {
  async function apiPost(payload) {
    const url = (window.ERNI_CONFIG && window.ERNI_CONFIG.API_URL) || '';
    if (!url || url.indexOf('PASTE_') === 0) {
      throw new Error('Die Anmeldung ist noch nicht aktiviert. Bitte melde Dich direkt bei Othmar und Christin.');
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow'
    });
    if (!res.ok) throw new Error('Netzwerkfehler (' + res.status + ').');
    const data = await res.json();
    return data;
  }

  function setBusy(btn, busy, labelBusy) {
    if (!btn) return;
    if (busy) {
      btn.dataset._label = btn.textContent;
      btn.textContent = labelBusy || 'Bitte warten…';
      btn.disabled = true;
    } else {
      if (btn.dataset._label) btn.textContent = btn.dataset._label;
      btn.disabled = false;
    }
  }

  function showError(el, message) {
    if (!el) return;
    el.textContent = message || '';
    el.style.display = message ? 'block' : 'none';
  }

  window.ErniAPI = { apiPost, setBusy, showError };
})();
