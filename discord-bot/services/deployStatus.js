/**
 * Deploy Status — helpers for marking report status in Firebase.
 *
 * Zero state dependencies — imports only from deployLogger.js.
 */

import { logFnCall, sendWebhook } from './deployLogger.js';

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
 */
export async function setDeployStatus(db, authorId, key, status, message) {
    logFnCall('deployStatus', 'setDeployStatus', 'Setting deploy status', { key, status });
    await db.ref(`scheduledReports/${authorId}/${key}`).update({
        deployStatus: status,
        deployMessage: message,
        deployCheckedAt: new Date().toISOString(),
    });
}

/**
 * Mark a report as completed and send a clear completion webhook.
 * Verifies the write succeeded and logs the outcome.
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
        await markDeployed(db, authorId, key, true);

        // Verify the write persisted
        const verifySnap = await db.ref(`scheduledReports/${authorId}/${key}/hasdeployed`).once('value');
        const hasdeployed = verifySnap.val();

        if (hasdeployed !== true) {
            console.error(`[AUTO] ${key} markDeployed verification FAILED: hasdeployed=${hasdeployed}`);
            return false;
        }

        await setDeployStatus(db, authorId, key, 'deployed', `Successfully deployed to ${type}.`);

        console.log(`[AUTO] ${key} marked as COMPLETED (hasdeployed=${hasdeployed}), removing from queue.`);

        await sendWebhook(null, {
            title: ' Report Complete — Removed from Queue',
            description: `**Report:** ${label}\n**Key:** \`${key}\`\n**Type:** ${type}${resultUrl ? `\n**URL:** ${resultUrl}` : ''}\n\nSuccessfully marked as \`hasdeployed: true\` in Firebase and removed from the deploy queue.`,
            color: 0x28a745,
            footer: { text: 'PHMC Bot — Auto Deploy' },
            timestamp: new Date().toISOString(),
        });

        return true;
    } catch (err) {
        console.error(`[AUTO] ${key} FAILED to mark as completed: ${err.message}`);
        return false;
    }
}
