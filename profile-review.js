// Coach-only review view. Audit operations never submit or change scores.
(function(){
  let panel=null,session=null,rows=[],privateResult=null;
  const allowed=()=>session&&/^(coach|admin)$/i.test(session.role||'');
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function close(){panel?.remove();panel=null;rows=[];privateResult=null;}
  async function loadScript(src){if(window.GlobeProfileReview&&src==='profile-review-core.js')return;await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(new Error('Review assets could not load. Reload and try again.'));document.head.appendChild(s);});}
  function render(){
    if(!panel||!allowed())return;
    const query=panel.querySelector('input').value.toLowerCase(),flag=panel.querySelector('select').value;
    const shown=rows.filter(r=>(!query||r.name.toLowerCase().includes(query))&&(!flag||r.flags.includes(flag)));
    panel.querySelector('[data-count]').textContent=`${shown.length} of ${rows.length} athletes · ${window.globeReviewDataSource||'Bundled snapshot — live sport assignments may be incomplete'}`;
    panel.querySelector('[data-list]').innerHTML=shown.map(r=>`<article><h3><button data-profile="${esc(r.id)}">${esc(r.name)}</button> <small>${esc(r.year)} · ${esc(r.gender)}</small></h3><p>${r.flags.map(f=>`<span class="reviewFlag">${esc(f)}</span>`).join(' ')||'No issues detected by these checks.'}</p><p>Primary sport: ${esc(r.primary||'Not selected')} · Roster sports: ${esc(r.sports.join(', ')||'None listed')}</p>${r.missing.length?`<p>Missing tests: ${esc(r.missing.join(', '))}</p>`:''}${r.suspicious.length?`<p>Check recorded values/stars: ${esc(r.suspicious.join(', '))}</p>`:''}<details><summary>${r.candidates.length} photo candidate(s) · filename matches need crop review</summary>${r.candidates.map(f=>`<p><a href="https://drive.google.com/file/d/${encodeURIComponent(f.id)}/view" target="_blank" rel="noopener noreferrer">${esc(f.name)}</a> · ${esc(f.sport)} · ${esc(f.season)}</p>`).join('')||'<p>No exact filename match. Names with different spelling, punctuation, or nicknames require manual review.</p>'}</details></article>`).join('');
    panel.querySelectorAll('article').forEach((article,i)=>{const leads=shown[i].nameCandidates;if(!leads.length)return;const d=document.createElement('details'),s=document.createElement('summary');s.textContent='Possible name mismatches — manual review only';d.appendChild(s);leads.forEach(f=>{const p=document.createElement('p'),a=document.createElement('a');a.href='https://drive.google.com/file/d/'+encodeURIComponent(f.id)+'/view';a.target='_blank';a.rel='noopener noreferrer';a.textContent=f.name+' · '+f.sport+' · '+f.season;p.appendChild(a);d.appendChild(p);});article.appendChild(d);});
    panel.querySelectorAll('[data-profile]').forEach(b=>b.onclick=()=>{const id=b.dataset.profile;close();window.openProfile(id);});
  }
  async function open(){
    if(!allowed())return;
    close();panel=document.createElement('dialog');panel.className='profileReview';panel.setAttribute('aria-label','Athlete Profile Review');
    panel.innerHTML=`<header><h2>Athlete Profile Review</h2><button data-close>Close</button></header><p>Read-only checks. Current-year photos first, 2025–26 fallback. No automatic name guesses or score changes.</p><p><strong>Batch 1:</strong> review workflow implemented · browser testing pending · user testing pending. Photo candidates have not been published.</p><p data-state role="status">Loading review…</p><p data-private>Account links: not checked.</p><label>Find athlete <input type="search" placeholder="Search review by name"></label> <label>Issue <select><option value="">All athletes</option></select></label><p data-count></p><div data-list></div>`;
    document.body.appendChild(panel);panel.showModal();panel.querySelector('[data-close]').onclick=close;panel.addEventListener('cancel',close);
    try{
      await loadScript('profile-review-core.js');await loadScript('athlete-data/photo-review-sources.js');
      if(!panel||!allowed())return;
      rows=window.GlobeProfileReview.audit(DATA.athletes,window.GLOBE_PHOTO_REVIEW_SOURCES.files,window.ATHLETE_PHOTOS||{},window.GLOBE_MAXPREPS_LINKS||{});
      const options=[...new Set(rows.flatMap(r=>r.flags))].sort();
      options.forEach(f=>{const o=document.createElement('option');o.value=f;o.textContent=f;panel.querySelector('select').appendChild(o);});
      panel.querySelector('input').oninput=render;panel.querySelector('select').onchange=render;
      panel.querySelector('[data-state]').textContent='Checks flag records for review; they do not establish that a record is wrong. A missing public test may also reflect a value filtered by the live service.';
      render();
      try{privateResult=await window.globeAuthPost('coachProfileReview');if(!panel||!allowed())return;if(!privateResult.ok)throw new Error(privateResult.error||'Review endpoint unavailable');
        const target=panel.querySelector('[data-private]');target.textContent=`Account links: ${privateResult.accountsChecked} checked; ${privateResult.issues.length} issue(s). `;
        privateResult.issues.forEach(issue=>{const p=document.createElement('p');p.textContent=`Account row ${issue.row}: ${issue.type} — ${issue.athleteName||'(no athlete name)'}`;target.appendChild(p);});
      }catch(e){if(panel)panel.querySelector('[data-private]').textContent='Account links: NOT CHECKED. The coach review service must be deployed before this check is available.';}
    }catch(e){if(panel)panel.querySelector('[data-state]').textContent=e.message;}
  }
  const style=document.createElement('style');style.textContent='.profileReview{color:#eee;background:#111;border:1px solid #444;border-radius:18px;width:min(960px,95vw);max-height:90vh;padding:22px}.profileReview::backdrop{background:#000b}.profileReview header{display:flex;justify-content:space-between;gap:12px;align-items:center}.profileReview h2{margin:0}.profileReview p{line-height:1.5;color:#bbb}.profileReview article{border-top:1px solid #444;padding:12px 0}.profileReview h3{margin:8px 0}.profileReview small{font-weight:400;color:#aaa}.profileReview a{color:#f5a34d}.reviewFlag{display:inline-block;border:1px solid #73512f;color:#ffc282;border-radius:6px;padding:3px 6px;margin:2px}.profileReview input{max-width:100%}@media(max-width:650px){.profileReview label{display:block;margin:10px 0}.profileReview{padding:14px}}';document.head.appendChild(style);
  function onSession(e){session=e?.detail||window.globeCurrentSession||null;document.querySelector('[data-review-button]')?.remove();if(!allowed()){close();return;}const slot=document.getElementById('googleSignInSlot');if(!slot)return;const b=document.createElement('button');b.type='button';b.dataset.reviewButton='1';b.textContent='Profile Review';b.onclick=open;slot.appendChild(b);}
  window.addEventListener('globe-auth-session',onSession);onSession();
})();

