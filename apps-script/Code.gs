const SOURCE_SHEETS = [
  { name: 'Athlete Metrics (Male)', gender: 'Male' },
  { name: 'Athlete Metrics (Female)', gender: 'Female' }
];
const VALID_YEARS = new Set(['Sr', 'Jr', 'So', 'Fr']);
const CACHE_SECONDS = 30;

const COL = {
  athlete: 0,
  year: 1,
  fallSport: 5,
  winterSport: 6,
  springSport: 7,
  overall: 8,
  academics: 9,
  gpa: 10,
  athleticism: 61,
  totalWeight: 162,
  strength: 163
};

const METRICS = {
  med:   { label: 'Med Ball Toss', unit: 'ft', raws: [11, 13, 15, 17, 19], timed: false },
  vert:  { label: 'Vertical Jump', unit: 'in', raws: [21, 23, 25, 27, 29], timed: false },
  broad: { label: 'Broad Jump', unit: 'in', raws: [31, 33, 35, 37, 39], timed: false },
  pro:   { label: 'Pro Agility', unit: 'sec', raws: [41, 43, 45, 47, 49], timed: true },
  dash:  { label: '40 Yard Dash', unit: 'sec', raws: [51, 53, 55, 57, 59], timed: true },
  bench: { label: 'Bench Press', unit: 'lb', raws: [64, 69, 74, 79, 84], timed: false },
  squat: { label: 'Back Squat', unit: 'lb', raws: [89, 94, 99, 104, 109], timed: false },
  dead:  { label: 'Deadlift', unit: 'lb', raws: [114, 119, 124, 129, 134], timed: false },
  clean: { label: 'Clean', unit: 'lb', raws: [139, 144, 149, 154, 159], timed: false }
};

function doGet(e) {
  try {
    if (e && e.parameter && e.parameter.mode === 'health') {
      return json_({ ok: true, service: 'Globe Athlete Public Data', version: 'v10-live' });
    }
    return json_(buildPublicPayload_());
  } catch (err) {
    return json_({
      ok: false,
      error: String(err && err.message ? err.message : err),
      generatedAt: new Date().toISOString()
    });
  }
}

function buildPublicPayload_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('public-payload-v3');
  if (cached) return JSON.parse(cached);

  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!spreadsheetId) {
    throw new Error('Missing Script Property: SPREADSHEET_ID');
  }

  const ss = SpreadsheetApp.openById(spreadsheetId);
  const athletes = [];

  SOURCE_SHEETS.forEach(source => {
    const sheet = ss.getSheetByName(source.name);
    if (!sheet) throw new Error(`Missing sheet: ${source.name}`);

    const values = sheet.getDataRange().getValues();
    for (let r = 5; r < values.length; r++) {
      const row = values[r];
      const name = String(row[COL.athlete] || '').trim();
      const year = String(row[COL.year] || '').trim();
      if (!name || !VALID_YEARS.has(year)) continue;

      const tests = {};
      const lifts = {};
      ['med', 'vert', 'broad', 'pro', 'dash'].forEach(key => {
        const result = bestMetric_(row, METRICS[key]);
        if (result) tests[key] = result;
      });
      ['bench', 'squat', 'dead', 'clean'].forEach(key => {
        const result = bestMetric_(row, METRICS[key]);
        if (result) lifts[key] = result;
      });

      const sports = [COL.fallSport, COL.winterSport, COL.springSport]
        .map(i => String(row[i] || '').trim())
        .filter(v => v && !/^\d+(\.\d+)?$/.test(v));

      const overall = scoreOrNull_(row[COL.overall]);
      const academics = scoreOrNull_(row[COL.academics]);
      const athleticism = scoreOrNull_(row[COL.athleticism]);
      const strength = scoreOrNull_(row[COL.strength]);

      let club1000 = validPerformance_(row[COL.totalWeight], false);
      if (club1000 === null) {
        const liftValues = Object.values(lifts)
          .map(x => x && x.value)
          .filter(v => Number.isFinite(v))
          .sort((a, b) => b - a);
        if (liftValues.length >= 3) club1000 = liftValues.slice(0, 3).reduce((a, b) => a + b, 0);
      }

      const sportBonusInfo = sportBonus_(sports, overall, academics, athleticism, strength);

      athletes.push({
        id: `${source.gender.toLowerCase()}-${r + 1}`,
        name,
        year,
        gender: source.gender,
        overall,
        academics,
        gpaRange: gpaRange_(row[COL.gpa]),
        athleticism,
        strength,
        club1000,
        sports,
        sportBonus: sportBonusInfo.value,
        sportBonusSource: sportBonusInfo.source,
        tests,
        lifts
      });
    }
  });

  const payload = {
    ok: true,
    version: 'v10-live',
    schemaVersion: 3,
    generatedAt: new Date().toISOString(),
    source: 'Athlete Training 2026-27',
    athleteCount: athletes.length,
    athletes
  };

  const text = JSON.stringify(payload);
  if (text.length < 95000) cache.put('public-payload-v3', text, CACHE_SECONDS);
  return payload;
}

function bestMetric_(row, def) {
  let best = null;
  def.raws.forEach(rawIndex => {
    const value = validPerformance_(row[rawIndex], def.timed);
    if (value === null) return;
    const score = scoreOrNull_(row[rawIndex + 1]);
    if (!best || (def.timed ? value < best.value : value > best.value)) {
      best = { value, score };
    }
  });
  return best;
}

function validPerformance_(value, timed) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string') {
    const s = value.trim().toUpperCase();
    if (!s || s === 'DNP' || s === 'DNF' || s === '-') return null;
  }
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return timed ? (n > 1 ? n : null) : (n > 0.5 ? n : null);
}

function scoreOrNull_(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function sportBonus_(sports, overall, academics, athleticism, strength) {
  if (sports.length) {
    return { value: Math.min(sports.length, 3) * 0.1, source: 'sports' };
  }

  const components = [academics, athleticism, strength];
  if (overall !== null && components.every(v => v !== null)) {
    const avg = components.reduce((a, b) => a + b, 0) / 3;
    const inferred = Math.round((overall - avg) * 10) / 10;
    if (inferred >= 0 && inferred <= 0.3) {
      return { value: inferred, source: 'inferred' };
    }
  }
  return { value: null, source: 'unknown' };
}

function gpaRange_(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n >= 3.5) return '3.5–4.0';
  if (n >= 3.0) return '3.0–3.4';
  if (n >= 2.5) return '2.5–2.9';
  if (n >= 2.0) return '2.0–2.4';
  return '<2.0';
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
