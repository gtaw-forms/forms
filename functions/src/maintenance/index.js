import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db, admin } from '../utils/firebase.js';
import { sendWebhook } from '../utils/helpers.js';
import { runWeeklyCoronerSummary, runMonthlyCoronerSummary, runYearlyCoronerSummary } from '../reports/coroner.js';
import { syncFactionMembers } from './factionSync.js';
import { getFunctionStats } from '../utils/functionStats.js';

const _runMaintenance = async (triggerContext) => {
    console.log("Running maintenance task.", triggerContext);

    const now = new Date();
    const isMonday = now.getUTCDay() === 1;
    const isFirstOfMonth = now.getUTCDate() === 1;
    const isFirstOfYear = isFirstOfMonth && now.getUTCMonth() === 0;

    const REPORTS_PATH = '/newSavedReports';
    const BBCODE_PATH = '/newSavedReportBBCode';
    
    // Results Tracker
    let maintenanceResults = {
        duplicateCleanup: { scanned: 0, duplicatesFound: 0, duplicatesDeleted: 0, errors: [] },
        reportCleanup: { oldReportsCleaned: 0, errors: [] },
        factionSync: { success: false, count: 0, error: null },
        pendingDeployments: { coronerReports: 0, coronerEmails: 0, total: 0, errors: [] },
        functionStats: null,
    };

    // --- 0. Faction Member Sync ---
    try {
        const syncResult = await syncFactionMembers(triggerContext.trigger);
        maintenanceResults.factionSync = syncResult;
    } catch (e) {
        console.error("Error during faction sync in maintenance:", e);
        maintenanceResults.factionSync = { success: false, error: e.message };
    }

    // --- 1. Pending Deployment Report Count ---
    try {
        const TEST_PATH = 'testingSavedReports';
        const testSnapshot = await db.ref(TEST_PATH).once('value');
        if (testSnapshot.exists()) {
            testSnapshot.forEach(authorSnap => {
                authorSnap.forEach(reportSnap => {
                    const r = reportSnap.val();
                    if (r.hasdeployed === false) {
                        if (r.formId === 'coroner-report') maintenanceResults.pendingDeployments.coronerReports++;
                        else if (r.formId === 'coroner_email') maintenanceResults.pendingDeployments.coronerEmails++;
                        maintenanceResults.pendingDeployments.total++;
                    }
                });
            });
        }
        console.log(`[Maintenance] Pending deployments: ${maintenanceResults.pendingDeployments.total} (${maintenanceResults.pendingDeployments.coronerReports} reports, ${maintenanceResults.pendingDeployments.coronerEmails} emails)`);
    } catch (e) {
        console.error("Error counting pending deployments:", e);
        maintenanceResults.pendingDeployments.errors.push(e.message);
    }

    // --- 2. Optimized User Report Maintenance (Duplicates & Old Reports) ---
    try {
        console.log('[Maintenance] Starting User Report Maintenance...');
        const userCountsRef = db.ref('userReportCounts');
        const userCountsSnapshot = await userCountsRef.once('value');
        
        if (userCountsSnapshot.exists()) {
            const userIds = Object.keys(userCountsSnapshot.val());
            const threeSixtyFiveDaysAgo = Date.now() - (365 * 24 * 60 * 60 * 1000);
            const fourteenDaysAgo = Date.now() - (14 * 24 * 60 * 60 * 1000);

            // Process users in chunks to control concurrency
            const CHUNK_SIZE = 10;
            for (let i = 0; i < userIds.length; i += CHUNK_SIZE) {
                const chunk = userIds.slice(i, i + CHUNK_SIZE);
                
                await Promise.all(chunk.map(async (userId) => {
                    // A. Old Reports Cleanup (> 365 days)
                    try {
                        const oldReportsQuery = db.ref(`${REPORTS_PATH}/${userId}`)
                            .orderByChild('timestamp')
                            .endAt(threeSixtyFiveDaysAgo);
                        
                        const oldSnapshot = await oldReportsQuery.once('value');
                        if (oldSnapshot.exists()) {
                            const updates = {};
                            oldSnapshot.forEach((snap) => {
                                updates[`${REPORTS_PATH}/${userId}/${snap.key}`] = null;
                                updates[`${BBCODE_PATH}/${userId}/${snap.key}`] = null;
                                maintenanceResults.reportCleanup.oldReportsCleaned++;
                            });
                            await db.ref().update(updates);
                        }
                    } catch (err) {
                        console.error(`Error cleaning old reports for user ${userId}:`, err);
                    }

                    // C. Duplicate Cleanup (Last 14 Days Only)
                    try {
                        const recentReportsQuery = db.ref(`${REPORTS_PATH}/${userId}`)
                            .orderByChild('timestamp')
                            .startAt(fourteenDaysAgo);
                        
                        const recentSnapshot = await recentReportsQuery.once('value');
                        if (recentSnapshot.exists()) {
                            const recentReports = [];
                            recentSnapshot.forEach(snap => {
                                recentReports.push({ key: snap.key, val: snap.val() });
                            });

                            recentReports.sort((a, b) => (b.val.timestamp || 0) - (a.val.timestamp || 0));

                            const updates = {};
                            const keptReports = []; 

                            const getEntityKey = (reportVal) => {
                                const d = reportVal.data || {};
                                if (d.decedentName || d.decedentOOC) {
                                    return `DECEDENT:${d.decedentName || ''}|${d.decedentOOC || ''}|${d.dateTime || ''}`;
                                }
                                return `TITLE:${reportVal.originalKey || ''}`;
                            };

                            for (const report of recentReports) {
                                maintenanceResults.duplicateCleanup.scanned++;
                                const currentEntityKey = getEntityKey(report.val);
                                const currentTimestamp = report.val.timestamp || 0;
                                
                                let isDuplicate = false;

                                for (const keptReport of keptReports) {
                                    const keptEntityKey = getEntityKey(keptReport.val);
                                    const keptTimestamp = keptReport.val.timestamp || 0;

                                    if (currentEntityKey === keptEntityKey) {
                                        const timeDiff = Math.abs(keptTimestamp - currentTimestamp);
                                        if (timeDiff <= 6 * 60 * 60 * 1000) {
                                            isDuplicate = true;
                                            break; 
                                        }
                                    }
                                }

                                if (isDuplicate) {
                                    updates[`${REPORTS_PATH}/${userId}/${report.key}`] = null;
                                    updates[`${BBCODE_PATH}/${userId}/${report.key}`] = null;
                                    maintenanceResults.duplicateCleanup.duplicatesFound++;
                                    maintenanceResults.duplicateCleanup.duplicatesDeleted++;
                                } else {
                                    keptReports.push(report);
                                }
                            }

                            if (Object.keys(updates).length > 0) {
                                await db.ref().update(updates);
                                console.log(`[Maintenance] Cleaned ${Object.keys(updates).length / 2} duplicates for user ${userId}`);
                            }
                        }
                    } catch (err) {
                        console.error(`Error cleaning duplicates for user ${userId}:`, err);
                        maintenanceResults.duplicateCleanup.errors.push(`User ${userId}: ${err.message}`);
                    }
                }));
            }
        }
    } catch (error) {
        console.error("Critical error in Report Maintenance:", error);
        maintenanceResults.reportCleanup.errors.push(`Critical: ${error.message}`);
    }

    // --- 3. Webhook Logs Cleanup ... [MOVED TO BOT] ---
    // --- 4. Monitoring Data Cleanup ... [MOVED TO BOT] ---

    // --- 5. Function Usage Stats (last 24h) ---
    try {
        const stats = await getFunctionStats(24);
        maintenanceResults.functionStats = stats;
        console.log(`[Maintenance] Function stats: ${stats.totalFunctions} functions, ${stats.totalEntries} log entries.`);
    } catch (error) {
        console.error('[Maintenance] Error fetching function stats:', error);
        maintenanceResults.functionStats = { error: error.message };
    }

    const hasCleanedUp = maintenanceResults.reportCleanup.oldReportsCleaned > 0 || maintenanceResults.duplicateCleanup.duplicatesDeleted > 0;
    const hasPending = maintenanceResults.pendingDeployments.total > 0;
    const fnStats = maintenanceResults.functionStats;

    const topFunctions = fnStats?.functions?.slice(0, 5) || [];
    const topFunctionsValue = topFunctions.length > 0
        ? topFunctions.map((f, i) => `${i + 1}. **${f.name}** — ${f.count} calls`).join('\n')
        : 'No data available';
    
    const embed = {
        title: `Daily Maintenance Task (${triggerContext.trigger})`,
        color: hasPending ? 0x9b59b6 : (hasCleanedUp ? 0xFF6B35 : 0x1E90FF),
        fields: [
            { name: "👥 Faction Member Sync", value: maintenanceResults.factionSync?.success
                ? `✅ Synced **${maintenanceResults.factionSync.count}** members.`
                : `❌ Failed: ${maintenanceResults.factionSync?.error || 'Unknown error'}`, inline: false },
            { name: "📜 Old Reports (365+ days)", value: `Deleted: ${maintenanceResults.reportCleanup.oldReportsCleaned}`, inline: true },
            { name: "🧹 Recent Duplicates (14 days)", value: `Scanned: ${maintenanceResults.duplicateCleanup.scanned}
Deleted: ${maintenanceResults.duplicateCleanup.duplicatesDeleted}`, inline: true },
            { name: "⏳ Pending Deployments", value: hasPending
                ? `**${maintenanceResults.pendingDeployments.total}** pending\n📄 ${maintenanceResults.pendingDeployments.coronerReports} reports\n✉️ ${maintenanceResults.pendingDeployments.coronerEmails} emails`
                : '✅ None', inline: true },
            { name: "🗑️ Webhook Logs (30d+ TTL)", value: hasWebhooksCleanup
                ? `Cleaned: **${maintenanceResults.webhookLogsCleanup.cleaned}** entries`
                : '✅ None to clean', inline: true },
            { name: "📊 Monitoring Data (1d TTL)", value: hasMonitoringCleanup
                ? `Cleaned: **${maintenanceResults.monitoringCleanup.cleaned}** entries`
                : '✅ None to clean', inline: true },
            { name: "⚡ Top Functions (24h)", value: topFunctionsValue, inline: false },
        ],
        footer: { text: "PHMC Tools - Automated Daily Maintenance (v2 Optimized)" }
    };

    const allErrors = [
        ...(maintenanceResults.reportCleanup.errors || []),
        ...(maintenanceResults.duplicateCleanup.errors || []),
        ...(maintenanceResults.pendingDeployments.errors || []),
        ...(maintenanceResults.webhookLogsCleanup?.error ? [maintenanceResults.webhookLogsCleanup.error] : []),
        ...(maintenanceResults.monitoringCleanup?.error ? [maintenanceResults.monitoringCleanup.error] : []),
        ...(fnStats?.error ? [fnStats.error] : []),
    ];

    if (allErrors.length > 0) {
        embed.fields.push({
            name: "⚠️ Errors",
            value: allErrors.slice(0, 5).join('\n') + (allErrors.length > 5 ? `\n...and ${allErrors.length - 5} more.` : ''),
            inline: false
        });
    }

    await sendWebhook({ embeds: [embed] });

    // --- 6. Trigger Consolidated Summaries ---
    if (isMonday) {
        console.log('[Maintenance] Triggering weekly summaries (Monday)...');
        await Promise.allSettled([
            runWeeklyCoronerSummary()
        ]);
    }

    if (isFirstOfMonth) {
        console.log('[Maintenance] Triggering monthly summaries (1st of month)...');
        await Promise.allSettled([
            runMonthlyCoronerSummary()
        ]);
    }

    if (isFirstOfYear) {
        console.log('[Maintenance] Triggering yearly summaries (January 1st)...');
        await Promise.allSettled([
            runYearlyCoronerSummary()
        ]);
    }

    return {
        success: allErrors.length === 0,
        results: maintenanceResults
    };
}

