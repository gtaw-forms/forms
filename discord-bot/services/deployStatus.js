/**
 * Deploy Status — helpers for marking report status in Firebase.
 *
 * Zero state dependencies — imports only from deployLogger.js.
 */

import { logFnCall } from './deployLogger.js';

/**
 * Mark a report as deployed (or failed) in Firebase.
 * Also cleans up the retry queue index.
 */
export async function markDeployed(db, authorId, key, success, extra = {}) {
    logFnCall('deployStatus', 'markDeployed', 'Marking report deployed', { key, success });
    const updates = {
        hasdeployed: success,
        deployedAt: new Date().toISOString(),
        deployedBy: 'autoDeploy',
        retryAt: null,
        deployStatus: success ? 'deployed' : 'failed_permanent',
        ...extra,
    };
    await db.ref(`scheduledReports/${authorId}/${key}`).update(updates);
    await db.ref(`retry-queue/${authorId}|${key}`).remove().catch(() => {});
}

/**
 * Write a deploy status message to the report in Firebase.
 * The web app reads this to show feedback in the UI.
 *
 * NOTE: no `deployCheckedAt` here on purpose. Routine touches (queued /
 * progress) used to bump it unconditionally, churning a write + listener
 * event on every deploy with zero readers depending on per-touch freshness
 * (verified: no deployCheckedAt reads in discord-bot, src/, or functions/;
 * getStuckReports keys off deployStatus). Real transitions still stamp it
 * explicitly at their call sites (deployRetry requeue/reschedule/terminal,
 * consent skip, executor handbrake, pick timeout, /report-retry).
 */
export async function setDeployStatus(db, authorId, key, status, message) {
    logFnCall('deployStatus', 'setDeployStatus', 'Setting deploy status', { key, status });
    await db.ref(`scheduledReports/${authorId}/${key}`).update({
        deployStatus: status,
        deployMessage: message,
    });
}

/**
 * Extract deploy metadata from a posted-content URL so the report record knows
 * WHERE it was posted (enables self-serve "Edit & Repost").
 */
function parseDeployUrl(url) {
    if (!url) return { deployUrl: null, deployTopicId: null, deployPostId: null };
    const s = String(url);
    const t = s.match(/[?&]t=(\d+)/);
    const p = s.match(/[?&]p=(\d+)/);
    return {
        deployUrl: url,
        deployTopicId: t ? t[1] : null,
        deployPostId: p ? p[1] : null,
    };
}

/**
 * Mark a report as completed and send a clear completion webhook.
 * Logs the outcome (update() resolution confirms persistence).
 *
 * @param {object}  db       - Firebase ref
 * @param {string}  authorId
 * @param {string}  key      - Report key
 * @param {string}  label    - Human-readable label (form title or key)
 * @param {string}  type     - Deploy type ('pm', 'topic', 'medical-record')
 * @param {string}  [resultUrl] - URL of the deployed content (optional)
 * @returns {Promise<boolean>} true if marked successfully
 */
export async function markReportComplete(db, authorId, key, label, type, resultUrl) {
    logFnCall('deployStatus', 'markReportComplete', 'Marking report complete', { key, type });
    try {
        await markDeployed(db, authorId, key, true, { ...parseDeployUrl(resultUrl), deployType: type });

        await setDeployStatus(db, authorId, key, 'deployed', `Successfully deployed to ${type}.`);

        console.log(`[AUTO] ${key} marked as COMPLETED, removing from queue.`);

        return true;
    } catch (err) {
        console.error(`[AUTO] ${key} FAILED to mark as completed: ${err.message}`);
        return false;
    }
}
