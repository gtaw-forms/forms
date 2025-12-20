import {
	onSchedule
} from "firebase-functions/v2/scheduler";
import {
	setGlobalOptions
} from "firebase-functions/v2";
import {
	onCall
} from "firebase-functions/v2/https";
import * as functions from "firebase-functions";
import admin from "firebase-admin";
import {
	createHash
} from 'crypto';

// Initialize Firebase Admin SDK
if (admin.apps.length === 0) {
    admin.initializeApp();
}
const db = admin.database();

// Set global options for all v2 functions in this file
setGlobalOptions({
    region: "us-central1"
}); // Or your preferred region

// Helper to safely check if secrets exist during deployment
const secretsExist = (secretNames) => {
    try {
        return secretNames.every(name => process.env[name] !== undefined);
    } catch {
        return false;
    }
};

/* 
 * DEPLOYMENT SETUP INSTRUCTIONS:
 * 
 * 1. INITIAL DEPLOYMENT (without secrets):
 *    firebase deploy --only functions
 * 
 * 2. GET YOUR ACCESS TOKEN:
 *    Call getTokenForSecrets function and check the logs
 * 
 * 3. SET UP SECRETS:
 *    firebase functions:secrets:set GTAWORLD_PERSISTENT_TOKEN --data="your_token"
 *    firebase functions:secrets:set GTAWORLD_REFRESH_TOKEN --data="your_refresh_token"  # optional
 * 
 * 4. OPTIONAL - RE-ENABLE SECRETS IN FUNCTION CONFIG:
 *    After secrets are created, you can add them back to function configurations:
 *    
 *    getManagedGtaWorldToken: add secrets: ["GTAWORLD_PERSISTENT_TOKEN", "GTAWORLD_REFRESH_TOKEN"]
 *    getProfileWithManagedToken: add secrets: ["GTAWORLD_PERSISTENT_TOKEN"]  
 *    checkFactionMembership: add secrets: ["GTAWORLD_PERSISTENT_TOKEN"]
 * 
 * 5. REDEPLOY:
 *    firebase deploy --only functions
 */

// --- Helper Functions ---

const getShuffledPhrases = (phrases) => {
    if (!Array.isArray(phrases) || phrases.length === 0) return [];
    const array = [...phrases];
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};


