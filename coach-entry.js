// Coach-only score entry UI for V10 preview.
(function(){
  if (!/(^|\/)v10-preview\.html$/i.test(location.pathname)) return;

  let session=null, selected=null, panel=null, statusEl=null, currentValue=null;

  const METRICS={
    med:['Med Ball Toss','ft',0.1,false],
    vert:['Vertical Jump','in',0.5,false],
    broad:['Broad Jump','in',1,false],
    pro:['Pro Agility','sec',0.01,true],
    dash:['40-Yard Dash','sec',0.01,true],
    bench:['Bench Press','lb',1,false],
    squat:['Back Squat','lb',1,false],
    dead:['Deadlift','lb',1,false],
    clean:['Clean','lb',1,false]
  };

  const LIFTS=new Set(['bench','squat','dead','clean']);
  const esc=v=>String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#39;');

  function nameParts(name){
    const p=String(name||'').trim().split(/\s+/).filter(Boolean);
    return {first:p.slice(0,-1).join(' '),last:p[p.length-1]||''};
  }
  function rosterLabel(name){
    const p=nameParts(name);
    return p.first ? `${p.last}, ${p.first}` : p.last;
  }
  function athletes(){
    const list=(typeof DATA!=='undefined' && DATA && Array.isArray(DATA.athletes)) ? DATA.athletes : [];
    return list.slice().sort((a,b)=>{
      const ap=nameParts(a.name), bp=nameParts(b.name);
      return ap.last.localeCompare(bp.last)||ap.first.localeCompare(bp.first)||String(a.gender||'').localeCompare(String(b.gender||''));
    });
  }
  function isCoach(s){ return s && /^(coach|admin)$/i.test(String(s.role||'')); }

  function css(){
    const s=document.createElement('style');
    s.textContent=`
      .coachScoresBtn{border:1px solid #744814;border-radius:999px;background:#24180d;color:#f59a32;padding:8px 11px;font:800 12px/1.1 Inter,Arial,sans-serif;cursor:pointer}
      .coachOverlay{position:fixed;inset:0;background:rgba(0,0,0,.74);z-index:9998;display:grid;place-items:center;padding:18px}
      .coachCard{width:min(980px,97vw);max-height:92vh;overflow:hidden;background:#111;border:1px solid #383838;border-radius:18px;box-shadow:0 30px 80px rgba(0,0,0,.55);display:flex;flex-direction:column}
      .coachHead{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:20px 20px 14px}.coachHead h2{margin:0;font-size:24px}.coachHead small{display:block;color:#888;margin-top:4px;font-size:11px}.coachClose{border:0;background:#222;color:#ddd;border-radius:999px;padding:8px 11px;cursor:pointer}
      .coachBody{display:grid;grid-template-columns:310px minmax(0,1fr);min-height:0;border-top:1px solid #272727}
      .coachRosterPane{border-right:1px solid #2d2d2d;padding:14px;display:flex;flex-direction:column;min-height:0;background:#0e0e0e}
      .coachRosterPane label,.coachField label{font-size:11px;color:#999;font-weight:800;text-transform:uppercase;letter-spacing:.05em}
      .coachRosterSearch{width:100%;box-sizing:border-box;background:#181818;color:#eee;border:1px solid #3b3b3b;border-radius:10px;padding:10px 11px;font:700 13px Inter,Arial,sans-serif;margin:8px 0 10px}
      .coachRosterCount{font-size:10px;color:#777;margin:0 2px 8px}.coachRoster{overflow-y:auto;border:1px solid #303030;border-radius:10px;background:#121212;min-height:220px}
      .coachAthlete{padding:9px 11px;border-bottom:1px solid #252525;cursor:pointer}.coachAthlete:last-child{border-bottom:0}.coachAthlete:hover{background:#1b1b1b}.coachAthlete.selected{background:#281b0e;border-left:3px solid #f58b24;padding-left:8px}.coachAthlete b{display:block;font-size:13px}.coachAthlete span{font-size:10px;color:#888}
      .coachEntryPane{padding:18px 20px 20px;overflow-y:auto;min-width:0}.coachEmpty{border:1px dashed #333;border-radius:12px;padding:24px;color:#777;text-align:center}
      .coachSelectedHead{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:16px}.coachSelectedName{font-size:22px;font-weight:900}.coachSelectedMeta{color:#888;font-size:11px;margin-top:3px}.coachNav{display:flex;gap:7px}.coachNav button{border:1px solid #3b3b3b;background:#181818;color:#ddd;border-radius:9px;padding:7px 9px;cursor:pointer;font-weight:800}.coachNav button:disabled{opacity:.35;cursor:not-allowed}
      .coachGrid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.coachField{display:flex;flex-direction:column;gap:6px}.coachField.full{grid-column:1/-1}.coachField input,.coachField select{width:100%;box-sizing:border-box;background:#181818;color:#eee;border:1px solid #3b3b3b;border-radius:10px;padding:11px 12px;font:700 14px Inter,Arial,sans-serif}
      .coachScoreCards{display:grid;grid-template-columns:1fr 1fr;gap:10px}.coachScoreCard{border:1px solid #333;border-radius:11px;padding:12px;background:#151515}.coachScoreCard span{display:block;color:#888;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px}.coachScoreCard strong{font-size:20px;color:#f59a32}.coachScoreCard small{color:#888;margin-left:5px}
      .coachSave{border:0;border-radius:10px;background:#f58b24;color:#111;font-weight:900;padding:12px 16px;cursor:pointer;min-height:44px}.coachSave:disabled{opacity:.45;cursor:not-allowed}.coachStatus{min-height:20px;font-size:12px;color:#aaa}.coachStatus.good{color:#85efa4}.coachStatus.error{color:#ff8e8e}
      @media(max-width:760px){.coachCard{overflow:auto;max-height:94vh}.coachBody{grid-template-columns:1fr}.coachRosterPane{border-right:0;border-bottom:1px solid #2d2d2d;max-height:310px}.coachRoster{min-height:160px}.coachEntryPane{overflow:visible}.coachGrid,.coachScoreCards{grid-template-columns:1fr}}
    `;
    document.head.appendChild(s);
  }

  function addButton(){
    if(document.querySelector('.coachScoresBtn')||!isCoach(session))return;
    const slot=document.getElementById('googleSignInSlot'); if(!slot)return;
    const b=document.createElement('button'); b.type='button'; b.className='coachScoresBtn'; b.textContent='Coach Scores'; b.onclick=open; slot.appendChild(b);
  }
  function removeButton(){ const b=document.querySelector('.coachScoresBtn'); if(b)b.remove(); }

  function open(){
    if(panel)panel.remove();
    panel=document.createElement('div'); panel.className='coachOverlay';
    panel.innerHTML=`
      <div class="coachCard">
        <div class="coachHead">
          <div><h2>Coach Score Entry</h2><small>Select an athlete, see the previous best, and enter the new seasonal result.</small></div>
          <button class="coachClose" type="button">Close</button>
        </div>
        <div class="coachBody">
          <aside class="coachRosterPane">
            <label>Athletes · alphabetical by last name</label>
            <input id="coachAthleteSearch" class="coachRosterSearch" autocomplete="off" placeholder="Filter athletes">
            <div id="coachRosterCount" class="coachRosterCount"></div>
            <div id="coachRoster" class="coachRoster"></div>
          </aside>
          <main class="coachEntryPane">
            <div id="coachEmpty" class="coachEmpty">Choose an athlete from the alphabetical list.</div>
            <div id="coachEditor" style="display:none">
              <div class="coachSelectedHead">
                <div><div id="coachSelectedName" class="coachSelectedName"></div><div id="coachSelectedMeta" class="coachSelectedMeta"></div></div>
                <div class="coachNav"><button id="coachPrev" type="button">← Prev</button><button id="coachNext" type="button">Next →</button></div>
              </div>
              <div class="coachGrid">
                <div class="coachField"><label>Metric</label><select id="coachMetric">${Object.entries(METRICS).map(([k,v])=>`<option value="${k}">${v[0]}</option>`).join('')}</select></div>
                <div class="coachField"><label>Season</label><select id="coachSeason"><option>Previous Year</option><option selected>Fall</option><option>Winter</option><option>Spring</option><option>Summer</option></select></div>
                <div class="coachField full"><div class="coachScoreCards"><div class="coachScoreCard"><span>Previous Best</span><strong id="coachBest">—</strong><small id="coachBestRating"></small></div><div class="coachScoreCard"><span id="coachCurrentLabel">Current Season</span><strong id="coachCurrent">—</strong></div></div></div>
                <div class="coachField"><label>New score</label><input id="coachNew" type="number" inputmode="decimal"></div>
                <div class="coachField" style="justify-content:end"><button id="coachSave" class="coachSave" type="button" disabled>Save Score</button></div>
                <div class="coachField full"><div id="coachStatus" class="coachStatus"></div></div>
              </div>
            </div>
          </main>
        </div>
      </div>`;

    document.body.appendChild(panel); statusEl=panel.querySelector('#coachStatus');
    panel.querySelector('.coachClose').onclick=()=>{panel.remove();panel=null};
    panel.addEventListener('click',e=>{if(e.target===panel){panel.remove();panel=null}});
    panel.querySelector('#coachAthleteSearch').addEventListener('input',renderRoster);
    panel.querySelector('#coachMetric').onchange=loadContext;
    panel.querySelector('#coachSeason').onchange=loadContext;
    panel.querySelector('#coachNew').oninput=syncStep;
    panel.querySelector('#coachSave').onclick=save;
    panel.querySelector('#coachPrev').onclick=()=>moveSelection(-1);
    panel.querySelector('#coachNext').onclick=()=>moveSelection(1);
    renderRoster(); syncStep();
  }

  function renderRoster(){
    if(!panel)return;
    const q=String(panel.querySelector('#coachAthleteSearch').value||'').trim().toLowerCase();
    const all=athletes();
    const shown=all.filter(a=>{
      if(!q)return true;
      const normal=String(a.name||'').toLowerCase();
      const reverse=rosterLabel(a.name).toLowerCase();
      return normal.includes(q)||reverse.includes(q);
    });
    panel.querySelector('#coachRosterCount').textContent=`${shown.length} athlete${shown.length===1?'':'s'}`;
    const roster=panel.querySelector('#coachRoster');
    roster.innerHTML=shown.map(a=>`<div class="coachAthlete${selected&&selected.id===a.id?' selected':''}" data-id="${esc(a.id)}"><b>${esc(rosterLabel(a.name))}</b><span>${esc(a.year)} · ${esc(a.gender)}</span></div>`).join('')||'<div class="coachAthlete"><span>No matches</span></div>';
    roster.querySelectorAll('[data-id]').forEach(el=>el.onclick=()=>selectAthlete(el.dataset.id));
  }

  function selectAthlete(id){
    selected=athletes().find(a=>a.id===id)||null; if(!selected)return;
    renderRoster();
    panel.querySelector('#coachEmpty').style.display='none';
    panel.querySelector('#coachEditor').style.display='block';
    panel.querySelector('#coachSelectedName').textContent=selected.name;
    panel.querySelector('#coachSelectedMeta').textContent=`${selected.year} · ${selected.gender}`;
    updateNav(); loadContext();
  }

  function moveSelection(delta){
    if(!selected)return;
    const list=athletes(), i=list.findIndex(a=>a.id===selected.id); if(i<0)return;
    const next=Math.max(0,Math.min(list.length-1,i+delta));
    if(next!==i)selectAthlete(list[next].id);
  }

  function updateNav(){
    if(!panel||!selected)return;
    const list=athletes(), i=list.findIndex(a=>a.id===selected.id);
    panel.querySelector('#coachPrev').disabled=i<=0;
    panel.querySelector('#coachNext').disabled=i<0||i>=list.length-1;
  }

  function bestMetric(metric){
    if(!selected)return null;
    const bucket=LIFTS.has(metric)?selected.lifts:selected.tests;
    return bucket&&bucket[metric]?bucket[metric]:null;
  }

  function fmt(metric,value){
    if(value===null||value===undefined||value==='')return '—';
    const n=Number(value); if(!Number.isFinite(n))return String(value);
    if(metric==='med')return n.toFixed(1);
    if(metric==='vert'){const q=Math.round(n*2)/2;return Number.isInteger(q)?String(q):q.toFixed(1)}
    if(metric==='broad'||LIFTS.has(metric))return String(Math.round(n));
    if(metric==='pro'||metric==='dash')return n.toFixed(2);
    return String(n);
  }

  function renderBest(){
    if(!panel||!selected)return;
    const metric=panel.querySelector('#coachMetric').value, def=METRICS[metric], best=bestMetric(metric);
    panel.querySelector('#coachBest').textContent=best&&best.value!=null?`${fmt(metric,best.value)} ${def[1]}`:'—';
    panel.querySelector('#coachBestRating').textContent=best&&best.score!=null?`Score ${Number(best.score).toFixed(1)}/5`:'';
  }

  function syncStep(){ if(!panel)return; const k=panel.querySelector('#coachMetric').value; panel.querySelector('#coachNew').step=METRICS[k][2]; }
  function disableSave(){ if(!panel)return; panel.querySelector('#coachSave').disabled=true; currentValue=null; }
  function setStatus(t,m){ if(!statusEl)return; statusEl.textContent=t||''; statusEl.className='coachStatus'+(m?' '+m:''); }

  async function loadContext(){
    if(!panel||!selected||typeof window.globeAuthPost!=='function'){disableSave();return}
    disableSave();
    const metric=panel.querySelector('#coachMetric').value, season=panel.querySelector('#coachSeason').value;
    renderBest(); syncStep(); setStatus('');
    panel.querySelector('#coachCurrentLabel').textContent=`Current ${season}`;
    panel.querySelector('#coachCurrent').textContent='Loading…';
    try{
      const r=await window.globeAuthPost('coachScoreContext',{athleteId:selected.id,athleteName:selected.name,gender:selected.gender,metric,season});
      if(!r.ok)throw new Error(r.error||'Could not load score.');
      currentValue=r.currentValue;
      panel.querySelector('#coachCurrent').textContent=(r.currentDisplay==null||r.currentDisplay==='')?'blank':`${r.currentDisplay}${r.unit?' '+r.unit:''}`;
      panel.querySelector('#coachNew').value='';
      panel.querySelector('#coachSave').disabled=false;
    }catch(e){panel.querySelector('#coachCurrent').textContent='Unavailable';setStatus(e.message||String(e),'error')}
  }

  function updateLocalBest(metric,value,score){
    if(!selected)return;
    const bucket=LIFTS.has(metric)?selected.lifts:selected.tests;
    if(!bucket)return;
    const old=bucket[metric], timed=METRICS[metric][3];
    if(!old||old.value==null||(timed?Number(value)<Number(old.value):Number(value)>Number(old.value))) bucket[metric]={value:Number(value),score:score==null?null:Number(score)};
  }

  async function save(){
    if(!panel||!selected)return;
    const metric=panel.querySelector('#coachMetric').value, season=panel.querySelector('#coachSeason').value;
    const input=panel.querySelector('#coachNew'), value=Number(input.value);
    if(!Number.isFinite(value)){setStatus('Enter a numeric score.','error');return}
    const label=METRICS[metric][0], old=(currentValue===null||currentValue===''?'blank':currentValue);
    if(!confirm(`Save ${selected.name} · ${label} · ${season}\n${old} → ${value}?`))return;
    panel.querySelector('#coachSave').disabled=true; setStatus('Saving…');
    try{
      const r=await window.globeAuthPost('coachUpdateScore',{athleteId:selected.id,athleteName:selected.name,gender:selected.gender,metric,season,value,expectedCurrent:currentValue});
      if(!r.ok)throw new Error(r.error||'Could not save score.');
      updateLocalBest(metric,r.newValue,r.score); renderBest();
      await loadContext();
      setStatus(`Saved. Spreadsheet updated. Use Next → to move through the roster.`,'good');
    }catch(e){setStatus(e.message||String(e),'error');panel.querySelector('#coachSave').disabled=false}
  }

  function onSession(e){session=e&&e.detail||window.globeCurrentSession||null;if(isCoach(session))addButton();else removeButton();}
  css();
  window.addEventListener('globe-auth-session',onSession);
  setTimeout(()=>onSession({detail:window.globeCurrentSession||null}),500);
})();
