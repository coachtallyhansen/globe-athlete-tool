// External athlete profile links. Pilot: Heber Hansen -> MaxPreps.
(function(){
  const LINKS={
    'Heber Hansen':'https://www.maxpreps.com/az/globe/globe-tigers/athletes/heber-hansen/?careerid=cl65oa2nfmcbb'
  };

  function injectStyle(){
    if(document.getElementById('maxprepsLinkStyle'))return;
    const s=document.createElement('style');
    s.id='maxprepsLinkStyle';
    s.textContent=`.externalProfileLinks{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.maxprepsLink{display:inline-flex;align-items:center;gap:6px;border:1px solid #4b4b4b;border-radius:999px;background:#171717;color:#f2f2f2;padding:8px 11px;text-decoration:none;font:850 12px/1 Inter,Arial,sans-serif}.maxprepsLink:hover{border-color:#f28c28;color:#f28c28}.maxprepsLink .arrow{font-size:14px}`;
    document.head.appendChild(s);
  }

  function render(){
    const profile=document.getElementById('profile');
    const nameEl=document.getElementById('pname');
    const sports=document.getElementById('sports');
    if(!profile||!nameEl||!sports)return;
    let holder=document.getElementById('externalProfileLinks');
    if(!holder){
      holder=document.createElement('div');
      holder.id='externalProfileLinks';
      holder.className='externalProfileLinks';
      sports.insertAdjacentElement('afterend',holder);
    }
    const name=String(nameEl.textContent||'').trim();
    const url=LINKS[name];
    holder.innerHTML=url?`<a class="maxprepsLink" href="${url}" target="_blank" rel="noopener noreferrer" aria-label="Open ${name} on MaxPreps">MaxPreps Profile <span class="arrow">↗</span></a>`:'';
    holder.style.display=url?'flex':'none';
  }

  injectStyle();
  const oldOpen=window.openProfile;
  if(typeof oldOpen==='function'){
    window.openProfile=function(id){oldOpen(id);setTimeout(render,0);};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render,{once:true});else render();
})();