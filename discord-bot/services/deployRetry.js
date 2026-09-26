/**
 * Deploy Retry — retry queue management, cleanup, and backfill.
 */

import { logFnCall } from './deployLogger.js';
import { state, C } from './deployState.js';
import { isMaintenanceMode } from './deployQueue.js';
import { probeMsForHost } from './postingHealth.js';

//  Retry Queue Backfill

/**
 * Build a retry-queue index row. Carries display labels so the queue
 * dashboard can render failed forms from this tiny index alone (no
 * scheduledReports scan). Keep it small — label/formId/detail only.
 */
export function retryIndexEntry(authorId, reportKey, reportData, retryAt, deployRetries) {
    const d = reportData || {};
    return {
        authorId, reportKey, retryAt, deployRetries: deployRetries || 0,
        label: String(d.originalKey || reportKey || '').slice(0, 80),
        formId: String(d.formId || '').slice(0, 40),
        detail: String(d.deployMessage || '').slice(0, 120),
    };
}

export async function backfillRetryQueue(db) {
    logFnCall('deployRetry', 'backfillRetryQueue', 'Backfilling retry queue');
    try {
        const snap = await db.ref('scheduledReports').once('value');
        if (!snap?.exists()) return;
        let count = 0;
        snap.forEach((authorSnap) => {
            const authorId = authorSnap.key;
            authorSnap.forEach((reportSnap) => {
                const reportKey = reportSnap.key;
                const reportData = reportSnap.val();
                if (reportData.deployStatus === 'retry_queued' && reportData.retryAt) {
                    db.ref(`retry-queue/${authorId}|${reportKey}`).set(
                        retryIndexEntry(authorId, reportKey, reportData, reportData.retryAt, reportData.deployRetries)
                    ).catch(() => {});
                    count++;
                }
            });
        });
        if (count > 0) console.log(`[AUTO] Backfilled ${count} existing retry_queued entries into retry-queue index`);
    } catch (err) {
        console.error(`[AUTO] Retry queue backfill error: ${err.message}`);
    }
}

//  Cleanup Old Deployed Reports

export async function cleanupOldDeployed(db) {
    logFnCall('deployRetry', 'cleanupOldDeployed', 'Cleaning up old deployments');
    const cutoff = Date.now() - C.CLEANUP_AFTER_MS;
    let deleted = 0;
    try {
        const snap = await db.ref('scheduledReports').once('value');
        if (!snap.exists()) return 0;
        const updates = {};
        snap.forEach((authorSnap) => {
            const authorId = authorSnap.key;
            authorSnap.forEach((reportSnap) => {
                const report = reportSnap.val();
                if (report.hasdeployed === true) {
                    const deployedAt = new Date(report.deployedAt || report.timestamp || 0).getTime();
                    if (deployedAt > 0 && deployedAt < cutoff) {
                        const key = reportSnap.key;
                        updates[`scheduledReports/${authorId}/${key}`] = null;
                        updates[`scheduledReportsBBCode/${authorId}/${key}`] = null;
                        deleted++;
                    }
                }
            });
        });
        if (deleted > 0) {
            await db.ref().update(updates);
            console.log(`[AUTO] Cleaned up ${deleted} old deployed report(s)`);
        }
        return deleted;
    } catch (err) {
        console.error(`[AUTO] Cleanup error: ${err.message}`);
        return 0;
    }
}

//  Retry Queue Check (periodic re-enqueue)

export async function checkRetryQueue() {
    logFnCall('deployRetry', 'checkRetryQueue', 'Checking retry queue');

    // Respect maintenance mode — pause retries during an outage
    if (await isMaintenanceMode().catch(() => false)) {
        console.log('[RETRY]  Maintenance mode — skipping retry queue scan');
        return;
    }

    const db = state.dbRef;
    if (!db) return;

    try {
        const snap = await db.child('retry-queue').once('value');
        if (!snap.exists()) return;

        const now = Date.now();
        let requeued = 0;

        snap.forEach((child) => {
            const entry = child.val();
            const { authorId, reportKey, retryAt } = entry || {};
            if (!authorId || !reportKey || !retryAt) {
                // Clean up malformed entries
                child.ref.remove().catch(() => {});
                return;
            }

            if (now >= new Date(retryAt).getTime()) {
                // No exhaustion: due retries always re-enqueue (outages can
                // need any number of attempts; data-terminal states are
                // marked explicitly elsewhere, never by count).
                // Re-enqueue (hasdeployed=false is load-bearing: the cold-load
                // and value listener both skip anything not strictly false,
                // which would strand the report across restarts)
                db.child(`scheduledReports/${authorId}/${reportKey}`).update({
                    deployStatus: 'queued',
                    hasdeployed: false,
                    deployCheckedAt: new Date().toISOString(),
                    retryAt: null,
                }).catch(() => {});
                child.ref.remove().catch(() => {});
                // Remove from knownReportKeys so the Firebase listener picks it up
                if (state.knownReportKeys) state.knownReportKeys.delete(reportKey);
                requeued++;
            }
        });

        if (requeued > 0) console.log(`[AUTO] Retry queue: ${requeued} re-queued (retries never expire)`);
    } catch (err) {
        console.error(`[AUTO] Retry queue check error: ${err.message}`);
    }
}

