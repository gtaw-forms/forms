// Probe: can we map morgue location strings to verified_locations streets,
// and how many bodies land on each street? (Brainstorm feasibility only.)
import fs from 'fs';
import path from 'path';

const REPO = 'C:\\Users\\cross\\Documents\\GitHub\\phmc-forms';

// ── read morgue API key/url from functions/.env ──
const envTxt = fs.readFileSync(path.join(REPO, 'functions', '.env'), 'utf8');
const env = {};
for (const line of envTxt.split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#') || !t.includes('=')) continue;
  env[t.slice(0, t.indexOf('=')).trim()] = t.slice(t.indexOf('=') + 1).trim();
}
const API_KEY = env.MORGUE_API_KEY;
const API_URL = env.MORGUE_API_URL || 'http://88.208.243.254';

const ABBR = [
  [/\bblvd\b/g, 'boulevard'], [/\bhwy\b/g, 'highway'], [/\bfwy\b/g, 'freeway'],
  [/\bave\b/g, 'avenue'], [/\brd\b/g, 'road'], [/\bct\b/g, 'court'],
  [/\bst\b/g, 'street'], [/\bdr\b/g, 'drive'], [/\bln\b/g, 'lane'],
  [/\bpl\b/g, 'place'], [/\bpkwy\b/g, 'parkway'], [/\bsr\b/g, 'state route'],
];
const expand = (s) => { let o = s; for (const [re, full] of ABBR) o = o.replace(re, full); return o; };

const norm = (s) => expand(String(s || '')
  .toLowerCase()
  .replace(/\(zone\s*\d+\)/gi, '')
  .replace(/[^a-z0-9 ]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim());

// "Burton - Eastbourne Way" -> "eastbourne way"; also handles no-prefix names.
const streetToken = (loc) => {
  let s = String(loc || '').trim();
  if (!s || /location unknown|^unknown$/i.test(s)) return '';
  const parts = s.split(/\s+-\s+/);
  s = parts.length > 1 ? parts[parts.length - 1] : s;
  return norm(s);
};

async function main() {
  // 1) morgue records via VPS REST
  const url = `${API_URL.replace(/\/$/, '')}/api/morgue?key=${encodeURIComponent(API_KEY)}`;
  console.log('Fetching morgue records:', API_URL, '...');
  const res = await fetch(url, { headers: { 'x-api-key': API_KEY } });
  if (!res.ok) throw new Error(`morgue API ${res.status}`);
  const j = await res.json();
  const records = Array.isArray(j.records) ? j.records : Object.values(j.records || j || {});
  console.log('Record count:', records.length);

  // 2) verified_locations via RTDB REST (public read)
  const db = 'https://gtaw-forms-default-rtdb.europe-west1.firebasedatabase.app';
  console.log('Fetching verified_locations ...');
  const vres = await fetch(`${db}/verified_locations.json`);
  const vlocs = (await vres.json()) || {};
  const streets = Object.values(vlocs).filter(x => x && x.type === 'Street');
  const streetypes = {};
  for (const v of Object.values(vlocs)) { const t = v?.type || '(none)'; streetypes[t] = (streetypes[t] || 0) + 1; }
  console.log('verified_locations types:', streetypes);
  console.log('Street records:', streets.length, '| with path:', streets.filter(s => s.path?.length > 1).length, '| with point:', streets.filter(s => s.x !== undefined || s.gameX !== undefined).length);

  // street name index (normalized)
  const streetIndex = new Map();
  for (const s of streets) {
    const key = norm(s.name);
    if (key) streetIndex.set(key, s);
  }

  // Levenshtein for the fuzzy fallback (typos / suffix variants).
  const lev = (a, b) => {
    const m = a.length, n = b.length;
    if (!m) return n; if (!n) return m;
    let prev = Array.from({ length: n + 1 }, (_, i) => i);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[n];
  };
  const similarity = (a, b) => 1 - lev(a, b) / Math.max(a.length, b.length);
  const bestFuzzy = (tok, threshold = 0.8) => {
    let best = null, bestScore = 0;
    for (const [k, v] of streetIndex) {
      const sc = similarity(tok, k);
      if (sc > bestScore) { bestScore = sc; best = v; }
    }
    return bestScore >= threshold ? { ...best, _score: bestScore } : null;
  };

  // 3) aggregate
  let noLoc = 0, parsed = 0, matched = 0, unmatched = 0, fuzzyRecovered = 0;
  const counts = new Map();
  const unmatchedSamples = new Map();
  const fuzzySamples = new Map();
  for (const r of records) {
    const raw = r.location;
    if (!raw || /location unknown|^unknown$/i.test(String(raw))) { noLoc++; continue; }
    const tok = streetToken(raw);
    if (!tok) { noLoc++; continue; }
    parsed++;
    // exact normalized match first, then contains either way
    let hit = streetIndex.get(tok);
    if (!hit) {
      for (const [k, v] of streetIndex) {
        if (k === tok || k.includes(tok) || tok.includes(k)) { hit = v; break; }
      }
    }
    if (hit) {
      matched++;
      const name = hit.name;
      counts.set(name, (counts.get(name) || 0) + 1);
    } else {
      const fz = bestFuzzy(tok);
      if (fz) {
        matched++;
        fuzzyRecovered++;
        const name = fz.name;
        counts.set(name, (counts.get(name) || 0) + 1);
        fuzzySamples.set(`${tok}  ->  ${name} (${fz._score.toFixed(2)})`, (fuzzySamples.get(`${tok}  ->  ${name} (${fz._score.toFixed(2)})`) || 0) + 1);
      } else {
        unmatched++;
        unmatchedSamples.set(tok, (unmatchedSamples.get(tok) || 0) + 1);
      }
    }
  }

  console.log('\n=== COVERAGE ===');
  console.log('records:', records.length);
  console.log('no/unknown location:', noLoc);
  console.log('parsed to street token:', parsed);
  console.log('matched to a verified street:', matched, `(${parsed ? (100 * matched / parsed).toFixed(1) : 0}% of parsed)`);
  console.log('  of which fuzzy-recovered:', fuzzyRecovered);
  console.log('unmatched street tokens (-> skipped):', unmatched);

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  console.log('\n=== TOP 25 STREETS BY BODY COUNT ===');
  for (const [name, n] of sorted.slice(0, 25)) console.log(String(n).padStart(4), name);
  console.log('\nDistinct streets with >=1 body:', sorted.length);
  console.log('Streets with >=5 bodies:', sorted.filter(x => x[1] >= 5).length);

  console.log('\n=== SAMPLE FUZZY RECOVERIES (est.) ===');
  [...fuzzySamples.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)
    .forEach(([t, n]) => console.log(String(n).padStart(4), t));

  console.log('\n=== TOP 20 UNMATCHED TOKENS (-> skipped) ===');
  [...unmatchedSamples.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)
    .forEach(([t, n]) => console.log(String(n).padStart(4), t));
}

main().catch(e => { console.error('PROBE FAILED:', e.message); process.exit(1); });
