/**
 * Deploy LSSD — cross-post completed autopsies to LSSD forum f=2263
 * using the saved lssdRequestTopicId from the acknowledgement phase.
 *
 * No more searching — the target thread is already known from when
 * the request was first detected. Falls back gracefully if no ID is saved.
 */

import { EmbedBuilder } from 'discord.js';
import { logFnCall } from './deployLogger.js';
import { getForumClient } from './forumClient.js';
import { notifySelfHeal, sendLogMessage } from './logChannel.js';

export const LSSD_AUTOPSY_FORUM_ID = 2263;
export const LSSD_BASE = 'https://lssd.gta.world';

/**
 * Search the dedicated LSSD autopsy forum (f=2263) for the request topic matching
 * a decedent. LSSD auto-crossposts their own requests, so we rarely have the topic
 * ID saved — this search is the fallback. Terms are tried in order:
 *   1. "Name (( OOC ))"   (full reference, most specific)
 *   2. OOC name           (what appears in the topic title in parens)
 *   3. Plain decedent name (title-only cases like "Autopsy Request - Terrell Hylton")
 *
 * Results are title-verified against the decedent before returning (phpBB search
 * by recency can surface unrelated topics).
 *
 * @param {object} client — forum client already logged into the LSSD forum
 * @param {{oocName?: string, name?: string}} who — decedent OOC + character name
 * @returns {Promise<{topicId: string|number, title: string, term: string} | null>}
 */
export async function searchLssdRequestTopic(client, { oocName = '', name = '' } = {}) {
    const ooc = (oocName || '').trim();
    const decedent = (name || '').trim();
    const isGeneric = /^john\s*doe$/i.test(decedent);

    const terms = [];
    if (ooc && decedent && !isGeneric) terms.push(`${decedent} (( ${ooc} ))`);
    if (ooc) terms.push(ooc);
    if (decedent && !isGeneric) terms.push(decedent);
    if (terms.length === 0) {
        console.log('[AUTO-CROSSPOST] No searchable name for LSSD request lookup');
        return null;
    }

    const oocL = ooc.toLowerCase();
    const decL = decedent.toLowerCase();
    for (const term of terms) {
        const results = await client.searchForum(term, LSSD_AUTOPSY_FORUM_ID, { baseUrl: LSSD_BASE });
        if (!results || results.length === 0) continue;
        const match = results.find(r => {
            const t = (r.title || '').toLowerCase();
            return (oocL && t.includes(oocL)) || (decL && !isGeneric && t.includes(decL));
        });
        if (match) {
            console.log(`[AUTO-CROSSPOST] LSSD request found via "${term}" → #${match.topicId} "${match.title}"`);
            return { topicId: match.topicId, title: match.title, term };
        }
    }
    return null;
}

/**
 * Cross-post a completed autopsy report to the LSSD forum.
 * Uses the saved lssdRequestTopicId — no search needed.
 *
 * @param {object} reportData — report data object (for fallback dept check)
 * @param {string} bbCode — completed autopsy BBCode
 * @param {string} phmcTopicId — PHMC autopsy-requested topic ID (for status tracking)
 * @param {import('firebase-admin').database.Database} db
 * @param {string|null} lssdTopicId — saved LSSD request topic ID, or null to skip
 * @returns {Promise<{ok: boolean, skipped?: boolean, reason?: string}>}
 */