/**
 * Re-enqueue a report by updating Firebase status and removing from knownReportKeys
 * so the value listener picks them up.
 */
export async function requeueReport(db, authorId, reportKey, reportData) {
    logFnCall('deployRetry', 'requeueReport', 'Re-queuing report', { reportKey });
    // No exhaustion: the count is telemetry only. Transport failures retry
    // forever; data-terminal states are marked explicitly elsewhere.
    const retries = (reportData.deployRetries || 0) + 1;
    const retryAt = new Date(Date.now() + C.RETRY_DELAY_MS).toISOString();

    console.log(`[AUTO] ${reportKey} re-queued for retry at ${retryAt} (attempt ${retries} — retrying until posted)`);
    await db.ref(`scheduledReports/${authorId}/${reportKey}`).update({
        deployStatus: 'retry_queued',
        // Load-bearing (see checkRetryQueue): a requeued report must read as
        // not-deployed or restarts will prime it as done and strand it.
        hasdeployed: false,
        deployRetries: retries,
        retryAt,
        deployCheckedAt: new Date().toISOString(),
        deployMessage: `Retry queued — attempt ${retries} at ${new Date(retryAt).toLocaleString()} (retrying until posted)`,
    });

    // Update retry queue index (with display labels for the dashboard)
    await db.ref(`retry-queue/${authorId}|${reportKey}`).set(
        retryIndexEntry(authorId, reportKey, reportData, retryAt, retries)
    ).catch(() => {});

    if (state.knownReportKeys) state.knownReportKeys.delete(reportKey);
}

/**
 * Mark a report as terminally settled (data problem — never retried).
 * Mirrors the settled-terminal semantics used elsewhere (trashed_duplicate,
 * skipped_no_consent): hasdeployed=true so the cold-load/listener skip it,
 * the given deployStatus is recorded verbatim, and any retry-queue index
 * entry is removed. Counterpart to requeueReport (RETRYABLE path).
 */
export async function markDeployTerminal(db, authorId, reportKey, status, message) {
    logFnCall('deployRetry', 'markDeployTerminal', 'Marking report terminal', { reportKey, status });
    await db.ref(`scheduledReports/${authorId}/${reportKey}`).update({
        hasdeployed: true,
        deployStatus: status || 'failed_permanent',
        deployMessage: message || 'Terminal deploy failure',
        deployedAt: new Date().toISOString(),
        deployedBy: 'autoDeploy',
        retryAt: null,
        deployCheckedAt: new Date().toISOString(),
    });

    // Remove any retry-queue index entry — a terminal report must never be
    // picked up by checkRetryQueue.
    await db.ref(`retry-queue/${authorId}|${reportKey}`).remove().catch(() => {});
}

/**
 * Pause a report while the forum write path is blocked (circuit breaker
 * open) WITHOUT consuming retry budget: deployRetries is preserved, and the
 * next probe fires after the breaker's probe interval instead of the normal
 * retry delay. checkRetryQueue picks it up like any due retry.
 */
export async function rescheduleReportProbe(db, authorId, reportKey, reportData, host) {
    const waitMs = probeMsForHost(host);
    const retryAt = new Date(Date.now() + waitMs).toISOString();
    const retries = (reportData && reportData.deployRetries) || 0;
    await db.ref(`scheduledReports/${authorId}/${reportKey}`).update({
        deployStatus: 'retry_queued',
        // Load-bearing (see checkRetryQueue): must read as not-deployed.
        hasdeployed: false,
        retryAt,
        deployCheckedAt: new Date().toISOString(),
        deployMessage: `Paused — forum write path blocked (circuit breaker open). Probing again ${new Date(retryAt).toLocaleString()} without using retry budget.`,
    });
    await db.ref(`retry-queue/${authorId}|${reportKey}`).set(
        retryIndexEntry(authorId, reportKey, reportData, retryAt, retries)
    ).catch(() => {});
    if (state.knownReportKeys) state.knownReportKeys.delete(reportKey);
    console.log(`[AUTO] ${reportKey} paused (breaker open) — probe at ${retryAt}, retries preserved at ${retries}`);
}
