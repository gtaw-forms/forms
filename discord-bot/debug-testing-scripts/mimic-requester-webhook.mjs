/**
 * mimic-requester-webhook.mjs — locally mimic requester completion webhooks.
 *
 * Uses the REAL payload builder from services/requesterWebhook.js so what you
 * see in Discord is byte-identical to a live send. Never touches the forum.
 *
 * Usage:
 *   node debug-testing-scripts/mimic-requester-webhook.mjs --print --synthetic
 *   node debug-testing-scripts/mimic-requester-webhook.mjs --print --entry 10021
 *   node debug-testing-scripts/mimic-requester-webhook.mjs --send <webhook-url> --synthetic --as sadcr
 *   node debug-testing-scripts/mimic-requester-webhook.mjs --print --entry 10021 --as dao   # preview DAO routing
 *
 * Variants:
 *   --entry <key>      pull a real autopsy-requested record (READ-ONLY)
 *   --synthetic        fabricate a CASELINK request instead of reading RTDB
 *   --as <FACTION>     override faction routing (LSSD | SADCR | DAO | LSPD)
 *   --no-mapping       ignore any officer-discord mapping (preview salutation fallback)
 *   --human            human-posted request (copy says PHMC inbox/Autopsy Records, never CASELINK)
 *   --no-me            no ME assigned / no ME discord mapping
 *   --multi            pretend all-cases-done multi-decedent record (uses per-case id 0)
 *   --unassigned       leave "- UNASSIGNED" suffix on the title (tests cleanup)
 *   --send <url>       POST to this webhook (dev-discord test webhook) instead of printing
 *   --print            pretty-print the payload JSON (default when no --send)
 *
 * Safety: this script NEVER writes Firebase and NEVER posts to the forum.
 * With no --send flag it is fully offline (--print only).
 */
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BOT_DIR = path.resolve(__dirname, '..');       // discord-bot/
const REPO_ROOT = path.resolve(BOT_DIR, '..');        // phmc-forms repo root

// ── Args ──
const argv = process.argv.slice(2);
const arg = (name) => {
    const i = argv.indexOf(name);
    return i !== -1 ? argv[i + 1] : undefined;
};
const has = (name) => argv.includes(name);

const ENTRY_KEY = arg('--entry');
const FACTION_OVERRIDE = (arg('--as') || '').toUpperCase();
const SEND_URL = arg('--send');
const DO_PRINT = !SEND_URL || has('--print');

// ── Service imports (the real ones — same code path as production) ──
const { buildCompletionPayload, resolveRequesterPing } = await import('../services/requesterWebhook.js');
const { getAgencyForum } = await import('../services/agencyForums.js');

// ── Build entry data ──
let entry;
let label;

// Resolve firebase-admin as a bare package (this script lives inside
// discord-bot/, whose node_modules hosts it; exports maps forbid path requires).
let adminPkg;
try {
    adminPkg = {
        app: require('firebase-admin/app'),
        db: require('firebase-admin/database'),
    };
} catch { adminPkg = null; }

if (ENTRY_KEY) {
    if (!adminPkg) throw new Error('firebase-admin not found under discord-bot/node_modules');
    const { initializeApp, getApps, cert } = adminPkg.app;
    const { getDatabase } = adminPkg.db;
    if (getApps().length === 0) {
        initializeApp({
            credential: cert(require(path.join(REPO_ROOT, 'firebase-admin-key.json'))),
            databaseURL: 'https://gtaw-forms-default-rtdb.europe-west1.firebasedatabase.app',
        });
    }
    const db = getDatabase();
    const snap = await db.ref(`autopsy-requested/${ENTRY_KEY}`).once('value');
    const rec = snap.val();
    if (!rec) {
        console.error(`[ERR] No record at autopsy-requested/${ENTRY_KEY}`);
        process.exit(1);
    }
    entry = rec;
    label = `real: ${rec.title || ENTRY_KEY}`;
} else {
    // Synthetic CASELINK request mirroring real prod shape (see entry 10021).
    entry = {
        title: 'Autopsy Request - Jennifer Bradley [LSSD]',
        name: 'Jennifer Bradley',
        oocName: '',
        faction: 'LSSD',
        caseNum: '517',
        caseTitle: 'Case 517 - Jennifer Bradley [LSSD] - UNASSIGNED',
        caseUrl: 'https://phmc.gta.world/viewtopic.php?t=10030',
        topicId: '10021',
        postedByCaselink: true,
        requesterPoster: 'CASELINK [Bot]',
        requesterDiscordTag: '._diaaa',
        parsed: { requesterName: 'Katherine Olsen' },
        lssdRequestTopicId: has('--multi') ? '' : '25000',
    };
    label = 'synthetic CASELINK/LSSD request';
}

