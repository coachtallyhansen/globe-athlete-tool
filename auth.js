// Student Google sign-in + primary sport picker for preview and permanent site.
(function(){
  const page=(location.pathname.split('/').pop()||'index.html').toLowerCase();
  if (!['index.html','v10-preview.html'].includes(page)) return;

  const TOKEN_KEY = 'globe-athlete-id-token';
  const DEFAULT_DOMAIN = 'globeschools.org';
  let idToken = '';
  let session = null;
  let authUi = null;
  let messageEl = null;
  let signInSlot = null;
  let chooser = null;
  let openProfileBase = null;

  const esc = value => String(value == null ? '' : value)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

  function endpoint(){ return String(window.ATHLETE_DATA_URL || '').trim(); }
  function clientId(){ return String(window.GOOGLE_CLIENT_ID || '').trim(); }
  function domain(){ return String(window.AUTH_ALLOWED_DOMAIN || DEFAULT_DOMAIN).trim(); }

  function injectStyles(){
    const style = document.createElement('style');
    style.textContent = `
      .brand{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap}
      .authUi{display:flex;align-items:center;gap:8px;margin-left:auto;letter-spacing:normal;flex-wrap:wrap}
      .authPill,.authAction{border:1px solid #3b3b3b;border-radius:999px;background:#151515;color:#eee;padding:8px 11px;font:700 12px/1.1 Inter,Arial,sans-serif}
      .authAction{cursor:pointer}.authAction:hover{border-color:#666}.authAction.primary{border-color:#6c451d;background:#24180d;color:#f2a34a}
      .authMessage{font:600 11px/1.35 Inter,Arial,sans-serif;color:#aaa;max-width:320px;text-align:right}
      .authMessage.error{color:#ff8f8f}.authMessage.good{color:#8cf0aa}
      .primaryChooser{margin:12px 0 4px;padding:14px 16px;border:1px solid #323232;border-radius:14px;background:#111}
      .primaryChooserHead{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:10px}
      .primaryChooserHead b{font-size:13px}.primaryChooserHead span{color:#888;font-size:11px}
      .primaryOptions{display:flex;gap:8px;flex-wrap:wrap}
      .primarySportBtn{border:1px solid #3d3d3d;background:#171717;color:#eee;border-radius:999px;padding:9px 12px;cursor:pointer;font-weight:800}
      .primarySportBtn.selected{background:#f28c28;color:#111;border-color:#f28c28}
      .primarySportBtn:disabled{opacity:.55;cursor:wait}
      @media(max-width:650px){.brand{align-items:flex-start}.authUi{width:100%;margin-left:0;justify-content:flex-start}.authMessage{text-align:left;max-width:none;width:100%}}
    `;
    document.head.appendChild(style);
  }

  function buildAuthUi(){
    const brand = document.querySelector('.brand');
    if (!brand) return false;
    authUi = document.createElement('div');
    authUi.className = 'authUi';
    signInSlot = document.createElement('div');
    signInSlot.id = 'googleSignInSlot';
    messageEl = document.createElement('div');
    messageEl.className = 'authMessage';
    authUi.append(signInSlot, messageEl);
    brand.appendChild(authUi);
    return true;
  }

  function setMessage(text, mode){
    if (!messageEl) return;
    messageEl.textContent = text || '';
    messageEl.className = 'authMessage' + (mode ? ' ' + mode : '');
  }

  async function post(action, extra){
    const url = endpoint();
    if (!url) throw new Error('Live data endpoint is not configured.');
    const body = Object.assign({ action, idToken }, extra || {});
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      cache: 'no-store'
    });
    if (!response.ok) throw new Error(`Login service returned HTTP ${response.status}.`);
    return await response.json();
  }
  window.globeAuthPost = post;

  function publishSession(){
    window.globeCurrentSession = session;
    window.dispatchEvent(new CustomEvent('globe-auth-session', { detail: session }));
  }

  function currentAthleteId(){
    return new URLSearchParams(location.hash.replace(/^#/, '')).get('athlete');
  }

  function athleteNameForIcon(icon, athlete){
    const i = (athlete.sports || []).indexOf(icon);
    return i >= 0 && athlete.sportNames && athlete.sportNames[i] ? athlete.sportNames[i] : icon;
  }

  function renderChooser(){
    if (chooser) { chooser.remove(); chooser = null; }
    if (!session || !session.athlete) return;
    const profile = document.getElementById('profile');
    if (!profile || profile.classList.contains('hide')) return;
    if (currentAthleteId() !== session.athlete.id) return;
    const sportsHolder = document.getElementById('sports');
    if (!sportsHolder) return;
    const athlete = session.athlete;
    chooser = document.createElement('div');
    chooser.className = 'primaryChooser';
    const selected = athlete.primarySportIcon || '';
    chooser.innerHTML = `
      <div class="primaryChooserHead"><b>Choose Primary Sport</b><span>This controls your main profile photo.</span></div>
      <div class="primaryOptions">${(athlete.sports || []).map(icon => {
        const name = athleteNameForIcon(icon, athlete);
        const isSelected = icon === selected;
        return `<button type="button" class="primarySportBtn${isSelected ? ' selected' : ''}" data-sport="${esc(icon)}">${esc(icon)} ${esc(name)}</button>`;
      }).join('')}</div>`;
    sportsHolder.insertAdjacentElement('afterend', chooser);
    chooser.querySelectorAll('.primarySportBtn').forEach(button => button.addEventListener('click', () => choosePrimary(button.dataset.sport)));
  }

  async function choosePrimary(sport){
    if (!session || !session.athlete || !sport) return;
    const buttons = chooser ? chooser.querySelectorAll('.primarySportBtn') : [];
    buttons.forEach(b => b.disabled = true);
    setMessage('Saving primary sport…');
    try {
      const result = await post('setPrimarySport', { sport });
      if (!result.ok) throw new Error(result.error || 'Could not save primary sport.');
      session.athlete = result.athlete || session.athlete;
      renderSignedIn();
      renderChooser();
      setMessage(`Primary sport saved: ${result.primarySport || athleteNameForIcon(sport, session.athlete)}`, 'good');
      window.dispatchEvent(new CustomEvent('globe-primary-sport-changed', { detail: result }));
    } catch (err) {
      setMessage(err.message || String(err), 'error');
      buttons.forEach(b => b.disabled = false);
    }
  }

  function renderSignedIn(){
    if (!authUi || !session) return;
    signInSlot.innerHTML = '';
    const athlete = session.athlete;
    const who = document.createElement('span');
    who.className = 'authPill';
    who.textContent = athlete ? athlete.name : (session.email || 'Signed in');
    signInSlot.appendChild(who);
    if (athlete) {
      const myProfile = document.createElement('button');
      myProfile.type = 'button';
      myProfile.className = 'authAction primary';
      myProfile.textContent = 'My Profile';
      myProfile.addEventListener('click', () => {
        if (typeof window.openProfile === 'function') window.openProfile(athlete.id);
        renderChooser();
      });
      signInSlot.appendChild(myProfile);
    }
    const out = document.createElement('button');
    out.type = 'button';
    out.className = 'authAction';
    out.textContent = 'Sign Out';
    out.addEventListener('click', signOut);
    signInSlot.appendChild(out);
    setMessage(athlete ? 'District account linked.' : `Signed in successfully as ${session.role || 'user'}.`, 'good');
    publishSession();
  }

  function signOut(){
    session = null;
    idToken = '';
    sessionStorage.removeItem(TOKEN_KEY);
    if (window.google && google.accounts && google.accounts.id) google.accounts.id.disableAutoSelect();
    if (chooser) { chooser.remove(); chooser = null; }
    publishSession();
    renderGoogleButton();
    setMessage('Signed out.');
  }

  async function useCredential(credential){
    idToken = String(credential || '').trim();
    if (!idToken) return;
    sessionStorage.setItem(TOKEN_KEY, idToken);
    setMessage('Checking district account…');
    try {
      const result = await post('session');
      if (!result.ok) throw Object.assign(new Error(result.error || 'Account could not be linked.'), { code: result.code });
      session = result;
      renderSignedIn();
      if (session.athlete && typeof window.openProfile === 'function') {
        window.openProfile(session.athlete.id);
        renderChooser();
      }
    } catch (err) {
      session = null;
      publishSession();
      if (err && err.code === 'ACCOUNT_NOT_LINKED') setMessage('Your district login worked, but this email is not linked to an athlete yet.', 'error');
      else setMessage(err.message || String(err), 'error');
      sessionStorage.removeItem(TOKEN_KEY);
      idToken = '';
      renderGoogleButton();
    }
  }

  function renderGoogleButton(){
    if (!signInSlot) return;
    signInSlot.innerHTML = '';
    const cid = clientId();
    if (!cid) {
      const disabled = document.createElement('span');
      disabled.className = 'authPill';
      disabled.textContent = 'Student Login · setup needed';
      signInSlot.appendChild(disabled);
      setMessage('Google Client ID still needs to be connected.');
      return;
    }
    if (!window.google || !google.accounts || !google.accounts.id) { setMessage('Loading Google sign-in…'); return; }
    google.accounts.id.initialize({
      client_id: cid,
      callback: response => useCredential(response && response.credential),
      hd: domain(),
      auto_select: false,
      cancel_on_tap_outside: true
    });
    google.accounts.id.renderButton(signInSlot, {
      type: 'standard', theme: 'filled_black', size: 'medium', text: 'signin_with', shape: 'pill', logo_alignment: 'left'
    });
    setMessage(`Students must use @${domain()}.`);
  }

  function loadGoogleIdentity(){
    if (window.google && google.accounts && google.accounts.id) { renderGoogleButton(); restoreSession(); return; }
    const existing = document.querySelector('script[data-globe-gsi]');
    if (existing) return;
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true; script.defer = true; script.dataset.globeGsi = '1';
    script.onload = () => { renderGoogleButton(); restoreSession(); };
    script.onerror = () => setMessage('Google sign-in could not load.', 'error');
    document.head.appendChild(script);
  }

  async function restoreSession(){
    const saved = sessionStorage.getItem(TOKEN_KEY);
    if (!saved || session || !clientId()) return;
    idToken = saved;
    setMessage('Restoring sign-in…');
    try {
      const result = await post('session');
      if (!result.ok) throw new Error(result.error || 'Session expired.');
      session = result;
      renderSignedIn();
      renderChooser();
    } catch (err) {
      sessionStorage.removeItem(TOKEN_KEY);
      idToken = '';
      session = null;
      publishSession();
      renderGoogleButton();
    }
  }

  function hookProfile(){
    if (openProfileBase || typeof window.openProfile !== 'function') return;
    openProfileBase = window.openProfile;
    window.openProfile = function(id){ openProfileBase(id); setTimeout(renderChooser, 0); };
  }

  function waitForConfig(tries){
    if (typeof window.GOOGLE_CLIENT_ID !== 'undefined' && endpoint()) { loadGoogleIdentity(); return; }
    if (tries <= 0) { loadGoogleIdentity(); return; }
    setTimeout(() => waitForConfig(tries - 1), 100);
  }

  function start(){ injectStyles(); if (!buildAuthUi()) return; hookProfile(); waitForConfig(40); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true}); else start();
})();
