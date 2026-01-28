import { onSchedule } from "firebase-functions/v2/scheduler";
import { createHash } from 'crypto';
import { db, admin } from '../utils/firebase.js';
import { sendWebhook, getShuffledPhrases, scheduleDeletion } from '../utils/helpers.js';
import { runWeeklyCoronerSummary, runMonthlyCoronerSummary, runYearlyCoronerSummary } from '../reports/coroner.js';

// --- Helper for Metrics Summary ---
export const runWeeklyMetricsSummary = async () => {
    console.log(`[Metrics Summary] Running weekly user metrics summary.`);

    const metricsRef = db.ref('user_metrics');
    const snapshot = await metricsRef.once('value');

    if (!snapshot.exists()) {
        console.log('[Metrics Summary] No user_metrics data found.');
        return null;
    }

    const allMetrics = snapshot.val();
    const userStats = [];
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    Object.entries(allMetrics).forEach(([ucpName, categories]) => {
        let totalActions = 0;
        let lastActive = 0;
        let distinctActions = 0;

        if (ucpName === 'DEV_STAGING') return; // Ignore dev staging data

        Object.values(categories).forEach(subCategories => {
            Object.values(subCategories).forEach(metric => {
                totalActions += metric.visit_count || 0;
                if (metric.last_visited > lastActive) {
                    lastActive = metric.last_visited;
                }
                distinctActions++;
            });
        });

        // Only include users active in the last week
        if (lastActive > oneWeekAgo) {
            userStats.push({
                ucpName: ucpName.replace(/_/g, ' '),
                totalActions,
                distinctActions,
                lastActive,
            });
        }
    });

    if (userStats.length === 0) {
        await sendWebhook({
            embeds: [{
                title: "Weekly Metrics Summary",
                description: "No user activity recorded in the last 7 days.",
                color: 0x6c757d, // Gray
                footer: { text: "PHMC Tools - Automated Weekly Summary" }
            }]
        });
        return null;
    }
    
    // Sort by total actions and get top 5
    const top5Users = userStats.sort((a, b) => b.totalActions - a.totalActions).slice(0, 5);

    const totalWeeklyUsers = userStats.length;
    const totalWeeklyActions = userStats.reduce((sum, user) => sum + user.totalActions, 0);

    let topUsersDescription = top5Users.map((user, index) => {
        return `${index + 1}. **${user.ucpName}**: ${user.totalActions} actions`;
    }).join('\n');
    
    if (top5Users.length === 0) {
        topUsersDescription = "No users with recorded actions this week."
    }

    const embed = {
        title: "Weekly User Activity Summary",
        description: "A summary of user engagement with PHMC Tools over the last 7 days.",
        color: 0x0275d8, // Blue
        fields: [
            {
                name: "📊 Overall Stats",
                value: `**${totalWeeklyUsers}** active users performed a total of **${totalWeeklyActions}** actions.`, 
                inline: false
            },
            {
                name: "🏆 Top 5 Most Active Users (by actions)",
                value: topUsersDescription,
                inline: false
            }
        ],
        footer: { text: "PHMC Tools - Automated Weekly Summary" },
        timestamp: new Date().toISOString()
    };

    await sendWebhook({ embeds: [embed] });

    console.log(`[Metrics Summary] Weekly summary sent. Active users: ${totalWeeklyUsers}. Total actions: ${totalWeeklyActions}.`);

    return null;
};


// --- Scheduled Cloud Function (v2) ---

