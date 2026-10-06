// Temporary preview diagnostics for Google sign-in. Never logs or displays ID tokens.
(function(){
  if (!/(^|\/)v10-preview\.html$/i.test(location.pathname)) return;
  const originalFetch = window.fetch.bind(window);
  const show = (text) => setTimeout(() => {
    const el = document.querySelector('.authMessage');
    if (!el) return;
    el.textContent = text;
    el.className = 'authMessage error';
  }, 150);

  window.fetch = async function(input, init){
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const isAuthPost = /script\.google\.com\/macros\/s\//.test(url) && String(init && init.method || 'GET').toUpperCase() === 'POST';
    if (!isAuthPost) return originalFetch(input, init);
    try {
      const response = await originalFetch(input, init);
      try {
        const clone = response.clone();
        const text = await clone.text();
        let data = null;
        try { data = JSON.parse(text); } catch (_) {}
        if (!response.ok) show(`Login backend HTTP ${response.status}.`);
        else if (data && data.ok === false) show(`Login backend: ${data.error || data.code || 'request failed'}`);
      } catch (_) {}
      return response;
    } catch (err) {
      show(`Login network error: ${err && err.message ? err.message : String(err)}`);
      throw err;
    }
  };
})();
