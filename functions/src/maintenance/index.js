import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db, admin } from '../utils/firebase.js';
import { sendWebhook } from '../utils/helpers.js';
import { runWeeklyCoronerSummary, runMonthlyCoronerSummary, runYearlyCoronerSummary } from '../reports/coroner.js';
// import { syncFactionMembers } from './factionSync.js';  // Commented out: sync now runs on auth recovery only, not scheduled
import { getFunctionStats } from '../utils/functionStats.js';

// --- VPS saved-report store client (3b-5) ---
// Direct Admin-SDK-free HTTPS calls to morgue-api with server-side keys
// (same MORGUE_API_URL / MORGUE_API_KEY / MORGUE_WRITE_API_KEY env as
// functions/index.js callSavedReportsApi). Keys are never logged.
const VPS_BASE_URL = (process.env.MORGUE_API_URL || 'http://88.208.243.254').replace(/\/$/, '');
const VPS_READ_KEY = process.env.MORGUE_API_KEY || null;
const VPS_WRITE_KEY = process.env.MORGUE_WRITE_API_KEY || null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function vpsSavedReportsGet(path, apiKey) {
    if (!apiKey) throw new Error('Saved-report VPS key is not configured.');
    for (let attempt = 0; attempt < 2; attempt++) {
        const response = await fetch(`${VPS_BASE_URL}${path}`, {
            headers: { 'x-api-key': apiKey },
        });
        if (response.status === 429 && attempt === 0) {
            console.warn(`[Maintenance] VPS rate-limited on GET ${path}; waiting 61s and retrying.`);
            await sleep(61000);
            continue;
        }
        if (!response.ok) {
            const text = await response.text().catch(() => '');
            throw new Error(`VPS GET ${path} returned ${response.status}${text ? `: ${text.slice(0, 200)}` : ''}`);
        }
        return response.json();
    }
    throw new Error('VPS GET rate-limited twice; giving up on this call.');
}

async function vpsDeleteSavedReport(author, key) {
    if (!VPS_WRITE_KEY) throw new Error('Saved-report VPS write key is not configured.');
    const path = `/api/reports/${encodeURIComponent(author)}/${encodeURIComponent(key)}`;
    for (let attempt = 0; attempt < 2; attempt++) {
        const response = await fetch(`${VPS_BASE_URL}${path}`, {
            method: 'DELETE',
            headers: { 'x-api-key': VPS_WRITE_KEY },
        });
        if (response.status === 429 && attempt === 0) {
            console.warn(`[Maintenance] VPS rate-limited on DELETE; waiting 61s and retrying.`);
            await sleep(61000);
            continue;
        }
        if (response.status === 404) return false;
        if (!response.ok) {
            const text = await response.text().catch(() => '');
            throw new Error(`VPS DELETE returned ${response.status}${text ? `: ${text.slice(0, 200)}` : ''}`);
        }
        return true;
    }
    throw new Error('VPS DELETE rate-limited twice; giving up on this report.');
}

