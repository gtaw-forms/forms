// tools/rehearse-mass-request.mjs — SAFE rehearsal for a mass autopsy request.
//
// Takes the exact topicTitle + requestBBCode a web batch submission would post
// and runs it through the SAME parser + assignment selector the live bot uses,
// without touching live state:
//   - no forum posts / replies
//   - no Firebase writes (selectMEsForMass is called with commit:false)
//   - no Discord messages / pings
// The one optional write is --discard, which deletes the pending TEST entry
// afterwards so it can never be auto-posted later.
//
// Use it after submitting with auto-post OFF, or against a saved BBCode file.
//
// Usage:
//   node tools/rehearse-mass-request.mjs --pending latest
//   node tools/rehearse-mass-request.mjs --pending <pushId> [--discard]
//   node tools/rehearse-mass-request.mjs --file request.bbcode --title "[Mass Autopsy Request] Davis Shooting [LSPD]"
//   ... add --no-rotation to skip the ME preview (no Firebase reads)
//
// Exit codes: 0 = rehearsed, 1 = parse/setup error, 2 = not a mass request.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import {
    isMassRequest,
    parseMassRequestBbcode,
    parseMassTitle,
} from '../discord-bot/services/autopsyRequestMonitor.js';
import { selectMEsForMass, getDevTestME } from '../discord-bot/services/autopsyRotation.js';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const argv = process.argv.slice(2);
const arg = (name) => {
    const i = argv.indexOf(name);
    return i >= 0 ? String(argv[i + 1] || '') : '';
};
const has = (name) => argv.includes(name);
const pendingId = arg('--pending');
const filePath = arg('--file');
const titleArg = arg('--title');
const skipRotation = has('--no-rotation');

function fail(message, code = 1) {
    console.error(`\n[ERR] ${message}`);
    process.exit(code);
}

function pad(value, width) {
    const s = String(value ?? '');
    return s.length >= width ? s.slice(0, width - 1) + '…' : s.padEnd(width);
}

// ── Firebase (read-only) ──
function openDb() {
    let adminBase = '';
    try { require.resolve('firebase-admin'); } catch { adminBase = path.join(ROOT, 'functions/node_modules'); }
    const pkg = (p) => (adminBase ? path.join(adminBase, p) : p);
    const { initializeApp, getApps, cert } = require(pkg('firebase-admin/app'));
    const { getDatabase } = require(pkg('firebase-admin/database'));
    const keyPath = path.join(ROOT, 'firebase-admin-key.json');
    if (!fs.existsSync(keyPath)) fail(`firebase-admin-key.json not found at ${keyPath}`);
    const key = require(keyPath);
    if (getApps().length === 0) {
        initializeApp({
            credential: cert(key),
            databaseURL: process.env.PHMC_DB_URL || 'https://gtaw-forms-default-rtdb.europe-west1.firebasedatabase.app',
        });
    }
    return getDatabase();
}

// ── Load the request ──
let title = titleArg.trim();
let bbcode = '';
let source = '';
let pendingEntry = null;
let resolvedPendingId = '';
let db = null;

if (pendingId) {
    db = openDb();
    if (pendingId === 'latest') {
        const snap = await db.ref('autopsy-requests/pending').once('value');
        const all = Object.entries(snap.val() || {})
            .filter(([, v]) => v && String(v.status || 'pending') === 'pending')
            .sort((a, b) => (b[1]?.createdAt || 0) - (a[1]?.createdAt || 0));
        const hit = all.find(([, v]) => v.isMass === true || isMassRequest(v.topicTitle, v.requestBBCode));
        if (!hit) fail('No pending mass request found in autopsy-requests/pending (submit one with auto-post OFF first).');
        source = `autopsy-requests/pending/${hit[0]} (latest mass entry)`;
        pendingEntry = hit[1];
        resolvedPendingId = hit[0];
    } else {
        const snap = await db.ref(`autopsy-requests/pending/${pendingId}`).once('value');
        if (!snap.exists()) fail(`No entry at autopsy-requests/pending/${pendingId}`);
        source = `autopsy-requests/pending/${pendingId}`;
        pendingEntry = snap.val();
        resolvedPendingId = pendingId;
    }
} else if (filePath) {
    if (!fs.existsSync(filePath)) fail(`File not found: ${filePath}`);
    const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
    // Accept either a raw BBCode file or a saved { topicTitle, requestBBCode } JSON.
    try {
        const json = JSON.parse(raw);
        if (json && typeof json === 'object' && (json.requestBBCode || json.bbcode)) {
            bbcode = String(json.requestBBCode || json.bbcode || '');
            title = title || String(json.topicTitle || json.title || '');
        } else {
            bbcode = raw;
        }
    } catch {
        bbcode = raw;
    }
    source = filePath;
} else {
    fail('Nothing to rehearse. Use --pending latest | --pending <pushId> | --file <path> [--title ...]');
}

if (pendingEntry) {
    bbcode = String(pendingEntry.requestBBCode || '');
    title = String(pendingEntry.topicTitle || '');
    if (!bbcode) fail(`${source} has no requestBBCode`);
}

if (!title) fail('No topic title. Pass --title "[Mass Autopsy Request] <incident> [AGENCY]".');
if (!bbcode) fail('No BBCode loaded.');

