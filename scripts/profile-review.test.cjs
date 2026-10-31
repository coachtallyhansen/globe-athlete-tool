const assert=require('node:assert/strict');
const {audit,filenameName}=require('../profile-review-core.js');
const athlete={id:'1',name:'Matthew Casey',sports:['Football'],tests:{dash:{value:5,score:3}},primarySport:'Football'};
const file={id:'a',name:'Casey, Matthew.jpg',sport:'Football',season:'2026-27',mime:'image/jpeg'};
const inspect=(as=[athlete],fs=[file])=>audit(as,fs,{},{});
assert.equal(filenameName('De La Torre, Devron.jpg'),'Devron De La Torre');
assert.equal(inspect()[0].preferredSeason,'2026-27');
assert(inspect(undefined,[file,{...file,id:'b'}])[0].flags.includes('Multiple photo matches'));
assert(!inspect(undefined,[file,{...file,id:'b',sport:'Swim'}])[0].flags.includes('Multiple photo matches'));
assert(inspect(undefined,[{...file,name:'Casey, Matt.jpg'}])[0].flags.includes('Missing photo'));
assert(inspect(undefined,[{...file,season:'2025-26'}])[0].flags.includes('Older photo only'));
assert(inspect([{...athlete,primarySport:'Soccer'}])[0].flags.includes('Missing primary sport photo'));
assert(inspect([athlete,{...athlete,id:'2'}])[0].flags.includes('Duplicate athlete record'));
assert(inspect([{...athlete,tests:{dash:{value:0,score:6}}}])[0].flags.includes('Suspicious test data'));
assert(inspect([{...athlete,tests:{dash:{value:5,score:null}}}])[0].suspicious.length===0);
const before=JSON.stringify(athlete);inspect();assert.equal(JSON.stringify(athlete),before);
console.log('Photo matching, ambiguity, fallback, primary sport, duplicate, metric validity and no-mutation checks passed.');

