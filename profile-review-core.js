// Read-only audit rules shared by the coach review panel and offline audit.
(function(root){
  'use strict';
  const norm = s => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
  function filenameName(filename){
    const stem=String(filename||'').replace(/\.(jpe?g|png|webp)$/i,'').trim();
    const parts=stem.split(',').map(x=>x.trim());
    return parts.length===2 && parts.every(Boolean) ? parts[1]+' '+parts[0] : stem;
  }
  const sport = s => ({'🏈':'Football','🏐':'Volleyball','🏃':'Cross Country','🏊':'Swim','📣':'Cheer','⚽':'Soccer','👟':'Track & Field','🏀':'Basketball','🤼':'Wrestling','⚾':'Baseball','🥎':'Softball','🎾':'Tennis','⛳':'Golf','🎮':'Esports','💃':'Pom','Track':'Track & Field','Boys Soccer':'Soccer','Girls Soccer':'Soccer','Boys Basketball':'Basketball','Girls Basketball':'Basketball'}[s]||s);
  function candidates(a, files){return files.filter(f=>/^image\//.test(f.mime||'') && norm(filenameName(f.name))===norm(a.name));}
  function audit(athletes, files, legacy, links){
    const names=new Map(), ids=new Map();
    athletes.forEach(a=>{names.set(norm(a.name),(names.get(norm(a.name))||0)+1);ids.set(a.id,(ids.get(a.id)||0)+1);});
    return athletes.map(a=>{
      const flags=[], matches=candidates(a,files),current=matches.filter(f=>f.season==='2026-27'),older=matches.filter(f=>f.season==='2025-26');
      const parts=norm(a.name).split(' ');
      // Leads for manual review only; never eligible for photo selection.
      const nameCandidates=matches.length?[]:files.filter(f=>{const p=norm(filenameName(f.name)).split(' ');return /^image\//.test(f.mime||'')&&p.length>1&&parts.length>1&&p.at(-1)===parts.at(-1)&&p[0][0]===parts[0][0];});
      if(nameCandidates.length)flags.push('Possible filename/name mismatch');
      const sports=(a.sports||[]).map(sport), primary=sport(a.primarySportIcon||a.primarySport||'');
      const preferred=current.length?current:older;
      const ambiguous=preferred.some(f=>preferred.filter(g=>sport(g.sport)===sport(f.sport)).length>1);
      if(!current.length&&!older.length&&!legacy[a.name])flags.push('Missing photo');
      if(!current.length&&older.length)flags.push('Older photo only');
      if(!current.length&&!older.length&&legacy[a.name])flags.push('Legacy photo year unverified');
      if(ambiguous)flags.push('Multiple photo matches');
      if(names.get(norm(a.name))>1||ids.get(a.id)>1)flags.push('Duplicate athlete record');
      if(!sports.length)flags.push('No sports listed');
      if(primary&&!sports.includes(primary))flags.push('Primary sport not on roster');
      if(primary&&!matches.some(f=>sport(f.sport)===primary))flags.push('Missing primary sport photo');
      if(matches.some(f=>!sports.includes(sport(f.sport))))flags.push('Photo sport not on roster');
      if(!links[a.name])flags.push('Missing MaxPreps link');
      const metrics={...(a.tests||{}),...(a.lifts||{})};
      const missing=['med','vert','broad','pro','dash','bench','squat','dead','clean'].filter(k=>metrics[k]?.value==null);
      if(missing.length)flags.push('Missing test data');
      const suspicious=Object.entries(metrics).filter(([,m])=>m && (!Number.isFinite(Number(m.value))||Number(m.value)<=0||m.score!=null&&(!Number.isFinite(Number(m.score))||Number(m.score)<0||Number(m.score)>5))).map(([k])=>k);
      if(suspicious.length)flags.push('Suspicious test data');
      if(preferred.length&&!ambiguous)flags.push('Photo crop pending review');
      return {id:a.id,name:a.name,year:a.year,gender:a.gender,flags,primary,sports,missing,suspicious,candidates:matches,nameCandidates,preferredSeason:current.length?'2026-27':older.length?'2025-26':null};
    });
  }
  const api={norm,filenameName,sport,candidates,audit};
  if(typeof module!=='undefined')module.exports=api;else root.GlobeProfileReview=api;
})(typeof window!=='undefined'?window:globalThis);

