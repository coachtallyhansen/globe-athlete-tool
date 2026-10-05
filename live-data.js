// Live sanitized Google Sheet sync for V10 preview.
// Falls back to the bundled snapshot if config.js has no endpoint or the endpoint is unavailable.
(function(){
  const REFRESH_MS = 60000;
  let timer = null;
  let syncing = false;
  let lastGeneratedAt = null;

  function setBadge(mode, detail){
    const brand = document.querySelector('.brand');
    if (!brand) return;
    let badge = document.getElementById('dataSourceBadge');
    if (!badge) {
      badge = document.createElement('span');
      badge.id = 'dataSourceBadge';
      badge.style.cssText = 'display:inline-block;margin-left:10px;padding:4px 7px;border-radius:999px;font-size:9px;letter-spacing:.1em;font-weight:900;vertical-align:middle;border:1px solid #3a3a3a;color:#aaa;background:#151515';
      brand.appendChild(badge);
    }
    if (mode === 'live') {
      badge.textContent = 'LIVE SHEET';
      badge.style.color = '#8cf0aa';
      badge.style.borderColor = '#285d38';
      badge.style.background = '#102217';
      badge.title = detail || 'Live sanitized data from the master Google Sheet';
    } else if (mode === 'syncing') {
      badge.textContent = 'SYNCING';
      badge.style.color = '#f2c66d';
      badge.style.borderColor = '#5e4a20';
      badge.style.background = '#231d10';
      badge.title = 'Refreshing athlete data';
    } else {
      badge.textContent = 'SNAPSHOT';
      badge.style.color = '#aaa';
      badge.style.borderColor = '#3a3a3a';
      badge.style.background = '#151515';
      badge.title = detail || 'Bundled preview data';
    }
  }

  function validPayload(p){
    return !!(p && p.ok !== false && Array.isArray(p.athletes) && p.athletes.length);
  }

  function replaceAthletes(payload){
    if (typeof DATA === 'undefined' || !DATA || !Array.isArray(DATA.athletes)) return false;
    DATA.athletes.splice(0, DATA.athletes.length, ...payload.athletes);
    lastGeneratedAt = payload.generatedAt || null;
    const count = document.getElementById('athleteCount');
    if (count) count.textContent = `${DATA.athletes.length} athletes loaded`;
    if (typeof draw === 'function') draw();

    const profile = document.getElementById('profile');
    if (profile && !profile.classList.contains('hide')) {
      const id = new URLSearchParams(location.hash.replace(/^#/, '')).get('athlete');
      if (id && DATA.athletes.some(a => a.id === id) && typeof openProfile === 'function') {
        openProfile(id);
      }
    }
    return true;
  }

  async function fetchWithTimeout(url, ms){
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), ms);
    try {
      const sep = url.includes('?') ? '&' : '?';
      const bust = `${sep}t=${Date.now()}`;
      const r = await fetch(url + bust, { cache: 'no-store', signal: controller.signal });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } finally {
      clearTimeout(t);
    }
  }

  async function sync(){
    const url = String(window.ATHLETE_DATA_URL || '').trim();
    if (!url) {
      setBadge('snapshot', 'Live Sheet endpoint not connected yet');
      return;
    }
    if (syncing) return;
    syncing = true;
    setBadge('syncing');
    try {
      const payload = await fetchWithTimeout(url, 15000);
      if (!validPayload(payload)) throw new Error(payload && payload.error ? payload.error : 'Invalid athlete payload');
      replaceAthletes(payload);
      const when = lastGeneratedAt ? new Date(lastGeneratedAt).toLocaleTimeString([], {hour:'numeric', minute:'2-digit'}) : '';
      setBadge('live', when ? `Live Sheet · refreshed ${when}` : 'Live Sheet connected');
    } catch (err) {
      console.warn('Live athlete sync failed; using current data.', err);
      setBadge('snapshot', 'Live sync unavailable; showing last loaded data');
    } finally {
      syncing = false;
    }
  }

  function loadConfigThenStart(){
    const s = document.createElement('script');
    s.src = `config.js?v=${Date.now()}`;
    s.onload = () => {
      sync();
      timer = setInterval(sync, REFRESH_MS);
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) sync();
      });
    };
    s.onerror = () => setBadge('snapshot', 'Could not load live-data configuration');
    document.head.appendChild(s);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadConfigThenStart, {once:true});
  } else {
    loadConfigThenStart();
  }
})();
