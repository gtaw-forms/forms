/**
 * Auto-Deploy Service  monitors Firebase for new reports and deploys them
 * one at a time through a sequential queue.
 *
 * Wired into index.js on bot startup. Never runs more than one deploy at a time.
 */

import firebase from './firebase.js';
import { getForumClient } from './forumClient.js';
import { sendLogMessage } from './logChannel.js';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

import { logFnCall, sendWebhook, logStep, DeployProgressEmbed } from './deployLogger.js';
import { state, C } from './deployState.js';
import { markDeployed, setDeployStatus, markReportComplete } from './deployStatus.js';
import { checkUserConsent, skipDueToConsent } from './deployConsent.js';
import { consentGateAndEnqueue, enqueue, skipReport, getQueuedDeployments, getStuckReports, isMaintenanceMode, setMaintenanceMode } from './deployQueue.js';
import { backfillRetryQueue, cleanupOldDeployed, checkRetryQueue, requeueReport } from './deployRetry.js';
import { resolveAutopsyTopic } from './deployInteraction.js';
import { crosspostAutopsyToLssd, retryFailedLssdCrossposts } from './deployLssd.js';
import { crosspostAutopsyToLspd } from './deployLspd.js';
import { clearAssignment, getRotationStatus } from './autopsyRotation.js';
import { startFactionRosterSync } from './factionRosterSync.js';

//  Discord Client (for interactive messages)
// Set via setAutoDeployClient() from index.js on startup.



// Re-exports for external consumers
export { isMaintenanceMode, setMaintenanceMode, enqueue, skipReport, getQueuedDeployments, getStuckReports } from './deployQueue.js';
export { backfillRetryQueue, cleanupOldDeployed, checkRetryQueue, requeueReport } from './deployRetry.js';
export { markDeployed, setDeployStatus, markReportComplete } from './deployStatus.js';
export { resolveAutopsyTopic } from './deployInteraction.js';
export { crosspostAutopsyToLssd } from './deployLssd.js';
export { handlePM } from './deployPM.js';
export { handleTopic } from './deployTopic.js';
export { handleMedicalRecord } from './deployMedicalRecord.js';
export { handleAutopsyReply } from './deployAutopsyReply.js';

import { retryFailedCompletionSteps } from './deployAutopsyReply.js';