const _runMaintenance = async (triggerContext) => {
    console.log("Running maintenance task.", triggerContext);

    const now = new Date();
    const isMonday = now.getUTCDay() === 1;
    const isFirstOfMonth = now.getUTCDate() === 1;
    const isFirstOfYear = isFirstOfMonth && now.getUTCMonth() === 0;

    // Results Tracker
    let maintenanceResults = {
        duplicateCleanup: { scanned: 0, duplicatesFound: 0, duplicatesDeleted: 0, errors: [] },
        reportCleanup: { oldReportsCleaned: 0, errors: [] },
        webhookLogsCleanup: { cleaned: 0, error: null },
        monitoringCleanup: { cleaned: 0, error: null },
        // factionSync: { success: false, count: 0, error: null },  // Commented out with import above
        pendingDeployments: { coronerReports: 0, coronerEmails: 0, total: 0, errors: [] },
        functionStats: null,
    };

    // --- 0. Faction Member Sync ---
    // Commented out: sync now runs on auth recovery only, not scheduled maintenance
    // try {
    //     const syncResult = await syncFactionMembers(triggerContext.trigger);
    //     maintenanceResults.factionSync = syncResult;
    // } catch (e) {
    //     console.error("Error during faction sync in maintenance:", e);
    //     maintenanceResults.factionSync = { success: false, error: e.message };
    // }

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

    // --- 2. VPS Saved-Report Maintenance (Duplicates & Old Reports) ---
    // 3b-5: reimplemented against the VPS store — zero RTDB report scans.
    // Windows preserved: 365-day old-report cleanup + 14-day duplicate scan.
    // Authors enumerated via GET /api/reports/stats (byAuthor keys); per-author
    // reports via GET /api/reports?author= (full list, summaries spread the
    // stored report body so timestamp/data/originalKey are present); deletes via
    // DELETE /api/reports/:author/:key (write key, one file holds report+BBCode).
    // Authors processed sequentially to respect the VPS 60 req/min per-key
    // rate limit (429s wait 61s and retry once, same pattern as the backfill
    // script). Reports with no usable timestamp are never treated as old.
    try {
        console.log('[Maintenance] Starting VPS Saved-Report Maintenance...');

        const threeSixtyFiveDaysAgo = Date.now() - (365 * 24 * 60 * 60 * 1000);
        const fourteenDaysAgo = Date.now() - (14 * 24 * 60 * 60 * 1000);

        let authorIds = [];
        try {
            const statsResult = await vpsSavedReportsGet('/api/reports/stats', VPS_READ_KEY);
            authorIds = Object.keys(statsResult?.byAuthor || {});
        } catch (err) {
            throw new Error(`Could not list VPS report authors: ${err.message}`);
        }
        console.log(`[Maintenance] VPS saved-report authors: ${authorIds.length}`);

        for (const authorId of authorIds) {
            let reports = [];
            try {
                const listResult = await vpsSavedReportsGet(
                    `/api/reports?author=${encodeURIComponent(authorId)}`, VPS_READ_KEY);
                reports = Array.isArray(listResult?.reports) ? listResult.reports : [];
            } catch (err) {
                console.error(`Error listing VPS reports for author ${authorId}:`, err.message);
                maintenanceResults.reportCleanup.errors.push(`Author ${authorId} list: ${err.message}`);
                continue;
            }

            const recentReports = [];

            for (const report of reports) {
                const reportKey = report?.key;
                if (!reportKey) continue;
                const reportTimestamp = Number(report?.timestamp) || 0;

                // A. Old Reports Cleanup (> 365 days)
                if (reportTimestamp && reportTimestamp <= threeSixtyFiveDaysAgo) {
                    try {
                        await vpsDeleteSavedReport(authorId, reportKey);
                        maintenanceResults.reportCleanup.oldReportsCleaned++;
                    } catch (err) {
                        console.error(`Error deleting old VPS report ${authorId}/${reportKey}:`, err.message);
                        maintenanceResults.reportCleanup.errors.push(`Old ${authorId}/${reportKey}: ${err.message}`);
                    }
                    continue;
                }

                if (reportTimestamp && reportTimestamp >= fourteenDaysAgo) {
                    recentReports.push({ key: reportKey, val: report });
                }
            }

            // C. Duplicate Cleanup (Last 14 Days Only) — same entity-key +
            // 6-hour-window rule as the pre-3b-5 RTDB version.
            try {
                recentReports.sort((a, b) => (b.val.timestamp || 0) - (a.val.timestamp || 0));

                const getEntityKey = (reportVal) => {
                    const d = reportVal.data || {};
                    if (d.decedentName || d.decedentOOC) {
                        return `DECEDENT:${d.decedentName || ''}|${d.decedentOOC || ''}|${d.dateTime || ''}`;
                    }
                    return `TITLE:${reportVal.originalKey || ''}`;
                };

                const keptReports = [];
                let authorDuplicates = 0;

                for (const report of recentReports) {
                    maintenanceResults.duplicateCleanup.scanned++;
                    const currentEntityKey = getEntityKey(report.val);
                    const currentTimestamp = report.val.timestamp || 0;

                    let isDuplicate = false;

                    for (const keptReport of keptReports) {
                        if (getEntityKey(keptReport.val) === currentEntityKey
                            && Math.abs((keptReport.val.timestamp || 0) - currentTimestamp) <= 6 * 60 * 60 * 1000) {
                            isDuplicate = true;
                            break;
                        }
                    }

                    if (isDuplicate) {
                        try {
                            await vpsDeleteSavedReport(authorId, report.key);
                            maintenanceResults.duplicateCleanup.duplicatesFound++;
                            maintenanceResults.duplicateCleanup.duplicatesDeleted++;
                            authorDuplicates++;
                        } catch (err) {
                            console.error(`Error deleting duplicate VPS report ${authorId}/${report.key}:`, err.message);
                            maintenanceResults.duplicateCleanup.errors.push(`Duplicate ${authorId}/${report.key}: ${err.message}`);
                            keptReports.push(report);
                        }
                    } else {
                        keptReports.push(report);
                    }
                }

                if (authorDuplicates > 0) {
                    console.log(`[Maintenance] Cleaned ${authorDuplicates} duplicates for author ${authorId}`);
                }
            } catch (err) {
                console.error(`Error cleaning VPS duplicates for author ${authorId}:`, err.message);
                maintenanceResults.duplicateCleanup.errors.push(`Author ${authorId}: ${err.message}`);
            }
        }
    } catch (error) {
        console.error("Critical error in VPS Report Maintenance:", error);
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
    // Webhook-log + monitoring cleanup moved to the bot — no Functions-side
    // cleanup runs here. Flags stay defined (false) so the embed below renders
    // without throwing; the result fields are init'd in maintenanceResults above.
    const hasWebhooksCleanup = false;
    const hasMonitoringCleanup = false;
    const fnStats = maintenanceResults.functionStats;

    const topFunctions = fnStats?.functions?.slice(0, 5) || [];
    const topFunctionsValue = topFunctions.length > 0
        ? topFunctions.map((f, i) => `${i + 1}. **${f.name}** — ${f.count} calls`).join('\n')
        : 'No data available';
    
    const embed = {
        title: `Daily Maintenance Task (${triggerContext.trigger})`,
        color: hasPending ? 0x9b59b6 : (hasCleanedUp ? 0xFF6B35 : 0x1E90FF),
        fields: [
            // { name: "👥 Faction Member Sync", value: maintenanceResults.factionSync?.success
            //     ? `✅ Synced **${maintenanceResults.factionSync.count}** members.`
            //     : `❌ Failed: ${maintenanceResults.factionSync?.error || 'Unknown error'}`, inline: false },
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

    // Plan 5 cleanup (2026-09-14): runMonthlyCoronerSummary is @deprecated and
    // early-returns null — kept in the call list so re-enabling is a validation
    // task, not a rediscovery task. See functions/src/reports/coroner.js.
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
const dailyMaintenanceTask = onSchedule({
    schedule: "every day 09:00",
    timeZone: "UTC",
    region: "europe-west2",
    secrets: ["PHMC_CONFIG"],
    memory: "512MiB",
    timeoutSeconds: 540,
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
const triggerManualMaintenance = onCall({
    region: "europe-west2",
    secrets: ["PHMC_CONFIG"],
    memory: "512MiB",
    timeoutSeconds: 1200,
}, async (request) => {
    const isSuperAdmin = request.auth?.token?.isSuperAdmin === true || request.auth?.token?.accessLevel === 'superadmin';
    if (!isSuperAdmin) {
        throw new HttpsError('permission-denied', 'Super-admin access required.');
    }
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
            // const syncResult = await syncFactionMembers('auth_update');  // Commented out: sync runs on auth recovery
            return {
                success: true,
                message: `Auth state for ${path} updated and sync triggered.`,
                // syncResult
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


