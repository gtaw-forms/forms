/**
 * drdbAudit.js — the `drdb-sent` flag audit trail.
 *
 * When a coroner report is SENT through the automatic LSPD path (opted-in
 * report → `lspdPortalFormQueue` live filing on the new website system), the
 * worker appends one pipe-delimited line to the LEO access audit log
 * (`data/leo-report-access.log`, the same file the LEO view audit uses).
 *
 * The flag itself is DERIVED at read time, never persisted on the report:
 * `morgue-api` scans the (tail-bounded, mtime-cached) log and reports
 * `drdb-sent: true` for identities with a send record. Reports filed before
 * the DRDB system existed have no send record and correctly read `false`.
 *
 * A line marks author/key sent when EITHER holds:
 *   - `source=portal-send` (the automatic filing path below), OR
 *   - the viewer looks like the DRDB integration (`/drdb/i`, e.g. a future
 *     server-to-server DRDB pull through the LEO API).
 * Officer views in migration-ui (`source=live|cache`, human viewer) do NOT
 * set the flag — viewing is not sending.
 *
 * Dependency-free (node builtins only): safe for the static bot-import
 * checker and for both the `phmc-bot` worker and the `morgue-api` reader.
 */

import { appendFileSync, existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Same file the LEO view audit appends to (morgue-api `LEO_AUDIT_PATH`). */
export const DRDB_AUDIT_LOG_PATH = resolve(__dirname, '..', 'data', 'leo-report-access.log');

/** Audit `source` value for automatic LSPD filings. */
export const DRDB_SEND_SOURCE = 'portal-send';

/** Viewer matcher for direct DRDB-integration pulls. */
export const DRDB_VIEWER_RE = /drdb/i;

/** Tail bound for the read path — the log rotates at 5 MB, so the full file is never scanned. */
export const DRDB_LOG_TAIL_LINES = 5000;

/** On-disk report identity: mirrors morgue-api `safeReportSegment`. */
export function sanitizeReportSegment(value) {
  return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '');
}

/** Canonical audit identity for a report. */
export function drdbReportId(author, key) {
  return `${sanitizeReportSegment(author)}/${sanitizeReportSegment(key)}`;
}

// eslint-disable-next-line no-control-regex -- strips control chars from untrusted report text before audit logging (log-injection defense)
const stripControls = (value, max = 200) => String(value || '').replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, max);

/**
 * Build one audit line for an automatic LSPD filing. Field order mirrors
 * `recordLeoReportView` in morgue-api.js so the existing log stays uniform.
 */
export function buildDrdbSendLine({
  author, key, title = '', agency = 'lspd', recipient = '', formUrl = '', reference = '',
} = {}) {
  return [
    new Date().toISOString(),
    'viewer=LSPD DRDB',
    'viewerSource=send',
    'verifiedViewer=none',
    'oauth=phmc-bot',
    'uid=bot',
    `report=${drdbReportId(author, key)}`,
    `title=${stripControls(title)}`,
    `agency=${stripControls(agency || 'lspd', 64)}`,
    `source=${DRDB_SEND_SOURCE}`,
    'ip=127.0.0.1',
    `recipient=${stripControls(recipient, 120)}`,
    `formUrl=${stripControls(formUrl, 300)}`,
    `reference=${stripControls(reference, 64)}`,
  ].join(' | ');
}

/** Best-effort append: a logging failure must never fail the send itself. */
export function appendDrdbSend(entry, logPath = DRDB_AUDIT_LOG_PATH) {
  try {
    appendFileSync(logPath, `${buildDrdbSendLine(entry)}\n`);
    return true;
  } catch (err) {
    console.warn(`[DRDB-AUDIT] Send-line append failed: ${err.message}`);
    return false;
  }
}

/**
 * Parse one audit line into its `k=v` fields. Tolerant: unknown shapes and
 * extra fields are ignored, values may contain `=` (split on the first one).
 * @returns {{report:string, source:string, viewer:string}}
 */
export function parseAuditLine(line) {
  const fields = { report: '', source: '', viewer: '' };
  for (const part of String(line || '').split(' | ')) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    const k = part.slice(0, eq).trim();
    const v = part.slice(eq + 1).trim();
    if (k === 'report' || k === 'source' || k === 'viewer') fields[k] = v;
  }
  return fields;
}

/**
 * Pure derivation: do these audit lines mark author/key sent?
 * Multi-leg filings share the report identity, so any matching leg counts.
 */
export function isDrdbSentInLines(lines, author, key) {
  const want = drdbReportId(author, key);
  if (!want || want === '/') return false;
  const arr = Array.isArray(lines) ? lines : String(lines || '').split('\n');
  for (const line of arr) {
    if (!line || !line.includes(want)) continue;
    const { report, source, viewer } = parseAuditLine(line);
    if (report !== want) continue;
    if (source === DRDB_SEND_SOURCE) return true;
    if (DRDB_VIEWER_RE.test(viewer)) return true;
  }
  return false;
}

// mtime+size cache: the bot worker (another process) appends, so re-read only
// when the file actually changed. Keeps the per-request LEO list scan cheap.
let _cache = { mtimeMs: 0, size: 0, sent: new Set(), path: '' };

/** Test hook: drop the module cache. */
export function _resetDrdbSentCache() {
  _cache = { mtimeMs: 0, size: 0, sent: new Set(), path: '' };
}

/** Read the tail-bounded log into a Set of sent `author/key` identities. */
export function loadDrdbSentSet(logPath = DRDB_AUDIT_LOG_PATH, maxLines = DRDB_LOG_TAIL_LINES) {
  const sent = new Set();
  try {
    if (!existsSync(logPath)) return sent;
    const all = readFileSync(logPath, 'utf-8').split('\n').filter(Boolean);
    const tail = all.length > maxLines ? all.slice(all.length - maxLines) : all;
    for (const line of tail) {
      const { report, source, viewer } = parseAuditLine(line);
      if (!report || !report.includes('/')) continue;
      if (source === DRDB_SEND_SOURCE || DRDB_VIEWER_RE.test(viewer)) sent.add(report);
    }
  } catch (err) {
    console.warn(`[DRDB-AUDIT] Sent-set load failed: ${err.message}`);
  }
  return sent;
}

/** Cached read-path check used by the LEO endpoints. */
export function getDrdbSentSet(logPath = DRDB_AUDIT_LOG_PATH) {
  try {
    if (!existsSync(logPath)) {
      _cache = { mtimeMs: 0, size: 0, sent: new Set(), path: logPath };
      return _cache.sent;
    }
    const st = statSync(logPath);
    if (_cache.path === logPath && _cache.mtimeMs === st.mtimeMs && _cache.size === st.size) {
      return _cache.sent;
    }
    const sent = loadDrdbSentSet(logPath);
    _cache = { mtimeMs: st.mtimeMs, size: st.size, sent, path: logPath };
    return sent;
  } catch (err) {
    console.warn(`[DRDB-AUDIT] Sent-set cache check failed: ${err.message}`);
    return new Set();
  }
}

/** Single-report read-path check. */
export function isDrdbSent(author, key, logPath = DRDB_AUDIT_LOG_PATH) {
  return getDrdbSentSet(logPath).has(drdbReportId(author, key));
}
