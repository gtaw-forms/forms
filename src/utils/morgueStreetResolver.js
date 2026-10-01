// ---------------------------------------------------------------------------
// Morgue location -> verified street resolution
// ---------------------------------------------------------------------------
// Morgue records carry a free-text LOCATION (e.g. "Burton - Eastbourne Way").
// `verified_locations` (RTDB) holds admin-drawn streets as polylines with game
// coordinates. This module bridges the two so a map can bubble a body COUNT per
// street without needing exact per-body coordinates.
//
// Resolution order (first hit wins):
//   1. abbreviation expansion + exact normalized match
//   2. exact match on the district-stripped street token
//   3. contains-match either direction (guarded by min length)
//   4. conservative fuzzy match (Levenshtein >= FUZZY_THRESHOLD, with a
//      direction-word guard so "East Mirror Drive" never resolves to
//      "West Mirror Drive")
// Anything unresolved returns null and is skipped by the caller.

const ABBREVIATIONS = [
  [/\bblvd\b/g, 'boulevard'], [/\bhwy\b/g, 'highway'], [/\bfwy\b/g, 'freeway'],
  [/\bave\b/g, 'avenue'], [/\brd\b/g, 'road'], [/\bct\b/g, 'court'],
  [/\bst\b/g, 'street'], [/\bdr\b/g, 'drive'], [/\bln\b/g, 'lane'],
  [/\bpl\b/g, 'place'], [/\bpkwy\b/g, 'parkway'], [/\bsr\b/g, 'state route'],
];

export const FUZZY_THRESHOLD = 0.88;

const DIRECTION_WORDS = ['north', 'south', 'east', 'west'];

const expandAbbreviations = (s) => {
  let out = s;
  for (const [re, full] of ABBREVIATIONS) out = out.replace(re, full);
  return out;
};

export const normalizeStreetName = (s) => expandAbbreviations(
  String(s || '')
    .toLowerCase()
    .replace(/\(zone\s*\d+\)/gi, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
);

// A direction word present in one name but not the other is a reliable signal
// that a fuzzy candidate is a DIFFERENT street, not a typo.
const directionConflict = (a, b) => {
  const da = DIRECTION_WORDS.filter(w => a.includes(w));
  const db = DIRECTION_WORDS.filter(w => b.includes(w));
  return da.some(w => !db.includes(w)) || db.some(w => !da.includes(w));
};

/**
 * Extract the street token from a morgue LOCATION value.
 * "Burton - Eastbourne Way" -> "eastbourne way"; "Eastbourne Way" -> same.
 * Returns '' for unknown/blank locations.
 */
export const extractStreetToken = (location) => {
  const raw = String(location || '').trim();
  if (!raw || /location unknown|^unknown$/i.test(raw)) return '';
  const parts = raw.split(/\s+-\s+/);
  const street = parts.length > 1 ? parts[parts.length - 1] : raw;
  return normalizeStreetName(street);
};

/** Levenshtein distance (iterative, O(min) memory). */
const levenshtein = (a, b) => {
  const m = a.length; const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[n];
};

export const similarity = (a, b) => 1 - levenshtein(a, b) / Math.max(a.length, b.length);

/**
 * Build a normalized-name -> street index from `verified_locations` values.
 * Only `type: 'Street'` records with usable geometry are indexed.
 */
export const buildStreetIndex = (verifiedLocations) => {
  const index = new Map();
  const streets = Object.values(verifiedLocations || {}).filter(v => v && v.type === 'Street');
  for (const s of streets) {
    const key = normalizeStreetName(s.name);
    if (key && (s.path?.length > 1 || s.x !== undefined || s.gameX !== undefined)) {
      index.set(key, s);
    }
  }
  return index;
};

/**
 * Resolve one morgue location string against the street index.
 * Returns { street, match, score } or null.
 *   match: 'exact' | 'contains' | 'fuzzy'
 */
export const resolveStreet = (location, streetIndex) => {
  const token = extractStreetToken(location);
  if (!token || !streetIndex || streetIndex.size === 0) return null;

  const exact = streetIndex.get(token);
  if (exact) return { street: exact, match: 'exact', score: 1 };

  // Contains-match, guarded to avoid trivial substring hits ("st" in "street").
  for (const [key, street] of streetIndex) {
    const shorter = Math.min(key.length, token.length);
    if (shorter < 5) continue;
    if (key.includes(token) || token.includes(key)) {
      if (!directionConflict(token, key)) return { street, match: 'contains', score: 0.95 };
    }
  }

  // Conservative fuzzy.
  let best = null;
  let bestScore = 0;
  for (const [key, street] of streetIndex) {
    if (directionConflict(token, key)) continue;
    const score = similarity(token, key);
    if (score > bestScore) { bestScore = score; best = street; }
  }
  if (best && bestScore >= FUZZY_THRESHOLD) {
    return { street: best, match: 'fuzzy', score: bestScore };
  }

  return null;
};

/**
 * Midpoint (average of path vertices, or the point itself) in GAME coords.
 * Streets carry only a polyline — no explicit point — so the centroid of the
 * path is the bubble anchor.
 */
export const streetAnchor = (street) => {
  if (!street) return null;
  const pts = street.path?.length > 1
    ? street.path
    : (street.x !== undefined || street.gameX !== undefined
      ? [{ x: street.x ?? street.gameX, y: street.y ?? street.gameY }]
      : null);
  if (!pts || pts.length === 0) return null;
  let sx = 0; let sy = 0; let n = 0;
  for (const p of pts) {
    const x = Number(p.x); const y = Number(p.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    sx += x; sy += y; n += 1;
  }
  if (!n) return null;
  return { x: sx / n, y: sy / n };
};

/**
 * Aggregate morgue records into per-street body counts.
 * @returns { bubbles: [{name, count, anchor, match}], mapped, skipped, total }
 */
export const aggregateStreetBodies = (records, verifiedLocations) => {
  const streetIndex = buildStreetIndex(verifiedLocations);
  const byStreet = new Map();
  let mapped = 0;
  let skipped = 0;

  for (const r of (records || [])) {
    const res = resolveStreet(r?.location, streetIndex);
    if (!res) { skipped += 1; continue; }
    const anchor = streetAnchor(res.street);
    if (!anchor) { skipped += 1; continue; }
    const name = res.street.name;
    const entry = byStreet.get(name) || { name, count: 0, anchor, match: res.match };
    entry.count += 1;
    byStreet.set(name, entry);
    mapped += 1;
  }

  const bubbles = [...byStreet.values()].sort((a, b) => b.count - a.count);
  return { bubbles, mapped, skipped, total: (records || []).length };
};
