// debug-testing-scripts/force-lssd-crossposts.mjs
// Force-publish pending LSSD autopsy crossposts that were skipped or failed.
//
// Scans autopsy-requested for LSSD cases with a completed autopsy that never
// reached the LSSD forum, resolves the target request topic (saved ID, or a
// fresh LSSD forum search by OOC / decedent name), and posts the autopsy report.
//
// Usage (on VPS, from discord-bot/):
//   node debug-testing-scripts/force-lssd-crossposts.mjs                      # dry-run preview (default)
//   node debug-testing-scripts/force-lssd-crossposts.mjs --post                # actually post
//   node debug-testing-scripts/force-lssd-crossposts.mjs --post --only "name"  # filter by key/ooc/name substring
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
    const envPath = resolve(__dirname, '..', '.env');
    if (!existsSync(envPath)) {
        console.warn('[FORCE-LSSD] No .env found at ' + envPath);
        return;
    }
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const sepIndex = trimmed.indexOf('=');
        if (sepIndex === -1) continue;
        const key = trimmed.slice(0, sepIndex).trim();
        const value = trimmed.slice(sepIndex + 1).trim();
        if (!process.env[key]) process.env[key] = value;
    }
}
loadEnv();

import firebase from '../services/firebase.js';
firebase.init();
const db = firebase.db;

import { getForumClient } from '../services/forumClient.js';
import { crosspostAutopsyToLssd, searchLssdRequestTopic } from '../services/deployLssd.js';

const LSSD_BASE = 'https://lssd.gta.world';
// ── Hard-coded allowlist ──
// ONLY these autopsy-requested keys are processed by default. Everything else is
// skipped unless --all is passed (we don't care about the other requests).
const ALLOWED_KEYS = ['9889', '9898']; // Edwin Fimbres [LSSD], Terrell Hylton [LSSD]

const POST = process.argv.includes('--post');
const ALLOW_INCOMPLETE = process.argv.includes('--all');
const only = (() => {
    const i = process.argv.indexOf('--only');
    return i !== -1 && process.argv[i + 1] ? process.argv[i + 1].toLowerCase() : '';
})();
const topicOverride = (() => {
    const i = process.argv.indexOf('--topic');
    return i !== -1 && process.argv[i + 1] ? String(process.argv[i + 1]) : '';
})();

function isLssdEntry(entry) {
    const faction = (entry.faction || '').toLowerCase();
    const title = entry.title || '';
    const reqDept = (entry.parsed?.requesterDept || '').toLowerCase();
    return faction === 'lssd' || /\[lssd\]/i.test(title) || reqDept.includes('lssd') || reqDept.includes('sheriff');
}

// Build an index of stored autopsy report BBCode keyed by decedent OOC/name, so
// entries whose completion flow never persisted the BBCode can still be recovered.
// The decedent names live on the DATA stores (scheduledReports / newSavedReports);
// the report content lives on the BBCode stores under the same author/key.
const reportBbIndex = {};
for (const dataPath of ['scheduledReports', 'newSavedReports']) {
    const dataSnap = await db.ref(dataPath).once('value');
    if (!dataSnap.exists()) continue;
    const authorChildren = [];
    dataSnap.forEach((author) => authorChildren.push(author));
    for (const author of authorChildren) {
        const repChildren = [];
        author.forEach((rep) => repChildren.push(rep));
        for (const rep of repChildren) {
            const v = rep.val() || {};
            if (v.formId && v.formId !== 'autopsy') continue;
            const d = v.data || {};
            const ooc = (d.decedentOOC || '').toLowerCase();
            const name = (d.decedentName || '').toLowerCase();
            if (!ooc && (!name || /^john\s*doe$/.test(name))) continue;
            const bbPath = dataPath === 'scheduledReports' ? 'scheduledReportsBBCode' : 'newSavedReportBBCode';
            const bbSnap = await db.ref(`${bbPath}/${author.key}/${rep.key}`).once('value');
            const bb = bbSnap.val()?.bbCode || '';
            if (!bb) continue;
            if (ooc) reportBbIndex[ooc] = bb;
            if (name && !reportBbIndex[name]) reportBbIndex[name] = bb;
        }
    }
}

async function resolveLssdTopic(entry) {
    if (topicOverride) return { topicId: topicOverride, source: 'override', title: '(--topic ' + topicOverride + ')' };
    const saved = entry.lssdRequestTopicId || entry.lssdTopicId;
    const ooc = entry.lssdCrosspostOoc || entry.oocName || '';
    const name = entry.name || '';
    const oocL = ooc.toLowerCase();
    const nameL = name.toLowerCase();
    const isGeneric = /^john\s*doe$/i.test(nameL);
    const query = ooc
        ? `(( ${ooc} ))`
        : (name && !isGeneric ? name : '');
    if (!query) {
        return { topicId: saved || null, source: saved ? 'saved-unverified' : 'no-search-term', query };
    }
    try {
        const client = getForumClient();
        await client.login(process.env.FORUM_LSSD_USERNAME, process.env.FORUM_LSSD_PASSWORD, { force: true, baseUrl: LSSD_BASE });
        // Scoped search on the dedicated LSSD autopsy forum (f=2263), trying
        // "Name (( OOC ))" then the plain name — returns a title-verified topic.
        const found = await searchLssdRequestTopic(client, { oocName: ooc, name });
        const matches = found ? [found] : [];
        // Prefer the saved topic if it is among the title-matching results.
        if (saved && matches.length > 0 && String(matches[0].topicId) === String(saved)) {
            return { topicId: saved, source: 'saved', title: matches[0].title, total: matches.length };
        }
        if (saved && matches.length > 0) {
            console.warn(`[FORCE-LSSD] Saved topic #${saved} did not title-match — using #${matches[0].topicId} "${matches[0].title}" instead`);
        }
        if (matches.length > 0) {
            const m = matches[0];
            return { topicId: m.topicId, source: 'search', title: m.title, total: matches.length, all: matches.map(r => '#' + r.topicId + ' "' + r.title + '"') };
        }
        return {
            topicId: null, source: 'search-no-match', query,
            all: [`#${saved || '?'} "${saved ? 'saved target' : 'no saved target'}"`],
        };
    } catch (err) {
        return { topicId: null, source: 'search-error', query, error: err.message };
    }
}

