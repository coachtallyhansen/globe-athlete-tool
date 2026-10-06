// Temporary preview-only Google sign-in diagnostic. Does not log or display ID tokens.
(function(){
  if (!/(^|\/)v10-preview\.html$/i.test(location.pathname)) return;

  const DOMAIN = String(window.AUTH_ALLOWED_DOMAIN || 'globeschools.org').trim();
  const CLIENT_ID = String(window.GOOGLE_CLIENT_ID || '').trim();
  const ENDPOINT = String(window.ATHLETE_DATA_URL || '').trim();
  let slot, status, token = '';

  function setStatus(text, mode){
    if (!status) return;
    status.textContent = text || '';
    status.style.color = mode === 'error' ? '#ff8f8f' : mode === 'good' ? '#8cf0aa' : '#aaa';
  }

  function buildUi(){
    const brand = document.querySelector('.brand');
    if (!brand) return false;
    const box = document.createElement('div');
    box.style.cssText = 'display:flex;align-items:center;gap:10px;margin-left:auto;flex-wrap:wrap;letter-spacing:normal';
    slot = document.createElement('div');
    status = document.createElement('div');
    status.style.cssText = 'font:600 11px/1.35 Inter,Arial,sans-serif;max-width:390px';
    box.append(slot,status);
    brand.appendChild(box);
    return true;
  }

  async function callBackend(){
    setStatus('Google credential received. Checking login service…');
    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {'Content-Type':'text/plain;charset=utf-8'},
        body: JSON.stringify({action:'session', idToken:token}),
        cache: 'no-store'
      });
      const text = await response.text();
      let data;
      try { data = JSON.parse(text); }
      catch (_) {
        throw new Error(`Login service returned non-JSON (HTTP ${response.status}).`);
      }
      if (!response.ok) throw new Error(`Login service returned HTTP ${response.status}.`);
      if (!data.ok) throw new Error(data.error || data.code || 'Login service rejected the account.');
      renderSignedIn(data);
    } catch (err) {
      setStatus(err && err.message ? err.message : String(err), 'error');
    }
  }

  function renderSignedIn(data){
    slot.innerHTML = '';
    const pill = document.createElement('span');
    pill.textContent = data.athlete && data.athlete.name ? data.athlete.name : (data.email || 'Signed in');
    pill.style.cssText='border:1px solid #356947;border-radius:999px;background:#102418;color:#8cf0aa;padding:8px 11px;font:800 12px/1 Inter,Arial,sans-serif';
    const out = document.createElement('button');
    out.type='button'; out.textContent='Sign Out';
    out.style.cssText='border:1px solid #3b3b3b;border-radius:999px;background:#151515;color:#eee;padding:8px 11px;font:800 12px/1 Inter,Arial,sans-serif;cursor:pointer';
    out.onclick = () => { token=''; if (window.google?.accounts?.id) google.accounts.id.disableAutoSelect(); renderButton(); setStatus('Signed out.'); };
    slot.append(pill,out);
    setStatus(`Signed in successfully as ${data.role || 'user'}.`, 'good');
  }

  function renderButton(){
    if (!CLIENT_ID) { setStatus('Google Client ID is missing.', 'error'); return; }
    if (!window.google?.accounts?.id) { setStatus('Loading Google sign-in…'); return; }
    slot.innerHTML='';
    google.accounts.id.initialize({
      client_id: CLIENT_ID,
      hd: DOMAIN,
      auto_select: false,
      cancel_on_tap_outside: true,
      callback: response => {
        token = String(response && response.credential || '').trim();
        if (!token) { setStatus('Google returned without a credential.', 'error'); return; }
        callBackend();
      }
    });
    google.accounts.id.renderButton(slot, {
      type:'standard', theme:'filled_black', size:'medium', text:'signin_with', shape:'pill', logo_alignment:'left',
      click_listener: () => setStatus('Google sign-in opened. Choose your @' + DOMAIN + ' account.')
    });
    setStatus('Students must use @' + DOMAIN + '.');
  }

  function loadGoogle(){
    if (window.google?.accounts?.id) { renderButton(); return; }
    const s=document.createElement('script');
    s.src='https://accounts.google.com/gsi/client'; s.async=true; s.defer=true;
    s.onload=renderButton;
    s.onerror=()=>setStatus('Google sign-in library could not load.', 'error');
    document.head.appendChild(s);
  }

  function start(){
    if (!buildUi()) return;
    if (!ENDPOINT) { setStatus('Live data endpoint is missing.', 'error'); return; }
    loadGoogle();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();
