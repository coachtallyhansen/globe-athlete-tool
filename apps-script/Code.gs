const SOURCE_SHEETS = [
  { name: 'Athlete Metrics (Male)', gender: 'Male' },
  { name: 'Athlete Metrics (Female)', gender: 'Female' }
];
const VALID_YEARS = new Set(['Sr', 'Jr', 'So', 'Fr']);
const CACHE_SECONDS = 30;
const ACCOUNTS_SHEET = 'Web App Accounts';
const SCORE_LOG_SHEET = 'Web App Score Log';
const ALLOWED_DOMAIN = 'globeschools.org';
const PUBLIC_CACHE_KEY = 'public-payload-v6';
const SEASONS = ['Previous Year','Fall','Winter','Spring','Summer'];

const ACCOUNT_COL = { email:0, sub:1, athleteName:2, gender:3, primarySport:4, role:5, status:6, updatedAt:7 };

// Only these sport icons are recognized by the web app.
// Cross Country uses the plain runner only; Track & Field uses the shoe only.
// Beach Volleyball is intentionally excluded.
const SPORT_MAP = {
  '🏈':'Football','🏐':'Volleyball','🏃':'Cross Country','🏊':'Swim','📣':'Cheer','🎮':'Esports',
  '🏀':'Basketball','🤼':'Wrestling','⚽':'Soccer','💃':'Pom','⚾':'Baseball','🥎':'Softball',
  '👟':'Track & Field','🎾':'Tennis','⛳':'Golf'
};

const COL = {
  athlete:0, year:1, fallSport:5, winterSport:6, springSport:7, overall:8, academics:9, gpa:10,
  athleticism:61, totalWeight:162, strength:163
};

const METRICS = {
  med:   { label:'Med Ball Toss', unit:'ft',  raws:[11,13,15,17,19], timed:false },
  vert:  { label:'Vertical Jump', unit:'in',  raws:[21,23,25,27,29], timed:false },
  broad: { label:'Broad Jump', unit:'in',      raws:[31,33,35,37,39], timed:false },
  pro:   { label:'Pro Agility', unit:'sec',    raws:[41,43,45,47,49], timed:true },
  dash:  { label:'40 Yard Dash', unit:'sec',   raws:[51,53,55,57,59], timed:true },
  bench: { label:'Bench Press', unit:'lb',     raws:[64,69,74,79,84], timed:false },
  squat: { label:'Back Squat', unit:'lb',      raws:[89,94,99,104,109], timed:false },
  dead:  { label:'Deadlift', unit:'lb',        raws:[114,119,124,129,134], timed:false },
  clean: { label:'Clean', unit:'lb',           raws:[139,144,149,154,159], timed:false }
};

function doGet(e) {
  try {
    if (e && e.parameter && e.parameter.mode === 'health') {
      return json_({ ok:true, service:'Globe Athlete Public Data', version:'v10-live-coach-entry' });
    }
    return json_(buildPublicPayload_());
  } catch (err) {
    return json_({ ok:false, error:String(err && err.message ? err.message : err), generatedAt:new Date().toISOString() });
  }
}