if (has('--multi')) {
    // Simulate the per-case view the completion flow uses for multi records.
    entry.caseNum = '519';
    entry.caseTitle = 'Case 519 - Dylan Bongo [LSSD] - Dr Jane Roe';
    entry.name = 'Dylan Bongo';
    entry.oocName = '';
}

if (has('--human')) {
    // Human officer origin — copy must name PHMC inbox/Autopsy Records, never CASELINK.
    entry.postedByCaselink = false;
    entry.requesterPoster = 'Jimmy Kowalski';
}

if (has('--unassigned')) {
    entry.caseTitle = (entry.caseTitle || '').replace(/- Dr.*$/, '') || entry.caseTitle;
    if (!/- UNASSIGNED$/i.test(entry.caseTitle)) entry.caseTitle += ' - UNASSIGNED';
}

const factionKey = FACTION_OVERRIDE || String(entry.faction || '').toUpperCase() || 'LSSD';

// ── Resolve ping exactly like production ──
let dbStub = null;
if (!has('--no-mapping') && entry.requesterDiscordTag && adminPkg) {
    // Real admin db for the officer-discord mapping lookup (best effort).
    try {
        const { initializeApp, getApps, cert } = adminPkg.app;
        const { getDatabase } = adminPkg.db;
        if (getApps().length === 0) {
            initializeApp({
                credential: cert(require(path.join(REPO_ROOT, 'firebase-admin-key.json'))),
                databaseURL: 'https://gtaw-forms-default-rtdb.europe-west1.firebasedatabase.app',
            });
        }
        dbStub = getDatabase();
    } catch { dbStub = null; }
}
const ping = await resolveRequesterPing(dbStub, entry);

const meName = has('--no-me') ? '' : 'Jane Roe';
const meDiscordId = has('--no-me') ? null : '111222333444555666'; // stand-in for mapping lookup

const cfg = getAgencyForum(factionKey);
const agencyTopicFieldVal = cfg ? entry[cfg.topicField] : null;
const deepLink = (cfg && agencyTopicFieldVal)
    ? `${cfg.baseUrl}/viewtopic.php?t=${agencyTopicFieldVal}`
    : null;

const payload = buildCompletionPayload({
    caseTitle: entry.caseTitle || entry.title || '',
    caseNumber: entry.caseNum ?? '',
    meName,
    meDiscordId,
    requesterSalutation: ping.salutation,
    requesterDiscordId: ping.discordId,
    factionKey,
    postedByCaselink: entry.postedByCaselink !== false,
    agencyTopicUrl: deepLink,
});

// ── Report ──
console.log('=== MIMIC REQUESTER WEBHOOK ===');
console.log(`source    : ${label}`);
console.log(`faction   : ${factionKey}${cfg ? ` (forum ${cfg.forumId})` : ' (NO registry forum)'}`);
console.log(`ping      : ${ping.discordId ? `<@${ping.discordId}> (numeric)` : `salutation "${ping.salutation}"`}`);
console.log(`button url: ${payload.components[0].components[0].label} -> ${payload.components[0].components[0].url}`);

if (DO_PRINT) {
    console.log('--- payload ---');
    console.log(JSON.stringify(payload, null, 2));
}

if (SEND_URL) {
    const res = await fetch(SEND_URL + '?with_components=true', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    console.log(res.ok ? '[OK] Sent to webhook' : `[ERR] HTTP ${res.status}: ${await res.text().catch(() => '')}`);
    process.exit(res.ok ? 0 : 1);
}
process.exit(0);
