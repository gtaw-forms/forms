import { onSchedule } from "firebase-functions/v2/scheduler";
import { createHash } from 'crypto';
import { db, admin } from '../utils/firebase.js';
import { sendWebhook, getShuffledPhrases, scheduleDeletion } from '../utils/helpers.js';

// --- Scheduled Cloud Function (v2) ---

export const dailyMaintenanceTask = onSchedule({
    schedule: "every day 09:00",
    timeZone: "UTC",
    // --- MODIFICATION: Add the 'secrets' option to grant access to the webhook URL
    secrets: ["ADMIN_ACTION_WEBHOOK_URL"],
}, async (event) => {
    console.log(`Running daily maintenance task. Event ID: ${event.id}`);

    const REPORTS_PATH = '/newSavedReports';
    const BBCODE_PATH = '/newSavedReportBBCode';
    let maintenanceResults = {
        bingo: { success: [], noCard: [], notEnoughPhrases: [], errors: [] },
        phraseRequests: { deleted: 0, errors: [] },
        duplicateCleanup: { scanned: 0, duplicatesFound: 0, duplicatesDeleted: 0, errors: [] },
        backupCleanup: { oldBackupsCleaned: 0, errors: [] },
        webhookLogCleanup: { oldLogsCleaned: 0, errors: [] },
        reportCleanup: { oldReportsCleaned: 0, errors: [] }
    };

    // --- Bingo Reset Logic ---
    const BINGO_TYPES = [
        { id: 'er', name: 'Emergency Room', path: 'ER' },
        { id: 'ems', name: 'EMS', path: 'EMS' },
        { id: 'coroner', name: 'Coroner', path: 'Coroner' }
    ];

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
            // --- IMPROVEMENT: More robustly handle object-or-array data structures from Firebase.
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
            console.error(`Error processing ${bingoType.name}: ${error?.message || String(error)}`);
            maintenanceResults.bingo.errors.push(`${bingoType.name}: ${error.message}`);
        }
    }));

    // --- Phrase Request Deletion Logic ---
    try {
        const requestsRef = db.ref('bingo/phraseRequests');
        const snapshot = await requestsRef.once('value');
        if (snapshot.exists()) {
            const requests = snapshot.val();
            let deletionCount = 0;

            // Collect deletion promises
            const deletionPromises = Object.entries(requests)
                .map(([key, value]) => {
                    const request = { id: key, ...value };
                    if (request.status !== 'pending' && request.processedAt) {
                        return scheduleDeletion(request).then(() => {
                            deletionCount++; // Increment only on successful deletion
                        });
                    }
                    return null;
                })
                .filter(Boolean);

            await Promise.all(deletionPromises);
            maintenanceResults.phraseRequests.deleted = deletionCount;
        }
    } catch (error) {
        console.error(`Error during phrase request deletion: ${error?.message || String(error)}`);
        maintenanceResults.phraseRequests.errors.push(`Phrase request deletion error: ${error.message}`);
    }

    // --- Duplicate Reports Cleanup Logic ---
    try {
        console.log('[Maintenance] Starting duplicate reports cleanup...');
        const reportsRef = db.ref(REPORTS_PATH);
        const reportsSnapshot = await reportsRef.once('value');

        if (reportsSnapshot.exists()) {
            const allReports = reportsSnapshot.val();
            const reportHashes = new Map(); // hash -> [reportPaths]
            let totalReportsScanned = 0;
            let duplicatesFound = 0;
            let duplicatesDeleted = 0;

            // Scan all user directories
            for (const [userId, userReports] of Object.entries(allReports)) {
                if (!userReports || typeof userReports !== 'object') continue;

                // Scan all reports for this user
                for (const [reportKey, reportData] of Object.entries(userReports)) {
                    if (!reportData || typeof reportData !== 'object') continue;

                    totalReportsScanned++;

                    // Create a hash based on key fields to identify duplicates
                    // UPDATED: Use reportData.data (form values) for unique content hash as bbCode is stored separately now.
                    const hashData = {
                        content: reportData.data ? JSON.stringify(reportData.data) : (reportData.bbCode || ''),
                        authorName: reportData.authorName,
                        originalKey: reportData.originalKey
                    };

                    const hash = createHash('md5').update(JSON.stringify(hashData)).digest('hex');
                    const reportPath = `${userId}/${reportKey}`;

                    if (!reportHashes.has(hash)) {
                        reportHashes.set(hash, [reportPath]);
                    } else {
                        reportHashes.get(hash).push(reportPath);
                    }
                }
            }

            // Process duplicates - keep the most recent one, delete others
            for (const [hash, reportPaths] of reportHashes.entries()) {
                if (reportPaths.length > 1) {
                    duplicatesFound += reportPaths.length - 1; // All except the first are duplicates

                    const reportsWithTimestamps = await Promise.all(
                        reportPaths.map(async (path) => {
                            const [userId, reportKey] = path.split('/');
                            const reportRef = db.ref(`${REPORTS_PATH}/${userId}/${reportKey}`);
                            const snapshot = await reportRef.once('value');
                            const data = snapshot.val();
                            return {
                                path,
                                timestamp: data?.timestamp || 0,
                                userId,
                            reportKey
                        };
                        })
                    );

                    reportsWithTimestamps.sort((a, b) => b.timestamp - a.timestamp);

                    const toDelete = reportsWithTimestamps.slice(1);
                    for (const report of toDelete) {
                        try {
                            const deleteRef = db.ref(`${REPORTS_PATH}/${report.userId}/${report.reportKey}`);
                            const deleteBbCodeRef = db.ref(`${BBCODE_PATH}/${report.userId}/${report.reportKey}`);
                            await deleteRef.remove();
                            await deleteBbCodeRef.remove();
                            duplicatesDeleted++;
                            console.log(`[Maintenance] Deleted duplicate report: ${report.path}`);
                        } catch (deleteError) {
                            console.error(`[Maintenance] Error deleting duplicate report ${report.path}: ${deleteError?.message || String(deleteError)}`);
                            maintenanceResults.duplicateCleanup.errors.push(`Failed to delete duplicate: ${report.path}`);
                        }
                    }
                }
            }

            maintenanceResults.duplicateCleanup.scanned = totalReportsScanned;
            maintenanceResults.duplicateCleanup.duplicatesFound = duplicatesFound;
            maintenanceResults.duplicateCleanup.duplicatesDeleted = duplicatesDeleted;

            console.log(`[Maintenance] Duplicate cleanup complete: scanned ${totalReportsScanned}, found ${duplicatesFound} duplicates, deleted ${duplicatesDeleted}`);
        } else {
            console.log('[Maintenance] No saved reports found to clean up');
        }
    } catch (error) {
        console.error(`Error during duplicate reports cleanup: ${error?.message || String(error)}`);
        maintenanceResults.duplicateCleanup.errors.push(`Duplicate cleanup error: ${error.message}`);
    }

    // --- Backup Cleanup Logic ---
    try {
		console.log('[Maintenance] Starting backup cleanup...');
		const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000); // 3 days in milliseconds
		let oldBackupsCleaned = 0;

		const factionBackupRef = db.ref('factions');
		const factionSnapshot = await factionBackupRef.once('value');

		if (factionSnapshot.exists()) {
			const factions = factionSnapshot.val();

			for (const [factionId, factionData] of Object.entries(factions)) {
				if (factionData?.backups) {
					const backupPromises = Object.entries(factionData.backups)
						.map(async ([backupKey, backupData]) => {
							if (backupData?.backedUpAt && backupData.backedUpAt < threeDaysAgo) {
								try {
									const backupRef = db.ref(`factions/${factionId}/backups/${backupKey}`);
									await backupRef.remove();
									oldBackupsCleaned++;
									console.log(`[Maintenance] Deleted old faction backup: ${factionId}/${backupKey}`);
								} catch (backupError) {
									console.error(`[Maintenance] Error deleting faction backup ${factionId}/${backupKey}: ${backupError?.message || String(backupError)}`);
									maintenanceResults.backupCleanup.errors.push(`Failed to delete faction backup: ${factionId}/${backupKey}`);
								}
							}
						});
					await Promise.all(backupPromises);
				}
			}
		}

		maintenanceResults.backupCleanup.oldBackupsCleaned = oldBackupsCleaned;
		console.log(`[Maintenance] Backup cleanup complete: cleaned ${oldBackupsCleaned} old backups`);
	} catch (error) {
		console.error(`Error during backup cleanup: ${error?.message || String(error)}`);
		maintenanceResults.backupCleanup.errors.push(`Backup cleanup error: ${error.message}`);
	}

    // --- Webhook Log Cleanup Logic ---
    try {
        console.log('[Maintenance] Starting webhook log cleanup...');
        const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000); // 3 days in milliseconds
        const webhookLogsRef = db.ref('webhook_logs');
        const logsSnapshot = await webhookLogsRef.once('value');

        let oldLogsCleaned = 0;

        if (logsSnapshot.exists()) {
            const logs = logsSnapshot.val();

            const logDeletionPromises = Object.entries(logs)
                .map(async ([logKey, logData]) => {
                    let logTimestamp = parseInt(logKey);
                    
                    if (isNaN(logTimestamp)) {
                        if (logData?.timestamp) {
                            logTimestamp = parseInt(logData.timestamp);
                        } else if (logData?.payload?.timestamp) {
                            logTimestamp = parseInt(logData.payload.timestamp);
                        } else if (typeof logData === 'number') {
                            logTimestamp = logData;
                        }
                    }
                    
                    if (!isNaN(logTimestamp) && logTimestamp > 0 && logTimestamp < threeDaysAgo) {
                        try {
                            const logRef = db.ref(`webhook_logs/${logKey}`);
                            await logRef.remove();
                            oldLogsCleaned++;
                        } catch (logError) {
                            console.error(`[Maintenance] Error deleting webhook log ${logKey}: ${logError?.message || String(logError)}`);
                            maintenanceResults.webhookLogCleanup.errors.push(`Failed to delete webhook log: ${logKey}`);
                        }
                    }
                });

            await Promise.all(logDeletionPromises);
        }

        maintenanceResults.webhookLogCleanup.oldLogsCleaned = oldLogsCleaned;
        console.log(`[Maintenance] Webhook log cleanup complete: cleaned ${oldLogsCleaned} old logs`);
    } catch (error) {
        console.error(`Error during webhook log cleanup: ${error?.message || String(error)}`);
        maintenanceResults.webhookLogCleanup.errors.push(`Webhook log cleanup error: ${error.message}`);
    }

    // --- Saved Reports Cleanup Logic (365 days) ---
    try {
        console.log('[Maintenance] Starting old reports cleanup (365 days)...');
        const threeSixtyFiveDaysAgo = Date.now() - (365 * 24 * 60 * 60 * 1000);
        const allUserIdsRef = db.ref(REPORTS_PATH);
        const allUserIdsSnapshot = await allUserIdsRef.once('value');
        let oldReportsCleaned = 0;
        const deletionPromises = [];

        if (allUserIdsSnapshot.exists()) {
            const allUsers = allUserIdsSnapshot.val();

            for (const userId in allUsers) {
                const userReportsQuery = db.ref(`${REPORTS_PATH}/${userId}`).orderByChild('timestamp').endAt(threeSixtyFiveDaysAgo);
                const userReportsSnapshot = await userReportsQuery.once('value');

                if (userReportsSnapshot.exists()) {
                    userReportsSnapshot.forEach((reportSnapshot) => {
                        const reportId = reportSnapshot.key;
                        deletionPromises.push(db.ref(`${REPORTS_PATH}/${userId}/${reportId}`).remove());
                        deletionPromises.push(db.ref(`${BBCODE_PATH}/${userId}/${reportId}`).remove());
                        oldReportsCleaned++;
                    });
                }
            }

            await Promise.all(deletionPromises);
            console.log(`[Maintenance] Old reports cleanup complete: cleaned ${oldReportsCleaned} old reports.`);
        } else {
            console.log('[Maintenance] No saved reports found to clean up.');
        }
        maintenanceResults.reportCleanup.oldReportsCleaned = oldReportsCleaned;
    } catch (error) {
        console.error(`Error during old reports cleanup: ${error?.message || String(error)}`);
        maintenanceResults.reportCleanup.errors.push(`Old reports cleanup error: ${error.message}`);
    }

    // Send comprehensive webhook notification with all maintenance results
    const bingoDetails = [
        `Success: ${maintenanceResults.bingo.success.join(', ') || 'None'}`,
        `No Card: ${maintenanceResults.bingo.noCard.join(', ') || 'None'}`,
        `Not Enough Phrases: ${maintenanceResults.bingo.notEnoughPhrases.join(', ') || 'None'}`
    ].join('\n');

    const phraseRequestsDetails = `Deleted: ${maintenanceResults.phraseRequests.deleted}`;

    const hasCleanedUp = maintenanceResults.reportCleanup.oldReportsCleaned > 0 || maintenanceResults.duplicateCleanup.duplicatesDeleted > 0 || maintenanceResults.backupCleanup.oldBackupsCleaned > 0 || maintenanceResults.webhookLogCleanup.oldLogsCleaned > 0;
    const embed = {
        title: "Daily Maintenance Task",
        color: hasCleanedUp ? 0xFF6B35 : 0x1E90FF, // Orange if cleanup happened, blue otherwise
        fields: [
            {
                name: "🎯 Bingo Reset Status",
                value: `${bingoDetails.trim() || "No bingo actions taken."}`,
                inline: false
            },
            {
                name: "📝 Phrase Request Deletion",
                value: `${phraseRequestsDetails.trim() || "No phrase request actions taken."}`,
                inline: false
            },
            { name: "📜 Old Reports Cleanup (365 days)", value: `🗑️ **Old Reports Cleaned:** ${maintenanceResults.reportCleanup.oldReportsCleaned}`, inline: true }, // New field
            {
                name: "🧹 Duplicate Reports Cleanup",
                value: `📊 **Scanned:** ${maintenanceResults.duplicateCleanup.scanned} reports\n🔍 **Found:** ${maintenanceResults.duplicateCleanup.duplicatesFound}\n🗑️ **Deleted:** ${maintenanceResults.duplicateCleanup.duplicatesDeleted}`,
                inline: true
            },
            { name: "💾 Backup Cleanup (3 days)", value: `📁 **Old Backups Cleaned:** ${maintenanceResults.backupCleanup.oldBackupsCleaned}`, inline: true },
            { name: "📋 Webhook Log Cleanup (3 days)", value: `📝 **Old Logs Cleaned:** ${maintenanceResults.webhookLogCleanup.oldLogsCleaned}`, inline: true },
            {
                name: "📈 Overall Status",
                value: hasCleanedUp
                    ? `✅ Maintenance completed successfully with cleanup actions.`
                    : `✅ Maintenance completed - no significant cleanup actions needed.`,
                inline: false
            }
        ],
        footer: { text: "PHMC Tools - Automated Daily Maintenance (v2)" }
    };

    // Add error details if any
    const allErrors = [
        ...maintenanceResults.reportCleanup.errors, // Add reportCleanup errors
        ...maintenanceResults.bingo.errors,
        ...maintenanceResults.phraseRequests.errors,
        ...maintenanceResults.duplicateCleanup.errors,
        ...maintenanceResults.backupCleanup.errors,
        ...maintenanceResults.webhookLogCleanup.errors
    ];

    if (allErrors.length > 0) {
        embed.fields.push({
            name: "⚠️ Errors",
            value: allErrors.slice(0, 5).join('\n'), // Limit to first 5 errors
            inline: false
        });
    }

    const webhookSuccess = await sendWebhook({ embeds: [embed] });

    if (webhookSuccess) {
        console.log('Daily task handler finished successfully and dispatched webhook.');
    } else {
        console.error('Daily task handler finished, but failed to dispatch webhook.');
    }

    return null;
});

export const weeklyMetricsSummary = onSchedule({
    schedule: "every monday 09:00", // Weekly trigger
    timeZone: "UTC",
    secrets: ["ADMIN_ACTION_WEBHOOK_URL"],
}, async (event) => {
    console.log(`[Metrics Summary] Running weekly user metrics summary. Event ID: ${event.id}`);

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
});