function doPost(e) {
  try {
    const body = parsePostBody_(e);
    const action = String(body.action || '').trim();
    if (!action) return json_({ ok:false, code:'MISSING_ACTION', error:'Missing action.' });

    const claims = verifyGoogleIdToken_(body.idToken);
    const ss = getSpreadsheet_();
    const account = resolveAccount_(ss, claims);
    if (!account.ok) return json_(account);

    if (action === 'session') {
      return json_({
        ok:true, role:account.role, email:claims.email,
        athlete:account.athlete ? publicSessionAthlete_(account.athlete, account.primarySport) : null
      });
    }

    if (action === 'setPrimarySport') {
      if (!account.athlete) return json_({ ok:false, code:'NO_ATHLETE', error:'This account is not linked to an athlete.' });
      const requested = String(body.sport || '').trim();
      if (!requested || !account.athlete.sports.includes(requested)) {
        return json_({ ok:false, code:'INVALID_SPORT', error:'Choose one of the sports assigned to this athlete.' });
      }
      updatePrimarySport_(account.sheet, account.rowNumber, requested);
      CacheService.getScriptCache().remove(PUBLIC_CACHE_KEY);
      return json_({
        ok:true, primarySportIcon:requested, primarySport:sportName_(requested),
        athlete:publicSessionAthlete_(account.athlete, requested)
      });
    }

    if (action === 'coachScoreContext') {
      if (!isCoachRole_(account.role)) return json_({ ok:false, code:'FORBIDDEN', error:'Coach access required.' });
      return json_(coachScoreContext_(ss, body));
    }

    if (action === 'coachUpdateScore') {
      if (!isCoachRole_(account.role)) return json_({ ok:false, code:'FORBIDDEN', error:'Coach access required.' });
      return json_(coachUpdateScore_(ss, body, claims));
    }

    return json_({ ok:false, code:'UNKNOWN_ACTION', error:'Unknown action.' });
  } catch (err) {
    return json_({ ok:false, code:'SERVER_ERROR', error:String(err && err.message ? err.message : err) });
  }
}

function parsePostBody_(e) {
  const text = e && e.postData && e.postData.contents ? e.postData.contents : '';
  if (!text) return {};
  try { return JSON.parse(text); } catch (err) { throw new Error('Invalid request body.'); }
}

function getSpreadsheet_() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!spreadsheetId) throw new Error('Missing Script Property: SPREADSHEET_ID');
  return SpreadsheetApp.openById(spreadsheetId);
}

function verifyGoogleIdToken_(idToken) {
  const token = String(idToken || '').trim();
  if (!token) throw new Error('Missing Google sign-in token.');
  const clientId = String(PropertiesService.getScriptProperties().getProperty('GOOGLE_CLIENT_ID') || '').trim();
  if (!clientId) throw new Error('Missing Script Property: GOOGLE_CLIENT_ID');
  const response = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token), { muteHttpExceptions:true });
  if (response.getResponseCode() !== 200) throw new Error('Google sign-in token could not be verified.');
  const claims = JSON.parse(response.getContentText());
  if (String(claims.aud || '') !== clientId) throw new Error('Google sign-in token was issued for a different app.');
  if (!(claims.email_verified === true || String(claims.email_verified).toLowerCase() === 'true')) throw new Error('Google account email is not verified.');
  const email = String(claims.email || '').trim().toLowerCase();
  const hostedDomain = String(claims.hd || '').trim().toLowerCase();
  if (!email.endsWith('@' + ALLOWED_DOMAIN) || hostedDomain !== ALLOWED_DOMAIN) throw new Error('Please sign in with a @' + ALLOWED_DOMAIN + ' account.');
  const exp = Number(claims.exp || 0);
  if (!exp || exp * 1000 < Date.now()) throw new Error('Google sign-in token has expired.');
  return { email, sub:String(claims.sub || ''), hd:hostedDomain };
}

