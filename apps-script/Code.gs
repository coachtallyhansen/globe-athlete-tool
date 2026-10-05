const SPREADSHEET_ID = 'REPLACE_WITH_PRIVATE_SPREADSHEET_ID';
const SOURCE_SHEETS = [
  { name: 'Athlete Metrics (Male)', gender: 'Male' },
  { name: 'Athlete Metrics (Female)', gender: 'Female' }
];
const VALID_YEARS = new Set(['Sr','Jr','So','Fr']);

const COL = {
  athlete: 0, year: 1,
  fallSport: 5, winterSport: 6, springSport: 7,
  overall: 8, academics: 9, gpa: 10,
  athleticism: 61,
  totalWeight: 162, strength: 163
};

const METRICS = {
  med:   { label: 'Med Ball Toss', unit: 'ft', raws: [11,13,15,17,19], timed: false },
  vert:  { label: 'Vertical Jump', unit: 'in', raws: [21,23,25,27,29], timed: false },
  broad: { label: 'Broad Jump', unit: 'in', raws: [31,33,35,37,39], timed: false },
  pro:   { label: 'Pro Agility', unit: 'sec', raws: [41,43,45,47,49], timed: true },
  dash:  { label: '40 Yard Dash', unit: 'sec', raws: [51,53,55,57,59], timed: true },
  bench: { label: 'Bench Press', unit: 'lb', raws: [64,69,74,79,84], timed: false },
  squat: { label: 'Back Squat', unit: 'lb', raws: [89,94,99,104,109], timed: false },
  dead:  { label: 'Deadlift', unit: 'lb', raws: [114,119,124,129,134], timed: false },
  clean: { label: 'Clean', unit: 'lb', raws: [139,144,149,154,159], timed: false }
};

function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify(buildPublicPayload_()))
    .setMimeType(ContentService.MimeType.JSON);
}

function buildPublicPayload_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
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
      ['med','vert','broad','pro','dash'].forEach(key => tests[key] = bestMetric_(row, METRICS[key]));
      ['bench','squat','dead','clean'].forEach(key => lifts[key] = bestMetric_(row, METRICS[key]));

      const sports = [COL.fallSport, COL.winterSport, COL.springSport]
        .map(i => String(row[i] || '').trim())
        .filter(v => v && !/^\d+(\.\d+)?$/.test(v));

      athletes.push({
        id: `${source.gender.toLowerCase()}-${r + 1}`,
        name,
        year,
        gender: source.gender,
        overall: numberOrNull_(row[COL.overall]),
        academics: numberOrNull_(row[COL.academics]),
        gpaRange: gpaRange_(row[COL.gpa]),
        athleticism: numberOrNull_(row[COL.athleticism]),
        strength: numberOrNull_(row[COL.strength]),
        club1000: validPerformance_(row[COL.totalWeight], false),
        sports,
        sportBonus: Math.min(sports.length, 3) * 0.1,
        tests,
        lifts
      });
    }
  });

  return {
    version: 'v10',
    generatedAt: new Date().toISOString(),
    source: 'Athlete Training 2026-27',
    athleteCount: athletes.length,
    athletes
  };
}

function bestMetric_(row, def) {
  let best = null;
  def.raws.forEach(rawIndex => {
    const value = validPerformance_(row[rawIndex], def.timed);
    if (value === null) return;
    const score = numberOrNull_(row[rawIndex + 1]);
    if (!best || (def.timed ? value < best.value : value > best.value)) best = { value, score };
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
  if (timed) return n > 1 ? n : null;
  return n > 0.5 ? n : null;
}

function numberOrNull_(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function gpaRange_(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n >= 3.5) return '3.5–4.0';
  if (n >= 3.0) return '3.0–3.4';
  if (n >= 2.5) return '2.5–2.9';
  if (n >= 2.0) return '2.0–2.4';
  return '<2.0';
}
