/**
 * nameWatch.js — silent OOC typo watch for autopsy requests.
 *
 * Compares open bodies' OOC names against the faction roster corpus
 * (LSPD/LSSD/SADCR roster files, same source as the requesting-officer
 * lookup). Near-misses are reported to the maintainer log channel with a
 * concrete fix proposal — NEVER auto-applied (identity data; a wrong guess
 * corrupts the record worse than a typo). Runs inside the 2-hour
 * systemMonitor cycle; each body is flagged at most once per OOC value.
 *
 * Scope: open (uncompleted) bodies from requests detected in the last 30
 * days. Generic/placeholder OOCs are skipped, not flagged.
 */

import { sendLogMessage } from './logChannel.js';

// OOC values that carry no identity signal — skip, never flag.
const SKIP_OOC_RE = /^(answer|unknown(\s*ooc)?|ooc\s*name|tbd|n\/a\b|na\b|none|\?+|\.+|-+)$/i;

const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

export function levenshtein(a, b) {
    const x = norm(a);
    const y = norm(b);
    if (x === y) return 0;
    if (!x.length) return y.length;
    if (!y.length) return x.length;
    let prev = new Array(y.length + 1);
    let cur = new Array(y.length + 1);
    for (let j = 0; j <= y.length; j++) prev[j] = j;
    for (let i = 1; i <= x.length; i++) {
        cur[0] = i;
        for (let j = 1; j <= y.length; j++) {
            cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
        }
        const tmp = prev;
        prev = cur;
        cur = tmp;
    }
    return prev[y.length];
}

/**
 * Best roster proposal for an OOC name, or null.
 * Rules: exact (normalized) hit = clean (returns {exact:true}, no proposal);
 * otherwise the closest roster name with edit distance 1–2 and length ≥ 4.
 * @param {string} ooc
 * @param {Map<string,{name:string,faction:string}>} corpus — normalized -> record
 */
export function proposeFix(ooc, corpus) {
    const n = norm(ooc);
    if (!n || n.length < 4 || SKIP_OOC_RE.test(n)) return null;
    if (corpus.has(n)) return { exact: true };
    let best = null;
    let bestDist = Infinity;
    for (const [cn, rec] of corpus) {
        if (Math.abs(cn.length - n.length) > 2) continue;
        const d = levenshtein(n, cn);
        if (d < bestDist) {
            bestDist = d;
            best = rec;
        }
        if (bestDist === 1) break;
    }
    if (best && bestDist >= 1 && bestDist <= 2) {
        return { exact: false, proposal: best.name, faction: best.faction, distance: bestDist };
    }
    return null;
}

async function loadCorpus() {
    const corpus = new Map();
    try {
        const { getFactionRoster } = await import('./factionRosterSync.js');
        for (const faction of ['lspd', 'lssd', 'sadcr']) {
            const data = getFactionRoster(faction) || {};
            for (const m of data.members || []) {
                const key = norm(m.name);
                if (key && !corpus.has(key)) corpus.set(key, { name: m.name, faction });
            }
        }
    } catch { /* empty corpus = silent no-op run */ }
    return corpus;
}

export async function checkSuspectNames(db) {
    console.log('[NAMEWATCH] Checking open OOC names against faction rosters...');
    try {
        const corpus = await loadCorpus();
        if (corpus.size === 0) {
            console.log('[NAMEWATCH] Empty roster corpus — skipping run.');
            return;
        }
        const now = Date.now();
        const windowMs = 30 * 24 * 60 * 60 * 1000;
        const notifiedSnap = await db.ref('monitoring/nameWatchNotified').once('value').catch(() => null);
        const notified = (notifiedSnap && notifiedSnap.val()) || {};
        const snap = await db.ref('autopsy-requested').once('value');
        if (!snap.exists()) return;

        const flags = [];
        const mark = async (flagKey, ooc, proposal) => {
            notified[flagKey] = { ooc, proposal: proposal || null, at: now };
            await db.ref(`monitoring/nameWatchNotified/${flagKey}`).set(notified[flagKey]).catch(() => {});
        };

        const consider = async (topicId, slot, name, ooc, me, caseNum) => {
            if (!ooc) return;
            const result = proposeFix(ooc, corpus);
            if (!result || result.exact) return;
            const flagKey = `${topicId}_${slot}`.replace(/[.$#[\]/]/g, '_');
            const prev = notified[flagKey];
            if (prev && prev.ooc === ooc) return; // already proposed for this value
            flags.push({ topicId, slot, name, ooc, me, caseNum, ...result });
            await mark(flagKey, ooc, result.proposal);
        };

        const jobs = [];
        snap.forEach((child) => {
            const v = child.val() || {};
            if (v.completedAt) return;
            const detected = v.detectedAt ? new Date(v.detectedAt).getTime() : 0;
            if (!detected || now - detected > windowMs) return;
            if (String(v.caseState || '').toLowerCase() === 'multi' && v.cases && typeof v.cases === 'object') {
                for (const [ci, c] of Object.entries(v.cases)) {
                    if (!c || c.completedAt) continue;
                    jobs.push(consider(child.key, `cases/${ci}`, c.name, c.oocName, c.assignedTo, v.caseNum));
                }
                return;
            }
            if (v.oocName && !v.completedAt) {
                jobs.push(consider(child.key, 'top', v.name, v.oocName, v.assignedTo, v.caseNum));
            }
        });
        await Promise.all(jobs);

        if (flags.length === 0) {
            console.log('[NAMEWATCH] No suspect OOC names.');
            return;
        }
        const lines = flags.slice(0, 10).map((f) =>
            `• "${f.ooc}" (${f.name || '?'} — Case #${f.caseNum || '?'} ${f.slot}, ME ${f.me || 'unassigned'}, t=${f.topicId}) — did you mean **"${f.proposal}"** (${f.faction.toUpperCase()}, d=${f.distance})? Fix: \`/fix-autopsy\` or edit \`autopsy-requested/${f.topicId}\``
        );
        await sendLogMessage(
            `**[NAMEWATCH]** ${flags.length} possibly mis-spelt OOC name(s) (proposals only — nothing changed):\n${lines.join('\n')}${flags.length > 10 ? `\n… +${flags.length - 10} more` : ''}`,
            null
        );
        console.log(`[NAMEWATCH] Flagged ${flags.length} suspect OOC name(s).`);
    } catch (err) {
        console.error('[NAMEWATCH] Check error:', err.message);
    }
}