function getAccountsSheet_(ss) {
  let sheet = ss.getSheetByName(ACCOUNTS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(ACCOUNTS_SHEET);
    sheet.getRange(1,1,1,8).setValues([['Email','Google Sub','Athlete Name','Gender','Primary Sport','Role','Status','Updated At']]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function resolveAccount_(ss, claims) {
  const sheet = getAccountsSheet_(ss);
  const values = sheet.getDataRange().getValues();
  const email = claims.email;
  for (let r=1; r<values.length; r++) {
    const row = values[r];
    if (String(row[ACCOUNT_COL.email] || '').trim().toLowerCase() !== email) continue;
    const status = String(row[ACCOUNT_COL.status] || 'Active').trim();
    if (/^(disabled|inactive|blocked)$/i.test(status)) return { ok:false, code:'ACCOUNT_DISABLED', error:'This web app account is disabled.' };
    const storedSub = String(row[ACCOUNT_COL.sub] || '').trim();
    if (storedSub && storedSub !== claims.sub) return { ok:false, code:'ACCOUNT_MISMATCH', error:'This email is linked to a different Google account.' };
    if (!storedSub && claims.sub) sheet.getRange(r+1, ACCOUNT_COL.sub+1).setValue(claims.sub);
    const role = String(row[ACCOUNT_COL.role] || 'Student').trim() || 'Student';
    const athleteName = String(row[ACCOUNT_COL.athleteName] || '').trim();
    const gender = String(row[ACCOUNT_COL.gender] || '').trim();
    const primarySport = String(row[ACCOUNT_COL.primarySport] || '').trim();
    const athlete = athleteName ? findAthlete_(ss, athleteName, gender) : null;
    if (/^student$/i.test(role) && !athlete) return { ok:false, code:'ATHLETE_NOT_FOUND', error:'Your account is linked, but the athlete record could not be found.' };
    return { ok:true, role, athlete, primarySport, sheet, rowNumber:r+1 };
  }

  const auto = autoMatchAthleteByEmail_(ss, email);
  if (!auto) return { ok:false, code:'ACCOUNT_NOT_LINKED', error:'Your district account is not linked to an athlete profile yet.', email };
  const rowNumber = sheet.getLastRow()+1;
  sheet.getRange(rowNumber,1,1,8).setValues([[email, claims.sub, auto.name, auto.gender, '', 'Student', 'Active', new Date()]]);
  return { ok:true, role:'Student', athlete:auto, primarySport:'', sheet, rowNumber };
}

function isCoachRole_(role) { return /^(coach|admin)$/i.test(String(role || '').trim()); }

function autoMatchAthleteByEmail_(ss, email) {
  const local = String(email || '').split('@')[0].toLowerCase();
  if (!local) return null;
  const matches = new Map();
  SOURCE_SHEETS.forEach(source => {
    const sheet = ss.getSheetByName(source.name); if (!sheet) return;
    const values = sheet.getDataRange().getValues();
    for (let r=5; r<values.length; r++) {
      const row=values[r], name=String(row[COL.athlete]||'').trim(), year=String(row[COL.year]||'').trim();
      if (!name || !VALID_YEARS.has(year) || nameToEmailLocal_(name) !== local) continue;
      const key=source.gender+'|'+name.toLowerCase();
      if (!matches.has(key)) matches.set(key, athleteFromRow_(source,row,r));
    }
  });
  return matches.size===1 ? Array.from(matches.values())[0] : null;
}

function nameToEmailLocal_(name) {
  const parts=String(name||'').trim().split(/\s+/).filter(Boolean); if(parts.length<2)return '';
  const clean=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const first=clean(parts[0]), last=clean(parts[parts.length-1]); return first&&last ? first+'.'+last : '';
}

function extractSports_(row) {
  return [COL.fallSport,COL.winterSport,COL.springSport]
    .map(i=>String(row[i]||'').trim())
    .filter(v=>v && !/^\d+(\.\d+)?$/.test(v) && Object.prototype.hasOwnProperty.call(SPORT_MAP,v));
}

function findAthlete_(ss, athleteName, gender) {
  const wantedName=String(athleteName||'').trim().toLowerCase(), wantedGender=String(gender||'').trim().toLowerCase();
  for (let i=0;i<SOURCE_SHEETS.length;i++) {
    const source=SOURCE_SHEETS[i]; if(wantedGender && source.gender.toLowerCase()!==wantedGender)continue;
    const sheet=ss.getSheetByName(source.name); if(!sheet)continue;
    const values=sheet.getDataRange().getValues();
    for(let r=5;r<values.length;r++){
      const row=values[r], name=String(row[COL.athlete]||'').trim(), year=String(row[COL.year]||'').trim();
      if(name && VALID_YEARS.has(year) && name.toLowerCase()===wantedName)return athleteFromRow_(source,row,r);
    }
  }
  return null;
}

function athleteFromRow_(source,row,zeroBasedRowIndex) {
  const sports=extractSports_(row);
  return { id:`${source.gender.toLowerCase()}-${zeroBasedRowIndex+1}`, name:String(row[COL.athlete]||'').trim(), year:String(row[COL.year]||'').trim(), gender:source.gender, sports };
}

function updatePrimarySport_(sheet,rowNumber,sportIcon) {
  sheet.getRange(rowNumber,ACCOUNT_COL.primarySport+1).setValue(sportIcon);
  sheet.getRange(rowNumber,ACCOUNT_COL.updatedAt+1).setValue(new Date());
}

function publicSessionAthlete_(athlete,primarySportIcon) {
  const sports=athlete.sports||[], primary=primarySportIcon&&sports.includes(primarySportIcon)?primarySportIcon:'';
  return { id:athlete.id,name:athlete.name,year:athlete.year,gender:athlete.gender,sports,sportNames:sports.map(sportName_),primarySportIcon:primary||null,primarySport:primary?sportName_(primary):null };
}

function resolveCoachMetric_(body) {
  const metricKey=String(body.metric||'').trim(), season=String(body.season||'').trim();
  const def=METRICS[metricKey]; if(!def)throw new Error('Unknown metric.');
  const seasonIndex=SEASONS.indexOf(season); if(seasonIndex<0)throw new Error('Unknown season.');
  return { metricKey, season, seasonIndex, def, rawIndex:def.raws[seasonIndex] };
}

function findAthleteLocation_(ss,body) {
  const athleteId=String(body.athleteId||'').trim(), expectedName=String(body.athleteName||'').trim(), expectedGender=String(body.gender||'').trim();
  const m=athleteId.match(/^(male|female)-(\d+)$/i);
  if(m){
    const gender=m[1].toLowerCase()==='male'?'Male':'Female', rowNumber=Number(m[2]);
    const source=SOURCE_SHEETS.find(s=>s.gender===gender), sheet=source&&ss.getSheetByName(source.name);
    if(sheet && rowNumber>=6 && rowNumber<=sheet.getLastRow()){
      const row=sheet.getRange(rowNumber,1,1,sheet.getLastColumn()).getValues()[0];
      const name=String(row[COL.athlete]||'').trim(), year=String(row[COL.year]||'').trim();
      if(name && VALID_YEARS.has(year) && (!expectedName || name.toLowerCase()===expectedName.toLowerCase())) return {source,sheet,row,rowNumber};
    }
  }
  const wantedName=expectedName.toLowerCase(), wantedGender=expectedGender.toLowerCase();
  if(!wantedName)throw new Error('Athlete could not be located.');
  const hits=[];
  SOURCE_SHEETS.forEach(source=>{
    if(wantedGender && source.gender.toLowerCase()!==wantedGender)return;
    const sheet=ss.getSheetByName(source.name); if(!sheet)return;
    const values=sheet.getDataRange().getValues();
    for(let r=5;r<values.length;r++){
      const name=String(values[r][COL.athlete]||'').trim(), year=String(values[r][COL.year]||'').trim();
      if(name.toLowerCase()===wantedName && VALID_YEARS.has(year))hits.push({source,sheet,row:values[r],rowNumber:r+1});
    }
  });
  if(hits.length!==1)throw new Error(hits.length?'Athlete match is ambiguous.':'Athlete could not be located.');
  return hits[0];
}

function cellDisplay_(value) {
  if(value===null||value===undefined||value==='')return '';
  if(typeof value==='number')return value;
  return String(value).trim();
}

function sameCellValue_(a,b) {
  const na=Number(a), nb=Number(b);
  if(a!==''&&a!==null&&a!==undefined&&b!==''&&b!==null&&b!==undefined&&Number.isFinite(na)&&Number.isFinite(nb))return Math.abs(na-nb)<1e-9;
  return String(a==null?'':a).trim()===String(b==null?'':b).trim();
}

function coachScoreContext_(ss,body) {
  const target=resolveCoachMetric_(body), loc=findAthleteLocation_(ss,body), current=loc.row[target.rawIndex];
  return { ok:true, athleteId:`${loc.source.gender.toLowerCase()}-${loc.rowNumber}`, athleteName:String(loc.row[COL.athlete]||'').trim(), gender:loc.source.gender,
    metric:target.metricKey, metricLabel:target.def.label, unit:target.def.unit, season:target.season, currentValue:current===undefined?null:current, currentDisplay:cellDisplay_(current) };
}

function coachUpdateScore_(ss,body,claims) {
  const target=resolveCoachMetric_(body), loc=findAthleteLocation_(ss,body), current=loc.row[target.rawIndex];
  if(Object.prototype.hasOwnProperty.call(body,'expectedCurrent') && !sameCellValue_(current,body.expectedCurrent)) {
    return { ok:false, code:'SCORE_CHANGED', error:'That spreadsheet cell changed since you loaded it. Reload the current score before saving.' };
  }
  const value=Number(body.value);
  if(!Number.isFinite(value))return { ok:false, code:'INVALID_VALUE', error:'Enter a numeric score.' };
  if(target.def.timed ? value<=1 : value<=0.5)return { ok:false, code:'INVALID_VALUE', error:'That score is outside the valid range.' };
  loc.sheet.getRange(loc.rowNumber,target.rawIndex+1).setValue(value);
  SpreadsheetApp.flush();
  const recalculated=loc.sheet.getRange(loc.rowNumber,target.rawIndex+1,1,2).getValues()[0];
  logScoreChange_(ss,claims.email,loc.source.gender,String(loc.row[COL.athlete]||'').trim(),target,current,value);
  CacheService.getScriptCache().remove(PUBLIC_CACHE_KEY);
  return { ok:true, athleteId:`${loc.source.gender.toLowerCase()}-${loc.rowNumber}`, athleteName:String(loc.row[COL.athlete]||'').trim(), gender:loc.source.gender,
    metric:target.metricKey, metricLabel:target.def.label, unit:target.def.unit, season:target.season, oldValue:current, newValue:recalculated[0], score:scoreOrNull_(recalculated[1]), updatedAt:new Date().toISOString() };
}

function logScoreChange_(ss,email,gender,athleteName,target,oldValue,newValue) {
  let sheet=ss.getSheetByName(SCORE_LOG_SHEET);
  if(!sheet){
    sheet=ss.insertSheet(SCORE_LOG_SHEET);
    sheet.getRange(1,1,1,9).setValues([['Timestamp','Coach Email','Athlete','Gender','Metric','Season','Old Value','New Value','Source']]);
    sheet.setFrozenRows(1);
  }
  sheet.appendRow([new Date(),email,athleteName,gender,target.def.label,target.season,oldValue,newValue,'Coach Web App']);
}

function getPrimarySportMap_(ss) {
  const map={}, sheet=ss.getSheetByName(ACCOUNTS_SHEET); if(!sheet)return map;
  const values=sheet.getDataRange().getValues();
  for(let r=1;r<values.length;r++){
    const row=values[r], status=String(row[ACCOUNT_COL.status]||'Active').trim(); if(/^(disabled|inactive|blocked)$/i.test(status))continue;
    const name=String(row[ACCOUNT_COL.athleteName]||'').trim(), gender=String(row[ACCOUNT_COL.gender]||'').trim(), primary=String(row[ACCOUNT_COL.primarySport]||'').trim();
    if(name&&gender&&primary)map[gender.toLowerCase()+'|'+name.toLowerCase()]=primary;
  }
  return map;
}

function buildPublicPayload_() {
  const cache=CacheService.getScriptCache(), cached=cache.get(PUBLIC_CACHE_KEY); if(cached)return JSON.parse(cached);
  const ss=getSpreadsheet_(), primarySportMap=getPrimarySportMap_(ss), athletes=[];
  SOURCE_SHEETS.forEach(source=>{
    const sheet=ss.getSheetByName(source.name); if(!sheet)throw new Error(`Missing sheet: ${source.name}`);
    const values=sheet.getDataRange().getValues();
    for(let r=5;r<values.length;r++){
      const row=values[r], name=String(row[COL.athlete]||'').trim(), year=String(row[COL.year]||'').trim(); if(!name||!VALID_YEARS.has(year))continue;
      const tests={}, lifts={};
      ['med','vert','broad','pro','dash'].forEach(key=>{const result=bestMetric_(row,METRICS[key]);if(result)tests[key]=result;});
      ['bench','squat','dead','clean'].forEach(key=>{const result=bestMetric_(row,METRICS[key]);if(result)lifts[key]=result;});
      const sports=extractSports_(row);
      const overall=scoreOrNull_(row[COL.overall]), academics=scoreOrNull_(row[COL.academics]), athleticism=scoreOrNull_(row[COL.athleticism]), strength=scoreOrNull_(row[COL.strength]);
      let club1000=validPerformance_(row[COL.totalWeight],false);
      if(club1000===null){const vals=Object.values(lifts).map(x=>x&&x.value).filter(Number.isFinite).sort((a,b)=>b-a);if(vals.length>=3)club1000=vals.slice(0,3).reduce((a,b)=>a+b,0);}
      const sportBonusInfo=sportBonus_(sports,overall,academics,athleticism,strength), key=source.gender.toLowerCase()+'|'+name.toLowerCase();
      const savedPrimary=String(primarySportMap[key]||'').trim(), primarySportIcon=savedPrimary&&sports.includes(savedPrimary)?savedPrimary:null;
      athletes.push({ id:`${source.gender.toLowerCase()}-${r+1}`,name,year,gender:source.gender,overall,academics,gpaRange:gpaRange_(row[COL.gpa]),athleticism,strength,club1000,sports,
        primarySportIcon,primarySport:primarySportIcon?sportName_(primarySportIcon):null,sportBonus:sportBonusInfo.value,sportBonusSource:sportBonusInfo.source,tests,lifts });
    }
  });
  const payload={ok:true,version:'v10-live-coach-entry',schemaVersion:5,generatedAt:new Date().toISOString(),source:'Athlete Training 2026-27',athleteCount:athletes.length,athletes};
  const text=JSON.stringify(payload); if(text.length<95000)cache.put(PUBLIC_CACHE_KEY,text,CACHE_SECONDS); return payload;
}

function sportName_(icon){const key=String(icon||'').trim();return SPORT_MAP[key]||key;}
function bestMetric_(row,def){let best=null;def.raws.forEach(rawIndex=>{const value=validPerformance_(row[rawIndex],def.timed);if(value===null)return;const score=scoreOrNull_(row[rawIndex+1]);if(!best||(def.timed?value<best.value:value>best.value))best={value,score};});return best;}
function validPerformance_(value,timed){if(value===null||value===undefined||value==='')return null;if(typeof value==='string'){const s=value.trim().toUpperCase();if(!s||s==='DNP'||s==='DNF'||s==='-')return null;}const n=Number(value);if(!Number.isFinite(n))return null;return timed?(n>1?n:null):(n>0.5?n:null);}
function scoreOrNull_(value){if(value===null||value===undefined||value==='')return null;const n=Number(value);return Number.isFinite(n)?n:null;}
function sportBonus_(sports,overall,academics,athleticism,strength){if(sports.length)return{value:Math.min(sports.length,3)*0.1,source:'sports'};const components=[academics,athleticism,strength];if(overall!==null&&components.every(v=>v!==null)){const avg=components.reduce((a,b)=>a+b,0)/3,inferred=Math.round((overall-avg)*10)/10;if(inferred>=0&&inferred<=0.3)return{value:inferred,source:'inferred'};}return{value:null,source:'unknown'};}
function gpaRange_(value){if(value===null||value===undefined||value==='')return null;const n=Number(value);if(!Number.isFinite(n))return null;if(n>=3.5)return'3.5–4.0';if(n>=3.0)return'3.0–3.4';if(n>=2.5)return'2.5–2.9';if(n>=2.0)return'2.0–2.4';return'<2.0';}
function json_(obj){return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);}