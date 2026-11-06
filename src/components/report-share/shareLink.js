// Portal deep links — one saved report, addressed by its store path.
//
//   #/report/<author>/<key>
//
// The bot's law-enforcement notice points at a single report ("a Coroner
// Report has been finalized, view it on the portal"), so this shape is a public
// contract: it appears in messages we cannot edit afterwards. Everything that
// builds, matches or validates the link goes through this module — the route in
// App.jsx, the share page itself, and any future bot-side link builder — so the
// pieces cannot drift.
//
// Author / key are the same values the saved-report API uses
// (data/saved-reports/<author>/<key>.json): an author slug such as
// "Alyson_Frost" and a report key such as
// "_PK_John_Doe_Benji_Clemons_10_24_2026_1792872179619". Neither is invented
// here, so no character is stripped — they are percent-encoded per segment
// instead, which keeps values with punctuation working.

/** Hash prefix of the share route (must match App.jsx). */
export const REPORT_ROUTE_PREFIX = '#/report/';

/** Hash prefix of the short-code route (must match App.jsx). */
export const SHORT_ROUTE_PREFIX = '#/r/';

/** Canonical Pages site; override when hosting moves. */
export const PORTAL_BASE_URL = 'https://gtaw-forms.github.io/forms/';

/** Short-code alphabet: unambiguous (no 0/O, 1/l/I), URL-safe, 55 symbols. */
export const SHARE_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

/** Short-code length: 55^6 ≈ 28B combos — no coordination needed. */
export const SHARE_CODE_LENGTH = 6;

/** Highest length we accept for one address segment (defensive, not a format). */
const MAX_SEGMENT_LENGTH = 300;

function cleanBase(baseUrl) {
  const base = String(baseUrl || PORTAL_BASE_URL).trim() || PORTAL_BASE_URL;
  return base.endsWith('/') ? base : `${base}/`;
}

/**
 * Hash path for a report: `#/report/<author>/<key>`, each segment encoded so a
 * space, `#` or `?` inside a slug cannot break the link or the hash router.
 */
export function buildReportPath(author, key) {
  return `${REPORT_ROUTE_PREFIX}${encodeURIComponent(String(author ?? ''))}/${encodeURIComponent(String(key ?? ''))}`;
}

/** Absolute link to a report, for messages, notices and copied URLs. */
export function buildReportUrl(author, key, baseUrl = PORTAL_BASE_URL) {
  return `${cleanBase(baseUrl)}${buildReportPath(author, key)}`;
}

/**
 * Parse a location hash into `{ author, key }`, or null when it is not a
 * report link. Used by the route guard (skip the migration notice on share
 * links) and by tests; the page itself reads `useParams()`.
 */
export function parseReportHash(hash) {
  const raw = String(hash || '');
  const path = raw.startsWith('#') ? raw.slice(1) : raw;
  const match = path.match(/^\/report\/([^/]+)\/([^/?#]+)/);
  if (!match) return null;
  try {
    return { author: decodeURIComponent(match[1]), key: decodeURIComponent(match[2]) };
  } catch {
    return null; // malformed %-escape
  }
}

/** True when a hash addresses a shared report. */
export function isReportHash(hash) {
  return parseReportHash(hash) !== null || parseShortHash(hash) !== null;
}

/**
 * Generate a random share code (`crypto.getRandomValues`, unambiguous
 * alphabet). Random per save — collisions are resolved by the index write,
 * not by coordination.
 */
export function generateShareCode() {
  const alpha = SHARE_CODE_ALPHABET;
  const bytes = new Uint8Array(SHARE_CODE_LENGTH);
  const cryptoObj = (typeof globalThis !== 'undefined' && globalThis.crypto) || null;
  if (cryptoObj?.getRandomValues) {
    cryptoObj.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let out = '';
  for (const b of bytes) out += alpha[b % alpha.length];
  return out;
}

/** True for a well-formed share code (shape only — existence needs the index). */
export function isValidShareCode(code) {
  const text = typeof code === 'string' ? code.trim() : '';
  if (text.length !== SHARE_CODE_LENGTH) return false;
  for (const ch of text) {
    if (!SHARE_CODE_ALPHABET.includes(ch)) return false;
  }
  return true;
}

/** Hash path for a code: `#/r/<code>`. */
export function buildShortReportPath(code) {
  return `${SHORT_ROUTE_PREFIX}${String(code ?? '').trim()}`;
}

/** Absolute short link to a report. */
export function buildShortReportUrl(code, baseUrl = PORTAL_BASE_URL) {
  return `${cleanBase(baseUrl)}${buildShortReportPath(code)}`;
}

/**
 * Parse a short-code hash into `{ code }`, or null when it is not one.
 */
export function parseShortHash(hash) {
  const raw = String(hash || '');
  const path = raw.startsWith('#') ? raw.slice(1) : raw;
  const match = path.match(/^\/r\/([^/?#]+)/);
  if (!match) return null;
  const code = match[1];
  return isValidShareCode(code) ? { code } : null;
}

/**
 * Guard against empty / oversized / control-character segments before we ask
 * the API for anything. This is a sanity check, not authorisation: the report
 * itself is only readable by a signed-in user (getSavedReport policy).
 */
export function isValidReportRef(author, key) {
  const ok = (value) => {
    const text = typeof value === 'string' ? value.trim() : '';
    return text.length > 0
      && text.length <= MAX_SEGMENT_LENGTH
      && !/[\u0000-\u001f\u007f]/.test(text);
  };
  return ok(author) && ok(key);
}
