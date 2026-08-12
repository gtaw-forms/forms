/**
 * deployLspd.js — Cross-post completed autopsies to LSPD forum f=1361.
 *
 * Creates a new topic on the LSPD forum with the case title and completed
 * autopsy report. Saves the LSPD topic ID in Firebase for future reference.
 *
 * LSPD Forum: f=1361 — https://lspd.gta.world/viewforum.php?f=1361
 * New Topic URL: posting.php?mode=post&f=1361
 */

import { logFnCall, notifyDeployFailure } from './deployLogger.js';
import { getForumClient } from './forumClient.js';
import { notifySelfHeal } from './logChannel.js';

const LSPD_BASE = 'https://lspd.gta.world';
const LSPD_FORUM_ID = 1361;

/**
 * Cross-post a completed autopsy to the LSPD forum.
 * Creates a new topic with the case title, posts the completed report as a reply.
 *
 * @param {object} reportData — report data object
 * @param {string} bbCode — completed autopsy BBCode
 * @param {string} phmcTopicId — PHMC autopsy-requested topic ID
 * @param {import('firebase-admin').database.Database} db
 * @param {string|null} lspdTopicId — not used yet (future: saved topic ID for replies)
 * @param {object} [options]
 * @param {string} [options.caseTitle] — title of the case for the new topic
 * @returns {Promise<{ok: boolean, skipped?: boolean, reason?: string, url?: string}>}
 */
export async function crosspostAutopsyToLspd(reportData, bbCode, phmcTopicId, db, lspdTopicId, options = {}) {
    logFnCall('deployLspd', 'crosspostAutopsyToLspd', 'LSPD cross-post', { phmcTopicId });

    // Check if this is an LSPD case
    const dept = (reportData?.data?.department || '').toLowerCase();
    if (!dept.includes('lspd') && !dept.includes('police')) {
        console.log('[LSPD-XP] Not LSPD — skipping');
        return { ok: true, skipped: true };
    }

    const caseTitle = options.caseTitle || reportData?.originalKey || 'Autopsy Case';
    const caseTopicId = options.caseTopicId || null;
    console.log('[LSPD-XP] LSPD cross-post for: "' + caseTitle + '"' + (caseTopicId ? ` caseTopicId=#${caseTopicId}` : ' caseTopicId=UNKNOWN'));

    try {
        const client = getForumClient();

        // Login to LSPD forum
        await client.login(process.env.FORUM_LSPD_USERNAME, process.env.FORUM_LSPD_PASSWORD, { force: true, baseUrl: LSPD_BASE });

        const decedentName = reportData?.data?.decedentName || 'Unknown';
        const decedentOOC = reportData?.data?.decedentOOC || '';
        const oocPart = decedentOOC ? ' ((' + decedentOOC + '))' : '';

        // Build the completed report reply
        const reportBody =
            '[divbox=white][b]Case:[/b] ' + caseTitle + '\n' +
            '[b]Decedent:[/b] ' + decedentName + oocPart + '\n' +
            '[b]Status:[/b] Completed\n' +
            '[hr][/hr]\n' +
            bbCode +
            '[/divbox]';

        // If an LSPD topic was created at detection time, reply to it
        let lspdTopicIdResult = null;
        if (lspdTopicId) {
            console.log('[LSPD-XP] Replying to existing LSPD topic #' + lspdTopicId);
            const replyResult = await client.replyToTopic(lspdTopicId, LSPD_FORUM_ID, reportBody, { dryRun: false, baseUrl: LSPD_BASE });
            if (!replyResult.ok) {
                throw new Error('Failed to reply to LSPD topic: ' + (replyResult.reason || 'unknown'));
            }
            lspdTopicIdResult = lspdTopicId;
        } else {
            // No existing topic — create a new one (legacy fallback)
            const topicTitle = 'Autopsy Report - ' + decedentName + oocPart + ' [LSPD]';
            console.log('[LSPD-XP] Creating new LSPD topic: "' + topicTitle + '"');
            const postResult = await client.postTopic(LSPD_FORUM_ID, topicTitle, reportBody, 'https://lspd.gta.world/posting.php?mode=post&f=1361');
            if (!postResult.ok) {
                throw new Error('Failed to create LSPD topic: ' + (postResult.reason || 'unknown'));
            }
            const tM = postResult.url.match(/[?&]t=(\d+)/);
            lspdTopicIdResult = tM ? tM[1] : null;
            console.log('[LSPD-XP] Topic created: ' + postResult.url);
        }

        // Save the LSPD topic ID in Firebase
        if (phmcTopicId && db && lspdTopicIdResult) {
            await writeStatus(phmcTopicId, db, 'completed', {
                lspdTopicId: lspdTopicIdResult,
                lspdCrosspostedAt: new Date().toISOString(),
            });
        }

        return { ok: true, url: lspdTopicIdResult };
    } catch (err) {
        console.error('[LSPD-XP] Error:', err.message);
        if (phmcTopicId && db) {
            await writeStatus(phmcTopicId, db, 'failed', { lspdCrosspostError: err.message });
        }
        if (phmcTopicId) {
            await notifyDeployFailure('Autopsy #' + phmcTopicId, 'lspd-crosspost', phmcTopicId, err.message);
        }
        return { ok: false, error: err.message };
    }
}

