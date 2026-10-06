// Student score submission UI for preview and permanent site. Submissions require coach approval.
(function(){
  const page=(location.pathname.split('/').pop()||'index.html').toLowerCase();
  if (!['index.html','v10-preview.html'].includes(page)) return;

  let session=null, panel=null, statusEl=null;
  const METRICS={
    med:['Med Ball Toss','ft',0.1], vert:['Vertical Jump','in',0.5], broad:['Broad Jump','in',1],
    pro:['Pro Agility','sec',0.01], dash:['40-Yard Dash','sec',0.01],
    bench:['Bench Press','lb',1], squat:['Back Squat','lb',1], dead:['Deadlift','lb',1], clean:['Clean','lb',1]
  };
  const esc=v=>String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const isStudent=s=>s&&/^student$/i.test(String(s.role||''))&&s.athlete;

  function css(){
    const s=document.createElement('style');
    s.textContent=`
      .studentSubmitBtn{border:1px solid #2c6850;border-radius:999px;background:#10231c;color:#8cf0aa;padding:8px 11px;font:800 12px/1.1 Inter,Arial,sans-serif;cursor:pointer}
      .studentScoreOverlay{position:fixed;inset:0;background:rgba(0,0,0,.74);z-index:9999;display:grid;place-items:center;padding:18px}
      .studentScoreCard{width:min(700px,97vw);max-height:92vh;overflow:auto;background:#111;border:1px solid #383838;border-radius:18px;padding:20px;box-shadow:0 30px 80px rgba(0,0,0,.55)}
      .studentScoreHead{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;margin-bottom:16px}.studentScoreHead h2{margin:0;font-size:24px}.studentScoreHead small{display:block;color:#888;margin-top:4px}.studentScoreClose{border:0;background:#222;color:#ddd;border-radius:999px;padding:8px 11px;cursor:pointer}
      .studentNotice{border:1px solid #2b493b;background:#102018;border-radius:11px;padding:10px 12px;color:#9ddfb7;font-size:12px;margin-bottom:14px}
      .studentScoreGrid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.studentField{display:flex;flex-direction:column;gap:6px}.studentField.full{grid-column:1/-1}.studentField label{font-size:11px;color:#999;font-weight:800;text-transform:uppercase;letter-spacing:.05em}.studentField input,.studentField select{width:100%;box-sizing:border-box;background:#181818;color:#eee;border:1px solid #3b3b3b;border-radius:10px;padding:11px 12px;font:700 14px Inter,Arial,sans-serif}
      .studentScoreCards{display:grid;grid-template-columns:1fr 1fr;gap:10px}.studentMiniCard{border:1px solid #333;border-radius:11px;padding:12px;background:#151515}.studentMiniCard span{display:block;color:#888;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px}.studentMiniCard strong{font-size:20px;color:#8cf0aa}.studentSubmitSave{border:0;border-radius:10px;background:#8cf0aa;color:#0d1511;font-weight:900;padding:12px 16px;cursor:pointer;min-height:44px}.studentSubmitSave:disabled{opacity:.45;cursor:not-allowed}.studentSubmitStatus{min-height:20px;font-size:12px;color:#aaa}.studentSubmitStatus.good{color:#85efa4}.studentSubmitStatus.error{color:#ff8e8e}
      .studentRecent{margin-top:18px;border-top:1px solid #2b2b2b;padding-top:14px}.studentRecent h3{margin:0 0 9px;font-size:14px}.studentRecentRow{display:grid;grid-template-columns:1fr auto;gap:10px;padding:9px 0;border-bottom:1px solid #242424;font-size:12px}.studentRecentRow:last-child{border-bottom:0}.studentRecentMeta{color:#888;font-size:10px;margin-top:3px}.studentStatus{font-weight:900}.studentStatus.Pending{color:#f2c66d}.studentStatus.Approved{color:#85efa4}.studentStatus.Rejected{color:#ff8e8e}
      @media(max-width:650px){.studentScoreGrid,.studentScoreCards{grid-template-columns:1fr}}
    `;
    document.head.appendChild(s);
  }

  function addButton(){
    if(document.querySelector('.studentSubmitBtn')||!isStudent(session))return;
    const slot=document.getElementById('googleSignInSlot'); if(!slot)return;
    const b=document.createElement('button'); b.type='button'; b.className='studentSubmitBtn'; b.textContent='Submit Score'; b.onclick=open; slot.appendChild(b);
  }
  function removeButton(){const b=document.querySelector('.studentSubmitBtn');if(b)b.remove();}

  function open(){
    if(!isStudent(session))return;
    if(panel)panel.remove();
    panel=document.createElement('div'); panel.className='studentScoreOverlay';
    panel.innerHTML=`<div class="studentScoreCard">
      <div class="studentScoreHead"><div><h2>Submit a Score</h2><small>${esc(session.athlete.name)} · ${esc(session.athlete.year)} · ${esc(session.athlete.gender)}</small></div><button class="studentScoreClose" type="button">Close</button></div>
      <div class="studentNotice">Your submission will be marked <b>Pending</b>. It will not become an official score until a coach approves it.</div>
      <div class="studentScoreGrid">
        <div class="studentField"><label>Metric</label><select id="studentMetric">${Object.entries(METRICS).map(([k,v])=>`<option value="${k}">${v[0]}</option>`).join('')}</select></div>
        <div class="studentField"><label>Season</label><select id="studentSeason"><option>Previous Year</option><option selected>Fall</option><option>Winter</option><option>Spring</option><option>Summer</option></select></div>
        <div class="studentField full"><div class="studentScoreCards"><div class="studentMiniCard"><span>Official Best</span><strong id="studentBest">—</strong></div><div class="studentMiniCard"><span id="studentCurrentLabel">Current Fall</span><strong id="studentCurrent">—</strong></div></div></div>
        <div class="studentField"><label>New score to submit</label><input id="studentNew" type="number" inputmode="decimal"></div>
        <div class="studentField" style="justify-content:end"><button id="studentSubmitSave" class="studentSubmitSave" type="button" disabled>Submit for Approval</button></div>
        <div class="studentField full"><div id="studentSubmitStatus" class="studentSubmitStatus"></div></div>
      </div>
      <div class="studentRecent"><h3>My Recent Submissions</h3><div id="studentRecentList" class="studentSubmitStatus">Loading…</div></div>
    </div>`;
    document.body.appendChild(panel); statusEl=panel.querySelector('#studentSubmitStatus');
    panel.querySelector('.studentScoreClose').onclick=close;
    panel.addEventListener('click',e=>{if(e.target===panel)close()});
    panel.querySelector('#studentMetric').onchange=loadContext;
    panel.querySelector('#studentSeason').onchange=loadContext;
    panel.querySelector('#studentSubmitSave').onclick=submit;
    loadContext(); loadRecent();
  }
  function close(){if(panel)panel.remove();panel=null;statusEl=null;}
  function setStatus(t,m){if(!statusEl)return;statusEl.textContent=t||'';statusEl.className='studentSubmitStatus'+(m?' '+m:'');}
  function fmt(value,unit){return value===null||value===undefined||value===''?'—':`${value}${unit?' '+unit:''}`;}
  function syncStep(){if(!panel)return;const k=panel.querySelector('#studentMetric').value;panel.querySelector('#studentNew').step=METRICS[k][2];}

  async function loadContext(){
    if(!panel||typeof window.globeAuthPost!=='function')return;
    const metric=panel.querySelector('#studentMetric').value, season=panel.querySelector('#studentSeason').value;
    syncStep(); setStatus(''); panel.querySelector('#studentSubmitSave').disabled=true;
    panel.querySelector('#studentCurrentLabel').textContent=`Current ${season}`;
    panel.querySelector('#studentCurrent').textContent='Loading…'; panel.querySelector('#studentBest').textContent='Loading…';
    try{
      const r=await window.globeAuthPost('studentScoreContext',{metric,season});
      if(!r.ok)throw new Error(r.error||'Could not load your score information.');
      panel.querySelector('#studentCurrent').textContent=fmt(r.currentDisplay,r.unit);
      panel.querySelector('#studentBest').textContent=r.previousBest&&r.previousBest.value!=null?fmt(r.previousBest.value,r.unit):'—';
      panel.querySelector('#studentNew').value=''; panel.querySelector('#studentSubmitSave').disabled=false;
    }catch(e){panel.querySelector('#studentCurrent').textContent='Unavailable';panel.querySelector('#studentBest').textContent='Unavailable';setStatus(e.message||String(e),'error');}
  }

  async function submit(){
    if(!panel)return;
    const metric=panel.querySelector('#studentMetric').value, season=panel.querySelector('#studentSeason').value;
    const input=panel.querySelector('#studentNew'), value=Number(input.value);
    if(!Number.isFinite(value)){setStatus('Enter a numeric score.','error');return;}
    const label=METRICS[metric][0];
    if(!confirm(`Submit ${label} · ${season} · ${value} for coach approval?`))return;
    panel.querySelector('#studentSubmitSave').disabled=true; setStatus('Submitting…');
    try{
      const r=await window.globeAuthPost('studentSubmitScore',{metric,season,value});
      if(!r.ok)throw new Error(r.error||'Could not submit score.');
      input.value=''; setStatus('Submitted. Your score is pending coach approval.','good');
      await loadRecent();
    }catch(e){setStatus(e.message||String(e),'error');panel.querySelector('#studentSubmitSave').disabled=false;}
  }

  async function loadRecent(){
    if(!panel||typeof window.globeAuthPost!=='function')return;
    const holder=panel.querySelector('#studentRecentList');
    try{
      const r=await window.globeAuthPost('studentMySubmissions');
      if(!r.ok)throw new Error(r.error||'Could not load submissions.');
      const list=Array.isArray(r.submissions)?r.submissions:[];
      holder.innerHTML=list.length?list.map(x=>`<div class="studentRecentRow"><div><b>${esc(x.metricLabel)} · ${esc(x.season)} · ${esc(x.value)}</b><div class="studentRecentMeta">${x.submittedAt?new Date(x.submittedAt).toLocaleString():''}${x.reviewNote?` · ${esc(x.reviewNote)}`:''}</div></div><div class="studentStatus ${esc(x.status)}">${esc(x.status)}</div></div>`).join(''):'No submissions yet.';
    }catch(e){holder.textContent=e.message||String(e);}
  }

  function onSession(e){session=e&&e.detail||window.globeCurrentSession||null;if(isStudent(session))addButton();else removeButton();}
  css(); window.addEventListener('globe-auth-session',onSession); setTimeout(()=>onSession({detail:window.globeCurrentSession||null}),500);
})();