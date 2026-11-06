// tools/redrive-mass-request.mjs — re-arm a PARKED autopsy request for intake.
//
// Why this exists: when the mass parser cannot produce a single body (all
// bodies placeholder/unidentifiable) the monitor writes `caseState: 'skipped'`
// + `massParseError` + `skipReason`. ANY `caseState` makes the detection loop
// skip the topic forever, so a fixed source post is never re-read. This tool
// clears just that park marker so the next monitor cycle (or
// /force-autopsy-check) re-runs intake on the live post.
//
// It only clears the park state — it never invents data. Fix the forum post
// first (that is the source of truth), then re-drive.
//
// Usage:
//   node tools/redrive-mass-request.mjs <topicId> [--apply]
//
// Dry-run by default; pass --apply to write.
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

let adminBase = '';
try { require.resolve('firebase-admin'); } catch { adminBase = path.join(ROOT, 'functions/node_modules'); }
const pkg = (p) => (adminBase ? path.join(adminBase, p) : p);

const { initializeApp, getApps, cert } = require(pkg('firebase-admin/app'));
const { getDatabase } = require(pkg('firebase-admin/database'));

const key = require(path.join(ROOT, 'firebase-admin-key.json'));
if (getApps().length === 0) {
  initializeApp({ credential: cert(key), databaseURL: 'https://gtaw-forms-default-rtdb.europe-west1.firebasedatabase.app' });
}
const db = getDatabase();

const argv = process.argv.slice(2);
const topicId = argv.find((a) => !a.startsWith('--'));
const apply = argv.includes('--apply');
if (!topicId) {
  console.error('Usage: node tools/redrive-mass-request.mjs <topicId> [--apply]');
  process.exit(1);
}

const rec = (await db.ref(`autopsy-requested/${topicId}`).once('value')).val();
if (!rec) { console.error(`No record at autopsy-requested/${topicId}`); process.exit(1); }

console.log(`Target: t=${topicId}  ${rec.name || rec.parsed?.decedentName || '?'} — ${rec.title || ''}`);

if (rec.completedAt) {
  console.error(`Already completed (${rec.completedAt}) — refusing to re-drive.`);
  process.exit(1);
}

const state = String(rec.caseState || '');
if (state && state !== 'skipped') {
  // A live case (case_created / me_assigned / ack_sent / multi) must not be
  // reset — re-running intake would file a duplicate case thread.
  console.error(`caseState='${state}' is not a parked state — refusing to re-drive.`);
  process.exit(1);
}

const update = {
  caseState: '',
  massParseError: null,
  skipReason: null,
  redrivenAt: new Date().toISOString(),
  redrivenBy: 'redrive-mass-request (CLI)',
};

console.log(`  caseState: ${state || '(none)'} -> (cleared)`);
if (rec.massParseError) console.log(`  massParseError: ${rec.massParseError}`);
if (rec.skipReason) console.log(`  skipReason: ${rec.skipReason}`);
console.log('  (detection re-reads the LIVE forum post — fix it before re-driving)');

if (!apply) {
  console.log('\n[DRY RUN] No changes written. Re-run with --apply to write.');
  process.exit(0);
}

await db.ref(`autopsy-requested/${topicId}`).update(update);
console.log(`\n[DONE] autopsy-requested/${topicId} re-armed.`);
console.log('The monitor re-reads it next cycle, or run /force-autopsy-check now.');
process.exit(0);