export async function crosspostAutopsyToLssd(reportData, bbCode, phmcTopicId, db, lssdTopicId) {
    logFnCall('deployLssd', 'crosspostAutopsyToLssd', 'Cross-posting to LSSD');

    // If no LSSD topic ID was saved during acknowledgement, skip
    if (!lssdTopicId) {
        console.log('[AUTO-CROSSPOST] No LSSD request topic saved — skipping');
        if (phmcTopicId && db) {
            await writeStatus(phmcTopicId, db, 'no_thread', { lssdCrosspostOoc: '(no LSSD request found)' });
        }
        return { ok: true, skipped: true };
    }

    // Track as pending
    if (phmcTopicId && db) {
        await writeStatus(phmcTopicId, db, 'pending');
    }

    console.log('[AUTO-CROSSPOST] Posting to LSSD topic #' + lssdTopicId);

    try {
        const client = getForumClient();
        await client.login(process.env.FORUM_LSSD_USERNAME, process.env.FORUM_LSSD_PASSWORD, { force: true, baseUrl: 'https://lssd.gta.world' });

        const r = await client.replyToTopic(lssdTopicId, 2263, bbCode, { dryRun: false, baseUrl: 'https://lssd.gta.world' });
        const status = r.ok ? 'completed' : 'failed';

        if (phmcTopicId && db) {
            await writeStatus(phmcTopicId, db, status, {
                lssdTopicId,
                lssdCrosspostedAt: r.ok ? new Date().toISOString() : undefined,
                lssdCrosspostError: r.ok ? undefined : (r.reason || 'Unknown'),
            });
        }

        console.log('[AUTO-CROSSPOST] ' + (r.ok ? 'Posted to LSSD #' + lssdTopicId : 'Failed: ' + (r.reason || 'Unknown')));
        if (!r.ok) {
            await notifyCrosspostFailure(phmcTopicId, '#' + lssdTopicId, r.reason || 'Unknown');
        }
        return { ok: r.ok, reason: r.reason };
    } catch (err) {
        console.error('[AUTO-CROSSPOST] Error:', err.message);
        if (phmcTopicId && db) {
            await writeStatus(phmcTopicId, db, 'failed', { lssdCrosspostError: err.message });
        }
        await notifyCrosspostFailure(phmcTopicId, lssdTopicId ? '#' + lssdTopicId : 'unknown topic', err.message);
        return { ok: false, error: err.message };
    }
}

/**
 * Post a clear failure alert to the log channel when an LSSD crosspost fails,
 * so staff can investigate while the retry sweep self-heals.
 */
async function notifyCrosspostFailure(phmcTopicId, target, reason) {
    if (!phmcTopicId) return;
    try {
        const embed = new EmbedBuilder()
            .setColor(0xdc3545)
            .setTitle('LSSD Crosspost Failed')
            .setDescription([
                `**Case:** #${phmcTopicId}`,
                `**Target:** ${target}`,
                `**Reason:** ${reason}`,
                '',
                'The recovery sweep will retry this automatically. Check `pm2 logs phmc-bot` for details.',
            ].join('\n'))
            .setFooter({ text: 'PHMC Bot — LSSD Crosspost' })
            .setTimestamp();
        await sendLogMessage(null, embed);
    } catch (err) {
        console.warn('[AUTO-CROSSPOST] Failure alert failed: ' + err.message);
    }
}

/**
 * Write LSSD cross-post status to Firebase (best-effort, never throws).
 */
async function writeStatus(phmcTopicId, db, status, extra) {
    if (!phmcTopicId || !db) return;
    try {
        const update = { lssdCrosspostStatus: status, lssdCrosspostUpdatedAt: new Date().toISOString(), ...extra };
        const clean = {};
        for (const [k, v] of Object.entries(update)) {
            if (v !== undefined) clean[k] = v;
        }
        await db.ref('autopsy-requested/' + phmcTopicId).update(clean);
    } catch (err) {
        console.warn('[AUTO-CROSSPOST] Failed to write status:', err.message);
    }
}

/**
 * Scan for failed LSSD cross-posts on startup and retry them.
 * Reads lssdRequestTopicId from each entry and retries with it.
 */
