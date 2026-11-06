// tools/mirror-scheduled-reports.mjs — copy deployment-queue reports into the
// VPS saved-report store that powers the migration UI / LEO feeds.
//
// Why: deployment-tracked saves live in RTDB `scheduledReports` (the bot
// queue), while the live feeds read `data/saved-reports` on the VPS. A queued
// report is therefore invisible to every feed until it is mirrored. This tool
// is a MIRROR, never a move: the RTDB queue entry is left untouched.
//
// Safe by default (dry run). Mirrors only reports the bot already deployed
// (`hasdeployed: true` / `deployStatus: 'deployed'`) unless --include-pending.
// Skips keys already on the VPS unless --overwrite. The VPS bulk endpoint
// bumps appMetadata/reportsDataVersion, so open migration UIs refresh.
//
// Usage:
//   node tools/mirror-scheduled-reports.mjs                       # dry run, all
//   node tools/mirror-scheduled-reports.mjs --apply               # mirror all
//   node tools/mirror-scheduled-reports.mjs --author=Thayse_Klenner --key=<reportKey> --apply
//   node tools/mirror-scheduled-reports.mjs --since=1790000000000 --limit=25 --apply
//   node tools/mirror-scheduled-reports.mjs --include-pending --apply
//   node tools/mirror-scheduled-reports.mjs --overwrite --apply
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function loadEnvFile(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const split = trimmed.indexOf('=');
    if (split < 1) continue;
    const key = trimmed.slice(0, split).trim();
    const value = trimmed.slice(split + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}
loadEnvFile(path.join(ROOT, '.env'));
loadEnvFile(path.join(ROOT, 'functions', '.env'));

const args = process.argv.slice(2);
const hasFlag = (name) => args.includes(`--${name}`);
const argValue = (name, fallback = '') => {
  const hit = args.find((arg) => arg.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

if (hasFlag('help')) {
  console.log(`Mirror deployed RTDB scheduledReports into the VPS saved-report store.
  --apply             write to the VPS (default: dry run)
  --author=<name>     only this sanitized author id (e.g. Thayse_Klenner)
  --key=<reportKey>   only this report key (requires --author)
  --since=<ms>        only reports at/after this timestamp
  --limit=<n>         newest n selected reports
  --include-pending   include reports the bot has not deployed yet
  --overwrite         re-write keys that already exist on the VPS
  --help`);
  process.exit(0);
}

const apply = hasFlag('apply');
const overwrite = hasFlag('overwrite');
const includePending = hasFlag('include-pending');
const authorFilter = argValue('author').trim();
const keyFilter = argValue('key').trim();
const limit = Math.max(0, Number(argValue('limit', '0')) || 0);
const since = Math.max(0, Number(argValue('since', '0')) || 0);

if (keyFilter && !authorFilter) {
  console.error('--key requires --author (the RTDB path is author-scoped).');
  process.exit(1);
}

const apiUrl = (process.env.MORGUE_API_URL || 'http://88.208.243.254').replace(/\/$/, '');
const apiKey = process.env.MORGUE_API_KEY
  || String(process.env.MORGUE_API_KEYS || '').split(',')[0].trim();
if (!apiKey) {
  console.error('MORGUE_API_KEY (or MORGUE_API_KEYS) is missing from the environment/.env.');
  process.exit(1);
}

const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');

const serviceAccountPath = path.resolve(
  ROOT,
  process.env.FIREBASE_ADMIN_KEY_PATH || 'firebase-admin-key.json',
);
if (!existsSync(serviceAccountPath)) {
  console.error(`Firebase admin key not found: ${serviceAccountPath}`);
  process.exit(1);
}
if (getApps().length === 0) {
  initializeApp({
    credential: cert(require(serviceAccountPath)),
    databaseURL: process.env.FIREBASE_DATABASE_URL
      || 'https://gtaw-forms-default-rtdb.europe-west1.firebasedatabase.app',
  });
}
const db = getDatabase();

// Close Firebase's sockets before exiting; a bare process.exit() on Windows
// can trip a libuv assertion while connections are mid-close. Returns a promise
// that never resolves so top-level callers stop there; the timer exits.
const finish = (code = 0) => {
  try { db.goOffline(); } catch { /* ignore */ }
  return new Promise(() => {
    setTimeout(() => process.exit(code), 100);
  });
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJson(url, options = {}, attempts = 6) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const response = await fetch(url, options);
    if (response.status === 429 && attempt < attempts) {
      const retryAfter = Number(response.headers.get('retry-after')) || 61;
      console.log(`[mirror] rate limited — waiting ${retryAfter}s`);
      await response.arrayBuffer();
      await sleep(retryAfter * 1000);
      continue;
    }
    const text = await response.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text }; }
    if (!response.ok) {
      throw new Error(`${options.method || 'GET'} ${url} → HTTP ${response.status} ${text.slice(0, 200)}`);
    }
    return body;
  }
  throw new Error(`${options.method || 'GET'} ${url} → retries exhausted`);
}

const readNode = async (refPath) => (await db.ref(refPath).once('value')).val() || {};
const normalize = (value) => (value && typeof value === 'object' ? value : {});

const [reportsNode, bbCodeNode] = await Promise.all([
  authorFilter
    ? readNode(keyFilter ? `scheduledReports/${authorFilter}/${keyFilter}` : `scheduledReports/${authorFilter}`)
    : readNode('scheduledReports'),
  authorFilter
    ? readNode(keyFilter ? `scheduledReportsBBCode/${authorFilter}/${keyFilter}` : `scheduledReportsBBCode/${authorFilter}`)
    : readNode('scheduledReportsBBCode'),
]);