export function setAutoDeployClient(client) {
        logFnCall('autoDeploy', 'setAutoDeployClient', 'Registering Discord client');
    state.discordClient = client;
}

    /**
     * Start listening to Firebase for new undeployed reports.
     * Called once on bot startup.
     */
    export function startAutoDeploy() {
        logFnCall('autoDeploy', 'startAutoDeploy', 'Starting auto-deploy system');
        firebase.init();
        const db = firebase.db;
        state.dbRef = db.ref(); // root Reference so .child() and .ref() both work

        console.log('[AUTO]  Starting auto-deploy listener...');

        //  Check persisted maintenance state 
        db.ref(C.MAINTENANCE_PATH).once('value', (snap) => {
            state.maintenanceMode = snap.val() === true;
            if (state.maintenanceMode) {
                console.log('[AUTO]  Maintenance mode was ON (persisted)  queue paused');
                sendWebhook(null, {
                    title: ' Bot Started in Maintenance Mode',
                    description: 'Auto-deploy queue is paused. Use `/maintenance off` to resume.',
                    color: 0xffc107,
                });
            } else {
                console.log('[AUTO]  No maintenance flag  queue active');
            }
        });

        //  (Bot Online message sent from index.js on startup — covers both bot + auto-deploy status)

        //  Backfill any existing retry_queued entries into retry-queue index 
        backfillRetryQueue(db);

        //  Cleanup old deployed reports (startup + every 6 hours) 
        cleanupOldDeployed(db);
        setInterval(() => cleanupOldDeployed(db), 6 * 60 * 60 * 1000);

        //  Check retry queue on startup and every 30 minutes
        // Picks up reports with retry_queued status whose retryAt has passed
        checkRetryQueue();
        setInterval(() => checkRetryQueue(), C.RETRY_CHECK_INTERVAL_MS);

        //  Retry any failed LSSD cross-posts from previous sessions
        retryFailedLssdCrossposts(db);

        //  Retry any failed autopsy completion steps from previous sessions
        retryFailedCompletionSteps(db);

        //  Retry any failed LSPD acknowledgement replies from previous sessions
        retryFailedLspdAcknowledgements(db);

        //  Autopsy status summary — assigned cases + LOA staff
        (async () => {
            try {
                const arSnap = await db.ref('autopsy-requested').once('value');
                const rotation = await getRotationStatus(db).catch(() => null);
                // Read LOA set directly (getLoaSet isn't exported from autopsyRotation)
                const loaSnap = await db.ref('autopsy-requests/loa').once('value').catch(() => null);
                const loaSet = new Set();
                if (loaSnap && loaSnap.exists()) {
                    for (const [name, val] of Object.entries(loaSnap.val())) {
                        if (val === true) loaSet.add(name);
                    }
                }

                const assigned = [];
                if (arSnap.exists()) {
                    arSnap.forEach((child) => {
                        const entry = child.val();
                        if (entry.assignedTo && !entry.completedAt) {
                            assigned.push({
                                name: entry.name || 'Unknown',
                                ooc: entry.oocName || '',
                                assignedTo: entry.assignedTo,
                                age: entry.detectedAt ? Math.floor((Date.now() - new Date(entry.detectedAt).getTime()) / 3600000) : '?',
                            });
                        }
                    });
                }

                // LOA list
                const loaNames = [...loaSet].sort();

                // Build assigned cases description
                const caseCount = assigned.length;
                let desc = '';
                if (caseCount === 0) {
                    desc = 'No pending assigned autopsies.';
                } else {
                    const maxShow = 20;
                    const shown = assigned.slice(0, maxShow);
                    desc = shown.map(a => {
                        const ageStr = a.age === '?' ? '' : ` (${a.age}h)`;
                        const oocStr = a.ooc ? ` ((${a.ooc}))` : '';
                        return `• **${a.name}**${oocStr} → ${a.assignedTo}${ageStr}`;
                    }).join('\n');
                    if (assigned.length > maxShow) {
                        desc += `\n… and ${assigned.length - maxShow} more`;
                    }
                }

                // LOA section
                let loaDesc = 'None';
                if (loaNames.length > 0) {
                    loaDesc = loaNames.map(n => `• ${n}`).join('\n');
                }

                // Rotation next
                const nextUp = rotation?.effectiveNext || 'None available';

                sendWebhook(null, {
                    title: ` Autopsy Status — ${caseCount} Assigned`,
                    description: `**Pending Cases:**\n${desc}\n\n**On Leave (LOA):**\n${loaDesc}\n\n**Next in Rotation:** ${nextUp}`,
                    color: caseCount > 0 ? 0xffc107 : 0x28a745,
                    footer: { text: `PHMC Bot — Startup Scan` },
                    timestamp: new Date().toISOString(),
                });
            } catch (e) {
                console.warn('[AUTO] Failed to build autopsy status embed:', e.message);
            }
        })();

        //  Start passive CK listener on newSavedReports
        // Monitors opted-out users' reports for CKs and drafts death records
        // when a morgue match is found.
        try {
            import('./deathRecordDraft.js').then(({ startCKListener }) => {
                startCKListener(db);
            }).catch((err) => console.warn('[AUTO]  Failed to start CK listener:', err.message));
        } catch (err) {
            console.warn('[AUTO]  Could not start CK listener:', err.message);
        }

        //  Start morgue listener (auto-match pending drafts) 
        try {
            import('./deathRecordDraft.js').then(({ initMorgueCache, startMorgueListener }) => {
                initMorgueCache(db);
                startMorgueListener(db);
            }).catch((err) => console.warn('[AUTO]  Failed to start morgue listener:', err.message));
        } catch (err) {
            console.warn('[AUTO]  Could not start morgue listener:', err.message);
        }

        //  Start faction roster sync (LSPD/LSSD member list, daily)
        try {
            startFactionRosterSync();
        } catch (err) {
            console.warn('[AUTO]  Could not start roster sync:', err.message);
        }

        //  Listen for new reports at scheduledReports
        // Using on('value') because child_added only fires for NEW top-level children (authors),
        // not for reports added under EXISTING authors. value fires on any change.
        state.knownReportKeys = new Set();
        const _autoDeployStartupTime = Date.now();
        const CK_EPOCH = 1782864000000; // 2026-07-01T00:00:00Z  reports saved before this are skipped for CK drafting
        console.log(`[AUTO]  CK drafting: skipping reports saved before 01/JUL/2026`);

        // Startup cold-load guard: on the first `value` callback, only prime
        // reports that are ALREADY deployed (hasdeployed=true) into knownReportKeys.
        // Reports still pending (hasdeployed=false, undefined, or "queued") are
        // left un-primed so they fall through to normal processing and get queued.
        // This prevents re-processing already-completed work while not ignoring
        // legitimate pending reports from a previous session or a bot restart.
        let _initialLoadDone = false;
        db.ref('scheduledReports').on('value', (snap) => {
            if (!_initialLoadDone) {
                console.log(`[AUTO]  Cold-load: priming knownReportKeys...`);
                let primed = 0, pending = 0;
                snap.forEach((authorSnap) => {
                    authorSnap.forEach((reportSnap) => {
                        const rd = reportSnap.val();
                        if (rd?.hasdeployed === true || rd?.deployStatus === 'deployed' || rd?.deployStatus === 'skipped_manual' || rd?.deployStatus === 'failed_permanent') {
                            state.knownReportKeys.add(reportSnap.key);
                            primed++;
                        } else {
                            pending++;
                        }
                    });
                });
                _initialLoadDone = true;
                console.log(`[AUTO]  Cold-load: primed ${primed} done reports, ${pending} pending (will process below).`);
                // Fall through — pending reports (not in knownReportKeys) will be
                // picked up by the normal processing logic below in this same callback.
            }

            snap.forEach((authorSnap) => {
                const authorId = authorSnap.key;
                authorSnap.forEach((reportSnap) => {
                    const reportKey = reportSnap.key;
                    if (state.knownReportKeys.has(reportKey)) return;

                    const reportData = reportSnap.val();
                    if (reportData.hasdeployed !== false) {
                        state.knownReportKeys.add(reportKey);
                        return;
                    }

                    // Skip dev-mode reports (saved from localhost) — prevents test data from hitting production
                    if (reportData._devMode) {
                        console.log(`[AUTO]  Skipping dev mode report: ${reportData.originalKey || reportKey}`);
                        state.knownReportKeys.add(reportKey);
                        return;
                    }

                    state.knownReportKeys.add(reportKey);
                    console.log(`[AUTO]  ${reportData.originalKey || reportKey}`);

                    const item = {
                        authorId,
                        key: reportKey,
                        report: reportData,
                        db,
                    };

                    if (reportData.formId === 'coroner_email') {
                        consentGateAndEnqueue('pm', item, reportData.formId);
                    } else if (['death_record', 'mass-ftality-test', 'coroner-report'].includes(reportData.formId)) {
                        consentGateAndEnqueue('topic', item, reportData.formId);
                        // Coroner email fires inside handleTopic — after topic post completes
                    } else if (['patient_notes', 'er_protocol', 'physical_evaluation', 'staff-patient-file', 'surgical', 'session_notes', 'intensive_treatment', 'psych_eval', 'testing-compact-mode'].includes(reportData.formId)) {
                        consentGateAndEnqueue('medical-record', item, reportData.formId);
                    } else if (reportData.formId === 'autopsy') {
                        consentGateAndEnqueue('autopsy-reply', item, reportData.formId);
                    }

                    //  Passive CK check (death record drafting)
                    // Only for NEW reports (saved after bot startup) to avoid re-processing
                    // legacy records. Silently checks morgue and drafts if matched.
                    if (reportData.timestamp && reportData.timestamp >= _autoDeployStartupTime) {
                        if (reportData.formId === 'coroner-report' || reportData.formId === 'mass-ftality-test') {
                            import('./deathRecordDraft.js').then(({ passivCKCheck }) => {
                                passivCKCheck(db, authorId, reportKey, reportData)
                                    .catch((err) => console.error(`[AUTO]  Passive CK error for ${reportKey}:`, err.message));
                            }).catch(() => { });
                        }
                    }
                });
            });
        });

        //  Dev-reports listener (localhost testing) — only runs coroner email auto-generation
        let _devInitialLoadDone = false;
        db.ref('dev-reports').on('value', (snap) => {
            // Same cold-start guard as scheduledReports — prime keys on first callback
            if (!_devInitialLoadDone) {
                snap.forEach((authorSnap) => {
                    authorSnap.forEach((reportSnap) => {
                        state.knownReportKeys.add(reportSnap.key);
                    });
                });
                _devInitialLoadDone = true;
                return;
            }

            snap.forEach((authorSnap) => {
                const authorId = authorSnap.key;
                authorSnap.forEach((reportSnap) => {
                    const reportKey = reportSnap.key;
                    if (state.knownReportKeys.has(reportKey)) return;
                    state.knownReportKeys.add(reportKey);
                    const reportData = reportSnap.val();
                    if (!reportData || reportData._devMode !== true) return;
                    console.log(`[AUTO]  Dev report: ${reportData.originalKey || reportKey}`);
                    const isMedicalForm = ['patient_notes', 'er_protocol', 'physical_evaluation', 'staff-patient-file', 'surgical', 'session_notes', 'intensive_treatment', 'psych_eval', 'testing-compact-mode'].includes(reportData.formId);
                    const item = { authorId, key: reportKey, report: reportData, db };

                    if ((reportData.formId === 'coroner-report' || reportData.formId === 'mass-ftality-test') &&
                        (reportData.data?.ReportRequested === true || reportData.data?.ReportRequested === 'true' || reportData.data?.requestingOfficer)) {
                        console.log('[AUTO]  Dev report requested — triggering auto coroner email (dry run)');
                        import('./deployCoronerEmail.js').then(({ handleCoronerEmail }) => {
                            handleCoronerEmail(item).catch(err => console.error('[CORONER-EMAIL] Dev handler error:', err.message));
                        }).catch(err => console.error('[CORONER-EMAIL] Failed to import handler:', err.message));
                    }

                    if (isMedicalForm) {
                        console.log('[AUTO]  Dev medical record — processing...');
                        import('./deployMedicalRecord.js').then(({ handleMedicalRecord }) => {
                            handleMedicalRecord(item).catch(err => console.error('[MEDICAL-RECORD] Dev handler error:', err.message));
                        }).catch(err => console.error('[MEDICAL-RECORD] Failed to import handler:', err.message));
                    }
                });
            });
        });

        //  Retry queue index cleanup  remove stale entries
        db.ref('retry-queue').once('value').then((rqSnap) => {
            if (rqSnap?.exists()) {
                const rqCleanup = {};
                rqSnap.forEach((child) => {
                    const entry = child.val();
                    if (!entry) { rqCleanup[child.key] = null; return; }
                    if (!entry.retryAt) { rqCleanup[child.key] = null; }
                });
                if (Object.keys(rqCleanup).length > 0) {
                    db.ref('retry-queue').update(rqCleanup);
                    console.log(`[AUTO]  Cleaned up ${Object.keys(rqCleanup).length} empty retry-queue entries`);
                }
            }
        }).catch(() => { });

        console.log('[AUTO]  Auto-deploy listener active.');

        //  Periodically retry failed LSPD acknowledgement replies (every 30 min)
        setInterval(() => retryFailedLspdAcknowledgements(db), 30 * 60 * 1000);
    }

