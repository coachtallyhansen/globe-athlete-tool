const fs=require('node:fs'),vm=require('node:vm');
const rules=require('../profile-review-core.js');
const context={window:{ATHLETE_CHUNKS:[],addEventListener(){}},document:{}};
vm.createContext(context);
for(const f of fs.readdirSync('athlete-data').filter(f=>/^(fe)?male-.*\.js$/.test(f)))vm.runInContext(fs.readFileSync('athlete-data/'+f,'utf8'),context);
vm.runInContext(fs.readFileSync('athlete-data/photo-map.js','utf8'),context);
const keys=['med','vert','broad','pro','dash','bench','squat','dead','clean'];
const bundled=context.window.ATHLETE_CHUNKS.map(r=>{const tests={},lifts={};keys.forEach((k,i)=>{if(r[12+i*2]!=null)(i<5?tests:lifts)[k]={value:r[12+i*2],score:r[13+i*2]};});return{id:r[0],name:r[1],year:r[2],gender:r[3],sports:r[11]||[],tests,lifts};});
const live=fs.existsSync('live-review-snapshot.json')?JSON.parse(fs.readFileSync('live-review-snapshot.json','utf8')):null;
if(live&&(!live.ok||!Array.isArray(live.athletes)))throw Error('Invalid live feed; refusing to audit it');
const athletes=live?live.athletes:bundled;
const inventory=JSON.parse(fs.readFileSync('photo-source-inventory.json','utf8'));
const linkSource=fs.readFileSync('maxpreps-links.js','utf8');
const links=Object.fromEntries([...linkSource.matchAll(/'([^']+)':'(https:\/\/www\.maxpreps[^']+)'/g)].map(m=>[m[1],m[2]]));
const report=rules.audit(athletes,inventory.files,context.window.ATHLETE_PHOTOS,links);
// Only roster-linked candidates ship; unmatched source filenames stay local.
const ids=new Set(report.flatMap(r=>[...r.candidates,...r.nameCandidates].map(f=>f.id)));
const shipped={generatedAt:new Date().toISOString(),preferredSeason:'2026-27',fallbackSeason:'2025-26',sourceCounts:{current:inventory.files.filter(f=>f.season==='2026-27').length,fallback:inventory.files.filter(f=>f.season==='2025-26').length},files:inventory.files.filter(f=>ids.has(f.id))};
fs.writeFileSync('athlete-data/photo-review-sources.js','window.GLOBE_PHOTO_REVIEW_SOURCES='+JSON.stringify(shipped,null,2)+';\n');
fs.writeFileSync('review-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({athletes:report.length,sources:shipped.sourceCounts,currentMatches:report.filter(r=>r.preferredSeason==='2026-27').length,olderOnly:report.filter(r=>r.preferredSeason==='2025-26').length,flags:report.reduce((acc,r)=>{r.flags.forEach(f=>acc[f]=(acc[f]||0)+1);return acc;},{})},null,2));

