// External athlete profile links. Pilot: Heber Hansen -> MaxPreps.
(function(){
  const LINKS={
    'Heber Hansen':'https://www.maxpreps.com/az/globe/globe-tigers/athletes/heber-hansen/?careerid=cl65oa2nfmcbb'
  };

  function injectStyle(){
    if(document.getElementById('maxprepsLinkStyle'))return;
    const s=document.createElement('style');
    s.id='maxprepsLinkStyle';
    s.textContent=`.externalProfileLinks{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.maxprepsLink{display:inline-flex;align-items:center;gap:6px;border:1px solid #f28c28;border-radius:999px;background:#211508;color:#f6a34d;padding:9px 12px;text-decoration:none;font:900 12px/1 Inter,Arial,sans-serif}.maxprepsLink:hover{background:#2c1b09;color:#ffc078}.maxprepsLink .arrow{font-size:14px}`;
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

  function install(){
    injectStyle();
    render();

    // Render whenever the profile name or profile visibility changes. This is more
    // reliable than depending on one particular openProfile wrapper/load order.
    const nameEl=document.getElementById('pname');
    const profile=document.getElementById('profile');
    if(nameEl){
      new MutationObserver(render).observe(nameEl,{childList:true,subtree:true,characterData:true});
    }
    if(profile){
      new MutationObserver(render).observe(profile,{attributes:true,attributeFilter:['class']});
    }

    document.addEventListener('click',()=>setTimeout(render,0),true);
    window.addEventListener('hashchange',render);
    window.addEventListener('popstate',render);
    window.addEventListener('globe-auth-session',()=>setTimeout(render,0));
    window.addEventListener('globe-primary-sport-changed',()=>setTimeout(render,0));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
