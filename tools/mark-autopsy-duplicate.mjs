// tools/mark-autopsy-duplicate.mjs — mark an autopsy-requested entry as a duplicate.
//
// Why this exists: `/autopsy-skip` searches by name and updates EVERY matching
// entry, so a re-filed duplicate that shares a decedent name with the original
// (e.g. Case 535 t=10342 duplicating the completed Case 532 t=10328) would also
// clobber the original's `caseState`. This tool targets ONE topic id.
//
// What it does:
//   - sets caseState 'skipped' (+ skippedAt/skippedBy/skipReason/duplicateOf),
//     which stops all wait checks (systemMonitor FINAL_STATES) and the monitor's
//     re-processing (any existing caseState is skipped by the detection guard);
//   - releases the assigned ME's rotation slot if this topic is still tracked
//     (guarded decrement — never goes negative).
//
// Usage:
//   node tools/mark-autopsy-duplicate.mjs <topicId> --of <originalTopicId> [--reason "text"] [--apply]
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

// ── Args ──
const argv = process.argv.slice(2);
const positionals = argv.filter((a) => !a.startsWith('--'));
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? undefined : argv[i + 1];
};
const topicId = positionals[0];
const ofTopicId = flag('of');
const reasonOverride = flag('reason');
const apply = argv.includes('--apply');

if (!topicId) {
  console.error('Usage: node tools/mark-autopsy-duplicate.mjs <topicId> --of <originalTopicId> [--reason "text"] [--apply]');
  process.exit(1);
}

const TERMINAL = new Set(['skipped', 'cancelled', 'denied', 'dry_run']);

const rec = (await db.ref(`autopsy-requested/${topicId}`).once('value')).val();
if (!rec) { console.error(`No record at autopsy-requested/${topicId}`); process.exit(1); }

// ── Guards ──
if (rec.completedAt) {
  console.error(`autopsy-requested/${topicId} is already completed (${rec.completedAt}) — nothing to do.`);
  process.exit(1);
}
const curState = String(rec.caseState || '').toLowerCase();
if (TERMINAL.has(curState)) {
  console.log(`autopsy-requested/${topicId} is already terminal (caseState='${rec.caseState}') — nothing to do.`);
  process.exit(0);
}

const original = ofTopicId ? (await db.ref(`autopsy-requested/${ofTopicId}`).once('value')).val() : null;
if (ofTopicId && !original) {
  console.warn(`[WARN] Original ${ofTopicId} not found — continuing without its case number.`);
}

const origCase = original?.caseNum ? `Case ${original.caseNum}` : (ofTopicId ? `topic ${ofTopicId}` : 'an earlier request');
const skipReason = reasonOverride
  || `duplicate${ofTopicId ? ` of ${origCase} (t=${ofTopicId})` : ''}`;

const update = {
  caseState: 'skipped',
  skippedAt: new Date().toISOString(),
  skippedBy: 'mark-autopsy-duplicate (CLI)',
  skipReason,
};
if (ofTopicId) {
  update.duplicateOf = {
    topicId: String(ofTopicId),
    caseNum: original?.caseNum ? String(original.caseNum) : null,
    name: original?.name || null,
    title: original?.title || null,
  };
}

console.log(`Target:  t=${topicId}  ${rec.name || '?'} — ${rec.title || ''}`);
console.log(`  caseState: ${rec.caseState || '(none)'} -> skipped`);
console.log(`  assignedTo: ${rec.assignedTo || '(none)'}${rec.caseNum ? `   caseNum: ${rec.caseNum}` : ''}`);
console.log(`  skipReason: ${skipReason}`);
if (ofTopicId) console.log(`  duplicateOf: t=${ofTopicId} ${original?.name || ''} ${original?.caseNum ? `(Case ${original.caseNum})` : ''}`);

// ── Rotation release (guarded) ──
let release = null;
if (rec.assignedTo) {
  const key2 = String(rec.assignedTo).toLowerCase();
  const tracker = (await db.ref(`autopsy-requests/assignments/${key2}`).once('value')).val() || {};
  const hasCase = !!(tracker.cases && tracker.cases[String(topicId)]);
  const active = Number(tracker.active) || 0;
  release = { me: rec.assignedTo, key: key2, hasCase, active, decrement: hasCase && active > 0 };
  console.log(`  rotation: ${rec.assignedTo} active=${active} tracksThisTopic=${hasCase} -> ${release.decrement ? 'active-1, drop case' : (hasCase ? 'drop case (active already 0)' : 'no change')}`);
}

if (!apply) {
  console.log('\n[DRY RUN] No changes written. Re-run with --apply to write.');
  process.exit(0);
}

await db.ref(`autopsy-requested/${topicId}`).update(update);
console.log(`\n[DONE] autopsy-requested/${topicId} marked skipped (duplicate).`);

if (release && (release.hasCase || release.active > 0)) {
  const updates = {};
  if (release.hasCase) updates[`autopsy-requests/assignments/${release.key}/cases/${topicId}`] = null;
  if (release.decrement) updates[`autopsy-requests/assignments/${release.key}/active`] = { '.sv': { increment: -1 } };
  await db.ref().update(updates);
  console.log(`[DONE] Released rotation slot for ${release.me}.`);
}

console.log('Wait checks: systemMonitor treats caseState "skipped" as settled. Monitor detection skips any entry with a caseState.');
process.exit(0);
