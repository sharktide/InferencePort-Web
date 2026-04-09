// turnstile.js — show overlay and handle verification
(function() {
  let handled = false;
  function hasTurnstileCookie() {
    return document.cookie.split(';').some(c => c.trim().startsWith('turnstile='));
  }

  const overlay = document.getElementById('turnstile-overlay');
  const pageRoot = document.getElementById('app') || document.body;

  function hideOverlay() {
    if (overlay) overlay.style.display = 'none';
    if (pageRoot) pageRoot.classList.remove('page-faded');
  }
  function showOverlay() {
    if (overlay) overlay.style.display = 'flex';
    if (pageRoot) pageRoot.classList.add('page-faded');
  }

  // Helper: set local cookie so reload won't re-show challenge
  function setLocalTurnstileCookie() {
    try {
      document.cookie = 'turnstile=1; path=/; max-age=' + (24 * 3600);
    } catch (e) { /* ignore */ }
  }

  // Attempt websocket verify first, then fallback to REST if needed.
  async function doWebsocketVerify(token) {
    return new Promise(resolve => {
      if (!window.ws || !window.ws.send || !window.ws.isConnected || !window.ws.on) return resolve(false);
      // If websocket not connected, bail
      if (!window.ws.isConnected()) return resolve(false);

      let done = false;
      const onOk = () => { if (done) return; done = true; try { unsub(); unsubErr(); } catch {} resolve(true); };
      const onErr = () => { if (done) return; done = true; try { unsub(); unsubErr(); } catch {} resolve(false); };

      // Listen for server ack
      const unsub = window.ws.on('turnstile:ok', () => { onOk(); });
      const unsubErr = window.ws.on('turnstile:error', () => { onErr(); });

      // Send verify message
      try { window.ws.send({ type: 'turnstile:verify', token }); }
      catch (e) { unsub(); unsubErr(); resolve(false); }

      // Fallback timeout
      setTimeout(() => { if (!done) { try { unsub(); unsubErr(); } catch {} resolve(false); } }, 3500);
    });
  }

  async function doRestVerify(token) {
    try {
      const r = await fetch('/api/turnstile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
      if (r.ok) return true;
    } catch (e) { console.error('Turnstile REST verify failed', e); }
    return false;
  }

  // Global callback for Cloudflare Turnstile — ensure single handling
  window.onTurnstileSuccess = async function(token) {
    if (!token || handled) return; handled = true;

    // Prefer websocket verify for immediate session validation
    let ok = await doWebsocketVerify(token);
    if (ok) {
      setLocalTurnstileCookie();
      hideOverlay();
      return;
    }

    // Fallback to REST verify (sets cookie server-side)
    ok = await doRestVerify(token);
    if (ok) setLocalTurnstileCookie();
    if (ok) hideOverlay();
    else {
      // If both failed, allow retry by resetting handled after short delay
      handled = false;
      showOverlay();
    }
  };

  // Initialize visibility
  if (hasTurnstileCookie()) hideOverlay(); else showOverlay();
})();