const sendWebhook = async (payload) => {
    // Use process.env for secrets in Firebase Functions v2
    const webhookURL = process.env.ADMIN_ACTION_WEBHOOK_URL;
    if (!webhookURL) {
        console.error("FATAL: ADMIN_ACTION_WEBHOOK_URL secret is not set or not accessible. Webhook cannot be sent.");
        return false;
    }

    console.log(`Webhook URL is configured. Length: ${webhookURL.length}. Sending payload.`);

    try {
        const response = await fetch(webhookURL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Error sending webhook. Status: ${response.status} ${response.statusText}. Response: ${errorText}`);
            return false;
        } else {
            console.log("Webhook sent successfully.");
            return true;
        }
    } catch (error) {
        console.error("Error sending webhook from Cloud Function:", error);
        return false;
    }
};

const scheduleDeletion = async (request) => {
    const requestId = request.id;
    let processedAt;

    try {
        // Safely parse the processedAt timestamp
        if (request.processedAt && typeof request.processedAt === 'number') {
            processedAt = new Date(request.processedAt);
        } else if (request.processedAt && typeof request.processedAt === 'string') {
            processedAt = new Date(request.processedAt);
        } else {
            console.warn(`Invalid processedAt for request ${requestId}:`, request.processedAt);
            return; // Skip this request if timestamp is invalid
        }

        // Check if the date is valid
        if (isNaN(processedAt.getTime())) {
            console.warn(`Invalid date created for request ${requestId}:`, request.processedAt);
            return; // Skip this request if date is invalid
        }
    } catch (error) {
        console.error(`Error parsing processedAt for request ${requestId}:`, error);
        return; // Skip this request if parsing fails
    }

    const now = new Date();
    const timeDiff = now.getTime() - processedAt.getTime();
    const daysDiff = Math.floor(timeDiff / (1000 * 3600 * 24));

    let isDeletable = false;

    if (request.status.startsWith('Denied') && daysDiff >= 2) {
        isDeletable = true;
    } else if (request.status === 'approved' && daysDiff >= 1) {
        isDeletable = true;
    }

    if (isDeletable) {
        const requestRef = db.ref(`bingo/phraseRequests/${requestId}`);
        try {
            await requestRef.remove();
            console.log(`Successfully deleted request ${requestId}`);

             const embed = {
                 title: "Bingo Phrase Request Deleted (Scheduled)",
                 description: `Request ID: ${requestId} automatically deleted.`, 
                 fields: [
                     { name: "Status", value: request.status, inline: true },
                     { name: "Requested By", value: request.requestedBy, inline: true },
                     { name: "Phrase", value: request.phrase, inline: false },
                 ],
                 footer: { text: "PHMC Tools - Scheduled Cleanup" }
              };
             await sendWebhook({ embeds: [embed] });

        } catch (error) {
            console.error(`Error deleting request ${requestId}:`, error);
            // Consider logging this error to Sentry
        }
    }
};

// --- Scheduled Cloud Function (v2) ---

// Use ESM 'export' syntax instead of 'exports.dailyTaskHandler ='
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
                    const hashData = {
                        bbCodeVersion: reportData.bbCodeVersion,
                        bbCode: reportData.bbCode,
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



// Simple in-memory cache for OAuth codes (prevents duplicate processing)
const oauthCodeCache = new Map();
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

/**
 * Proxies requests to the GTA World API to bypass CORS issues.
 * This function is called from the client-side to make authenticated requests
 * to ucp.gta.world/api endpoints.
 */
/* export const proxyGtaWorldApi = onCall({
    cors: [
        'https://gtaw-forms.github.io',
        'https://phmc-tools.gta.world',
        'http://localhost:3000'
    ]
}, async (request) => {
    const { endpoint, accessToken, method = 'GET', body = null, headers = {}, skipAuthCheck = false } = request.data;

    // Allow skipping auth check for session validation calls
    if (!skipAuthCheck && !request.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }

    if (!endpoint || !accessToken) {
        throw new functions.https.HttpsError('invalid-argument', 'Endpoint and accessToken are required.');
    }

    const GTA_WORLD_API_BASE_URL = 'https://global.gta.world/api';
    const targetUrl = `${GTA_WORLD_API_BASE_URL}${endpoint}`;

    console.log(`[Proxy] Proxying request to GTA World API: ${method} ${targetUrl}`);

    try {
        const fetchOptions = {
            method: method,
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'User-Agent': 'PHMC-Tools/1.0 (Firebase Functions Proxy)', // Identify proxy
                ...headers
            },
        };

        if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
            fetchOptions.body = JSON.stringify(body);
        }

        const response = await fetch(targetUrl, fetchOptions);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Proxy] Proxy request to ${targetUrl} failed: ${response.status} ${response.statusText} - ${errorText}`);
            throw new functions.https.HttpsError('unavailable', `GTA World API responded with an error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const responseData = await response.json();
        console.log(`[Proxy] Successfully proxied request to ${targetUrl}`);
        return { success: true, data: responseData };

    } catch (error) {
        console.error(`[Proxy] Error in proxyGtaWorldApi for endpoint ${endpoint}:`, error);
        throw new functions.https.HttpsError('internal', 'Failed to proxy request to GTA World API.', error.message);
    }
 });
 */

// [NEW UNIFIED FUNCTION]
export const processGtaWorldAuth = onCall({
    secrets: ["GTAWORLD_CLIENT_ID", "GTAWORLD_CLIENT_SECRET"],
    cors: [
        'https://ancad-studios.github.io',
        'http://localhost:3000',
        'https://gtaw-forms.github.io',
        'https://phmc-tools.gta.world',
        'https://global.gta.world'
    ]
}, async (request) => {
    const { code, redirectUri, clientId: providedClientId } = request.data || {};
    const startTime = Date.now();
    const perf = { start: startTime, last: startTime };

    const logPerf = (name) => {
        const now = Date.now();
        const duration = now - perf.last;
        perf[name] = duration;
        perf.last = now;
        console.log(`[AuthPerf] ${name}: ${duration}ms`);
    };

    console.log(`[UnifiedAuth] Received auth request. Session ID: ${startTime}`);
    logPerf('init');

    // 1. --- Input Validation ---
    if (!code || !redirectUri) {
        throw new functions.https.HttpsError('invalid-argument', 'Authorization code and redirect URI are required.');
    }
    const clientId = process.env.GTAWORLD_CLIENT_ID;
    const clientSecret = process.env.GTAWORLD_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
        console.error('[UnifiedAuth] Missing OAuth client credentials in environment');
        throw new functions.https.HttpsError('internal', 'OAuth client credentials not configured properly on the server.');
    }
    logPerf('validation');

    try {
        // 2. --- Token Exchange ---
        console.log('[UnifiedAuth] Starting token exchange with GTA World.');
        const tokenRequestBody = new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            code: code,
        });

        const tokenController = new AbortController();
        const tokenTimeout = setTimeout(() => tokenController.abort(), 25000); // 25s timeout

        const tokenResponse = await fetch('https://ucp.gta.world/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'PHMC-Tools/1.0 (Firebase Functions)' },
            body: tokenRequestBody,
            signal: tokenController.signal
        });
        clearTimeout(tokenTimeout);
        logPerf('token_exchange_api');

        const tokenResponseText = await tokenResponse.text();
        const tokenData = JSON.parse(tokenResponseText);

        if (!tokenResponse.ok) {
            console.error('[UnifiedAuth] Token exchange failed:', tokenData);
            const userMessage = tokenData.hint?.includes('expired')
                ? 'Your login attempt has expired. Please try logging in again.'
                : 'Failed to exchange authorization code for an access token.';
            throw new functions.https.HttpsError('invalid-argument', userMessage, tokenData);
        }
        if (!tokenData.access_token) {
            throw new functions.https.HttpsError('internal', 'Invalid response from GTA World OAuth server (missing access_token).');
        }
        logPerf('token_parse');

        // 3. --- User Profile Fetch ---
        console.log('[UnifiedAuth] Token exchange successful, fetching user profile.');
        const userController = new AbortController();
        const userTimeout = setTimeout(() => userController.abort(), 30000); // 30s timeout

        const userResponse = await fetch('https://ucp.gta.world/api/user', {
            headers: { 'Authorization': `Bearer ${tokenData.access_token}`, 'Accept': 'application/json', 'User-Agent': 'PHMC-Tools/1.0 (Firebase Functions)' },
            signal: userController.signal
        });
        clearTimeout(userTimeout);
        logPerf('user_profile_api');

        const userResponseText = await userResponse.text();
        let userData;
        try {
            userData = JSON.parse(userResponseText);
        } catch (e) {
            console.error('[UnifiedAuth] Failed to parse user profile JSON:', userResponseText);
            throw new functions.https.HttpsError('internal', 'Failed to parse user profile from GTA World API.');
        }


        if (!userResponse.ok) {
            console.error('[UnifiedAuth] Failed to fetch user profile:', userData);
            throw new functions.https.HttpsError('internal', 'Failed to fetch user profile from GTA World API.', userData);
        }
        if (!userData.user && !userData.id) {
             throw new functions.https.HttpsError('internal', 'Invalid user data received from GTA World API.');
        }
        logPerf('user_profile_parse');

        // 4. --- Faction Membership Check ---
        console.log('[UnifiedAuth] User profile fetched, checking faction membership.');
        const finalUser = userData.user || userData;
        const characterArray = finalUser.character || finalUser.characters || [];
        const characterIds = characterArray.map(c => c.id).filter(id => id);

        let factionResult = {
            isMember: false,
            character: null,
            permissions: [],
            accessLevel: 'none',
            allFactionCharacters: []
        };

        if (characterIds.length > 0) {
            const factionId = 364; // PHMC Faction ID
            const membersRef = db.ref(`factions/${factionId}/members`);
            const membersSnapshot = await membersRef.once('value');
            const allMembers = membersSnapshot.val() || {};
            logPerf('faction_db_read');

            const factionMembers = [];
            for (const charId of characterIds) {
                if (allMembers[charId]) {
                    const memberData = allMembers[charId];
                    factionMembers.push({
                        character: { // Nest the character data
                            characterId: memberData.characterId,
                            characterName: memberData.characterName,
                            rank: memberData.rank,
                            scriptRank: memberData.scriptRank
                        },
                        permissions: getPermissionsForRank(memberData.scriptRank),
                        accessLevel: getAccessLevel(memberData.scriptRank)
                    });
                }
            }

            if (factionMembers.length > 0) {
                // Find highest ranking member
                const highestRankMember = factionMembers.reduce((max, current) =>
                    (current.character.scriptRank > max.character.scriptRank) ? current : max, factionMembers[0]
                );

                factionResult = {
                    isMember: true,
                    character: highestRankMember.character, // The full character object for the highest rank
                    permissions: highestRankMember.permissions,
                    accessLevel: highestRankMember.accessLevel,
                    allFactionCharacters: factionMembers // Array of all characters found in the faction
                };
            }
             logPerf('faction_processing');
        } else {
            console.log('[UnifiedAuth] No characters on user account to check for faction membership.');
             logPerf('faction_processing_skipped');
        }


        // 5. --- Final Response ---
        const processingTime = Date.now() - startTime;
        console.log(`[UnifiedAuth] Auth successful for ${finalUser.username}. Total time: ${processingTime}ms`);

        return {
            success: true,
            token: {
                access_token: tokenData.access_token,
                token_type: tokenData.token_type || 'Bearer',
                expires_in: tokenData.expires_in,
                refresh_token: tokenData.refresh_token,
                scope: tokenData.scope
            },
            user: {
                ...finalUser,
                // Enhance user object with faction data directly
                isFactionMember: factionResult.isMember,
                faction: factionResult.character,
                permissions: factionResult.permissions,
                accessLevel: factionResult.accessLevel,
                allFactionCharacters: factionResult.allFactionCharacters,
            },
            timestamp: new Date().toISOString(),
            processingTime,
            perf
        };

    } catch (error) {
        const processingTime = Date.now() - startTime;
        console.error(`[UnifiedAuth] Error after ${processingTime}ms:`, error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        } else {
            throw new functions.https.HttpsError('internal', 'An unexpected error occurred during authentication.', { originalError: error.message });
        }
    }
});



/**
 * Helper function to get access token for Firebase Secrets setup
 * This function performs OAuth and clearly logs the token for easy copying
 */
export const getTokenForSecrets = onCall({
    secrets: ["GTAWORLD_CLIENT_ID", "GTAWORLD_CLIENT_SECRET"],
    cors: [
        'https://ancad-studios.github.io',
        'http://localhost:3000',
        'https://gtaw-forms.github.io',
        'https://phmc-tools.gta.world',
        'https://global.gta.world'
    ]
}, async (request) => {
    console.log('🔧 [Token Setup] Starting token retrieval for Firebase Secrets setup');
    
    const data = request.data;
    const { code, redirectUri } = data || {};
    const clientId = process.env.GTAWORLD_CLIENT_ID;
    const clientSecret = process.env.GTAWORLD_CLIENT_SECRET;

    if (!code || !redirectUri) {
        throw new functions.https.HttpsError('invalid-argument', 'Authorization code and redirect URI are required');
    }

    try {
        // Exchange auth code for access token
        const tokenRequestBody = new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            code: code,
        });

        const tokenResponse = await fetch('https://global.gta.world/oauth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'PHMC-Tools/1.0 (Firebase Functions)'
            },
            body: tokenRequestBody,
        });

        const tokenData = await tokenResponse.json();

        if (!tokenResponse.ok) {
            throw new functions.https.HttpsError('invalid-argument', `Token exchange failed: ${tokenData.error_description || tokenData.error}`);
        }

        // CLEAR INSTRUCTIONS FOR SETTING UP SECRETS
        console.log('\n' + '='.repeat(100));
        console.log('🎉 SUCCESS! Your GTA World Access Token is ready!');
        console.log('='.repeat(100));
        console.log('');
        console.log('📋 COPY AND PASTE THESE COMMANDS:');
        console.log('');
        console.log('1️⃣  Set your main access token:');
        console.log(`firebase functions:secrets:set GTAWORLD_PERSISTENT_TOKEN --data="${tokenData.access_token}"`);
        console.log('');
        if (tokenData.refresh_token) {
            console.log('2️⃣  Set your refresh token (optional but recommended):');
            console.log(`firebase functions:secrets:set GTAWORLD_REFRESH_TOKEN --data="${tokenData.refresh_token}"`);
            console.log('');
        }
        console.log('3️⃣  Deploy your functions to use the new secrets:');
        console.log('firebase deploy --only functions');
        console.log('');
        console.log('='.repeat(100));
        console.log('📊 TOKEN DETAILS:');
        console.log(`   • Token Type: ${tokenData.token_type || 'Bearer'}`);
        console.log(`   • Expires In: ${tokenData.expires_in} seconds (${Math.floor(tokenData.expires_in / 3600)} hours)`);
        console.log(`   • Has Refresh Token: ${tokenData.refresh_token ? 'Yes ✅' : 'No ❌'}`);
        console.log(`   • Token Length: ${tokenData.access_token.length} characters`);
        console.log('='.repeat(100));
        console.log('');

        return {
            success: true,
            message: 'Token retrieved successfully! Check the function logs for setup instructions.',
            tokenInfo: {
                type: tokenData.token_type || 'Bearer',
                expiresIn: tokenData.expires_in,
                hasRefreshToken: !!tokenData.refresh_token,
                tokenLength: tokenData.access_token.length
            },
            setupInstructions: [
                `firebase functions:secrets:set GTAWORLD_PERSISTENT_TOKEN --data="${tokenData.access_token}"`, 
                tokenData.refresh_token ? `firebase functions:secrets:set GTAWORLD_REFRESH_TOKEN --data="${tokenData.refresh_token}"` : null,
                'firebase deploy --only functions'
            ].filter(Boolean),
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        console.error('❌ [Token Setup] Error retrieving token:', error);
        throw new functions.https.HttpsError('internal', 'Failed to retrieve token for secrets setup', {
            originalError: error.message
        });
    }
});

// --- Token Management Functions ---

/**
 * Get or refresh the persistent GTA World access token
 */
export const getManagedGtaWorldToken = onCall({
    secrets: ["GTAWORLD_PERSISTENT_TOKEN", "GTAWORLD_REFRESH_TOKEN", "GTAWORLD_CLIENT_ID", "GTAWORLD_CLIENT_SECRET"],
    cors: [
        'https://ancad-studios.github.io',
        'http://localhost:3000',
        'https://gtaw-forms.github.io',
        'https://phmc-tools.gta.world',
        'https://global.gta.world'
    ]
}, async (request) => {
    console.log('[Managed Token] Getting persistent access token');
    
    const persistentToken = process.env.GTAWORLD_PERSISTENT_TOKEN;
    const refreshToken = process.env.GTAWORLD_REFRESH_TOKEN;
    
    if (!persistentToken) {
        return {
            success: false,
            error: 'No persistent token configured',
            message: 'Please set GTAWORLD_PERSISTENT_TOKEN secret using: firebase functions:secrets:set GTAWORLD_PERSISTENT_TOKEN',
            setupInstructions:
                [
                    '1. First call getTokenForSecrets to get your access token',
                    '2. Run: firebase functions:secrets:set GTAWORLD_PERSISTENT_TOKEN --data="YOUR_TOKEN"',
                    '3. Deploy functions again: firebase deploy --only functions',
                    '4. Then you can use getManagedGtaWorldToken'
                ]
        };
    }
    
    try {
        // First, try to validate the existing token
        console.log('[Managed Token] Validating existing persistent token');
        const validationResponse = await fetch('https://global.gta.world/api/user', {
            headers: {
                'Authorization': `Bearer ${persistentToken}`,
                'Accept': 'application/json',
                'User-Agent': 'PHMC-Tools/1.0 (Firebase Functions)'
            },
        });
        
        if (validationResponse.ok) {
            console.log('[Managed Token] Persistent token is valid');
            const userData = await validationResponse.json();
            
            return {
                success: true,
                token: persistentToken,
                user: userData.user || userData,
                fromPersistent: true,
                timestamp: new Date().toISOString()
            };
        }
        
        console.log('[Managed Token] Persistent token expired, attempting refresh');
        
        // If token is expired and we have a refresh token, try to refresh
        if (refreshToken) {
            const clientId = process.env.GTAWORLD_CLIENT_ID;
            const clientSecret = process.env.GTAWORLD_CLIENT_SECRET;
            
            if (!clientId || !clientSecret) {
                throw new functions.https.HttpsError('failed-precondition', 
                    'OAuth credentials not configured for token refresh');
            }
            
            const refreshResponse = await fetch('https://global.gta.world/oauth/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'PHMC-Tools/1.0 (Firebase Functions)'
                },
                body: new URLSearchParams({
                    grant_type: 'refresh_token',
                    client_id: clientId,
                    client_secret: clientSecret,
                    refresh_token: refreshToken
                })
            });
            
            if (refreshResponse.ok) {
                const tokenData = await refreshResponse.json();
                console.log('[Managed Token] Successfully refreshed token');
                
                // Note: In a real implementation, you'd need to update the secret
                // This would require admin SDK or manual secret update
                console.warn('[Managed Token] New token obtained but cannot automatically update secret. Manual update required.');
                console.log('[Managed Token] New token (first 20 chars):', tokenData.access_token.substring(0, 20) + '...');
                
                return {
                    success: true,
                    token: tokenData.access_token,
                    user: null, // Would need another API call
                    refreshed: true,
                    newTokenPreview: tokenData.access_token.substring(0, 20) + '...',
                    message: 'Token refreshed successfully. Please update GTAWORLD_PERSISTENT_TOKEN secret.',
                    timestamp: new Date().toISOString()
                };
            }
        }
        
        throw new functions.https.HttpsError('unauthenticated', 
            'Persistent token expired and refresh failed. Manual token update required.');
        
    } catch (error) {
        console.error('[Managed Token] Error managing token:', error);
        
        if (error.code) {
            throw error;
        }
        
        throw new functions.https.HttpsError('internal', 'Failed to manage persistent token', {
            originalError: error.message
        });
    }
});

/**
 * Get user profile using the managed persistent token
 */
export const getProfileWithManagedToken = onCall({
    secrets: ["GTAWORLD_PERSISTENT_TOKEN"],
    cors: [
        'https://gtaw-forms.github.io',
        'https://phmc-tools.gta.world',
        'http://localhost:3000'
    ]
}, async (request) => {
    console.log('[Profile Managed] Getting profile with managed token');
    
    const persistentToken = process.env.GTAWORLD_PERSISTENT_TOKEN;
    
    if (!persistentToken) {
        return {
            success: false,
            error: 'No persistent token configured',
            message: 'Please set GTAWORLD_PERSISTENT_TOKEN secret first',
            setupInstructions:
                [
                    '1. Call getTokenForSecrets to get your access token',
                    '2. Run: firebase functions:secrets:set GTAWORLD_PERSISTENT_TOKEN --data="YOUR_TOKEN"',
                    '3. Deploy functions: firebase deploy --only functions'
                ]
        };
    }
    
    try {
        const userResponse = await fetch('https://global.gta.world/api/user', {
            headers: {
                'Authorization': `Bearer ${persistentToken}`,
                'Accept': 'application/json',
                'User-Agent': 'PHMC-Tools/1.0 (Firebase Functions)'
            },
        });
        
        if (!userResponse.ok) {
            if (userResponse.status === 401) {
                throw new functions.https.HttpsError('unauthenticated', 
                    'Persistent token expired. Please update GTAWORLD_PERSISTENT_TOKEN secret.');
            }
            throw new functions.https.HttpsError('failed-precondition', 
                `GTA World API returned ${userResponse.status}: ${userResponse.statusText}`);
        }
        
        const responseText = await userResponse.text();
        let userData;
        
        try {
            userData = JSON.parse(responseText);
        } catch (parseError) {
            console.error('[Profile Managed] JSON parse failed:', parseError.message);
            throw new functions.https.HttpsError('internal', 'Invalid JSON response from GTA World API');
        }
        
        console.log('[Profile Managed] Successfully retrieved profile with managed token');
        
        return {
            success: true,
            userData: userData,
            fromManagedToken: true,
            metadata: {
                timestamp: new Date().toISOString(),
                dataKeys: Object.keys(userData),
                dataSize: JSON.stringify(userData).length
            }
        };
        
    } catch (error) {
        console.error('[Profile Managed] Error retrieving profile:', error);
        
        if (error.code) {
            throw error;
        }
        
        throw new functions.https.HttpsError('internal', 'Failed to retrieve user profile with managed token', {
            originalError: error.message
        });
    }
});

/**
 * Validate an existing access token and return user data if valid
 */
export const validateGtaWorldToken = onCall({
    cors: [
        'https://gtaw-forms.github.io',
        'https://phmc-tools.gta.world',
        'http://localhost:3000'
    ]
}, async (request) => {
    console.log('[Token Validation] Starting token validation');
    
    const { accessToken } = request.data;
    
    if (!accessToken) {
        throw new functions.https.HttpsError('invalid-argument', 'Access token is required');
    }
    
    try {
        console.log('[Token Validation] Validating token with GTA World API');
        
        const userResponse = await fetch('https://global.gta.world/api/user', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json',
                'User-Agent': 'PHMC-Tools/1.0 (Firebase Functions)'
            },
        });
        
        if (!userResponse.ok) {
            console.log('[Token Validation] Token validation failed:', userResponse.status);
            return {
                success: false,
                valid: false,
                error: 'Token is invalid or expired',
                status: userResponse.status
            };
        }
        
        const responseText = await userResponse.text();
        let userData;
        
        try {
            userData = JSON.parse(responseText);
        } catch (parseError) {
            console.error('[Token Validation] Failed to parse response:', parseError.message);
            throw new functions.https.HttpsError('internal', 'Invalid response from GTA World API');
        }
        
        console.log('[Token Validation] Token is valid for user:', userData.user?.username || userData.username);
        
        return {
            success: true,
            valid: true,
            user: userData.user || userData,
            timestamp: new Date().toISOString()
        };
        
    } catch (error) {
        console.error('[Token Validation] Error validating token:', error);
        
        if (error.code) {
            throw error; // Re-throw Firebase errors
        }
        
        return {
            success: false,
            valid: false,
            error: 'Failed to validate token',
            originalError: error.message
        };
    }
});

/**
 * Get user profile using cached token validation
 */
export const getCachedGtaWorldProfile = onCall({
    cors: [
        'https://gtaw-forms.github.io',
        'https://phmc-tools.gta.world',
        'http://localhost:3000'
    ]
}, async (request) => {
    console.log('[Cached Profile] Starting cached profile retrieval');
    
    const { accessToken, useCache = true } = request.data;
    
    if (!accessToken) {
        throw new functions.https.HttpsError('invalid-argument', 'Access token is required');
    }
    
    try {
        // Check if we have cached user data for this token (optional optimization)
        const tokenHash = createHash('sha256').update(accessToken).digest('hex').substring(0, 16);
        const cacheRef = db.ref(`tokenCache/${tokenHash}`);
        
        if (useCache) {
            const cachedData = await cacheRef.once('value');
            if (cachedData.exists()) {
                const cached = cachedData.val();
                // Check if cache is still valid (less than 1 hour old)
                const cacheAge = Date.now() - cached.timestamp;
                if (cacheAge < 3600000) { // 1 hour in milliseconds
                    console.log('[Cached Profile] Using cached profile data');
                    return {
                        success: true,
                        userData: cached.userData,
                        fromCache: true,
                        cacheAge: Math.floor(cacheAge / 1000) // age in seconds
                    };
                }
            }
        }
        
        // Make fresh API call
        console.log('[Cached Profile] Making fresh API call');
        const userResponse = await fetch('https://ucp.gta.world/api/user', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json',
                'User-Agent': 'PHMC-Tools/1.0 (Firebase Functions)'
            },
        });
        
        if (!userResponse.ok) {
            // Token might be expired, clear cache
            await cacheRef.remove();
            throw new functions.https.HttpsError('failed-precondition', 
                `GTA World API returned ${userResponse.status}: ${userResponse.statusText}`);
        }
        
        const responseText = await userResponse.text();
        let userData;
        
        try {
            userData = JSON.parse(responseText);
        } catch (parseError) {
            console.error('[Cached Profile] JSON parse failed:', parseError.message);
            throw new functions.https.HttpsError('internal', 'Invalid JSON response from GTA World API');
        }
        
        // Cache the result
        if (useCache) {
            await cacheRef.set({
                userData: userData,
                timestamp: Date.now(),
                tokenPrefix: accessToken.substring(0, 20) + '...'
            });
            console.log('[Cached Profile] Cached fresh profile data');
        }
        
        return {
            success: true,
            userData: userData,
            fromCache: false,
            metadata: {
                timestamp: new Date().toISOString(),
                dataKeys: Object.keys(userData),
                dataSize: JSON.stringify(userData).length
            }
        };
        
    } catch (error) {
        console.error('[Cached Profile] Error retrieving profile:', error);
        
        if (error.code) {
            throw error; // Re-throw Firebase errors
        }
        
        throw new functions.https.HttpsError('internal', 'Failed to retrieve user profile', {
            originalError: error.message
        });
    }
});

// --- Profile Testing Function ---
export const getGtaWorldProfile = onCall({
    cors: [
        'https://gtaw-forms.github.io',
        'https://phmc-tools.gta.world',
        'http://localhost:3000',
        'https://global.gta.world'
    ]
}, async (request) => {
    console.log('[Profile Test] Starting profile retrieval via Firebase Function');
    
    const { accessToken } = request.data;
    
    if (!accessToken) {
        throw new functions.https.HttpsError('invalid-argument', 'Access token is required');
    }
    
    try {
        console.log('[Profile Test] Making API call to GTA World with token:', {
            hasToken: !!accessToken,
            tokenPrefix: accessToken.substring(0, 20) + '...'
        });
        
        const userResponse = await fetch('https://global.gta.world/api/user', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json',
                'User-Agent': 'PHMC-Tools/1.0 (Firebase Functions)'
            },
        });
        
        console.log('[Profile Test] API response status:', userResponse.status);
        
        if (!userResponse.ok) {
            throw new functions.https.HttpsError('failed-precondition', 
                `GTA World API returned ${userResponse.status}: ${userResponse.statusText}`);
        }
        
        const responseText = await userResponse.text();
        console.log('[Profile Test] Raw response preview:', responseText.substring(0, 200));
        
        let userData;
        try {
            userData = JSON.parse(responseText);
        } catch (parseError) {
            console.error('[Profile Test] JSON parse failed:', parseError.message);
            throw new functions.https.HttpsError('internal', 'Invalid JSON response from GTA World API');
        }
        
        console.log('[Profile Test] Successfully retrieved user profile:', {
            keys: Object.keys(userData),
            hasUsername: 'username' in userData,
            hasName: 'name' in userData,
            hasId: 'id' in userData
        });
        
        return {
            success: true,
            userData: userData,
            metadata: {
                timestamp: new Date().toISOString(),
                dataKeys: Object.keys(userData),
                dataSize: JSON.stringify(userData).length
            }
        };
        
    } catch (error) {
        console.error('[Profile Test] Error retrieving profile:', error);
        
        if (error.code) {
            throw error; // Re-throw Firebase errors
        }
        
        throw new functions.https.HttpsError('internal', 'Failed to retrieve user profile', {
            originalError: error.message
        });
    }
});

export const migrateLegacyReports = onCall({
    secrets: ["ADMIN_ACTION_WEBHOOK_URL"],
}, async (request) => {
    console.log('[Migration] Starting migration of legacy reports in /savedReports.');

    // Authentication check
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }

    const reportsRef = db.ref('/savedReports');
    let migratedCount = 0;

    try {
        const snapshot = await reportsRef.once('value');
        if (!snapshot.exists()) {
            console.log('[Migration] No reports found at /savedReports. Nothing to migrate.');
            return { success: true, message: 'No legacy reports found to migrate.', migratedCount: 0 };
        }

        const allUserData = snapshot.val();
        const updates = {};

        for (const userId in allUserData) {
            const userReports = allUserData[userId];
            for (const reportId in userReports) {
                const report = userReports[reportId];
                // Check if the report is an object and doesn't have the 'legacy' flag yet
                if (typeof report === 'object' && report !== null && report.legacy === undefined) {
                    updates[`/savedReports/${userId}/${reportId}/legacy`] = true;
                    migratedCount++;
                }
            }
        }

        if (migratedCount > 0) {
            console.log(`[Migration] Found ${migratedCount} reports to update. Applying updates...`);
            await db.ref().update(updates);
            console.log(`[Migration] Successfully updated ${migratedCount} reports with the legacy:true flag.`);
        } else {
            console.log('[Migration] All reports in /savedReports already seem to have the legacy flag.');
        }

        const successMessage = migratedCount > 0 
            ? `Migration successful. ${migratedCount} legacy reports were flagged.`
            : 'Migration complete. No new reports needed to be flagged.';
            
        await sendWebhook({
            embeds: [{
                title: "Legacy Report Migration Completed",
                description: successMessage,
                color: 0x00FF00, // Green
                footer: { text: `Triggered by: ${request.auth.token.email || request.auth.uid}` }
            }]
        });

        return { success: true, message: successMessage, migratedCount: migratedCount };

    } catch (error) {
        console.error('[Migration] An error occurred during the migration process:', error);
        await sendWebhook({
            embeds: [{
                title: "Legacy Report Migration FAILED",
                description: `An error occurred: ${error.message}`,
                color: 0xFF0000, // Red
                footer: { text: `Triggered by: ${request.auth.token.email || request.auth.uid}` }
            }]
        });
        throw new functions.https.HttpsError('internal', 'An error occurred during migration.', error.message);
    }
});

// --- Faction Data Management Functions ---

/**
 * Upload and process faction member data from CSV
 */
export const uploadFactionData = onCall({
    cors: [
        'https://gtaw-forms.github.io',
        'https://phmc-tools.gta.world',
        'http://localhost:3000'
    ]
}, async (request) => {
    console.log('[Faction Upload] Starting faction data upload');
    
    const { factionData, metadata } = request.data;
    
    if (!factionData || !Array.isArray(factionData)) {
        throw new functions.https.HttpsError('invalid-argument', 'Faction data must be an array');
    }
    
    if (!metadata || !metadata.factionId) {
        throw new functions.https.HttpsError('invalid-argument', 'Metadata with faction ID is required');
    }
    
    try {
        console.log('[Faction Upload] Processing faction data:', {
            recordCount: factionData.length,
            factionId: metadata.factionId,
            fileName: metadata.fileName
        });
        
        // Validate and process the data
        const processedData = {};
        const errors = [];
        const statistics = {
            totalRecords: factionData.length,
            validRecords: 0,
            duplicates: 0,
            errors: 0,
            rankDistribution: {}
        };
        
        for (const member of factionData) {
            try {
                // Validate required fields
                if (!member.characterId || !member.characterName || !member.rank || member.scriptRank === undefined) {
                    errors.push(`Invalid member data: ${JSON.stringify(member)}`);
                    statistics.errors++;
                    continue;
                }
                
                const characterId = parseInt(member.characterId);
                if (isNaN(characterId)) {
                    errors.push(`Invalid character ID: ${member.characterId}`);
                    statistics.errors++;
                    continue;
                }
                
                // Check for duplicates
                if (processedData[characterId]) {
                    console.warn(`[Faction Upload] Duplicate character ID: ${characterId}`);
                    statistics.duplicates++;
                    continue;
                }
                
                // Process the member data
                const processedMember = {
                    characterId: characterId,
                    characterName: member.characterName.trim(),
                    rank: member.rank.trim(),
                    scriptRank: parseInt(member.scriptRank),
                    factionId: metadata.factionId,
                    lastDuty: member.lastDuty || null,
                    lastOnline: member.lastOnline || null,
                    activity: member.activity || null,
                    uploadedAt: admin.database.ServerValue.TIMESTAMP,
                    uploadedBy: request.auth?.uid || 'unknown',
                    dataVersion: metadata.uploadTime || new Date().toISOString()
                };
                
                processedData[characterId] = processedMember;
                statistics.validRecords++;
                
                // Track rank distribution
                const scriptRank = processedMember.scriptRank;
                statistics.rankDistribution[scriptRank] = (statistics.rankDistribution[scriptRank] || 0) + 1;
                
            } catch (memberError) {
                console.error('[Faction Upload] Error processing member:', memberError);
                errors.push(`Error processing member ${member.characterId}: ${memberError.message}`);
                statistics.errors++;
            }
        }
        
        console.log('[Faction Upload] Data processing complete:', statistics);
        
        // Store the processed data in Firebase
        const factionRef = db.ref(`factions/${metadata.factionId}`);
        
        // Create backup of existing data if it exists
        const existingData = await factionRef.once('value');
        if (existingData.exists()) {
            const backupRef = db.ref(`factions/${metadata.factionId}/backups/${Date.now()}`);
            await backupRef.set({
                data: existingData.val().members || {},
                metadata: existingData.val().metadata || {},
                backedUpAt: admin.database.ServerValue.TIMESTAMP
            });
            console.log('[Faction Upload] Created backup of existing data');
        }
        
        // Store new data
        await factionRef.set({
            members: processedData,
            metadata: {
                ...metadata,
                lastUpdated: admin.database.ServerValue.TIMESTAMP,
                uploadedBy: request.auth?.uid || 'unknown',
                statistics: statistics
            }
        });
        
        console.log('[Faction Upload] Data stored successfully');
        
        // Log the upload for audit purposes
        await db.ref('audit/faction_uploads').push({
            factionId: metadata.factionId,
            fileName: metadata.fileName,
            recordCount: statistics.validRecords,
            uploadedBy: request.auth?.uid || 'unknown',
            uploadedAt: admin.database.ServerValue.TIMESTAMP,
            statistics: statistics
        });
        
        return {
            success: true,
            statistics: statistics,
            errors: errors.slice(0, 10), // Limit errors in response
            message: `Successfully uploaded ${statistics.validRecords} faction members`
        };
        
    } catch (error) {
        console.error('[Faction Upload] Upload failed:', error);
        
        throw new functions.https.HttpsError('internal', 'Failed to upload faction data', {
            originalError: error.message
        });
    }
});

/**
 * Appends 'legacy: true' flag to all saved reports that don't already have it.
 * Designed to be called from admin panel, updates in chunks to avoid rate limits.
 */
export const appendLegacyFlagToReports = onCall({
    cors: [
        'https://gtaw-forms.github.io',
        'https://phmc-tools.gta.world',
        'http://localhost:3000'
    ]
}, async (request) => {
    console.log('[Legacy Flag Append] Starting operation to append legacy flag to reports.');

    // Authentication check (optional, but recommended for admin functions)
    // if (!request.auth || !request.auth.token.admin) { // Example: require admin claim
    //     throw new functions.https.HttpsError('permission-denied', 'Admin access required to run this operation.');
    // }

    const REPORTS_PATH = 'savedReports';
    const BATCH_SIZE = 50; // Number of reports to update in a single batch
    const DELAY_MS = 1000; // Delay between batches in milliseconds
    let totalUpdatedUsers = 0;
    let totalUpdatedReports = 0;

    try {
        const allUsersSnapshot = await db.ref(REPORTS_PATH).once('value');
        if (!allUsersSnapshot.exists()) {
            console.log('[Legacy Flag Append] No reports found. Operation complete.');
            return { success: true, updatedUsers: 0, updatedReports: 0, message: 'No reports found.' };
        }

        const allUsersData = allUsersSnapshot.val();
        const userIds = Object.keys(allUsersData);
        console.log(`[Legacy Flag Append] Found ${userIds.length} users with saved reports.`);

        for (const userId of userIds) {
            console.log(`[Legacy Flag Append] Processing reports for user: ${userId}`);
            const userReportsRef = db.ref(`${REPORTS_PATH}/${userId}`);
            const userReportsSnapshot = await userReportsRef.once('value');

            if (!userReportsSnapshot.exists()) {
                continue; // Should not happen if userId was in allUsersData, but good for safety
            }

            const reportsToUpdate = [];
            userReportsSnapshot.forEach(reportSnap => {
                const reportData = reportSnap.val();
                if (!reportData.hasOwnProperty('legacy')) { // Check if 'legacy' property is missing
                    reportsToUpdate.push({
                        key: reportSnap.key,
                        data: reportData
                    });
                }
            });

            if (reportsToUpdate.length > 0) {
                totalUpdatedUsers++;
                console.log(`[Legacy Flag Append] User ${userId} has ${reportsToUpdate.length} reports to update.`);

                // Process reports in chunks
                for (let i = 0; i < reportsToUpdate.length; i += BATCH_SIZE) {
                    const batch = reportsToUpdate.slice(i, i + BATCH_SIZE);
                    const updatePromises = batch.map(async ({ key, data }) => {
                        const reportRef = db.ref(`${REPORTS_PATH}/${userId}/${key}`);
                        await reportRef.update({ legacy: true });
                        totalUpdatedReports++;
                    });

                    await Promise.all(updatePromises);
                    console.log(`[Legacy Flag Append] Updated batch of ${batch.length} reports for user ${userId}. Total updated: ${totalUpdatedReports}`);

                    // Introduce a delay between batches for rate limiting
                    if (i + BATCH_SIZE < reportsToUpdate.length) {
                        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
                    }
                }
            }
        }

        console.log(`[Legacy Flag Append] Operation finished. Total users updated: ${totalUpdatedUsers}, Total reports updated: ${totalUpdatedReports}.`);
        return {
            success: true,
            updatedUsers: totalUpdatedUsers,
            updatedReports: totalUpdatedReports,
            message: 'Legacy flag append operation completed.'
        };

    } catch (error) {
        console.error('[Legacy Flag Append] Error during operation:', error);
        throw new functions.https.HttpsError('internal', 'Failed to append legacy flag to reports.', {
            originalError: error.message
        });
    }
});






/**
 * Refreshes a user's GTAW data, including faction membership and permissions,
 * using their existing access token.
 */
export const refreshGtawUser = onCall({
    cors: [
        'https://gtaw-forms.github.io',
        'https://phmc-tools.gta.world',
        'http://localhost:3000'
    ]
}, async (request) => {
    const { accessToken } = request.data;

    if (!accessToken) {
        throw new functions.https.HttpsError('invalid-argument', 'Access token is required.');
    }

    try {
        const userResponse = await fetch('https://ucp.gta.world/api/user', {
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json', 'User-Agent': 'PHMC-Tools/1.0 (Firebase Functions)' },
        });

        if (!userResponse.ok) {
            throw new functions.https.HttpsError('internal', `Failed to fetch user profile from GTA World API. Status: ${userResponse.status}`);
        }
        
        const userData = await userResponse.json();

        if (!userData.user && !userData.id) {
             throw new functions.https.HttpsError('internal', 'Invalid user data received from GTA World API.');
        }

        const finalUser = userData.user || userData;
        const characterArray = finalUser.character || finalUser.characters || [];
        const characterIds = characterArray.map(c => c.id).filter(id => id);

        let factionResult = {
            isMember: false,
            character: null,
            permissions: [],
            accessLevel: 'none',
            allFactionCharacters: []
        };

        if (characterIds.length > 0) {
            const factionId = 364; // PHMC Faction ID
            const membersRef = db.ref(`factions/${factionId}/members`);
            const membersSnapshot = await membersRef.once('value');
            const allMembers = membersSnapshot.val() || {};

            const factionMembers = [];
            for (const charId of characterIds) {
                if (allMembers[charId]) {
                    const memberData = allMembers[charId];
                    factionMembers.push({
                        character: {
                            characterId: memberData.characterId,
                            characterName: memberData.characterName,
                            rank: memberData.rank,
                            scriptRank: memberData.scriptRank
                        },
                        permissions: getPermissionsForRank(memberData.scriptRank),
                        accessLevel: getAccessLevel(memberData.scriptRank)
                    });
                }
            }

            if (factionMembers.length > 0) {
                const highestRankMember = factionMembers.reduce((max, current) =>
                    (current.character.scriptRank > max.character.scriptRank) ? current : max, factionMembers[0]
                );

                factionResult = {
                    isMember: true,
                    character: highestRankMember.character,
                    permissions: highestRankMember.permissions,
                    accessLevel: highestRankMember.accessLevel,
                    allFactionCharacters: factionMembers
                };
            }
        }

        const refreshedUser = {
            ...finalUser,
            isFactionMember: factionResult.isMember,
            faction: factionResult.character,
            permissions: factionResult.permissions,
            accessLevel: factionResult.accessLevel,
            allFactionCharacters: factionResult.allFactionCharacters,
        };

        return {
            success: true,
            user: refreshedUser,
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        console.error('[refreshGtawUser] Error refreshing user:', error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        } else {
            throw new functions.https.HttpsError('internal', 'An unexpected error occurred during user refresh.', { originalError: error.message });
        }
    }
});


/**
 * Helper function to get permissions based on script rank
 */
function getPermissionsForRank(scriptRank) {
    const permissionMap = {
        15: ['admin_full_access', 'upload_faction_data', 'manage_all_reports', 'view_all_members', 'configure_permissions', 'access_audit_logs', 'manage_webhooks', 'database_access'],
        14: ['admin_full_access', 'upload_faction_data', 'manage_department_reports', 'view_all_members', 'access_audit_logs', 'manage_webhooks'],
        13: ['upload_faction_data', 'manage_department_reports', 'view_all_members'],
        12: ['manage_own_reports', 'view_department_members'],
        11: ['manage_own_reports', 'view_department_members'],
        10: ['manage_own_reports', 'view_department_members'],
        9: ['manage_own_reports', 'view_department_members'],
        8: ['manage_own_reports', 'view_department_members'],
        7: ['manage_own_reports', 'view_department_members'],
        6: ['manage_own_reports', 'view_department_members'],
        5: ['manage_own_reports', 'view_department_members'],
        4: ['manage_own_reports', 'view_department_members'],
        3: ['manage_own_reports', 'view_department_members'],
        2: ['manage_own_reports', 'view_department_members'],
        1: ['view_own_reports'],
        0: ['view_own_reports']
    };
    
    return permissionMap[scriptRank] || [];
}

/**
 * Helper function to get a simplified access level string
 */
function getAccessLevel(scriptRank) {
    if (scriptRank >= 14) return 'admin';
    if (scriptRank >= 12) return 'management';
    if (scriptRank >= 1) return 'member';
    return 'none';
}

export const getSavedReports = onCall({
    cors: [
        'https://gtaw-forms.github.io',
        'https://phmc-tools.gta.world',
        'http://localhost:3000'
    ]
}, async (request) => {
    console.log('[Saved Reports] Starting saved reports retrieval');
    
    const { userId } = request.data;
    
    if (!userId) {
        throw new functions.https.HttpsError('invalid-argument', 'User ID is required');
    }
    
    try {
        console.log('[Saved Reports] Looking up reports for user ID:', userId);
        
        const sanitizedUserId = userId.trim().replace(/[.#$[\\\] ]+/g, '_');
        const userReportsPath = `savedReports/${sanitizedUserId}`;
        const reportsRef = db.ref(userReportsPath);
        
        const snapshot = await reportsRef.once('value');
        
        if (!snapshot.exists()) {
            console.log('[Saved Reports] No reports found for user:', userId);
            return {
                success: true,
                reports: [],
                message: 'No reports found for this user'
            };
        }
        
        const reportsData = snapshot.val();
        const sanitizedReports = Object.keys(reportsData).map(reportKey => {
            const report = reportsData[reportKey];
            return {
                key: reportKey,
                originalKey: report.originalKey,
                bbCodeVersion: report.bbCodeVersion,
                timestamp: report.timestamp,
                authorName: report.authorName,
            };
        });
        
        console.log(`[Saved Reports] Found ${sanitizedReports.length} reports for user:`, userId);
        
        return {
            success: true,
            reports: sanitizedReports,
            message: `Found ${sanitizedReports.length} reports`
        };
        
    } catch (error) {
        console.error('[Saved Reports] Error retrieving reports:', error);
        
        throw new functions.https.HttpsError('internal', 'Failed to retrieve saved reports', {
            originalError: error.message
        });
    }
});

export const migrateReportsToNewStructure = onCall({
    cors: [
        'https://gtaw-forms.github.io',
        'https://phmc-tools.gta.world',
        'http://localhost:3000'
    ]
}, async (request) => {
    console.log('[Migration] Starting report structure migration.');

    // Security: Ensure the user is an administrator
    // This assumes you have a custom claim 'admin' set to true for your admin users.
    if (request.auth?.token?.admin !== true) {
        console.warn(`[Migration] Unauthorized attempt by UID: ${request.auth?.uid}`);
        throw new functions.https.HttpsError('permission-denied', 'You must be an admin to perform this operation.');
    }

    try {
        const reportsRef = db.ref('savedReports');
        const snapshot = await reportsRef.once('value');

        if (!snapshot.exists()) {
            console.log('[Migration] No reports found to migrate.');
            return { success: true, message: 'No reports found. Nothing to migrate.', migratedCount: 0 };
        }

        const allUsersReports = snapshot.val();
        const updates = {};
        let migratedCount = 0;
        let processedCount = 0;

        console.log('[Migration] Scanning all user reports for old structure...');

        for (const userId in allUsersReports) {
            const userReports = allUsersReports[userId];
            if (!userReports || typeof userReports !== 'object') continue;

            for (const reportId in userReports) {
                processedCount++;
                const report = userReports[reportId];

                // Check if the report is in the old format (has a bbCode property)
                if (report && typeof report === 'object' && report.hasOwnProperty('bbCode')) {
                    const bbCodeContent = report.bbCode;

                    // 1. Define path for the new BBCode-only entry
                    const bbCodePath = `/savedReportBBCode/${userId}/${reportId}`;
                    updates[bbCodePath] = { bbCode: bbCodeContent };

                    // 2. Define path to remove the bbCode from the original report
                    const originalReportBbCodePath = `/savedReports/${userId}/${reportId}/bbCode`;
                    updates[originalReportBbCodePath] = null; // Setting to null deletes the key in a multi-path update

                    migratedCount++;
                }
            }
        }

        console.log(`[Migration] Scan complete. Found ${migratedCount} reports to migrate out of ${processedCount} total reports.`);

        if (migratedCount > 0) {
            console.log('[Migration] Applying multi-path update to migrate reports...');
            await db.ref().update(updates);
            console.log('[Migration] Multi-path update complete.');
        } else {
            console.log('[Migration] No reports required migration.');
        }

        return {
            success: true,
            message: `Migration complete. Scanned ${processedCount} reports and migrated ${migratedCount} to the new structure.`, 
            migratedCount: migratedCount,
            totalScanned: processedCount
        };

    } catch (error) {
        console.error('[Migration] Error during report migration:', error);
        throw new functions.https.HttpsError('internal', 'An error occurred during the migration process.', {
            originalError: error.message
        });
    }
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
    }).join('\\n');
    
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


export const syncReportCounts = onCall({
    secrets: ["ADMIN_ACTION_WEBHOOK_URL"],
}, async (request) => {
    console.log('[Sync Counts] Starting combined report count sync process.');

    const legacyReportsRef = db.ref('/savedReports');
    const newReportsRef = db.ref('/newSavedReports');
    const countsRef = db.ref('/userReportCounts');
    
    try {
        const [legacySnapshot, newSnapshot] = await Promise.all([
            legacyReportsRef.once('value'),
            newReportsRef.once('value')
        ]);

        const legacyUsers = legacySnapshot.exists() ? legacySnapshot.val() : {};
        const newUsers = newSnapshot.exists() ? newSnapshot.val() : {};

        if (Object.keys(legacyUsers).length === 0 && Object.keys(newUsers).length === 0) {
            console.log('[Sync Counts] No reports found in legacy or new paths to sync.');
            return { success: true, message: 'No reports found to sync.', syncedUsers: 0 };
        }

        const combinedUserIds = new Set([...Object.keys(legacyUsers), ...Object.keys(newUsers)]);
        const updates = {};
        let syncedUsers = 0;

        for (const userId of combinedUserIds) {
            const legacyUserReports = legacyUsers[userId];
            const newUserReports = newUsers[userId];

            const legacyCount = (legacyUserReports && typeof legacyUserReports === 'object') ? Object.keys(legacyUserReports).length : 0;
            const newCount = (newUserReports && typeof newUserReports === 'object') ? Object.keys(newUserReports).length : 0;
            
            const totalCount = legacyCount + newCount;
            updates[`${userId}/total`] = totalCount;
            syncedUsers++;
        }

        if (syncedUsers > 0) {
            await countsRef.update(updates);
        }

        const successMessage = `Successfully synced combined counts for ${syncedUsers} users.`;
        console.log(`[Sync Counts] ${successMessage}`);
        
        await sendWebhook({
            embeds: [{
                title: "Report Count Sync Complete (Combined)",
                description: successMessage,
                color: 0x00FF00,
                footer: { text: "PHMC Tools - Admin Action" }
            }]
        });

        return {
            success: true,
            message: successMessage,
            syncedUsers
        };

    } catch (error) {
        console.error('[Sync Counts] Error during combined report count sync:', error);
        await sendWebhook({
            embeds: [{
                title: "Report Count Sync Failed (Combined)",
                description: `An error occurred: ${error.message}`,
                color: 0xFF0000,
                footer: { text: "PHMC Tools - Admin Action" }
            }]
        });
        throw new functions.https.HttpsError('internal', 'Failed to sync combined report counts.', error.message);
    }
});

export const gtawAccountSync = onCall({
    cors: [
        'https://gtaw-forms.github.io',
        'https://phmc-tools.gta.world',
        'http://localhost:3000'
    ]
}, async (request) => {
    console.log('[GTAW Account Sync] Starting account synchronization.');

    // Ensure user is authenticated
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required to sync GTAW account.');
    }

    const { gtaUser, options } = request.data;
    const uid = request.auth.uid;

    if (!gtaUser || !gtaUser.id || !gtaUser.username) {
        throw new functions.https.HttpsError('invalid-argument', 'GTA World user data is missing or incomplete.');
    }

    try {
        const userProfileRef = db.ref(`users/${uid}/gtawProfile`);

        // Prepare data to save
        const profileData = {
            gtawId: gtaUser.id,
            gtawUsername: gtaUser.username,
            // Store characters if available
            characters: gtaUser.character ? gtaUser.character.map(char => ({
                id: char.id,
                name: char.name || `${char.firstname || ''} ${char.lastname || ''}`.trim(),
                // Add other relevant character data if needed
            })) : [],
            lastSynced: admin.database.ServerValue.TIMESTAMP,
            syncOptions: options || {} // Store options for debugging/future use
        };

        await userProfileRef.set(profileData);

        console.log(`[GTAW Account Sync] Successfully synced GTAW profile for UID: ${uid}, GTAW User: ${gtaUser.username}`);

        return {
            success: true,
            message: `GTAW account synced successfully for ${gtaUser.username}.`,
            gtawId: gtaUser.id,
            uid: uid
        };

    } catch (error) {
        console.error(`[GTAW Account Sync] Error syncing account for UID: ${uid}, GTAW User: ${gtaUser.username}:`, error);
        throw new functions.https.HttpsError('internal', 'Failed to sync GTAW account data.', {
            originalError: error.message
        });
    }
});