// --- Scheduled Cloud Function (v2) ---
export const dailyMaintenanceTask = onSchedule({
    schedule: "every day 09:00",
    timeZone: "UTC",
    region: "europe-west2",
    secrets: ["PHMC_CONFIG"],
    memory: "512MiB",
    timeoutSeconds: 1200, 
}, async (event) => {
    console.log(`Running daily maintenance task. Event ID: ${event.id}`);
    const result = await _runMaintenance({ trigger: 'schedule', id: event.id });
    if (!result.success) {
        console.error("Scheduled maintenance finished with errors.", result.results);
    } else {
        console.log("Scheduled maintenance finished successfully.");
    }
    return null;
});

// --- Manual Trigger ---
export const triggerManualMaintenance = onCall({
    region: "europe-west2",
    secrets: ["PHMC_CONFIG"],
    memory: "512MiB",
    timeoutSeconds: 1200,
}, async (request) => {
    const triggerUser = request.auth?.token?.email || 'Unknown user';
    console.log(`Manually triggering maintenance. Requested by: ${triggerUser}`);

    try {
        const result = await _runMaintenance({ trigger: 'manual', user: triggerUser });
        console.log("Manual maintenance finished.", result);
        return result;
    } catch (error) {
        console.error("Critical error during manual maintenance trigger: ", error);
        return { success: false, error: error.message };
    }
});

