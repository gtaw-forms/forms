/**
 * Deploy Retry — retry queue management, cleanup, and backfill.
 */

import { logFnCall } from './deployLogger.js';
import { state, C } from './deployState.js';

//  Retry Queue Backfill

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
                    db.ref(`retry-queue/${authorId}|${reportKey}`).set({
                        authorId, reportKey,
                        retryAt: reportData.retryAt,
                        deployRetries: reportData.deployRetries || 0,
                    }).catch(() => {});
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
    const db = state.dbRef;
    if (!db) return;

    try {
        const snap = await db.child('retry-queue').once('value');
        if (!snap.exists()) return;

        const now = Date.now();
        let requeued = 0;
        let failed = 0;

        snap.forEach((child) => {
            const entry = child.val();
            const { authorId, reportKey, retryAt, deployRetries = 0 } = entry || {};
            if (!authorId || !reportKey || !retryAt) {
                // Clean up malformed entries
                child.ref.remove().catch(() => {});
                return;
            }

            if (now >= new Date(retryAt).getTime()) {
                // Retry is due — check max retries
                if (deployRetries >= C.MAX_RETRIES) {
                    // Mark as permanently failed
                    db.child(`scheduledReports/${authorId}/${reportKey}`).update({
                        deployStatus: 'failed_permanent',
                        deployMessage: `Failed after ${C.MAX_RETRIES} retries. Manual intervention required.`,
                    }).catch(() => {});
                    child.ref.remove().catch(() => {});
                    failed++;
                    return;
                }
                // Re-enqueue
                db.child(`scheduledReports/${authorId}/${reportKey}`).update({
                    deployStatus: 'queued',
                    deployCheckedAt: new Date().toISOString(),
                    retryAt: null,
                }).catch(() => {});
                child.ref.remove().catch(() => {});
                // Remove from knownReportKeys so the Firebase listener picks it up
                if (state.knownReportKeys) state.knownReportKeys.delete(reportKey);
                requeued++;
            }
        });

        if (requeued > 0) console.log(`[AUTO] Retry queue: ${requeued} re-queued, ${failed} failed permanently`);
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
    const retries = (reportData.deployRetries || 0) + 1;
    const retryAt = new Date(Date.now() + C.RETRY_DELAY_MS).toISOString();

    if (retries >= C.MAX_RETRIES) {
        console.log(`[AUTO] ${reportKey} failed permanently after ${C.MAX_RETRIES} retries`);
        await db.ref(`scheduledReports/${authorId}/${reportKey}`).update({
            hasdeployed: true,
            deployStatus: 'failed_permanent',
            deployMessage: `Failed after ${C.MAX_RETRIES} retries. Manual intervention required.`,
            deployRetries: retries,
        });
        return;
    }

    console.log(`[AUTO] ${reportKey} re-queued for retry at ${retryAt} (attempt ${retries}/${C.MAX_RETRIES})`);
    await db.ref(`scheduledReports/${authorId}/${reportKey}`).update({
        deployStatus: 'retry_queued',
        deployRetries: retries,
        retryAt,
        deployCheckedAt: new Date().toISOString(),
        deployMessage: `Retry queued — attempt ${retries}/${C.MAX_RETRIES} at ${new Date(retryAt).toLocaleString()}`,
    });

    // Update retry queue index
    await db.ref(`retry-queue/${authorId}|${reportKey}`).set({
        authorId, reportKey, retryAt, deployRetries: retries,
    }).catch(() => {});

    if (state.knownReportKeys) state.knownReportKeys.delete(reportKey);
}