/**
 * Write LSPD cross-post status to Firebase.
 */
async function writeStatus(phmcTopicId, db, status, extra) {
    if (!phmcTopicId || !db) return;
    try {
        const update = { lspdCrosspostStatus: status, lspdCrosspostUpdatedAt: new Date().toISOString(), ...extra };
        const clean = {};
        for (const [k, v] of Object.entries(update)) {
            if (v !== undefined) clean[k] = v;
        }
        await db.ref('autopsy-requested/' + phmcTopicId).update(clean);
    } catch (err) {
        console.warn('[LSPD-XP] Failed to write status:', err.message);
    }
}

/**
 * Retry failed LSPD cross-posts on startup.
 */
export async function retryFailedLspdCrossposts(db) {
    logFnCall('deployLspd', 'retryFailedLspdCrossposts', 'Scanning for failed LSPD cross-posts');
    if (!db) return;
    try {
        const snap = await db.ref('autopsy-requested').orderByChild('lspdCrosspostStatus').equalTo('failed').once('value');
        if (!snap.exists()) {
            console.log('[LSPD-XP] No failed cross-posts to retry');
            return;
        }
        let retried = 0;
        const promises = [];
        snap.forEach((child) => {
            const entry = child.val();
            if (entry.isPrivate === true) {
                console.log('[LSPD-XP] Skipping ' + child.key + ' — private case, no crosspost');
                return;
            }
            if (!entry.lspdCrosspostBbCode) {
                console.log('[LSPD-XP] Skipping ' + child.key + ' — no BBCode saved');
                return;
            }
            console.log('[LSPD-XP] Retrying ' + child.key);
            const reportData = { data: { department: 'LSPD', decedentName: entry.name || '' } };
            promises.push(
                crosspostAutopsyToLspd(reportData, entry.lspdCrosspostBbCode, child.key, db, null)
                    .then(r => {
                        console.log('[LSPD-XP] Retry ' + (r.ok ? 'succeeded' : 'failed') + ' for ' + child.key);
                        if (r.ok) notifySelfHeal(child.key, 'lspd crosspost failed', 'LSPD crosspost posted');
                        else notifySelfHeal(child.key, 'lspd crosspost failed', 'Retry FAILED: ' + (r.error || r.reason || 'Unknown'));
                    })
                    .catch(err => {
                        console.error('[LSPD-XP] Retry error for ' + child.key + ': ' + err.message);
                        notifySelfHeal(child.key, 'lspd crosspost failed', 'ERROR: ' + err.message);
                    })
            );
            retried++;
        });
        await Promise.allSettled(promises);
        console.log('[LSPD-XP] Retried ' + retried + ' failed cross-post(s)');
    } catch (err) {
        console.error('[LSPD-XP] Retry scan error:', err.message);
    }
}
