window.ATHLETE_CHUNKS=window.ATHLETE_CHUNKS||[];window.ATHLETE_CHUNKS.push(...[["female-132","Stella Graham","Fr","Female",2.5,5.0,1.0,1.5,"3.5–4.0",210,0,[],4.9,1.0,9.5,1.0,44.0,1.0,7.6,1.0,8.73,1.0,40.0,1.0,65.0,2.0,105.0,2.0,35.0,1.0]]);

// V10 photo-preview enhancement: exact filename matches only.
window.addEventListener('DOMContentLoaded',()=>{
  const css=document.createElement('style');
  css.textContent=`.heroPhoto{aspect-ratio:10/7;max-width:680px;margin:16px auto 24px;border-radius:22px;overflow:hidden;position:relative;background:#101010;border:1px solid #292929;box-shadow:0 22px 55px rgba(0,0,0,.32);background-repeat:no-repeat}.heroPhoto .photoEmpty{position:absolute;inset:0;display:grid;place-items:center;text-align:center;color:#707070}.photoEmpty b{display:block;font-size:48px;color:#454545;letter-spacing:.04em}.photoEmpty small{display:block;margin-top:8px;letter-spacing:.12em;font-size:10px}.photoSport{position:absolute;right:14px;bottom:12px;padding:6px 10px;border-radius:999px;background:rgba(0,0,0,.68);border:1px solid rgba(255,255,255,.2);font-size:11px;font-weight:800;letter-spacing:.06em;color:#eee}@media(max-width:650px){.heroPhoto{width:100%}}`;
  document.head.appendChild(css);
  const head=document.querySelector('#profile .profileHead');
  if(!head)return;
  const hero=document.createElement('div');hero.id='heroPhoto';hero.className='heroPhoto';head.after(hero);
  const initials=n=>n.split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase();
  let assetsReady=false;
  let primarySportByName={};
  function renderName(name){
    if(!name)return;
    const primary=primarySportByName[name]||'';
    if(name==='Heber Hansen' && (primary==='⚽' || primary==='Soccer')){
      hero.innerHTML='<span class="photoSport">Soccer</span>';
      hero.style.backgroundImage='linear-gradient(to bottom,rgba(0,0,0,0) 58%,rgba(9,9,9,.68) 100%),url("athlete-data/heber-soccer.webp?v=1")';
      hero.style.backgroundSize='100% 100%,cover';
      hero.style.backgroundPosition='center,center';
      return;
    }
    const p=window.ATHLETE_PHOTOS?.[name];
    if(p&&window.ATHLETE_PHOTO_SPRITE){
      const x=p.col*25, y=p.row*(100/7);
      hero.innerHTML=`<span class="photoSport">${p.sport}</span>`;
      hero.style.backgroundImage=`linear-gradient(to bottom,rgba(0,0,0,0) 58%,rgba(9,9,9,.68) 100%),url("${window.ATHLETE_PHOTO_SPRITE}")`;
      hero.style.backgroundSize='100% 100%,500% 800%';
      hero.style.backgroundPosition=`center,${x}% ${y}%`;
    }else{
      hero.style.backgroundImage='none';
      hero.style.backgroundSize='auto';
      hero.style.backgroundPosition='center';
      hero.innerHTML=`<div class="photoEmpty"><div><b>${initials(name)}</b><small>${assetsReady?'PHOTO COMING SOON':'LOADING PHOTO'}</small></div></div>`;
    }
  }
  const oldOpen=window.openProfile;
  window.openProfile=function(id){oldOpen(id);renderName(document.getElementById('pname').textContent);};
  window.addEventListener('globe-primary-sport-changed',e=>{
    const d=e&&e.detail||{};
    const name=document.getElementById('pname')?.textContent||'';
    if(name){primarySportByName[name]=d.primarySportIcon||d.primarySport||'';renderName(name);}
  });
  async function loadAssets(){
    try{
      await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='athlete-data/photo-map.js?v=3';s.onload=resolve;s.onerror=reject;document.head.appendChild(s)});
      const b64=await fetch('athlete-data/photo-sprite-tiny.b64?v=1',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('photo sprite');return r.text()});
      window.ATHLETE_PHOTO_SPRITE='data:image/webp;base64,'+b64.trim();
      assetsReady=true;
    }catch(e){assetsReady=true;console.warn('Athlete photos unavailable',e)}
    if(!document.getElementById('profile').classList.contains('hide'))renderName(document.getElementById('pname').textContent);
  }
  loadAssets();
});

// Load live Sheet sync, login, then coach score-entry preview tools.
window.addEventListener('DOMContentLoaded',()=>{
  const live=document.createElement('script');
  live.src='live-data.js?v=4';
  live.async=true;
  live.onload=()=>{
    const debug=document.createElement('script');
    debug.src='auth-debug.js?v=2';
    debug.async=true;
    debug.onload=()=>{
      const auth=document.createElement('script');
      auth.src='auth.js?v=4';
      auth.async=true;
      auth.onload=()=>{
        const coach=document.createElement('script');
        coach.src='coach-entry.js?v=2';
        coach.async=true;
        document.head.appendChild(coach);
      };
      document.head.appendChild(auth);
    };
    document.head.appendChild(debug);
  };
  document.head.appendChild(live);
});