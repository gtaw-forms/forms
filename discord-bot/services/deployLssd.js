/**
 * Deploy LSSD — cross-post completed autopsies to LSSD forum f=2263
 * using the saved lssdRequestTopicId from the acknowledgement phase.
 *
 * No more searching — the target thread is already known from when
 * the request was first detected. Falls back gracefully if no ID is saved.
 */

import { logFnCall } from './deployLogger.js';
import { getForumClient } from './forumClient.js';

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
        return { ok: r.ok, reason: r.reason };
    } catch (err) {
        console.error('[AUTO-CROSSPOST] Error:', err.message);
        if (phmcTopicId && db) {
            await writeStatus(phmcTopicId, db, 'failed', { lssdCrosspostError: err.message });
        }
        return { ok: false, error: err.message };
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
        const promises = [];
        snap.forEach((child) => {
            const entry = child.val();
            const phmcTopicId = child.key;
            if (!entry.lssdCrosspostBbCode) {
                console.log('[AUTO-CROSSPOST] Skipping ' + phmcTopicId + ' — no BBCode saved');
                return;
            }
            const lssdTopicId = entry.lssdRequestTopicId || entry.lssdTopicId;
            if (!lssdTopicId) {
                console.log('[AUTO-CROSSPOST] Skipping ' + phmcTopicId + ' — no LSSD topic ID saved');
                return;
            }
            console.log('[AUTO-CROSSPOST] Retrying cross-post for ' + (entry.lssdCrosspostOoc || phmcTopicId));
            const reportData = { data: { decedentOOC: entry.lssdCrosspostOoc || '', department: 'LSSD' } };
            promises.push(
                crosspostAutopsyToLssd(reportData, entry.lssdCrosspostBbCode, phmcTopicId, db, lssdTopicId)
                    .then((r) => {
                        if (r.ok && !r.error) {
                            console.log('[AUTO-CROSSPOST] Retry succeeded for ' + phmcTopicId);
                        } else {
                            console.log('[AUTO-CROSSPOST] Retry failed for ' + phmcTopicId + ': ' + (r.error || r.reason || 'Unknown'));
                        }
                    })
            );
            retried++;
        });
        await Promise.allSettled(promises);
        console.log('[AUTO-CROSSPOST] Retried ' + retried + ' failed cross-post(s)');
    } catch (err) {
        console.error('[AUTO-CROSSPOST] Retry scan error:', err.message);
    }
}
