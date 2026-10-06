const SOURCE_SHEETS = [
  { name: 'Athlete Metrics (Male)', gender: 'Male' },
  { name: 'Athlete Metrics (Female)', gender: 'Female' }
];
const VALID_YEARS = new Set(['Sr', 'Jr', 'So', 'Fr']);
const CACHE_SECONDS = 30;
const ACCOUNTS_SHEET = 'Web App Accounts';
const SCORE_LOG_SHEET = 'Web App Score Log';
const PENDING_SCORE_SHEET = 'Web App Pending Scores';
const ALLOWED_DOMAIN = 'globeschools.org';
const PUBLIC_CACHE_KEY = 'public-payload-v7';
const SEASONS = ['Previous Year','Fall','Winter','Spring','Summer'];

const ACCOUNT_COL = { email:0, sub:1, athleteName:2, gender:3, primarySport:4, role:5, status:6, updatedAt:7 };
const PENDING_COL = {
  id:0, submittedAt:1, studentEmail:2, athleteName:3, gender:4, athleteId:5,
  metricKey:6, metricLabel:7, season:8, proposedValue:9, status:10,
  reviewedAt:11, reviewedBy:12, reviewNote:13, appliedOld:14, appliedNew:15
};

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
      return json_({ ok:true, service:'Globe Athlete Public Data', version:'v10-student-submissions' });
    }
    return json_(buildPublicPayload_());
  } catch (err) {
    return json_({ ok:false, error:errorMessage_(err), generatedAt:new Date().toISOString() });
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
      if (!isCoachRole_(account.role)) return forbiddenCoach_();
      return json_(coachScoreContext_(ss, body));
    }
    if (action === 'coachUpdateScore') {
      if (!isCoachRole_(account.role)) return forbiddenCoach_();
      return json_(coachUpdateScore_(ss, body, claims));
    }

    if (action === 'studentScoreContext') {
      if (!isStudentRole_(account.role) || !account.athlete) return json_({ ok:false, code:'FORBIDDEN', error:'Student athlete access required.' });
      return json_(studentScoreContext_(ss, account, body));
    }
    if (action === 'studentSubmitScore') {
      if (!isStudentRole_(account.role) || !account.athlete) return json_({ ok:false, code:'FORBIDDEN', error:'Student athlete access required.' });
      return json_(studentSubmitScore_(ss, account, body, claims));
    }
    if (action === 'studentMySubmissions') {
      if (!isStudentRole_(account.role) || !account.athlete) return json_({ ok:false, code:'FORBIDDEN', error:'Student athlete access required.' });
      return json_(studentMySubmissions_(ss, account, claims));
    }

    if (action === 'coachPendingScores') {
      if (!isCoachRole_(account.role)) return forbiddenCoach_();
      return json_(coachPendingScores_(ss));
    }
    if (action === 'coachReviewSubmission') {
      if (!isCoachRole_(account.role)) return forbiddenCoach_();
      return json_(coachReviewSubmission_(ss, body, claims));
    }

    return json_({ ok:false, code:'UNKNOWN_ACTION', error:'Unknown action.' });
  } catch (err) {
    return json_({ ok:false, code:'SERVER_ERROR', error:errorMessage_(err) });
  }
}

function forbiddenCoach_() { return json_({ ok:false, code:'FORBIDDEN', error:'Coach access required.' }); }
function errorMessage_(err) { return String(err && err.message ? err.message : err); }

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
  if (!email.endsWith('@' + ALLOWED_DOMAIN) || hostedDomain !== ALLOWE