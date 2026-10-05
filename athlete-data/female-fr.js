window.ATHLETE_CHUNKS=window.ATHLETE_CHUNKS||[];window.ATHLETE_CHUNKS.push(...[["female-132","Stella Graham","Fr","Female",2.5,5.0,1.0,1.5,"3.5–4.0",210,0,[],4.9,1.0,9.5,1.0,44.0,1.0,7.6,1.0,8.73,1.0,40.0,1.0,65.0,2.0,105.0,2.0,35.0,1.0]]);

// V10 photo-preview enhancement. Runs after the page scripts finish loading.
window.addEventListener('DOMContentLoaded',()=>{
  const css=document.createElement('style');
  css.textContent=`.heroPhoto{height:410px;max-width:680px;margin:16px auto 24px;border-radius:22px;overflow:hidden;position:relative;background:#101010;border:1px solid #292929;box-shadow:0 22px 55px rgba(0,0,0,.32)}.heroPhoto:after{content:'';position:absolute;inset:0;background:linear-gradient(to bottom,rgba(0,0,0,0) 58%,rgba(9,9,9,.72) 100%);pointer-events:none}.heroPhoto img{width:100%;height:100%;object-fit:cover;object-position:center 18%;display:block}.heroPhoto .photoEmpty{position:absolute;inset:0;display:grid;place-items:center;text-align:center;color:#707070}.photoEmpty b{display:block;font-size:48px;color:#454545;letter-spacing:.04em}.photoEmpty small{display:block;margin-top:8px;letter-spacing:.12em;font-size:10px}@media(max-width:650px){.heroPhoto{height:350px}}`;
  document.head.appendChild(css);
  const head=document.querySelector('#profile .profileHead');
  if(!head)return;
  const hero=document.createElement('div');hero.id='heroPhoto';hero.className='heroPhoto';head.after(hero);
  const photoMap={};
  const initials=n=>n.split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase();
  const renderName=name=>{if(!name)return;const src=photoMap[name];hero.innerHTML=src?`<img src="${src}" alt="${name} athlete photo">`:`<div class="photoEmpty"><div><b>${initials(name)}</b><small>PHOTO COMING SOON</small></div></div>`;};
  const oldOpen=window.openProfile;
  window.openProfile=function(id){oldOpen(id);renderName(document.getElementById('pname').textContent);};
  fetch('index.html',{cache:'no-store'}).then(r=>r.text()).then(t=>{
    ['Heber Hansen','Olive Hansen'].forEach(name=>{
      const safe=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      const m=t.match(new RegExp("'"+safe+"'\\s*:\\s*\\{[\\s\\S]*?photo:'([^']+)'"));
      if(m)photoMap[name]=m[1];
    });
    if(!document.getElementById('profile').classList.contains('hide'))renderName(document.getElementById('pname').textContent);
  }).catch(()=>{});
});
