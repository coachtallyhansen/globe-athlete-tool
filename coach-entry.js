// Coach-only score entry UI for V10 preview.
(function(){
  if (!/(^|\/)v10-preview\.html$/i.test(location.pathname)) return;
  let session=null, selected=null, panel=null, statusEl=null, currentValue=null;
  const METRICS={
    med:['Med Ball Toss','ft',0.1], vert:['Vertical Jump','in',0.5], broad:['Broad Jump','in',1],
    pro:['Pro Agility','sec',0.01], dash:['40-Yard Dash','sec',0.01],
    bench:['Bench Press','lb',1], squat:['Back Squat','lb',1], dead:['Deadlift','lb',1], clean:['Clean','lb',1]
  };
  const esc=v=>String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  function athletes(){ return (window.DATA&&Array.isArray(DATA.athletes)?DATA.athletes:[]).slice().sort((a,b)=>a.name.localeCompare(b.name)); }
  function isCoach(s){ return s && /^(coach|admin)$/i.test(String(s.role||'')); }
  function css(){ const s=document.createElement('style'); s.textContent=`
    .coachScoresBtn{border:1px solid #744814;border-radius:999px;background:#24180d;color:#f59a32;padding:8px 11px;font:800 12px/1.1 Inter,Arial,sans-serif;cursor:pointer}
    .coachOverlay{position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:9998;display:grid;place-items:center;padding:20px}.coachCard{width:min(680px,96vw);max-height:90vh;overflow:auto;background:#111;border:1px solid #383838;border-radius:18px;padding:20px;box-shadow:0 30px 80px rgba(0,0,0,.55)}
    .coachHead{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:16px}.coachHead h2{margin:0;font-size:24px}.coachClose{border:0;background:#222;color:#ddd;border-radius:999px;padding:8px 11px;cursor:pointer}.coachGrid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.coachField{display:flex;flex-direction:column;gap:6px}.coachField.full{grid-column:1/-1}.coachField label{font-size:11px;color:#999;font-weight:800;text-transform:uppercase;letter-spacing:.05em}.coachField input,.coachField select{width:100%;box-sizing:border-box;background:#181818;color:#eee;border:1px solid #3b3b3b;border-radius:10px;padding:11px 12px;font:700 14px Inter,Arial,sans-serif}.coachResults{border:1px solid #333;border-radius:10px;overflow:hidden;max-height:220px;overflow-y:auto}.coachResult{padding:10px 12px;border-bottom:1px solid #282828;cursor:pointer}.coachResult:last-child{border-bottom:0}.coachResult:hover{background:#1b1b1b}.coachResult b{display:block}.coachResult span{font-size:11px;color:#999}.coachSelected{padding:11px 12px;background:#171717;border:1px solid #333;border-radius:10px;font-weight:800}.coachCurrent{font-size:14px;color:#bbb}.coachCurrent strong{color:#f59a32}.coachSave{border:0;border-radius:10px;background:#f58b24;color:#111;font-weight:900;padding:12px 16px;cursor:pointer}.coachSave:disabled{opacity:.45;cursor:not-allowed}.coachStatus{min-height:20px;font-size:12px;color:#aaa}.coachStatus.good{color:#85efa4}.coachStatus.error{color:#ff8e8e}@media(max-width:650px){.coachGrid{grid-template-columns:1fr}}
  `; document.head.appendChild(s); }
  function addButton(){
    if(document.querySelector('.coachScoresBtn')||!isCoach(session))return;
    const slot=document.getElementById('googleSignInSlot'); if(!slot)return;
    const b=document.createElement('button'); b.type='button'; b.className='coachScoresBtn'; b.textContent='Coach Scores'; b.onclick=open; slot.appendChild(b);
  }
  function removeButton(){ const b=document.querySelector('.coachScoresBtn'); if(b)b.remove(); }
  function open(){
    if(panel)panel.remove();
    panel=document.createElement('div'); panel.className='coachOverlay';
    panel.innerHTML=`<div class="coachCard"><div class="coachHead"><h2>Coach Score Entry</h2><button class="coachClose" type="button">Close</button></div><div class="coachGrid">
      <div class="coachField full"><label>Athlete</label><input id="coachAthleteSearch" autocomplete="off" placeholder="Search athlete name"><div id="coachResults" class="coachResults" style="display:none"></div><div id="coachSelected" class="coachSelected" style="display:none"></div></div>
      <div class="coachField"><label>Metric</label><select id="coachMetric">${Object.entries(METRICS).map(([k,v])=>`<option value="${k}">${v[0]}</option>`).join('')}</select></div>
      <div class="coachField"><label>Season</label><select id="coachSeason"><option>Previous Year</option><option selected>Fall</option><option>Winter</option><option>Spring</option><option>Summer</option></select></div>
      <div class="coachField full"><div id="coachCurrent" class="coachCurrent">Choose an athlete to load the current score.</div></div>
      <div class="coachField"><label>New score</label><input id="coachNew" type="number" inputmode="decimal"></div>
      <div class="coachField" style="justify-content:end"><button id="coachSave" class="coachSave" type="button" disabled>Save Score</button></div>
      <div class="coachField full"><div id="coachStatus" class="coachStatus"></div></div>
    </div></div>`;
    document.body.appendChild(panel); statusEl=panel.querySelector('#coachStatus');
    panel.querySelector('.coachClose').onclick=()=>{panel.remove();panel=null};
    panel.addEventListener('click',e=>{if(e.target===panel){panel.remove();panel=null}});
    const search=panel.querySelector('#coachAthleteSearch'), results=panel.querySelector('#coachResults');
    search.addEventListener('input',()=>{
      const q=search.value.trim().toLowerCase(); selected=null; panel.querySelector('#coachSelected').style.display='none'; disableSave();
      if(q.length<2){results.style.display='none';return}
      const found=athletes().filter(a=>a.name.toLowerCase().includes(q)).slice(0,12);
      results.innerHTML=found.map(a=>`<div class="coachResult" data-id="${esc(a.id)}"><b>${esc(a.name)}</b><span>${esc(a.year)} · ${esc(a.gender)}</span></div>`).join('')||'<div class="coachResult"><span>No matches</span></div>';
      results.style.display='block';
      results.querySelectorAll('[data-id]').forEach(el=>el.onclick=()=>selectAthlete(el.dataset.id));
    });
    panel.querySelector('#coachMetric').onchange=loadContext; panel.querySelector('#coachSeason').onchange=loadContext; panel.querySelector('#coachNew').oninput=syncStep;
    panel.querySelector('#coachSave').onclick=save;
    syncStep();
  }
  function syncStep(){ if(!panel)return; const k=panel.querySelector('#coachMetric').value; panel.querySelector('#coachNew').step=METRICS[k][2]; }
  function selectAthlete(id){
    selected=athletes().find(a=>a.id===id)||null; if(!selected)return;
    panel.querySelector('#coachResults').style.display='none'; panel.querySelector('#coachAthleteSearch').value='';
    const sel=panel.querySelector('#coachSelected'); sel.textContent=`${selected.name} · ${selected.year} · ${selected.gender}`; sel.style.display='block'; loadContext();
  }
  function disableSave(){ if(!panel)return; panel.querySelector('#coachSave').disabled=true; currentValue=null; }
  function setStatus(t,m){ if(!statusEl)return; statusEl.textContent=t||''; statusEl.className='coachStatus'+(m?' '+m:''); }
  async function loadContext(){
    if(!panel||!selected||typeof window.globeAuthPost!=='function'){disableSave();return}
    disableSave(); const metric=panel.querySelector('#coachMetric').value, season=panel.querySelector('#coachSeason').value;
    panel.querySelector('#coachCurrent').textContent='Loading current score…'; setStatus(''); syncStep();
    try{
      const r=await window.globeAuthPost('coachScoreContext',{athleteId:selected.id,athleteName:selected.name,gender:selected.gender,metric,season});
      if(!r.ok)throw new Error(r.error||'Could not load score.'); currentValue=r.currentValue;
      panel.querySelector('#coachCurrent').innerHTML=`Current ${esc(season)} ${esc(r.metricLabel)}: <strong>${r.currentDisplay==null||r.currentDisplay===''?'blank':esc(r.currentDisplay)}${r.unit?' '+esc(r.unit):''}</strong>`;
      panel.querySelector('#coachNew').value=''; panel.querySelector('#coachSave').disabled=false;
    }catch(e){panel.querySelector('#coachCurrent').textContent='Could not load current score.';setStatus(e.message||String(e),'error')}
  }
  async function save(){
    if(!panel||!selected)return; const metric=panel.querySelector('#coachMetric').value, season=panel.querySelector('#coachSeason').value;
    const input=panel.querySelector('#coachNew'), value=Number(input.value); if(!Number.isFinite(value)){setStatus('Enter a numeric score.','error');return}
    const label=METRICS[metric][0], old=(currentValue===null||currentValue===''?'blank':currentValue);
    if(!confirm(`Save ${selected.name} · ${label} · ${season}\n${old} → ${value}?`))return;
    panel.querySelector('#coachSave').disabled=true; setStatus('Saving…');
    try{
      const r=await window.globeAuthPost('coachUpdateScore',{athleteId:selected.id,athleteName:selected.name,gender:selected.gender,metric,season,value,expectedCurrent:currentValue});
      if(!r.ok)throw new Error(r.error||'Could not save score.');
      setStatus(`Saved ${r.athleteName}: ${r.metricLabel} ${r.season} = ${r.newValue}${r.unit?' '+r.unit:''}.`,'good');
      await loadContext(); setStatus(`Saved. Spreadsheet updated and live rankings will refresh automatically.`,'good');
    }catch(e){setStatus(e.message||String(e),'error'); panel.querySelector('#coachSave').disabled=false}
  }
  function onSession(e){ session=e&&e.detail||window.globeCurrentSession||null; if(isCoach(session))addButton(); else removeButton(); }
  css(); window.addEventListener('globe-auth-session',onSession); setTimeout(()=>onSession({detail:window.globeCurrentSession||null}),500);
})();