export const dailyMaintenanceTask = onSchedule({
    schedule: "every day 09:00",
    timeZone: "UTC",
    secrets: ["PHMC_CONFIG"],
    memory: "512MiB", // Explicitly increase memory for safety, though optimization reduces need
    timeoutSeconds: 540, // 9 minutes
}, async (event) => {
    console.log(`Running daily maintenance task. Event ID: ${event.id}`);

    const now = new Date();
    const isMonday = now.getUTCDay() === 1;
    const isFirstOfMonth = now.getUTCDate() === 1;
    const isFirstOfYear = isFirstOfMonth && now.getUTCMonth() === 0;

    const REPORTS_PATH = '/newSavedReports';
    const BBCODE_PATH = '/newSavedReportBBCode';
    
    // Results Tracker
    let maintenanceResults = {
        bingo: { success: [], noCard: [], notEnoughPhrases: [], errors: [] },
        phraseRequests: { deleted: 0, errors: [] },
        duplicateCleanup: { scanned: 0, duplicatesFound: 0, duplicatesDeleted: 0, errors: [] },
        backupCleanup: { oldBackupsCleaned: 0, errors: [] },
        webhookLogCleanup: { oldLogsCleaned: 0, errors: [] },
        reportCleanup: { oldReportsCleaned: 0, errors: [] }
    };

    // --- 1. Bingo Reset Logic ---
    // ... logic remains same ...
    const BINGO_TYPES = [
        { id: 'er', name: 'Emergency Room', path: 'ER' },
        { id: 'ems', name: 'EMS', path: 'EMS' },
        { id: 'coroner', name: 'Coroner', path: 'Coroner' }
    ];

    try {
        await db.ref('bingo/meta').update({ lastAutoRegenTimestamp: admin.database.ServerValue.TIMESTAMP });
        await Promise.all(BINGO_TYPES.map(async (bingoType) => {
            const cardPhrasesRef = db.ref(`bingo/cards/${bingoType.path}/phrases`);
            const masterPhrasesRef = db.ref(`bingo/phrases/${bingoType.path}`);
            const activityLogRef = db.ref(`bingo/logs/${bingoType.path}/activityLog`);

            try {
                const cardSnapshot = await cardPhrasesRef.once('value');
                if (!cardSnapshot.exists()) {
                    maintenanceResults.bingo.noCard.push(bingoType.name);
                    return;
                }

                const masterSnapshot = await masterPhrasesRef.once('value');
                if (!masterSnapshot.exists()) {
                    maintenanceResults.bingo.notEnoughPhrases.push(`${bingoType.name} (no master list)`);
                    return;
                }

                const masterPhrasesData = masterSnapshot.val();
                const masterPhrases = Array.isArray(masterPhrasesData)
                    ? masterPhrasesData.filter(Boolean)
                    : (typeof masterPhrasesData === 'object' && masterPhrasesData !== null)
                        ? Object.values(masterPhrasesData).map(p => (typeof p === 'object' ? p.phrase : p)).filter(Boolean)
                        : [];

                if (masterPhrases.length < 24) {
                    maintenanceResults.bingo.notEnoughPhrases.push(`${bingoType.name} (${masterPhrases.length}/24)`);
                    return;
                }

                const shuffledPhrases = getShuffledPhrases(masterPhrases).slice(0, 24);
                await cardPhrasesRef.set(shuffledPhrases);
                await activityLogRef.remove();
                maintenanceResults.bingo.success.push(bingoType.name);

            } catch (error) {
                console.error(`Error processing ${bingoType.name}: ${error?.message}`);
                maintenanceResults.bingo.errors.push(`${bingoType.name}: ${error.message}`);
            }
        }));
    } catch (e) {
        console.error("Critical error in Bingo Logic:", e);
        maintenanceResults.bingo.errors.push(`Critical: ${e.message}`);
    }

    // --- 2. Phrase Request Deletion Logic ---
    try {
        const requestsRef = db.ref('bingo/phraseRequests');
        const snapshot = await requestsRef.once('value');
        if (snapshot.exists()) {
            const requests = snapshot.val();
            let deletionCount = 0;
            const deletionPromises = Object.entries(requests)
                .map(([key, value]) => {
                    const request = { id: key, ...value };
                    if (request.status !== 'pending' && request.processedAt) {
                        return scheduleDeletion(request).then(() => deletionCount++);
                    }
                    return null;
                })
                .filter(Boolean);
            await Promise.all(deletionPromises);
            maintenanceResults.phraseRequests.deleted = deletionCount;
        }
    } catch (error) {
        console.error(`Error during phrase request deletion: ${error.message}`);
        maintenanceResults.phraseRequests.errors.push(`Phrase request error: ${error.message}`);
    }

    // --- 3. Optimized User Report Maintenance (Duplicates & Old Reports) ---
    // Instead of fetching all reports (OOM risk), we fetch user IDs and process per-user.
    try {
        console.log('[Maintenance] Starting User Report Maintenance...');
        const userCountsRef = db.ref('userReportCounts');
        const userCountsSnapshot = await userCountsRef.once('value');
        
        if (userCountsSnapshot.exists()) {
            const userIds = Object.keys(userCountsSnapshot.val());
            const threeSixtyFiveDaysAgo = Date.now() - (365 * 24 * 60 * 60 * 1000);
            const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000);

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

                    // B. Duplicate Cleanup (Last 3 Days Only)
                    // Logic: Match on Name/OOC/Date. If match found within 10 minutes of a newer save, delete the older one.
                    try {
                        const recentReportsQuery = db.ref(`${REPORTS_PATH}/${userId}`)
                            .orderByChild('timestamp')
                            .startAt(threeDaysAgo);
                        
                        const recentSnapshot = await recentReportsQuery.once('value');
                        if (recentSnapshot.exists()) {
                            const recentReports = [];
                            recentSnapshot.forEach(snap => {
                                recentReports.push({ key: snap.key, val: snap.val() });
                            });

                            // Sort descending by timestamp (Newest FIRST)
                            recentReports.sort((a, b) => (b.val.timestamp || 0) - (a.val.timestamp || 0));

                            const updates = {};
                            const keptReports = []; // Stores the 'surviving' reports to compare against

                            // Helper to generate a unique key for the entity (Person + Time)
                            const getEntityKey = (reportVal) => {
                                const d = reportVal.data || {};
                                // If it looks like a death/coroner report
                                if (d.decedentName || d.decedentOOC) {
                                    // Use specific fields requested
                                    return `DECEDENT:${d.decedentName || ''}|${d.decedentOOC || ''}|${d.dateTime || ''}`;
                                }
                                // Fallback for other forms: use the Report Title
                                return `TITLE:${reportVal.originalKey || ''}`;
                            };

                            for (const report of recentReports) {
                                maintenanceResults.duplicateCleanup.scanned++;
                                const currentEntityKey = getEntityKey(report.val);
                                const currentTimestamp = report.val.timestamp || 0;
                                
                                let isDuplicate = false;

                                // Check against reports we've already decided to keep (which are newer than this one)
                                for (const keptReport of keptReports) {
                                    const keptEntityKey = getEntityKey(keptReport.val);
                                    const keptTimestamp = keptReport.val.timestamp || 0;

                                    // If it's the same "Event/Person"
                                    if (currentEntityKey === keptEntityKey) {
                                        const timeDiff = Math.abs(keptTimestamp - currentTimestamp);
                                        // AND it was saved within 10 minutes of the newer version
                                        if (timeDiff <= 10 * 60 * 1000) {
                                            isDuplicate = true;
                                            break; // Stop checking, we found a newer version that supersedes this one
                                        }
                                    }
                                }

                                if (isDuplicate) {
                                    // Delete this older duplicate
                                    updates[`${REPORTS_PATH}/${userId}/${report.key}`] = null;
                                    updates[`${BBCODE_PATH}/${userId}/${report.key}`] = null;
                                    maintenanceResults.duplicateCleanup.duplicatesFound++;
                                    maintenanceResults.duplicateCleanup.duplicatesDeleted++;
                                } else {
                                    // Keep this report (it's either unique, or the newest version of a set)
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

    // --- 4. Backup Cleanup Logic ---
    try {
		console.log('[Maintenance] Starting backup cleanup...');
		const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000); 
		const factionBackupRef = db.ref('factions');
		const factionSnapshot = await factionBackupRef.once('value');

		if (factionSnapshot.exists()) {
			const factions = factionSnapshot.val();
			for (const [factionId, factionData] of Object.entries(factions)) {
				if (factionData?.backups) {
					const backupPromises = Object.entries(factionData.backups)
						.map(async ([backupKey, backupData]) => {
							if (backupData?.backedUpAt && backupData.backedUpAt < threeDaysAgo) {
                                await db.ref(`factions/${factionId}/backups/${backupKey}`).remove();
                                maintenanceResults.backupCleanup.oldBackupsCleaned++;
							}
						});
					await Promise.all(backupPromises);
				}
			}
		}
	} catch (error) {
		maintenanceResults.backupCleanup.errors.push(error.message);
	}

    // --- 5. Webhook Log Cleanup Logic (Optimized) ---
    try {
        console.log('[Maintenance] Starting webhook log cleanup...');
        const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000);
        
        // Use server-side query instead of downloading all logs
        // Assuming keys are timestamps or chronological
        const oldLogsQuery = db.ref('webhook_logs').orderByKey().endAt(String(threeDaysAgo));
        const oldLogsSnapshot = await oldLogsQuery.once('value');

        if (oldLogsSnapshot.exists()) {
            const updates = {};
            oldLogsSnapshot.forEach(snap => {
                updates[`webhook_logs/${snap.key}`] = null;
                maintenanceResults.webhookLogCleanup.oldLogsCleaned++;
            });
            await db.ref().update(updates);
        }
    } catch (error) {
        maintenanceResults.webhookLogCleanup.errors.push(error.message);
    }

    // Send comprehensive webhook notification
    const bingoDetails = [
        `Success: ${maintenanceResults.bingo.success.join(', ') || 'None'}`,
        `No Card: ${maintenanceResults.bingo.noCard.join(', ') || 'None'}`,
        `Not Enough Phrases: ${maintenanceResults.bingo.notEnoughPhrases.join(', ') || 'None'}`
    ].join('\n');

    const hasCleanedUp = maintenanceResults.reportCleanup.oldReportsCleaned > 0 || maintenanceResults.duplicateCleanup.duplicatesDeleted > 0 || maintenanceResults.backupCleanup.oldBackupsCleaned > 0 || maintenanceResults.webhookLogCleanup.oldLogsCleaned > 0;
    
    const embed = {
        title: "Daily Maintenance Task",
        color: hasCleanedUp ? 0xFF6B35 : 0x1E90FF,
        fields: [
            { name: "🎯 Bingo Reset Status", value: bingoDetails.trim() || "No bingo actions taken.", inline: false },
            { name: "📝 Phrase Request Deletion", value: `Deleted: ${maintenanceResults.phraseRequests.deleted}`, inline: false },
            { name: "📜 Old Reports (365+ days)", value: `Deleted: ${maintenanceResults.reportCleanup.oldReportsCleaned}`, inline: true },
            { name: "🧹 Recent Duplicates (3 days)", value: `Scanned: ${maintenanceResults.duplicateCleanup.scanned}\nDeleted: ${maintenanceResults.duplicateCleanup.duplicatesDeleted}`, inline: true },
            { name: "💾 Backup Cleanup", value: `Deleted: ${maintenanceResults.backupCleanup.oldBackupsCleaned}`, inline: true },
            { name: "📋 Webhook Log Cleanup", value: `Deleted: ${maintenanceResults.webhookLogCleanup.oldLogsCleaned}`, inline: true },
        ],
        footer: { text: "PHMC Tools - Automated Daily Maintenance (v2 Optimized)" }
    };

    const allErrors = [
        ...maintenanceResults.reportCleanup.errors,
        ...maintenanceResults.bingo.errors,
        ...maintenanceResults.phraseRequests.errors,
        ...maintenanceResults.duplicateCleanup.errors,
        ...maintenanceResults.backupCleanup.errors,
        ...maintenanceResults.webhookLogCleanup.errors
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
            runWeeklyMetricsSummary(),
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

    return null;
});

