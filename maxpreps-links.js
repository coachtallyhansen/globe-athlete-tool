// External athlete profile links. Verified MaxPreps mappings.
(function(){
  const LINKS={
    'Heber Hansen':'https://www.maxpreps.com/az/globe/globe-tigers/athletes/heber-hansen/?careerid=cl65oa2nfmcbb',
    'Braden Wager':'https://www.maxpreps.com/az/globe/globe-tigers/athletes/braden-wager/?careerid=ebimcd00l7see',
    'Ben Layton':'https://www.maxpreps.com/az/globe/globe-tigers/athletes/ben-layton/?careerid=e2osckvj0m5p9',
    'Corban Bejarano':'https://www.maxpreps.com/az/globe/globe-tigers/athletes/corban-bejarano/?careerid=fm5s59f3a6srb',
    'Reymondo Cassadore':'https://www.maxpreps.com/az/globe/globe-tigers/athletes/reymondo-cassadore/bio/?careerid=bk742d3jl2jl5',
    'Kaden Flores':'https://www.maxpreps.com/az/globe/globe-tigers/athletes/kaden-flores/bio/?careerid=1mdvut10vsr55',
    'Nick Enfield':'https://www.maxpreps.com/az/globe/globe-tigers/athletes/nick-enfield/?careerid=3212j7sdb5j44',
    'Zander Shirey':'https://www.maxpreps.com/az/globe/globe-tigers/athletes/zander-shirey/bio/?careerid=lrshasjgfh533',
    'Greyson Kruger':'https://www.maxpreps.com/az/globe/globe-tigers/athletes/greyson-kruger/?careerid=pohnjnhks25vf',
    'Davien Lagunas':'https://www.maxpreps.com/az/globe/globe-tigers/athletes/davien-lagunas/?careerid=rhcj5255ifqn7',
    'Isaac Iron Shell':'https://www.maxpreps.com/az/globe/globe-tigers/athletes/isaac-iron-shell/bio/?careerid=o6ahafh8pmsh1',
    'Connor Dean':'https://www.maxpreps.com/az/globe/globe-tigers/athletes/connor-dean/?careerid=7mfh9aeuue2g0'
  };

  window.GLOBE_MAXPREPS_LINKS=Object.freeze({...LINKS});
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

