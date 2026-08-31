/**
 * Auto-Deploy Service  monitors Firebase for new reports and deploys them
 * one at a time through a sequential queue.
 *
 * Wired into index.js on bot startup. Never runs more than one deploy at a time.
 */

import firebase from './firebase.js';
import { getForumClient } from './forumClient.js';
import { sendLogMessage, notifySelfHeal } from './logChannel.js';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

import { logFnCall, sendWebhook, logStep, DeployProgressEmbed } from './deployLogger.js';
import { state, C } from './deployState.js';
import { markDeployed, setDeployStatus, markReportComplete } from './deployStatus.js';
import { checkUserConsent, skipDueToConsent } from './deployConsent.js';
import { consentGateAndEnqueue, enqueue, skipReport, getQueuedDeployments, getStuckReports, isMaintenanceMode, setMaintenanceMode } from './deployQueue.js';
import { backfillRetryQueue, cleanupOldDeployed, checkRetryQueue, requeueReport } from './deployRetry.js';
import { resolveAutopsyTopic } from './deployInteraction.js';
import { crosspostAutopsyToLssd, retryFailedLssdCrossposts } from './deployLssd.js';
import { crosspostAutopsyToLspd, retryFailedLspdCrossposts } from './deployLspd.js';
import { clearAssignment, getRotationStatus } from './autopsyRotation.js';
import { startFactionRosterSync } from './factionRosterSync.js';
import { startPatientIndex } from './patientIndex.js';

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
import { retryFailedAssignmentReplies } from './autopsyRequestMonitor.js';
import { processReportEdits } from './reportEdits.js';

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

        //  Recovery heartbeat — runs ALL self-healing sweeps in sequence (startup + every 10 min)
        startRecoveryHeartbeat(db);

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
                        const multi = String(entry.caseState || '') === 'multi';
                        const cases = multi && entry.cases && typeof entry.cases === 'object' ? Object.values(entry.cases) : [];
                        if (multi && cases.length > 0) {
                            // Multi-decedent: one row per assigned ME + decedent.
                            cases.forEach((c) => {
                                if (c && c.assignedTo && !c.completedAt) {
                                    assigned.push({
                                        name: c.name || 'Unknown',
                                        ooc: c.oocName || '',
                                        assignedTo: c.assignedTo,
                                        age: entry.detectedAt ? Math.floor((Date.now() - new Date(entry.detectedAt).getTime()) / 3600000) : '?',
                                    });
                                }
                            });
                            return;
                        }
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

        //  Recover death record approvals interrupted by a previous crash/restart.
        //  Uses the Facebrowser API to verify whether the auto Face post landed.
        try {
            import('./deathRecordDraft.js').then(({ recoverInterruptedDeathRecordApprovals }) => {
                recoverInterruptedDeathRecordApprovals(db)
                    .catch((err) => console.warn('[AUTO]  Death record recovery error:', err.message));
            }).catch((err) => console.warn('[AUTO]  Failed to start death record recovery:', err.message));
        } catch (err) {
            console.warn('[AUTO]  Could not start death record recovery:', err.message);
        }

        //  Start faction roster sync (LSPD/LSSD member list, daily)
        try {
            startFactionRosterSync();
        } catch (err) {
            console.warn('[AUTO]  Could not start roster sync:', err.message);
        }

        //  Start patient index service (medical-records-index.json)
        //  Incremental refresh from saved reports + 3-day f=97 full rebuild.
        try {
            startPatientIndex(db).catch((err) => console.warn('[AUTO]  Could not start patient index:', err.message));
        } catch (err) {
            console.warn('[AUTO]  Could not start patient index:', err.message);
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

                    // Legacy key alias: reports saved before the form rename
                    // carry formId 'testing-compact-mode'.
                    if (reportData.formId === 'testing-compact-mode') reportData.formId = 'general_consultation';

                    if (reportData.formId === 'coroner_email') {
                        consentGateAndEnqueue('pm', item, reportData.formId);
                    } else if (['death_record', 'mass-ftality-test', 'coroner-report'].includes(reportData.formId)) {
                        consentGateAndEnqueue('topic', item, reportData.formId);
                        // Coroner email fires inside handleTopic — after topic post completes
                    } else if (['patient_notes', 'er_protocol', 'physical_evaluation', 'staff-patient-file', 'surgical', 'session_notes', 'intensive_treatment', 'psych-eval', 'general_consultation'].includes(reportData.formId)) {
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
                    if (reportData.formId === 'testing-compact-mode') reportData.formId = 'general_consultation'; // legacy rename alias
                    const isMedicalForm = ['patient_notes', 'er_protocol', 'physical_evaluation', 'staff-patient-file', 'surgical', 'session_notes', 'intensive_treatment', 'psych-eval', 'general_consultation'].includes(reportData.formId);
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

    }

// ── LSPD Acknowledgement Retry ──

/**
 * Scan for autopsy requests where the LSPD acknowledgement reply failed
 * and retry sending it. Runs as part of the recovery heartbeat (startup + every 10 min).
 */
export async function retryFailedLspdAcknowledgements(db) {
    logFnCall('autoDeploy', 'retryFailedLspdAcknowledgements', 'Scanning for failed LSPD ack replies');
    if (!db) return;
    try {
        const { sendAutopsyAcknowledgement, ACK_FIELD_NAMES } = await import('./autopsyRequestMonitor.js');
        const lspdField = ACK_FIELD_NAMES.lspd;
        const phmcField = ACK_FIELD_NAMES.phmc;
        const snap = await db.ref('autopsy-requested').orderByChild(lspdField).equalTo('failed').once('value');
        if (!snap.exists()) {
            console.log('[AUTO]  No failed LSPD ack replies to retry');
            return;
        }
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
                        db.ref('autopsy-requested/' + child.key + '/' + lspdField).set('completed').catch(() => {});
                        db.ref('autopsy-requested/' + child.key + '/' + lspdField + '-at').set(new Date().toISOString()).catch(() => {});
                        // sendAutopsyAcknowledgement also posts the PHMC ack — mark it
                        // completed too so the PHMC retry can't double-post this sweep.
                        if (result.phmc && entry[phmcField] !== 'completed') {
                            db.ref('autopsy-requested/' + child.key + '/' + phmcField).set('completed').catch(() => {});
                            db.ref('autopsy-requested/' + child.key + '/' + phmcField + '-at').set(new Date().toISOString()).catch(() => {});
                        }
                        notifySelfHeal(child.key, `${lspdField} failed`, 'LSPD ack posted');
                    } else {
                        console.warn('[AUTO]  LSPD ack retry failed for ' + child.key);
                        notifySelfHeal(child.key, `${lspdField} failed`, 'LSPD ack retry FAILED - will retry next sweep');
                    }
                }).catch(err => {
                    console.error('[AUTO]  LSPD ack retry error for ' + child.key + ': ' + err.message);
                    notifySelfHeal(child.key, `${lspdField} failed`, 'ERROR: ' + err.message);
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

// ── Agency Acknowledgement Retry (SADCR / DAO) ──

/**
 * Scan for SADCR/DAO autopsy requests whose agency acknowledgement reply failed
 * and retry sending it. Mirrors retryFailedLspdAcknowledgements — these factions
 * were added to the crosspost registry, so their acks need their own recovery
 * sweep entry. Runs as part of the recovery heartbeat.
 */
export async function retryFailedAgencyAcknowledgements(db) {
    logFnCall('autoDeploy', 'retryFailedAgencyAcknowledgements', 'Scanning for failed agency (SADCR/DAO) ack replies');
    if (!db) return;
    try {
        const { sendAutopsyAcknowledgement, ACK_FIELD_NAMES } = await import('./autopsyRequestMonitor.js');
        const phmcField = ACK_FIELD_NAMES.phmc;
        const targets = [
            { faction: 'SADCR', field: ACK_FIELD_NAMES.sadcr },
            { faction: 'DAO', field: ACK_FIELD_NAMES.dao },
        ];
        for (const { faction, field } of targets) {
            const snap = await db.ref('autopsy-requested').orderByChild(field).equalTo('failed').once('value');
            if (!snap.exists()) continue;
            let retried = 0;
            const promises = [];
            snap.forEach((child) => {
                const entry = child.val();
                const topicId = entry[`${faction.toLowerCase()}RequestTopicId`];
                if (!topicId) {
                    console.log('[AUTO]  Skipping ' + child.key + ' — no ' + faction + ' request topic ID saved');
                    return;
                }
                const requesterName = entry.parsed?.requesterName || entry.name || 'Requesting Party';
                console.log('[AUTO]  Retrying ' + faction + ' ack reply for ' + child.key + ' on topic #' + topicId);
                promises.push(
                    sendAutopsyAcknowledgement(child.key, requesterName, null, {
                        baseUrl: 'https://phmc.gta.world',
                        agencyTopicId: topicId,
                        agencyFaction: faction,
                    }).then(result => {
                        if (result[faction.toLowerCase()]) {
                            console.log('[AUTO]  ' + faction + ' ack retry succeeded for ' + child.key);
                            db.ref('autopsy-requested/' + child.key + '/' + field).set('completed').catch(() => {});
                            db.ref('autopsy-requested/' + child.key + '/' + field + '-at').set(new Date().toISOString()).catch(() => {});
                            if (result.phmc && entry[phmcField] !== 'completed') {
                                db.ref('autopsy-requested/' + child.key + '/' + phmcField).set('completed').catch(() => {});
                                db.ref('autopsy-requested/' + child.key + '/' + phmcField + '-at').set(new Date().toISOString()).catch(() => {});
                            }
                            notifySelfHeal(child.key, `${field} failed`, faction + ' ack posted');
                        } else {
                            console.warn('[AUTO]  ' + faction + ' ack retry failed for ' + child.key);
                            notifySelfHeal(child.key, `${field} failed`, faction + ' ack retry FAILED - will retry next sweep');
                        }
                    }).catch(err => {
                        console.error('[AUTO]  ' + faction + ' ack retry error for ' + child.key + ': ' + err.message);
                        notifySelfHeal(child.key, `${field} failed`, 'ERROR: ' + err.message);
                    })
                );
                retried++;
            });
            await Promise.allSettled(promises);
            console.log('[AUTO]  Retried ' + retried + ' failed ' + faction + ' ack reply(ies)');
        }
    } catch (err) {
        console.error('[AUTO]  Agency ack retry scan error: ' + err.message);
    }
}

// ── PHMC Acknowledgement Retry ──

/**
 * Scan for autopsy requests where the PHMC acknowledgement reply is missing or
 * failed (phmc-acknowledge-reply !== 'completed') and retry sending it.
 *
 * Unlike the LSPD retry (which queries status='failed'), this scans ALL entries
 * because a crash mid-step can leave no status field at all — exactly the
 * silent-gap failure we want to recover. A staleness guard skips requests
 * detected less than 30 minutes ago so we don't race the active detection flow.
 * Called at startup and every 30 minutes.
 */
export async function retryFailedPhmcAcknowledgements(db, { force = false } = {}) {
    logFnCall('autoDeploy', 'retryFailedPhmcAcknowledgements', 'Scanning for missing/failed PHMC ack replies');
    if (!db) return;
    try {
        const { sendAutopsyAcknowledgement, ACK_FIELD_NAMES } = await import('./autopsyRequestMonitor.js');
        const field = ACK_FIELD_NAMES.phmc;
        const STALENESS_MS = 10 * 60 * 1000;
        const snap = await db.ref('autopsy-requested').once('value');
        const entries = snap.val() || {};
        let retried = 0;
        const promises = [];
        for (const [key, entry] of Object.entries(entries)) {
            // Private cases have no public request topic — no ack to send.
            if (entry.isPrivate === true) continue;
            // Ack only applies once a case topic exists.
            if (!entry.caseTopicId) continue;
            // Case already completed — ack step is moot.
            if (entry.completedAt) continue;
            const status = entry[field];
            if (status === 'completed') continue;
            // Staleness guard: don't race a request still being processed.
            if (!force) {
                const detected = entry.detectedAt ? new Date(entry.detectedAt).getTime() : 0;
                if (!detected || (Date.now() - detected) < STALENESS_MS) continue;
            }
            const requesterName = entry.parsed?.requesterName || entry.name || 'Requesting Party';
            console.log(`[AUTO]  Retrying PHMC ack reply for ${key} (${field}=${status || 'missing'})`);
            promises.push(
                sendAutopsyAcknowledgement(key, requesterName, null, { baseUrl: 'https://phmc.gta.world' }).then(result => {
                    if (result.phmc) {
                        console.log(`[AUTO]  PHMC ack retry succeeded for ${key}`);
                        db.ref(`autopsy-requested/${key}/${field}`).set('completed').catch(() => {});
                        db.ref(`autopsy-requested/${key}/${field}-at`).set(new Date().toISOString()).catch(() => {});
                        notifySelfHeal(key, `${field} ${status || 'missing'}`, 'PHMC acknowledgement posted');
                    } else {
                        console.warn(`[AUTO]  PHMC ack retry failed for ${key}`);
                        notifySelfHeal(key, `${field} ${status || 'missing'}`, 'PHMC ack retry FAILED - will retry next sweep');
                    }
                }).catch(err => {
                    console.error(`[AUTO]  PHMC ack retry error for ${key}: ${err.message}`);
                    notifySelfHeal(key, `${field} ${status || 'missing'}`, `ERROR: ${err.message}`);
                })
            );
            retried++;
        }
        await Promise.allSettled(promises);
        if (retried > 0) console.log(`[AUTO]  Retried ${retried} missing/failed PHMC ack reply(ies)`);
    } catch (err) {
        console.error('[AUTO]  PHMC ack retry scan error: ' + err.message);
    }
}

// ── LSPD Crosspost Recovery (detection-time request topic) ──

/**
 * Find LSPD autopsy requests that have a case topic but no LSPD crosspost
 * (lspdTopicId missing) and recover them: create the LSPD f=1361 request copy,
 * post the LSPD acknowledgement, and persist lspdTopicId + ack status.
 *
 * The monitor's step 3 does this during detection, but if the run is interrupted
 * (e.g. a hung Discord send freezes it before step 3) the LSPD crosspost never
 * happens and nothing recovered it. This runs at startup and every 10 minutes.
 *
 * @param {object} db — Firebase RTDB
 * @param {object} [opts] — { force } bypasses the 10-min staleness guard for manual runs.
 */
export async function retryMissingLspdCrossposts(db, { force = false } = {}) {
    logFnCall('autoDeploy', 'retryMissingLspdCrossposts', 'Scanning for LSPD cases missing the LSPD crosspost');
    if (!db) return;
    try {
        const { getForumClient } = await import('./forumClient.js');
        const { ACK_TEMPLATE } = await import('./autopsyRequestMonitor.js');
        const LSPD_BASE = 'https://lspd.gta.world';
        const LSPD_FORUM_ID = 1361;
        const STALENESS_MS = 10 * 60 * 1000;

        const snap = await db.ref('autopsy-requested').once('value');
        const entries = snap.val() || {};
        let retried = 0;

        // One shared isolated LSPD client for the whole sweep. All isolated clients
        // share a single Chromium browser, and per-entry clients running in parallel
        // let one entry's client.close() tear down the page another was mid-navigation
        // on ("Target page, context or browser has been closed"), silently killing the
        // crosspost. One sequential client avoids that entirely.
        const client = getForumClient();
        // Force-login to LSPD with the LSPD credentials FIRST (matches the monitor's
        // step 3 and crosspostAutopsyToLspd). Important: postTopic's internal login
        // fallback uses this.username/password — the PHMC creds — so if the LSPD
        // posting page redirects to login mid-post it submits the WRONG creds and
        // gets stuck on the login page. Pre-logging-in with force:true avoids that.
        await client.login(process.env.FORUM_LSPD_USERNAME, process.env.FORUM_LSPD_PASSWORD, { force: true, baseUrl: LSPD_BASE });

        for (const [key, entry] of Object.entries(entries)) {
                if ((entry.faction || '').toUpperCase() !== 'LSPD') continue;
                if (entry.isPrivate === true) continue; // private cases never crosspost
                if (!entry.caseTopicId) continue;
                if (entry.completedAt) continue;
                if (entry.lspdTopicId && entry['lspd-acknowledge-reply'] === 'completed') continue;
                // Staleness guard: don't race a request still being processed.
                if (!force) {
                    const detected = entry.detectedAt ? new Date(entry.detectedAt).getTime() : 0;
                    if (!detected || (Date.now() - detected) < STALENESS_MS) continue;
                }

                retried++;
                try {
                    const name = entry.name || 'Decedent';
                    const oocName = entry.oocName || '';
                    const oocPart = oocName ? ' ((' + oocName + '))' : '';
                    const requestBbCode = entry.requestBbCode || '';
                    const caseTitle = entry.caseTitle || ('Case ' + (entry.caseNum || '') + ' - ' + name);
                    const caseTopicId = entry.caseTopicId || null;
                    const requesterName = entry.parsed?.requesterName || entry.name || 'Requesting Party';
                    console.log(`[AUTO]  LSPD recovery for ${key} (caseTopicId=${caseTopicId ? '#' + caseTopicId : 'UNKNOWN'}) "${caseTitle}"`);

                    // Create the LSPD request topic if it doesn't exist yet. Before creating,
                    // search LSPD f=1361 for an existing request topic for this case and adopt
                    // it if found. This guards against orphan topics when a PREVIOUS attempt
                    // posted the topic but failed to persist lspdTopicId (URL parse error or a
                    // dropped db write) — without the search, the next sweep would post a
                    // duplicate request topic.
                    let lspdTopicId = entry.lspdTopicId || null;
                    if (!lspdTopicId) {
                        const topicTitle = 'Autopsy Request - ' + name + oocPart + ' [LSPD]';
                        try {
                            const existing = await client.searchForum(topicTitle, LSPD_FORUM_ID, { baseUrl: LSPD_BASE });
                            const exact = existing.find(r => r.title === topicTitle);
                            if (exact) {
                                lspdTopicId = String(exact.topicId);
                                await db.ref(`autopsy-requested/${key}/lspdTopicId`).set(lspdTopicId).catch(() => {});
                                console.log(`[AUTO]  Adopted existing LSPD topic #${lspdTopicId} for ${key} (caseTopicId=${caseTopicId ? '#' + caseTopicId : 'UNKNOWN'})`);
                            }
                        } catch (searchErr) {
                            console.warn(`[AUTO]  LSPD pre-create search error for ${key}: ${searchErr.message} — will attempt create anyway`);
                        }
                    }
                    if (!lspdTopicId) {
                        const topicBody = requestBbCode
                            ? '[divbox=white][center][b][size=170]AUTOPSY REQUEST — CERIFIED COPY [/size][/b][/center][hr][/hr]\n' + requestBbCode + '\n[hr][/hr][b]Case:[/b] ' + caseTitle + '\n[b]Status:[/b] Under Investigation\n[/divbox]'
                            : '[divbox=white][b]Autopsy Request[/b]\n[b]Decedent:[/b] ' + name + oocPart + '\n[b]Case:[/b] ' + caseTitle + '\n[b]Status:[/b] Under Investigation\n[/divbox]';
                        console.log(`[AUTO]  Creating LSPD crosspost topic for ${key} (caseTopicId=${caseTopicId ? '#' + caseTopicId : 'UNKNOWN'}): "${topicTitle}"`);
                        const postResult = await client.postTopic(LSPD_FORUM_ID, topicTitle, topicBody, 'https://lspd.gta.world/posting.php?mode=post&f=1361');
                        if (!postResult.ok) throw new Error('LSPD topic create failed: ' + (postResult.reason || 'unknown'));
                        const tM = (postResult.url || '').match(/[?&]t=(\d+)/);
                        if (!tM) throw new Error('Could not extract LSPD topic ID from: ' + postResult.url);
                        lspdTopicId = tM[1];
                        await db.ref(`autopsy-requested/${key}/lspdTopicId`).set(lspdTopicId).catch(() => {});
                        console.log(`[AUTO]  LSPD topic created #${lspdTopicId} for ${key} (caseTopicId=${caseTopicId ? '#' + caseTopicId : 'UNKNOWN'})`);
                    }

                    // Post the LSPD acknowledgement reply.
                    const ackBbcode = ACK_TEMPLATE.replace('REQUESTING_NAME', requesterName);
                    const ackResult = await client.replyToTopic(lspdTopicId, LSPD_FORUM_ID, ackBbcode, { dryRun: false, baseUrl: LSPD_BASE });
                    if (ackResult.ok) {
                        await db.ref(`autopsy-requested/${key}/lspd-acknowledge-reply`).set('completed').catch(() => {});
                        await db.ref(`autopsy-requested/${key}/lspd-acknowledge-reply-at`).set(new Date().toISOString()).catch(() => {});
                        console.log(`[AUTO]  LSPD ack posted for ${key} (#${lspdTopicId})`);
                        notifySelfHeal(key, 'lspd crosspost missing', `LSPD topic #${lspdTopicId} + ack posted`);
                    } else {
                        console.warn(`[AUTO]  LSPD ack failed for ${key}: ${ackResult.reason || 'unknown'}`);
                        notifySelfHeal(key, 'lspd crosspost', `LSPD ack FAILED: ${ackResult.reason || 'unknown'}`);
                    }
                } catch (err) {
                    console.error(`[AUTO]  LSPD crosspost recovery error for ${key}: ${err.message}`);
                    notifySelfHeal(key, 'lspd crosspost', `ERROR: ${err.message}`);
                }
        }

        if (retried > 0) console.log(`[AUTO]  Retried ${retried} missing LSPD crosspost(s)`);
    } catch (err) {
        console.error('[AUTO]  LSPD crosspost recovery scan error: ' + err.message);
    }
}

// ── Unified Recovery Heartbeat ──

let _heartbeatRunning = false;
const RECOVERY_HEARTBEAT_INTERVAL_MS =
    parseInt(process.env.RECOVERY_HEARTBEAT_INTERVAL_MS || '', 10) || 10 * 60 * 1000;

/**
 * Run all recovery/self-healing sweeps in sequence.
 *
 * Checks are ordered so the shared default forum client's session stays sane
 * (retryMissingLspdCrossposts force-logs it into LSPD, so PHMC-only checks run
 * after it or re-authenticate explicitly). Each check is isolated — one failure
 * never stops the rest. A reentrancy guard skips an overlapping tick.
 */
export async function runRecoveryHeartbeat(db) {
    if (_heartbeatRunning) {
        console.log('[HEARTBEAT] Sweep skipped — previous sweep still running');
        return;
    }
    _heartbeatRunning = true;
    const sweepStart = Date.now();
    const summary = [];
    const checks = [
        ['retry-queue',            () => checkRetryQueue()],
        ['lssd-crosspost-retry',   () => retryFailedLssdCrossposts(db)],
        ['lspd-crosspost-retry',   () => retryFailedLspdCrossposts(db)],
        ['lspd-crosspost-recover', () => retryMissingLspdCrossposts(db)],
        ['lspd-ack-retry',         () => retryFailedLspdAcknowledgements(db)],
        ['agency-ack-retry',       () => retryFailedAgencyAcknowledgements(db)],
        ['phmc-ack-retry',         () => retryFailedPhmcAcknowledgements(db)],
        ['completion-steps-retry', () => retryFailedCompletionSteps(db)],
        ['assignment-reply-retry', () => retryFailedAssignmentReplies(db)],
        ['report-edits',           () => processReportEdits(db)],
        ['death-record-verify',    () => import('./deathRecordDraft.js').then(({ verifyPostedDeathRecords }) => verifyPostedDeathRecords(db))],
    ];
    try {
        for (const [name, fn] of checks) {
            const t0 = Date.now();
            try {
                await fn();
                summary.push(`${name}=ok(${((Date.now() - t0) / 1000).toFixed(1)}s)`);
            } catch (err) {
                console.error(`[HEARTBEAT] ${name} threw: ${err.message}`);
                summary.push(`${name}=ERR(${((Date.now() - t0) / 1000).toFixed(1)}s)`);
            }
        }
        console.log(`[HEARTBEAT] Sweep complete in ${((Date.now() - sweepStart) / 1000).toFixed(1)}s — ${summary.join(', ')}`);
    } finally {
        _heartbeatRunning = false;
    }
}

export function startRecoveryHeartbeat(db) {
    logFnCall('autoDeploy', 'startRecoveryHeartbeat', `Recovery heartbeat every ${RECOVERY_HEARTBEAT_INTERVAL_MS / 60000} min`);
    // Startup sweep is delayed so the shared browser's startup tasks (roster sync,
    // forum logins, group fetches) finish first — running it immediately raced with
    // those and threw "Target page, context or browser has been closed" intermittently.
    setTimeout(() => runRecoveryHeartbeat(db), 30 * 1000);
    setInterval(() => runRecoveryHeartbeat(db), RECOVERY_HEARTBEAT_INTERVAL_MS);
}