// ── Rehearse ──
const isMass = isMassRequest(title, bbcode);
const massTitle = parseMassTitle(title);
const mass = parseMassRequestBbcode(bbcode);

console.log('\n=== Mass autopsy request rehearsal (no posts / no assignments) ===');
console.log(`Source:      ${source}`);
console.log(`Title:       ${title}`);
console.log(`Mass match:  ${isMass ? 'YES' : 'NO'}`);
console.log(`Incident:    ${massTitle ? massTitle.label : '(unparseable)'}${massTitle?.agency ? `   Agency: ${massTitle.agency}` : ''}`);

if (!isMass) {
    console.error('\n[ERR] The bot would NOT take the mass path for this title/BBCode.');
    console.error('      It requires "[Mass Autopsy Request]" in the title (or >=2 --- BODY N --- headers).');
    console.error('      The singular path would process this request instead.');
    process.exit(2);
}

if (mass.error) fail(`Mass parser rejected the request: ${mass.error}`);

const bodies = mass.bodies || [];
const shared = mass.shared || {};
console.log(`Bodies:      ${bodies.length}`);
console.log(`Requester:   ${shared.requesterName || '?'} (${shared.requesterRank || '?'}, ${shared.requesterDept || '?'})`);

console.log('\n--- Bodies ---');
console.log(`  ${pad('#', 3)} ${pad('Decedent (OOC)', 34)} ${pad('Type', 6)} ${pad('DOD', 13)} ${pad('TOD', 11)} Location`);
for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i];
    const who = `${b.name || '?'}${b.oocName ? ` ((${b.oocName}))` : ''}`;
    console.log(`  ${pad(i + 1, 3)} ${pad(who, 34)} ${pad(b.deathType || '-', 6)} ${pad(b.dateOfDeath || '-', 13)} ${pad(b.timeOfDeath || '-', 11)} ${b.placeOfDeath || '-'}`);
    if (Array.isArray(b.incomplete) && b.incomplete.length > 0) {
        console.log(`      incomplete: ${b.incomplete.join(', ')}`);
    }
}

const warnings = Array.isArray(mass.warnings) ? mass.warnings : [];
if (warnings.length > 0) {
    console.log('\n--- Parser warnings ---');
    for (const w of warnings) console.log(`  - ${w}`);
}
const skipped = Array.isArray(mass.skippedBodies) ? mass.skippedBodies : [];
if (skipped.length > 0) {
    console.log('\n--- Skipped bodies (would NOT be filed) ---');
    for (const s of skipped) console.log(`  - Body ${s.label}: ${s.name || '(no name)'} — ${s.reason}`);
}

const agency = massTitle?.agency || '';
const factionTag = agency ? ` [${agency}]` : '';
const caseTitle = `Case <next> - ${massTitle?.label || 'Mass Autopsy Request'} (${bodies.length} ${bodies.length === 1 ? 'body' : 'bodies'})${factionTag} - UNASSIGNED`;
console.log(`\nWould file:  "${caseTitle}"`);
console.log('             (one f=266 thread; the case number is allocated only at live filing)');
console.log(`Would create: 1 ack reply on f=265, ${bodies.length} assignment row(s), ${bodies.length} completion path(s).`);

if (!skipRotation) {
    console.log('\n--- Assignment preview (commit:false; rotation is NOT advanced) ---');
    const devME = getDevTestME();
    if (devME) console.log(`  [NOTE] AUTOPSY_DEV_TEST is set in this shell — preview pins every body to ${devME}.`);
    try {
        const overrides = bodies.map(() => String(shared.assignedOverride || ''));
        const picks = await selectMEsForMass(db || openDb(), bodies.length, { overrides, commit: false });
        picks.forEach((me, i) => console.log(`  Body ${i + 1} -> ${me || '(none available — rotation/LOA)'}`));
    } catch (err) {
        console.log(`  (preview unavailable: ${err.message})`);
    }
}

console.log('\nNo forum posts, no assignments, no Discord messages.');

if (has('--discard')) {
    if (!resolvedPendingId) fail('--discard only applies to --pending rehearsals.');
    // Safety: never delete an old/possibly-real queued request. A test entry is
    // created minutes ago; anything older than 30 min is refused.
    const ageMs = Date.now() - Number(pendingEntry?.createdAt || 0);
    if (!Number.isFinite(ageMs) || ageMs > 30 * 60 * 1000) {
        fail(`Refusing to discard ${resolvedPendingId}: entry is older than 30 minutes (createdAt=${pendingEntry?.createdAt || 'unknown'}). Delete it manually if it really is a test.`);
    }
    await db.ref(`autopsy-requests/pending/${resolvedPendingId}`).remove();
    console.log(`[DONE] Deleted the test queue entry autopsy-requests/pending/${resolvedPendingId}.`);
    console.log('[IMPORTANT] Restart phmc-bot before re-enabling auto-post: the poster may still hold');
    console.log('            this entry in its in-memory queue and would post it on the next drain.');
    console.log('            pm2 restart phmc-bot (auto-post can stay off across the restart).');
}

// firebase-admin keeps a socket open; exit explicitly so the rehearsal ends.
process.exit(0);