export async function retryFailedLssdCrossposts(db) {
    logFnCall('deployLssd', 'retryFailedLssdCrossposts', 'Scanning for failed cross-posts');
    if (!db) return;
    try {
        const snap = await db.ref('autopsy-requested').orderByChild('lssdCrosspostStatus').equalTo('failed').once('value');
        if (!snap.exists()) {
            console.log('[AUTO-CROSSPOST] No failed cross-posts to retry');
            return;
        }
        let retried = 0;
        const children = [];
        snap.forEach((child) => { children.push({ key: child.key, entry: child.val() }); });
        const promises = [];
        for (const { key: phmcTopicId, entry } of children) {
            if (entry.isPrivate === true) {
                console.log('[AUTO-CROSSPOST] Skipping ' + phmcTopicId + ' — private case, no crosspost');
                continue;
            }
            if (!entry.lssdCrosspostBbCode) {
                console.log('[AUTO-CROSSPOST] Skipping ' + phmcTopicId + ' — no BBCode saved');
                continue;
            }
            let lssdTopicId = entry.lssdRequestTopicId || entry.lssdTopicId;
            // Self-heal: if no topic ID was saved (detection-time search missed it), try a
            // fresh search on the dedicated LSSD autopsy forum (f=2263) before giving up.
            if (!lssdTopicId) {
                const oocSearch = entry.lssdCrosspostOoc || entry.oocName || '';
                const nameSearch = entry.name || '';
                if (!oocSearch && !nameSearch) {
                    console.log('[AUTO-CROSSPOST] Skipping ' + phmcTopicId + ' — no LSSD topic ID saved and no searchable name');
                    continue;
                }
                console.log('[AUTO-CROSSPOST] No saved LSSD topic for ' + phmcTopicId + ' — searching LSSD autopsy forum...');
                try {
                    const client = getForumClient();
                    await client.login(process.env.FORUM_LSSD_USERNAME, process.env.FORUM_LSSD_PASSWORD, { force: true, baseUrl: LSSD_BASE });
                    const found = await searchLssdRequestTopic(client, { oocName: oocSearch, name: nameSearch });
                    if (found) {
                        console.log('[AUTO-CROSSPOST] Found LSSD topic #' + found.topicId + ' for ' + phmcTopicId);
                        await db.ref('autopsy-requested/' + phmcTopicId + '/lssdRequestTopicId').set(String(found.topicId)).catch(() => {});
                        lssdTopicId = String(found.topicId);
                    } else {
                        console.log('[AUTO-CROSSPOST] No LSSD topic found for ' + phmcTopicId + ' — will retry next sweep');
                        continue;
                    }
                } catch (err) {
                    console.error('[AUTO-CROSSPOST] LSSD topic search error for ' + phmcTopicId + ': ' + err.message);
                    continue;
                }
            }
            console.log('[AUTO-CROSSPOST] Retrying cross-post for ' + (entry.lssdCrosspostOoc || phmcTopicId));
            const reportData = { data: { decedentOOC: entry.lssdCrosspostOoc || '', department: 'LSSD' } };
            promises.push(
                crosspostAutopsyToLssd(reportData, entry.lssdCrosspostBbCode, phmcTopicId, db, lssdTopicId)
                    .then((r) => {
                        if (r.ok && !r.error) {
                            console.log('[AUTO-CROSSPOST] Retry succeeded for ' + phmcTopicId);
                            notifySelfHeal(phmcTopicId, 'lssd crosspost failed', 'LSSD crosspost posted');
                        } else {
                            console.log('[AUTO-CROSSPOST] Retry failed for ' + phmcTopicId + ': ' + (r.error || r.reason || 'Unknown'));
                            notifySelfHeal(phmcTopicId, 'lssd crosspost failed', 'Retry FAILED: ' + (r.error || r.reason || 'Unknown'));
                        }
                    })
                    .catch(err => {
                        console.error('[AUTO-CROSSPOST] Retry error for ' + phmcTopicId + ': ' + err.message);
                        notifySelfHeal(phmcTopicId, 'lssd crosspost failed', 'ERROR: ' + err.message);
                    })
            );
            retried++;
        }
        await Promise.allSettled(promises);
        console.log('[AUTO-CROSSPOST] Retried ' + retried + ' failed cross-post(s)');
    } catch (err) {
        console.error('[AUTO-CROSSPOST] Retry scan error:', err.message);
    }
}