const snap = await db.ref('autopsy-requested').once('value');
if (!snap.exists()) {
    console.log('[FORCE-LSSD] No autopsy-requested entries at all');
    process.exit(0);
}

const pending = [];
snap.forEach((child) => {
    const entry = child.val() || {};
    const key = child.key;
    if (only && !(key + ' ' + (entry.oocName || '') + ' ' + (entry.name || '') + ' ' + (entry.title || '')).toLowerCase().includes(only)) return;
    if (!isLssdEntry(entry)) return;
    if (entry.lssdCrosspostStatus === 'completed' || entry.lssdCrosspostedAt) return;
    // Hard-coded allowlist: skip everything not in ALLOWED_KEYS unless --all.
    if (ALLOWED_KEYS.length && !ALLOW_INCOMPLETE && !ALLOWED_KEYS.includes(key)) {
        console.log(`[FORCE-LSSD] ${key} — not in allowlist — skipped (--all to override)`);
        return;
    }
    // Safety: only force-post genuinely completed autopsies unless --all is passed.
    // The old cross-matching bug marked unrelated "John Doe" entries complete and
    // stored the wrong report's BBCode, so incomplete entries are excluded by default.
    if (!ALLOW_INCOMPLETE && entry.caseState !== 'complete') {
        console.log(`[FORCE-LSSD] ${key} — caseState="${entry.caseState || '?'}" (not complete) — skipped (use --all to force)`);
        return;
    }
    let bbCode = entry.completedBbCode || entry.lssdCrosspostBbCode;
    let bbSource = 'entry';
    if (!bbCode) {
        const oocKey = (entry.oocName || '').toLowerCase();
        const nameKey = (entry.name || '').toLowerCase();
        const found = reportBbIndex[oocKey] || reportBbIndex[nameKey];
        if (found) { bbCode = found; bbSource = 'report-store'; }
    }
    if (!bbCode) {
        console.log(`[FORCE-LSSD] ${key} — no report BBCode available (entry has none and no matching report store) — skipped`);
        return;
    }
    pending.push({ key, entry, bbCode, bbSource });
});

console.log(`[FORCE-LSSD] ${POST ? 'POSTING' : 'DRY-RUN'} — ${pending.length} pending LSSD crosspost(s)${only ? ' (filter: "' + only + '")' : ''}\n`);

let ok = 0, failed = 0, skipped = 0;
for (const { key, entry, bbCode, bbSource } of pending) {
    const label = (entry.title || entry.oocName || entry.name || key);
    console.log(`── ${key} — ${label} [state=${entry.caseState || '?'}]`);

    const resolved = await resolveLssdTopic(entry);
    if (!resolved.topicId) {
        console.log(`   [SKIP] No LSSD topic: ${resolved.source}${resolved.query ? ' (query: ' + resolved.query + ')' : ''}${resolved.error ? ' — ' + resolved.error : ''}`);
        skipped++;
        continue;
    }
    console.log(`   [OK] Target LSSD topic #${resolved.topicId} (${resolved.source}${resolved.total ? ', ' + resolved.total + ' results' : ''})`);
    if (resolved.title && resolved.source === 'search') {
        console.log(`       Best match: ${resolved.title}`);
        if (resolved.all && resolved.all.length > 1) {
            console.log(`       Top results: ${resolved.all.join(' | ')}`);
        }
    }

    console.log(`   [BB] Report content from: ${bbSource} (${bbCode.length} chars)`);

    if (!POST) {
        console.log(`   [DRY] Would post autopsy report to #${resolved.topicId}`);
        ok++;
        continue;
    }

    const reportData = { data: { decedentOOC: entry.lssdCrosspostOoc || entry.oocName || '', department: 'LSSD' } };
    try {
        const r = await crosspostAutopsyToLssd(reportData, bbCode, key, db, resolved.topicId);
        if (r.ok && !r.error) {
            console.log(`   [POSTED] Report posted to #${resolved.topicId}`);
            ok++;
        } else {
            console.log(`   [FAIL] ${r.error || r.reason || 'Unknown'}`);
            failed++;
        }
    } catch (err) {
        console.log(`   [FAIL] ${err.message}`);
        failed++;
    }
}

console.log(`\n[FORCE-LSSD] Done — posted: ${ok}, failed: ${failed}, skipped: ${skipped}`);
if (!POST) console.log('[FORCE-LSSD] Run with --post to actually publish. Use --only "<name>" to target one case.');
process.exit(failed > 0 ? 1 : 0);