// ── LSPD Acknowledgement Retry ──

/**
 * Scan for autopsy requests where the LSPD acknowledgement reply failed
 * and retry sending it. Called at startup and every 30 minutes.
 */
async function retryFailedLspdAcknowledgements(db) {
    logFnCall('autoDeploy', 'retryFailedLspdAcknowledgements', 'Scanning for failed LSPD ack replies');
    if (!db) return;
    try {
        const snap = await db.ref('autopsy-requested').orderByChild('lspdAck').equalTo('failed').once('value');
        if (!snap.exists()) {
            console.log('[AUTO]  No failed LSPD ack replies to retry');
            return;
        }
        const { sendAutopsyAcknowledgement } = await import('./autopsyRequestMonitor.js');
        let retried = 0;
        const promises = [];
        snap.forEach((child) => {
            const entry = child.val();
            const lspdTopicId = entry.lspdTopicId;
            if (!lspdTopicId) {
                console.log('[AUTO]  Skipping ' + child.key + ' — no LSPD topic ID saved');
                return;
            }
            const requesterName = entry.parsed?.requesterName || entry.name || 'Requesting Party';
            console.log('[AUTO]  Retrying LSPD ack reply for ' + child.key + ' on topic #' + lspdTopicId);
            promises.push(
                sendAutopsyAcknowledgement(child.key, requesterName, null, {
                    baseUrl: 'https://phmc.gta.world',
                    lspdTopicId: lspdTopicId
                }).then(result => {
                    if (result.lspd) {
                        console.log('[AUTO]  LSPD ack retry succeeded for ' + child.key);
                        db.ref('autopsy-requested/' + child.key + '/lspdAck').set('completed').catch(() => {});
                    } else {
                        console.warn('[AUTO]  LSPD ack retry failed for ' + child.key);
                    }
                }).catch(err => {
                    console.error('[AUTO]  LSPD ack retry error for ' + child.key + ': ' + err.message);
                })
            );
            retried++;
        });
        await Promise.allSettled(promises);
        console.log('[AUTO]  Retried ' + retried + ' failed LSPD ack reply(ies)');
    } catch (err) {
        console.error('[AUTO]  LSPD ack retry scan error: ' + err.message);
    }
}
