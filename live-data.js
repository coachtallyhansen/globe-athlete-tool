// Live sanitized Google Sheet sync for the Globe Athlete Tool.
// Falls back to the bundled snapshot if config.js has no endpoint or the endpoint is unavailable.
(function(){
  const REFRESH_MS = 60000;
  const SPORT_FILTER_PREVIEW = /(^|\/)v10-preview\.html$/i.test(location.pathname);
  let timer = null;
  let syncing = false;
  let lastGeneratedAt = null;
  let sportUiInstalled = false;
  let sportFilterInstalled = false;
  let sportFilterEl = null;
  let baseDraw = null;

  const SPORT_MAP = {
    '🏈': 'Football','🏐': 'Volleyball','🏃': 'Cross Country','🏃‍♂️': 'Cross Country','🏃‍♀️': 'Cross Country',
    '🏊': 'Swim','📣': 'Cheer','🎮': 'Esports','🏀': 'Basketball','🤼': 'Wrestling','⚽': 'Soccer','💃': 'Pom',
    '⚾': 'Baseball','🥎': 'Softball','👟': 'Track & Field','🏃‍➡️': 'Track & Field','🎾': 'Tennis','⛳': 'Golf','🏖️🏐': 'Beach Volleyball'
  };
  const SPORT_ORDER = [...new Set(Object.values(SPORT_MAP))];

  function sportName(icon){ return SPORT_MAP[String(icon || '').trim()] || String(icon || '').trim(); }
  function sportIcon(name){ const hit = Object.entries(SPORT_MAP).find(([,label]) => label === name); return hit ? hit[0] : ''; }
  function normalizeAthleteSports(a){
    const raw = Array.isArray(a.sports) ? a.sports.map(x => String(x || '').trim()).filter(Boolean) : [];
    a.sportIcons = raw.slice();
    a.sports = raw.map(sportName);
    return a;
  }
  function escapeHtml(value){
    return String(value == null ? '' : value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function renderSportIcons(a){
    const holder = document.getElementById('sports');
    if (!holder) return;
    const icons = Array.isArray(a && a.sportIcons) ? a.sportIcons : [];
    const names = Array.isArray(a && a.sports) ? a.sports : [];
    holder.innerHTML = icons.map((icon, i) => `<span class="sportEmoji" title="${escapeHtml(names[i] || sportName(icon))}" aria-label="${escapeHtml(names[i] || sportName(icon))}">${escapeHtml(icon)}</span>`).join('');
  }

  function decorateSportBonusRows(a){
    if (!SPORT_FILTER_PREVIEW) return;
    const rows = document.querySelectorAll('.bonusSec .metric');
    const names = Array.isArray(a && a.sports) ? a.sports : [];
    const icons = Array.isArray(a && a.sportIcons) ? a.sportIcons : [];
    rows.forEach((row, i) => {
      const first = row.querySelector('span');
      if (!first || !names[i]) return;
      first.textContent = `${icons[i] ? icons[i] + ' ' : ''}${names[i]}`;
    });
  }

  function installSportUi(){
    if (sportUiInstalled) return;
    sportUiInstalled = true;
    const css = document.createElement('style');
    css.textContent = `.sports{align-items:center}.sportEmoji{width:42px;height:42px;border-radius:50%;border:1px solid #414141;background:#151515;display:inline-grid;place-items:center;font-size:23px;line-height:1;box-shadow:0 6px 16px rgba(0,0,0,.18)}@media(max-width:650px){.sportEmoji{width:38px;height:38px;font-size:21px}}`;
    document.head.appendChild(css);
    const originalOpenProfile = window.openProfile;
    if (typeof originalOpenProfile === 'function') {
      window.openProfile = function(id){
        originalOpenProfile(id);
        const a = (typeof DATA !== 'undefined' && DATA && Array.isArray(DATA.athletes)) ? DATA.athletes.find(x => x.id === id) : null;
        if (a) { renderSportIcons(a); decorateSportBonusRows(a); }
      };
    }
  }

  function refreshSportOptions(){
    if (!SPORT_FILTER_PREVIEW || !sportFilterEl || typeof DATA === 'undefined' || !DATA || !Array.isArray(DATA.athletes)) return;
    const genderEl = document.querySelector('input[name=gender]:checked');
    const gender = genderEl ? genderEl.value : null;
    const selected = sportFilterEl.value || 'All';
    const available = new Set();
    DATA.athletes.forEach(a => { if (!gender || a.gender === gender) (a.sports || []).forEach(s => available.add(s)); });
    const ordered = SPORT_ORDER.filter(s => available.has(s));
    [...available].filter(s => !ordered.includes(s)).sort().forEach(s => ordered.push(s));
    sportFilterEl.innerHTML = '<option value="All">All Sports</option>' + ordered.map(name => {
      const icon = sportIcon(name);
      return `<option value="${escapeHtml(name)}">${icon ? escapeHtml(icon) + ' ' : ''}${escapeHtml(name)}</option>`;
    }).join('');
    sportFilterEl.value = available.has(selected) ? selected : 'All';
  }

  function sportFilteredDraw(){
    if (!SPORT_FILTER_PREVIEW || !sportFilterEl || typeof baseDraw !== 'function' || typeof DATA === 'undefined' || !DATA || !Array.isArray(DATA.athletes)) { if (typeof baseDraw === 'function') baseDraw(); return; }
    const selected = sportFilterEl.value || 'All';
    if (selected === 'All') { baseDraw(); return; }
    const full = DATA.athletes.slice();
    const filtered = full.filter(a => Array.isArray(a.sports) && a.sports.includes(selected));
    DATA.athletes.splice(0, DATA.athletes.length, ...filtered);
    try {
      baseDraw();
      const status = document.getElementById('status');
      if (status && !status.textContent.includes(selected)) status.textContent += ` · ${sportIcon(selected) ? sportIcon(selected) + ' ' : ''}${selected}`;
    } finally { DATA.athletes.splice(0, DATA.athletes.length, ...full); }
  }

  function installSportFilterPreview(){
    if (!SPORT_FILTER_PREVIEW || sportFilterInstalled) return;
    const filters = document.querySelector('.filters');
    const year = document.getElementById('year');
    if (!filters || !year || typeof window.draw !== 'function') return;
    sportFilterInstalled = true;
    baseDraw = window.draw;
    sportFilterEl = document.createElement('select');
    sportFilterEl.id = 'sportFilter';
    sportFilterEl.title = 'Filter leaderboard by sport';
    sportFilterEl.setAttribute('aria-label', 'Filter leaderboard by sport');
    sportFilterEl.innerHTML = '<option value="All">All Sports</option>';
    year.insertAdjacentElement('afterend', sportFilterEl);
    sportFilterEl.addEventListener('change', sportFilteredDraw);
    document.querySelectorAll('input[name=gender]').forEach(x => x.addEventListener('change', () => { refreshSportOptions(); sportFilteredDraw(); }));
    ['year','rank'].forEach(id => { const node = document.getElementById(id); if (node) node.addEventListener('change', sportFilteredDraw); });
    const search = document.getElementById('search'); if (search) search.addEventListener('input', sportFilteredDraw);
    refreshSportOptions();
  }

  function setBadge(mode, detail){
    const brand = document.querySelector('.brand'); if (!brand) return;
    let badge = document.getElementById('dataSourceBadge');
    if (!badge) { badge = document.createElement('span'); badge.id = 'dataSourceBadge'; badge.style.cssText = 'display:inline-block;margin-left:10px;padding:4px 7px;border-radius:999px;font-size:9px;letter-spacing:.1em;font-weight:900;vertical-align:middle;border:1px solid #3a3a3a;color:#aaa;background:#151515'; brand.appendChild(badge); }
    if (mode === 'live') { badge.textContent = 'LIVE SHEET'; badge.style.color = '#8cf0aa'; badge.style.borderColor = '#285d38'; badge.style.background = '#102217'; badge.title = detail || 'Live sanitized data from the master Google Sheet'; }
    else if (mode === 'syncing') { badge.textContent = 'SYNCING'; badge.style.color = '#f2c66d'; badge.style.borderColor = '#5e4a20'; badge.style.background = '#231d10'; badge.title = 'Refreshing athlete data'; }
    else { badge.textContent = 'SNAPSHOT'; badge.style.color = '#aaa'; badge.style.borderColor = '#3a3a3a'; badge.style.background = '#151515'; badge.title = detail || 'Bundled preview data'; }
  }
  function validPayload(p){ return !!(p && p.ok !== false && Array.isArray(p.athletes) && p.athletes.length); }
  function replaceAthletes(payload){
    if (typeof DATA === 'undefined' || !DATA || !Array.isArray(DATA.athletes)) return false;
    const incoming = payload.athletes.map(normalizeAthleteSports);
    DATA.athletes.splice(0, DATA.athletes.length, ...incoming);
    lastGeneratedAt = payload.generatedAt || null;
    const count = document.getElementById('athleteCount'); if (count) count.textContent = `${DATA.athletes.length} athletes loaded`;
    if (SPORT_FILTER_PREVIEW && sportFilterInstalled) { refreshSportOptions(); sportFilteredDraw(); } else if (typeof draw === 'function') draw();
    const profile = document.getElementById('profile');
    if (profile && !profile.classList.contains('hide')) {
      const id = new URLSearchParams(location.hash.replace(/^#/, '')).get('athlete');
      if (id && DATA.athletes.some(a => a.id === id) && typeof window.openProfile === 'function') window.openProfile(id);
    }
    return true;
  }
  async function fetchWithTimeout(url, ms){
    const controller = new AbortController(); const t = setTimeout(() => controller.abort(), ms);
    try { const sep = url.includes('?') ? '&' : '?'; const r = await fetch(url + `${sep}t=${Date.now()}`, { cache: 'no-store', signal: controller.signal }); if (!r.ok) throw new Error(`HTTP ${r.status}`); return await r.json(); }
    finally { clearTimeout(t); }
  }
  async function sync(){
    const url = String(window.ATHLETE_DATA_URL || '').trim();
    if (!url) { setBadge('snapshot', 'Live Sheet endpoint not connected yet'); return; }
    if (syncing) return; syncing = true; setBadge('syncing');
    try {
      const payload = await fetchWithTimeout(url, 15000);
      if (!validPayload(payload)) throw new Error(payload && payload.error ? payload.error : 'Invalid athlete payload');
      replaceAthletes(payload);
      const when = lastGeneratedAt ? new Date(lastGeneratedAt).toLocaleTimeString([], {hour:'numeric', minute:'2-digit'}) : '';
      setBadge('live', when ? `Live Sheet · refreshed ${when}` : 'Live Sheet connected');
    } catch (err) { console.warn('Live athlete sync failed; using current data.', err); setBadge('snapshot', 'Live sync unavailable; showing last loaded data'); }
    finally { syncing = false; }
  }
  function loadConfigThenStart(){
    installSportUi(); installSportFilterPreview();
    const s = document.createElement('script'); s.src = `config.js?v=${Date.now()}`;
    s.onload = () => { sync(); timer = setInterval(sync, REFRESH_MS); document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(); }); };
    s.onerror = () => setBadge('snapshot', 'Could not load live-data configuration');
    document.head.appendChild(s);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadConfigThenStart, {once:true}); else loadConfigThenStart();
})();