/**
 * Allows an admin to update an arbitrary session cookies auth state in the database.
 * Expects a Playwright storageState JSON object and a target path.
 */
export const updateAuthState = onCall({
    region: "europe-west2",
    secrets: ["PHMC_CONFIG"],
    memory: "256MiB",
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'You must be logged in.');
    }

    // Check for superadmin status via custom claims
    const isSuperAdmin = request.auth.token.isSuperAdmin === true || request.auth.token.accessLevel === 'superadmin';
    if (!isSuperAdmin) {
        throw new HttpsError('permission-denied', 'Only Super Admins can update authentication state.');
    }

    const { storageState, path } = request.data || {};
    if (!storageState || !storageState.cookies) {
        throw new HttpsError('invalid-argument', 'Invalid storageState provided. Must be a Playwright JSON object with cookies.');
    }
    if (!path || typeof path !== 'string' || !path.startsWith('/')) {
        throw new HttpsError('invalid-argument', 'A valid database path (string, starting with /) must be provided.');
    }

    try {
        await db.ref(path).set(storageState);
        
        // Notify of the update
        await sendWebhook({
            embeds: [{
                title: "Auth State Updated",
                description: `Admin **${request.auth.token.email}** updated auth state at path: \`${path}\`.`,
                color: 0x007bff,
                footer: { text: "PHMC Tools - Admin Action" }
            }]
        });

        // If it's the UCP auth state, trigger a sync to verify it works
        if (path === '/factions/364/ucp_auth_state') {
            const syncResult = await syncFactionMembers('auth_update');
            return { 
                success: true, 
                message: `Auth state for ${path} updated and sync triggered.`,
                syncResult 
            };
        }

        return { 
            success: true, 
            message: `Auth state for ${path} updated successfully.`,
        };
    } catch (error) {
        console.error(`Error updating auth state for path ${path}:`, error);
        throw new HttpsError('internal', error.message);
    }
});

/**
 * Manually triggers a faction member sync.
 */
export const triggerFactionSync = onCall({
    region: "europe-west2",
    secrets: ["PHMC_CONFIG"],
    memory: "512MiB",
    timeoutSeconds: 300,
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'You must be logged in.');
    }

    const isSuperAdmin = request.auth.token.isSuperAdmin === true || request.auth.token.accessLevel === 'superadmin';
    const isFactionMember = request.auth.token.isFactionMember === true;
    
    if (!isSuperAdmin && !isFactionMember) {
        throw new HttpsError('permission-denied', 'Only Faction Members or Super Admins can manually trigger a sync.');
    }

    try {
        const result = await syncFactionMembers('manual_trigger');
        return result;
    } catch (error) {
        throw new HttpsError('internal', error.message);
    }
});