// A keyFilter read returns the report object itself; normalise it into the
// `{ [author]: { [key]: report } }` shape the rest of the tool expects.
const reportsTree = keyFilter && authorFilter
  ? { [authorFilter]: { [keyFilter]: reportsNode } }
  : authorFilter
    ? { [authorFilter]: reportsNode }
    : reportsNode;
const bbTree = keyFilter && authorFilter
  ? { [authorFilter]: { [keyFilter]: bbCodeNode } }
  : authorFilter
    ? { [authorFilter]: bbCodeNode }
    : bbCodeNode;

function extractBbCode(author, key, report) {
  const node = normalize(normalize(bbTree[author])[key]);
  const fromNode = typeof node === 'string' ? node : node.bbCode || node.bbcode || '';
  return typeof fromNode === 'string' && fromNode ? fromNode : (report.bbCode || '');
}

function isDeployed(report) {
  return report?.hasdeployed === true
    || report?.hasdeployed === 'true'
    || String(report?.deployStatus || '').toLowerCase() === 'deployed';
}

// morgue-api stores keys through `safeReportSegment` (only A-Z a-z 0-9 _ -),
// so RTDB keys containing e.g. parentheses come back sanitised in the feed.
// Compare both sides in that same shape or every run looks "new".
const vpsKey = (value) => String(value || '').replace(/[^a-zA-Z0-9_-]/g, '');

const selected = [];
let skippedNotDeployed = 0;
for (const [author, authorReports] of Object.entries(normalize(reportsTree))) {
  if (authorFilter && author !== authorFilter) continue;
  for (const [key, report] of Object.entries(normalize(authorReports))) {
    if (!report || typeof report !== 'object' || Array.isArray(report)) continue;
    if (keyFilter && key !== keyFilter) continue;
    if (!includePending && !isDeployed(report)) { skippedNotDeployed += 1; continue; }
    if (since && (Number(report.timestamp) || 0) < since) continue;
    selected.push({ author, key, report, bbCode: extractBbCode(author, key, report) });
  }
}
selected.sort((a, b) => (Number(b.report.timestamp) || 0) - (Number(a.report.timestamp) || 0));
const chosen = limit > 0 ? selected.slice(0, limit) : selected;

console.log(JSON.stringify({
  mode: apply ? 'apply' : 'dry-run',
  filter: { author: authorFilter || null, key: keyFilter || null, since: since || null, includePending },
  selected: chosen.length,
  skippedNotDeployed,
  withBbCode: chosen.filter((item) => item.bbCode).length,
  approximateBytes: chosen.reduce((sum, item) => sum + Buffer.byteLength(JSON.stringify(item), 'utf8'), 0),
}, null, 2));

if (!chosen.length) {
  console.log('[mirror] nothing to mirror.');
  await finish(0);
}

// Existing VPS keys — one list request per selected author (paginated cap 500),
// unless --overwrite. Avoids overwriting a newer VPS copy with a queue copy.
const existing = new Set();
if (!overwrite) {
  for (const author of new Set(chosen.map((item) => item.author))) {
    let offset = 0;
    for (;;) {
      const page = await fetchJson(
        `${apiUrl}/api/reports?author=${encodeURIComponent(author)}&limit=500&offset=${offset}`,
        { headers: { 'x-api-key': apiKey } },
      );
      const rows = Array.isArray(page?.reports) ? page.reports : [];
      for (const row of rows) existing.add(`${author}/${vpsKey(row.key)}`);
      offset += rows.length;
      if (!rows.length || offset >= Number(page?.total || 0)) break;
    }
  }
}

const pending = chosen.filter((item) => !existing.has(`${item.author}/${vpsKey(item.key)}`));
const alreadyThere = chosen.length - pending.length;
console.log(`[mirror] ${pending.length} new, ${alreadyThere} already on VPS${overwrite ? ' (overwrite: ignored)' : ''}.`);

if (!apply) {
  for (const item of pending.slice(0, 10)) {
    console.log(`  - ${item.author}/${item.key} | ${item.report.originalKey || '(untitled)'} | bbCode=${item.bbCode ? 'yes' : 'no'}`);
  }
  if (pending.length > 10) console.log(`  … and ${pending.length - 10} more`);
  console.log('[mirror] dry run only — re-run with --apply to write.');
  await finish(0);
}

const BATCH_SIZE = 25;
let migrated = 0;
for (let index = 0; index < pending.length; index += BATCH_SIZE) {
  const batch = pending.slice(index, index + BATCH_SIZE).map((item) => {
    const report = { ...item.report };
    delete report.bbCode;
    return { author: item.author, key: item.key, report, bbCode: item.bbCode || '' };
  });
  const result = await fetchJson(`${apiUrl}/api/reports/bulk`, {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ reports: batch }),
  });
  if (!result?.success) throw new Error(`Bulk mirror failed: ${JSON.stringify(result).slice(0, 200)}`);
  migrated += batch.length;
  console.log(`[mirror] ${migrated}/${pending.length}`);
}

console.log(JSON.stringify({ mode: 'apply', mirrored: migrated, alreadyThere, sourceQueueTouched: false }, null, 2));
await finish(0);
