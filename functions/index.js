import { onSchedule } from "firebase-functions/v2/scheduler";
import { setGlobalOptions } from "firebase-functions/v2";
import { onCall } from "firebase-functions/v2/https";
import * as functions from "firebase-functions";
import admin from "firebase-admin";
import fetch from "node-fetch";

// Initialize Firebase Admin SDK
if (admin.apps.length === 0) {
    admin.initializeApp();
}
const db = admin.database();

// Set global options for all v2 functions in this file
setGlobalOptions({ region: "us-central1" }); // Or your preferred region

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
    const processedAt = new Date(request.processedAt);
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
                 timestamp: new Date().toISOString(),
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
export const dailyTaskHandler = onSchedule({
    schedule: "every day 09:00",
    timeZone: "UTC",
    // --- MODIFICATION: Add the 'secrets' option to grant access to the webhook URL
    secrets: ["ADMIN_ACTION_WEBHOOK_URL"],
}, async (event) => {
    console.log(`Running daily task handler. Event ID: ${event.id}`);

    // --- Bingo Reset Logic ---
    const BINGO_TYPES = [
        { id: 'er', name: 'Emergency Room', path: 'ER' },
        { id: 'ems', name: 'EMS', path: 'EMS' },
        { id: 'coroner', name: 'Coroner', path: 'Coroner' }
    ];

    const bingoResults = { success: [], noCard: [], notEnoughPhrases: [], errors: [] };

    await db.ref('bingo/meta').update({ lastAutoRegenTimestamp: admin.database.ServerValue.TIMESTAMP });

    await Promise.all(BINGO_TYPES.map(async (bingoType) => {
        const cardPhrasesRef = db.ref(`bingo/cards/${bingoType.path}/phrases`);
        const masterPhrasesRef = db.ref(`bingo/phrases/${bingoType.path}`);
        const activityLogRef = db.ref(`bingo/logs/${bingoType.path}/activityLog`);

        try {
            const cardSnapshot = await cardPhrasesRef.once('value');
            if (!cardSnapshot.exists()) {
                bingoResults.noCard.push(bingoType.name);
                return;
            }

            const masterSnapshot = await masterPhrasesRef.once('value');
            if (!masterSnapshot.exists()) {
                bingoResults.notEnoughPhrases.push(`${bingoType.name} (no master list)`);
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
                bingoResults.notEnoughPhrases.push(`${bingoType.name} (${masterPhrases.length}/24)`);
                return;
            }

            const shuffledPhrases = getShuffledPhrases(masterPhrases).slice(0, 24);
            await cardPhrasesRef.set(shuffledPhrases);
            await activityLogRef.remove();
            bingoResults.success.push(bingoType.name);

        } catch (error) {
            console.error(`Error processing ${bingoType.name}:`, error);
            bingoResults.errors.push(`${bingoType.name}: ${error.message}`);
        }
    }));

    let bingoDetails = '';
    if (bingoResults.success.length > 0) bingoDetails += `✅ Regenerated: ${bingoResults.success.join(', ')}\n`;
    if (bingoResults.noCard.length > 0) bingoDetails += `➖ Skipped (Disabled): ${bingoResults.noCard.join(', ')}\n`;
    if (bingoResults.notEnoughPhrases.length > 0) bingoDetails += `⚠️ Skipped (Not Enough Phrases): ${bingoResults.notEnoughPhrases.join(', ')}\n`;
    if (bingoResults.errors.length > 0) bingoDetails += `❌ Errors: ${bingoResults.errors.join(', ')}\n`;

    // --- Phrase Request Deletion Logic ---
       const requestsRef = db.ref('bingo/phraseRequests');
    let deletionDetails = '';
       try {
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
               deletionDetails = `✅ Successfully deleted ${deletionCount} phrase requests.\n`;

           } else {
               deletionDetails = '➖ No phrase requests found to delete.\n';
           }
       } catch (error) {
           console.error('Error during deletion scheduling:', error);
           deletionDetails = `❌ Error during phrase request deletion: ${error.message}\n`;
       }

    const embed = {
        title: "Daily Task Handler",
        color: 0x1E90FF,
        fields: [
            { name: "Bingo Reset Status", value: `\`\`\n${bingoDetails.trim() || "No bingo actions taken."}\n\`\`
`, inline: false },
            { name: "Phrase Request Deletion", value: `\`\`\n${deletionDetails.trim() || "No phrase request actions taken."}\n\`\`
`, inline: false },
        ],
        timestamp: new Date().toISOString(),
        footer: { text: "PHMC Tools - Scheduled Cloud Function (v2)" }
    };

    const webhookSuccess = await sendWebhook({ embeds: [embed] });

    if (webhookSuccess) {
        console.log('Daily task handler finished successfully and dispatched webhook.');
    } else {
        console.error('Daily task handler finished, but failed to dispatch webhook.');
    }

    return null;
});

// --- Daily Cleaning Task ---
export const dailyCleaningTask = onSchedule({
    schedule: "every day 09:00",
    timeZone: "UTC",
    secrets: ["ADMIN_ACTION_WEBHOOK_URL"],
}, async (event) => {
    console.log(`Running daily cleaning task. Event ID: ${event.id}`);

    const REPORTS_PATH = '/savedReports';
    let cleanupResults = { scanned: 0, duplicatesFound: 0, duplicatesDeleted: 0, errors: [] };

    try {
        const reportsRootRef = db.ref(REPORTS_PATH);
        const rootSnapshot = await reportsRootRef.once('value');

        if (!rootSnapshot.exists()) {
            console.log('No reports found in database.');
            cleanupResults.errors.push('No reports found in database');
        } else {
            const allUserNodes = rootSnapshot.val();
            const seenKeys = {};
            const seenBBCode = {};
            const duplicates = [];

            // Traverse each user node and collect duplicates
            Object.entries(allUserNodes).forEach(([userKey, userReports]) => {
                if (!userReports || typeof userReports !== 'object') return;

                Object.entries(userReports).forEach(([reportKey, report]) => {
                    cleanupResults.scanned++;

                    // Check by originalKey
                    if (report.originalKey) {
                        if (seenKeys[report.originalKey]) {
                            duplicates.push({
                                user: userKey,
                                key: reportKey,
                                originalKey: report.originalKey,
                                reason: 'originalKey',
                                duplicateOf: seenKeys[report.originalKey]
                            });
                        } else {
                            seenKeys[report.originalKey] = { user: userKey, key: reportKey };
                        }
                    }

                    // Check by BBCode
                    if (report.bbcode) {
                        if (seenBBCode[report.bbcode]) {
                            duplicates.push({
                                user: userKey,
                                key: reportKey,
                                bbcode: report.bbcode,
                                reason: 'bbcode',
                                duplicateOf: seenBBCode[report.bbcode]
                            });
                        } else {
                            seenBBCode[report.bbcode] = { user: userKey, key: reportKey };
                        }
                    }
                });
            });

            cleanupResults.duplicatesFound = duplicates.length;
            console.log(`Found ${duplicates.length} duplicate reports out of ${cleanupResults.scanned} total reports`);

            if (duplicates.length > 0) {
                // Create backup before deletion
                const backupTimestamp = Date.now();
                const backupRef = db.ref(`backups/duplicateReports/${backupTimestamp}`);
                await backupRef.set({
                    duplicates,
                    backupTimestamp: admin.database.ServerValue.TIMESTAMP,
                    totalScanned: cleanupResults.scanned,
                    totalDuplicates: duplicates.length
                });

                // Delete duplicates
                const deletePromises = duplicates.map(dup => {
                    const delRef = db.ref(`${REPORTS_PATH}/${dup.user}/${dup.key}`);
                    return delRef.remove();
                });

                await Promise.all(deletePromises);
                cleanupResults.duplicatesDeleted = duplicates.length;

                console.log(`Successfully deleted ${duplicates.length} duplicate reports and created backup`);

                // Delete the backup immediately after successful cleanup
                try {
                    await backupRef.remove();
                    console.log('Successfully deleted temporary backup after cleanup');
                } catch (backupDeleteError) {
                    console.error('Error deleting temporary backup:', backupDeleteError);
                    // Don't fail the entire operation if backup deletion fails
                }

                // Clean up old backups (older than 30 days) to prevent storage bloat
                try {
                    const backupsRef = db.ref('backups/duplicateReports');
                    const oldBackupsSnapshot = await backupsRef.once('value');

                    if (oldBackupsSnapshot.exists()) {
                        const allBackups = oldBackupsSnapshot.val();
                        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000); // 30 days in milliseconds
                        const oldBackupKeys = [];

                        Object.keys(allBackups).forEach(backupKey => {
                            const backupTimestampValue = parseInt(backupKey);
                            if (!isNaN(backupTimestampValue) && backupTimestampValue < thirtyDaysAgo) {
                                oldBackupKeys.push(backupKey);
                            }
                        });

                        if (oldBackupKeys.length > 0) {
                            console.log(`Cleaning up ${oldBackupKeys.length} old backup(s) older than 30 days`);
                            const cleanupPromises = oldBackupKeys.map(key => {
                                return db.ref(`backups/duplicateReports/${key}`).remove();
                            });
                            await Promise.all(cleanupPromises);
                            console.log(`Successfully cleaned up ${oldBackupKeys.length} old backup(s)`);
                        }
                    }
                } catch (cleanupError) {
                    console.error('Error during old backup cleanup:', cleanupError);
                    // Don't fail the entire operation if cleanup fails
                }

                // Clean up old webhook logs (older than 3 days)
                try {
                    const webhook_logsRef = db.ref('webhook_logs');
                    const oldLogsSnapshot = await webhook_logsRef.once('value');

                    if (oldLogsSnapshot.exists()) {
                        const allLogs = oldLogsSnapshot.val();
                        const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000); // 3 days in milliseconds
                        const oldLogKeys = [];

                        Object.keys(allLogs).forEach(logKey => {
                            const logTimestamp = parseInt(logKey);
                            if (!isNaN(logTimestamp) && logTimestamp < threeDaysAgo) {
                                oldLogKeys.push(logKey);
                            }
                        });

                        if (oldLogKeys.length > 0) {
                            console.log(`Cleaning up ${oldLogKeys.length} webhook log(s) older than 3 days`);
                            const cleanupPromises = oldLogKeys.map(key => {
                                return db.ref(`webhook_logs/${key}`).remove();
                            });
                            await Promise.all(cleanupPromises);
                            console.log(`Successfully cleaned up ${oldLogKeys.length} webhook log(s)`);
                        }
                    }
                } catch (logCleanupError) {
                    console.error('Error during webhook log cleanup:', logCleanupError);
                    // Don't fail the entire operation if cleanup fails
                }
            }
        }

    } catch (error) {
        console.error('Error during duplicate reports cleanup:', error);
        cleanupResults.errors.push(`Cleanup error: ${error.message}`);
    }

    // Send Discord webhook with results
    const embed = {
        title: "Daily Cleaning Task",
        color: cleanupResults.duplicatesDeleted > 0 ? 0xFF6B35 : 0x1E90FF,
        fields: [
            {
                name: "Duplicate Reports Scan Results",
                value: `📊 **Scanned:** ${cleanupResults.scanned} reports\n🔍 **Duplicates Found:** ${cleanupResults.duplicatesFound}\n🗑️ **Duplicates Deleted:** ${cleanupResults.duplicatesDeleted}`,
                inline: true
            },
            {
                name: "Status",
                value: cleanupResults.duplicatesDeleted > 0
                    ? `✅ Cleanup completed successfully. Temporary backup deleted after cleanup.`
                    : cleanupResults.duplicatesFound === 0
                        ? `✅ No duplicates found - database is clean.`
                        : `⚠️ Duplicates found but deletion failed.`,
                inline: false
            }
        ],
        timestamp: event?.timestamp ? new Date(event.timestamp).toISOString() : new Date().toISOString(),
        footer: { text: "PHMC Tools - Automated Daily Cleaning" }
    };

    // Add error details if any
    if (cleanupResults.errors.length > 0) {
        embed.fields.push({
            name: "Errors",
            value: cleanupResults.errors.join('\n'),
            inline: false
        });
    }

    const webhookSuccess = await sendWebhook({ embeds: [embed] });

    if (webhookSuccess) {
        console.log('Daily cleaning task completed and webhook sent.');
    } else {
        console.error('Daily cleaning task completed, but failed to send webhook.');
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
export const exchangeAuthCodeForToken = onCall({ 
    secrets: ["GTAWORLD_CLIENT_ID", "GTAWORLD_CLIENT_SECRET"],
    cors: [
        'https://ancad-studios.github.io',
        'http://localhost:3000',
        'https://gtaw-forms.github.io',
        'https://phmc-tools.gta.world',
        'https://global.gta.world'
    ]
}, async (request) => {
    const data = request.data;
    const startTime = Date.now();
    
    console.log('[OAuth] Received token exchange request');
    console.log('[OAuth] Request auth:', request.auth ? 'authenticated' : 'unauthenticated');
    console.log('[OAuth] Has code:', !!data?.code);
    console.log('[OAuth] Has redirectUri:', !!data?.redirectUri);
    
    const { code, redirectUri, clientId: providedClientId } = data || {};
    const clientId = process.env.GTAWORLD_CLIENT_ID;
    const clientSecret = process.env.GTAWORLD_CLIENT_SECRET;

    // Enhanced debugging for client ID comparison
    console.log('[OAuth] Client ID comparison debug:', {
        hasProvidedClientId: !!providedClientId,
        hasServerClientId: !!clientId,
        providedLength: providedClientId?.length || 0,
        serverLength: clientId?.length || 0,
        providedPrefix: providedClientId ? `${providedClientId.substring(0, 8)}...` : 'NOT_PROVIDED',
        serverPrefix: clientId ? `${clientId.substring(0, 8)}...` : 'NOT_SET',
        exactMatch: providedClientId === clientId,
        trimmedMatch: providedClientId?.trim() === clientId?.trim()
    });

    // Validate that the provided clientId matches the configured one (security check)
    if (providedClientId && providedClientId !== clientId) {
        console.error('[OAuth] Client ID mismatch - detailed comparison:', {
            provided: providedClientId,
            expected: clientId,
            providedType: typeof providedClientId,
            expectedType: typeof clientId
        });
        throw new functions.https.HttpsError('invalid-argument', 'Invalid client ID provided');
    }

    // Validate required arguments
    if (!code) {
        console.error('[OAuth] Missing authorization code parameter');
        throw new functions.https.HttpsError('invalid-argument', 'Authorization code is required');
    }

    if (!redirectUri) {
        console.error('[OAuth] Missing redirectUri parameter');
        throw new functions.https.HttpsError('invalid-argument', 'Redirect URI is required and must match the registered URI');
    }

    // Validate redirect URI format and allowed domains
    const allowedRedirectUris = [
        'https://ancad-studios.github.io/phmc-forms/#/auth/gta/callback',
        'https://gtaw-forms.github.io/forms/#/auth/gta/callback',
        'http://localhost:3000/#/auth/gta/callback',
        'https://phmc-tools.gta.world/#/auth/gta/callback'
    ];

    if (!allowedRedirectUris.includes(redirectUri)) {
        console.error('[OAuth] Invalid redirect URI:', redirectUri);
        throw new functions.https.HttpsError('invalid-argument', 'Redirect URI is not allowed');
    }

    if (!clientId || !clientSecret) {
        console.error('[OAuth] Missing OAuth client credentials in environment');
        throw new functions.https.HttpsError('internal', 'OAuth client credentials not configured properly');
    }

    // Check if this code was already processed recently (prevent duplicate requests)
    const cacheKey = `${code}-${redirectUri}`;
    const cached = oauthCodeCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_EXPIRY) {
        console.log('[OAuth] Using cached token exchange result');
        return cached.result;
    }

    try {
        console.log('[OAuth] Starting token exchange with GTA World');
        console.log('[OAuth] Token exchange parameters:', {
            hasCode: !!code,
            codeLength: code?.length,
            codePrefix: code ? `${code.substring(0, 20)}...` : 'MISSING',
            redirectUri: redirectUri,
            redirectUriEncoded: encodeURIComponent(redirectUri),
            clientId: clientId ? `${clientId.substring(0, 8)}...` : 'MISSING',
            tokenUrl: 'https://ucp.gta.world/oauth/token'
        });
        
        // Exchange auth code for access token
        const tokenRequestBody = new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            code: code,
        });

        console.log('[OAuth] Token request body parameters:', {
            grant_type: 'authorization_code',
            client_id: clientId ? `${clientId.substring(0, 8)}...` : 'MISSING',
            client_secret: clientSecret ? 'SET' : 'MISSING',
            redirect_uri: redirectUri,
            code: code ? `${code.substring(0, 30)}...` : 'MISSING',
            bodyString: tokenRequestBody.toString().substring(0, 200) + '...'
        });

        // Add timeout to prevent hanging requests
        const tokenController = new AbortController();
        const tokenTimeout = setTimeout(() => tokenController.abort(), 15000); // 15 second timeout
        
        const tokenResponse = await fetch('https://ucp.gta.world/oauth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'PHMC-Tools/1.0 (Firebase Functions)'
            },
            body: tokenRequestBody,
            signal: tokenController.signal
        });
        
        clearTimeout(tokenTimeout);

        console.log('[OAuth] Token response status:', tokenResponse.status);
        console.log('[OAuth] Token response headers:', Object.fromEntries(tokenResponse.headers.entries()));

        // Get response text first to check if it's HTML or JSON
        const tokenResponseText = await tokenResponse.text();
        console.log('[OAuth] Raw token response:', {
            status: tokenResponse.status,
            statusText: tokenResponse.statusText,
            contentType: tokenResponse.headers.get('content-type'),
            textLength: tokenResponseText.length,
            startsWithHTML: tokenResponseText.trim().startsWith('<'),
            firstChars: tokenResponseText.substring(0, 200)
        });

        let tokenData;
        try {
            tokenData = JSON.parse(tokenResponseText);
        } catch (parseError) {
            console.error('[OAuth] Failed to parse token response as JSON:', {
                error: parseError.message,
                responseText: tokenResponseText.substring(0, 1000),
                isHTML: tokenResponseText.includes('<html>') || tokenResponseText.includes('<!DOCTYPE')
            });
            throw new functions.https.HttpsError('internal', 'GTA World API returned invalid response (HTML instead of JSON)');
        }

        if (!tokenResponse.ok) {
            console.error('[OAuth] Token exchange failed:', tokenData);
            
            // Enhanced error handling for specific OAuth errors
            let errorMessage = 'Failed to exchange authorization code for access token';
            let userFriendlyMessage = errorMessage;
            
            if (tokenData.error) {
                switch (tokenData.error) {
                    case 'invalid_request':
                        if (tokenData.hint && tokenData.hint.includes('revoked')) {
                            userFriendlyMessage = 'This login attempt has expired or was already used. Please try logging in again.';
                            errorMessage = 'Authorization code has been revoked (likely due to duplicate request)';
                        } else {
                            userFriendlyMessage = 'Invalid login request. Please try again.';
                        }
                        break;
                    case 'invalid_grant':
                        userFriendlyMessage = 'The login session has expired. Please try logging in again.';
                        break;
                    case 'invalid_client':
                        userFriendlyMessage = 'Authentication service configuration error. Please contact support.';
                        break;
                    default:
                        userFriendlyMessage = `Authentication failed: ${tokenData.error_description || tokenData.error}`;
                        break;
                }
            }
            
            throw new functions.https.HttpsError('invalid-argument', userFriendlyMessage, {
                ...tokenData,
                originalError: errorMessage
            });
        }

        // Validate token response structure
        if (!tokenData.access_token) {
            console.error('[OAuth] Invalid token response - missing access_token');
            throw new functions.https.HttpsError('internal', 'Invalid response from GTA World OAuth server');
        }

        console.log('[OAuth] Token exchange successful, fetching user profile');

        // Fetch user profile with enhanced error handling
        console.log('[OAuth] User profile request details:', {
            url: 'https://ucp.gta.world/api/user',
            hasAccessToken: !!tokenData.access_token,
            tokenType: tokenData.token_type || 'Bearer',
            tokenPrefix: tokenData.access_token ? `${tokenData.access_token.substring(0, 20)}...` : 'MISSING'
        });

        // Add timeout to user profile request
        const userController = new AbortController();
        const userTimeout = setTimeout(() => userController.abort(), 10000); // 10 second timeout
        
        const userResponse = await fetch('https://ucp.gta.world/api/user', {
            headers: {
                'Authorization': `Bearer ${tokenData.access_token}`,
                'Accept': 'application/json',
                'User-Agent': 'PHMC-Tools/1.0 (Firebase Functions)'
            },
            signal: userController.signal
        });
        
        clearTimeout(userTimeout);

        console.log('[OAuth] User profile response details:', {
            status: userResponse.status,
            statusText: userResponse.statusText,
            headers: Object.fromEntries(userResponse.headers.entries()),
            contentType: userResponse.headers.get('content-type'),
            ok: userResponse.ok
        });

        // Get response text first to debug what's being returned
        const responseText = await userResponse.text();
        
        // Parse JSON to show structured data instead of truncated text
        let parsedData;
        let isValidJSON = false;
        try {
            parsedData = JSON.parse(responseText);
            isValidJSON = true;
        } catch {
            parsedData = null;
            isValidJSON = false;
        }
        
        console.log('[OAuth] Raw user profile response:', {
            textLength: responseText.length,
            startsWithHTML: responseText.trim().startsWith('<'),
            isJSON: isValidJSON,
            characterCount: isValidJSON && parsedData?.user?.character ? parsedData.user.character.length : 0,
            userInfo: isValidJSON && parsedData?.user ? {
                id: parsedData.user.id,
                username: parsedData.user.username,
                hasCharacters: !!parsedData.user.character
            } : null
        });
        
        // Log character data separately (only in debug mode or if there are issues)
        if (isValidJSON && parsedData?.user?.character) {
            // Reduce verbose logging - only log character count and basic info
            console.log('[OAuth] Character data summary:', {
                characterCount: parsedData.user.character.length,
                characterIds: parsedData.user.character.map(char => char.id),
                characterNames: parsedData.user.character.map(char => 
                    char.name || `${char.firstname || ''} ${char.lastname || ''}`.trim()
                )
            });
        } else if (!isValidJSON) {
            console.log('[OAuth] Raw response text (not JSON):', responseText.substring(0, 200));
        }

        let userData;
        try {
            userData = JSON.parse(responseText);
        } catch (parseError) {
            console.error('[OAuth] Failed to parse user profile response as JSON:', {
                parseError: parseError.message,
                responsePreview: responseText.substring(0, 500)
            });
            throw new functions.https.HttpsError('invalid-argument', 'Failed to fetch user profile from GTA World API - invalid response format', {
                status: userResponse.status,
                contentType: userResponse.headers.get('content-type'),
                responsePreview: responseText.substring(0, 200)
            });
        }

        console.log('[OAuth] User profile response status:', userResponse.status);

        if (!userResponse.ok) {
            console.error('[OAuth] Failed to fetch user profile:', userData);
            throw new functions.https.HttpsError('invalid-argument', 'Failed to fetch user profile from GTA World API', userData);
        }

        // Validate user data structure
        if (!userData.user && !userData.id && !userData.username) {
            console.error('[OAuth] Invalid user response structure:', userData);
            throw new functions.https.HttpsError('internal', 'Invalid user data received from GTA World API');
        }

        console.log('[OAuth] Authentication successful for user:', userData.user?.username || userData.username);
        
        // Prepare successful response
        const successResult = { 
            success: true,
            token: {
                access_token: tokenData.access_token,
                token_type: tokenData.token_type || 'Bearer',
                expires_in: tokenData.expires_in,
                refresh_token: tokenData.refresh_token,
                scope: tokenData.scope
            },
            user: userData.user || userData, // Handle both response formats
            timestamp: new Date().toISOString(),
            processingTime: Date.now() - startTime
        };

        // Cache the result to prevent duplicate processing
        oauthCodeCache.set(cacheKey, {
            result: successResult,
            timestamp: Date.now()
        });

        // Clean up old cache entries (basic cleanup)
        if (oauthCodeCache.size > 100) {
            const entries = Array.from(oauthCodeCache.entries());
            const now = Date.now();
            for (const [key, value] of entries) {
                if (now - value.timestamp > CACHE_EXPIRY) {
                    oauthCodeCache.delete(key);
                }
            }
        }

        console.log(`[OAuth] Token exchange completed in ${Date.now() - startTime}ms`);
        return successResult;

    } catch (error) {
        console.error('[OAuth] Unexpected error during token exchange:', error);
        console.error('[OAuth] Error stack:', error.stack);
        
        // Determine error type for better client-side handling
        let errorCode = 'internal';
        let errorMessage = 'An internal error occurred during authentication';
        
        if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
            errorCode = 'unavailable';
            errorMessage = 'Unable to connect to GTA World OAuth server';
        } else if (error.name === 'AbortError') {
            errorCode = 'deadline-exceeded';
            errorMessage = 'Request to GTA World OAuth server timed out after 15 seconds. Please try again.';
        } else if (error.message && error.message.includes('fetch')) {
            errorCode = 'unavailable';
            errorMessage = 'Network error connecting to GTA World servers';
        }
        
        throw new functions.https.HttpsError(errorCode, errorMessage, 
            process.env.NODE_ENV === 'development' ? error.message : undefined
        );
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
            setupInstructions: [
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
            setupInstructions: [
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
        const tokenHash = require('crypto').createHash('sha256').update(accessToken).digest('hex').substring(0, 16);
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
        const userResponse = await fetch('https://global.gta.world/api/user', {
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
 * BATCH CHECK: Check faction membership for multiple characters at once
 * This optimizes the OAuth flow by reducing 3+ individual calls to 1 batch call
 */
export const batchCheckFactionMembership = onCall({
    secrets: ["GTAWORLD_PERSISTENT_TOKEN"],
    cors: [
        'https://gtaw-forms.github.io',
        'https://phmc-tools.gta.world',
        'http://localhost:3000'
    ]
}, async (request) => {
    console.log('[Batch Faction Check] Starting batch faction membership check');
    
    const { characterIds, factionId = 364, accessToken, skipTokenValidation = false, useManagedToken = false } = request.data;
    
    if (!characterIds || !Array.isArray(characterIds) || characterIds.length === 0) {
        throw new functions.https.HttpsError('invalid-argument', 'Character IDs array is required');
    }
    
    if (characterIds.length > 10) {
        throw new functions.https.HttpsError('invalid-argument', 'Maximum 10 characters can be checked at once');
    }
    
    console.log(`[Batch Faction Check] Checking ${characterIds.length} characters:`, characterIds);
    
    // Use managed persistent token if requested
    let tokenToUse = accessToken;
    if (useManagedToken) {
        const persistentToken = process.env.GTAWORLD_PERSISTENT_TOKEN;
        if (persistentToken) {
            console.log('[Batch Faction Check] Using managed persistent token');
            tokenToUse = persistentToken;
        } else {
            console.warn('[Batch Faction Check] Managed token requested but GTAWORLD_PERSISTENT_TOKEN not configured');
            return {
                success: false,
                error: 'Managed token not configured',
                message: 'Please set GTAWORLD_PERSISTENT_TOKEN secret first. Call getTokenForSecrets to get your token.',
                setupRequired: true
            };
        }
    }
    
    // Optional: Validate the access token (same as individual check)
    if (accessToken && !skipTokenValidation) {
        try {
            console.log('[Batch Faction Check] Validating access token');
            const tokenValidation = await fetch('https://global.gta.world/api/user', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept': 'application/json',
                    'User-Agent': 'PHMC-Tools/1.0 (Firebase Functions)'
                }
            });
            
            if (!tokenValidation.ok) {
                console.log('[Batch Faction Check] Token validation failed:', tokenValidation.status);
                throw new functions.https.HttpsError('unauthenticated', 'Invalid or expired access token');
            }
            
            console.log('[Batch Faction Check] Token validated successfully');
        } catch (tokenError) {
            console.error('[Batch Faction Check] Token validation error:', tokenError);
            if (tokenError.code) {
                throw tokenError;
            }
            throw new functions.https.HttpsError('unauthenticated', 'Failed to validate access token');
        }
    }
    
    try {
        // Get faction metadata once for all characters
        const metadataRef = db.ref(`factions/${factionId}/metadata`);
        const metadataSnapshot = await metadataRef.once('value');
        const factionMetadata = metadataSnapshot.val() || {};
        
        // Batch lookup all characters at once using a single database query
        const factionMembersRef = db.ref(`factions/${factionId}/members`);
        const membersSnapshot = await factionMembersRef.once('value');
        const allMembers = membersSnapshot.val() || {};
        
        console.log(`[Batch Faction Check] Retrieved faction data, checking against ${Object.keys(allMembers).length} total members`);
        
        // Process each character
        const results = [];
        let highestRankMember = null;
        let highestScriptRank = -1;
        
        for (const characterId of characterIds) {
            const memberData = allMembers[characterId];
            
            if (!memberData) {
                console.log(`[Batch Faction Check] Character ${characterId} not found in faction`);
                results.push({
                    characterId: parseInt(characterId),
                    isMember: false,
                    character: null,
                    permissions: [],
                    accessLevel: 'none',
                    message: 'Character not found in faction database'
                });
                continue;
            }
            
            console.log(`[Batch Faction Check] Found faction member ${characterId}:`, {
                characterName: memberData.characterName,
                rank: memberData.rank,
                scriptRank: memberData.scriptRank
            });
            
            // Determine permissions based on script rank
            const permissions = getPermissionsForRank(memberData.scriptRank);
            const accessLevel = getAccessLevel(memberData.scriptRank);
            
            const memberResult = {
                characterId: memberData.characterId,
                isMember: true,
                character: {
                    characterId: memberData.characterId,
                    characterName: memberData.characterName,
                    rank: memberData.rank,
                    scriptRank: memberData.scriptRank,
                    factionId: memberData.factionId,
                    lastOnline: memberData.lastOnline,
                    activity: memberData.activity,
                    dataVersion: memberData.dataVersion
                },
                permissions,
                accessLevel,
                message: `Access granted - ${memberData.rank} (Rank ${memberData.scriptRank})`
            };
            
            results.push(memberResult);
            
            // Track highest ranking character
            if (memberData.scriptRank > highestScriptRank) {
                highestScriptRank = memberData.scriptRank;
                highestRankMember = memberResult;
            }
        }
        
        // Summary statistics
        const membersFound = results.filter(r => r.isMember).length;
        const membersNotFound = results.filter(r => !r.isMember).length;
        
        console.log(`[Batch Faction Check] Batch check complete:`, {
            totalCharacters: characterIds.length,
            membersFound,
            membersNotFound,
            highestRank: highestRankMember ? {
                name: highestRankMember.character.characterName,
                scriptRank: highestRankMember.character.scriptRank,
                rank: highestRankMember.character.rank
            } : null
        });
        
        return {
            success: true,
            results,
            summary: {
                totalCharacters: characterIds.length,
                membersFound,
                membersNotFound,
                highestRankingMember: highestRankMember,
                factionInfo: {
                    factionId,
                    lastUpdated: factionMetadata.lastUpdated,
                    memberCount: factionMetadata.statistics?.validRecords || 0
                }
            },
            timestamp: new Date().toISOString()
        };
        
    } catch (error) {
        console.error('[Batch Faction Check] Error in batch faction check:', error);
        
        throw new functions.https.HttpsError('internal', 'Failed to perform batch faction membership check', {
            originalError: error.message
        });
    }
});

/**
 * Check faction membership and permissions for authenticated user
 */
/**
 * Enhanced faction membership check with managed token support
 */
export const checkFactionMembership = onCall({
    secrets: ["GTAWORLD_PERSISTENT_TOKEN"],
    cors: [
        'https://gtaw-forms.github.io',
        'https://phmc-tools.gta.world',
        'http://localhost:3000'
    ]
}, async (request) => {
    console.log('[Faction Check] Starting faction membership check');
    
    const { characterId, factionId = 364, accessToken, skipTokenValidation = false, useManagedToken = false } = request.data; // Default to PHMC faction
    
    if (!characterId) {
        throw new functions.https.HttpsError('invalid-argument', 'Character ID is required');
    }
    
    // Use managed persistent token if requested
    let tokenToUse = accessToken;
    if (useManagedToken) {
        const persistentToken = process.env.GTAWORLD_PERSISTENT_TOKEN;
        if (persistentToken) {
            console.log('[Faction Check] Using managed persistent token');
            tokenToUse = persistentToken;
        } else {
            console.warn('[Faction Check] Managed token requested but GTAWORLD_PERSISTENT_TOKEN not configured');
            return {
                isMember: false,
                error: 'Managed token not configured',
                message: 'Please set GTAWORLD_PERSISTENT_TOKEN secret first. Call getTokenForSecrets to get your token.',
                setupRequired: true
            };
        }
    }
    
    // Note: Secrets configuration removed for initial deployment
    // After setting up GTAWORLD_PERSISTENT_TOKEN, you can add it back to the function config
    
    // Optional: Validate the access token to ensure user is authenticated
    if (accessToken && !skipTokenValidation) {
        try {
            console.log('[Faction Check] Validating access token');
            const tokenValidation = await fetch('https://global.gta.world/api/user', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept': 'application/json',
                    'User-Agent': 'PHMC-Tools/1.0 (Firebase Functions)'
                }
            });
            
            if (!tokenValidation.ok) {
                console.log('[Faction Check] Token validation failed:', tokenValidation.status);
                throw new functions.https.HttpsError('unauthenticated', 'Invalid or expired access token');
            }
            
            console.log('[Faction Check] Token validated successfully');
        } catch (tokenError) {
            console.error('[Faction Check] Token validation error:', tokenError);
            if (tokenError.code) {
                throw tokenError;
            }
            throw new functions.https.HttpsError('unauthenticated', 'Failed to validate access token');
        }
    }
    
    try {
        console.log('[Faction Check] Looking up character ID:', characterId, 'in faction:', factionId);
        
        // Look up the user in faction database
        const factionRef = db.ref(`factions/${factionId}/members/${characterId}`);
        const memberSnapshot = await factionRef.once('value');
        
        if (!memberSnapshot.exists()) {
            console.log('[Faction Check] Character not found in faction database');
            return {
                isMember: false,
                character: null,
                permissions: [],
                accessLevel: 'none',
                message: 'Character not found in faction database'
            };
        }
        
        const memberData = memberSnapshot.val();
        console.log('[Faction Check] Found faction member:', {
            characterId: memberData.characterId,
            characterName: memberData.characterName,
            rank: memberData.rank,
            scriptRank: memberData.scriptRank
        });
        
        // Determine permissions based on script rank
        const permissions = getPermissionsForRank(memberData.scriptRank);
        const accessLevel = getAccessLevel(memberData.scriptRank);
        
        // Get faction metadata
        const metadataRef = db.ref(`factions/${factionId}/metadata`);
        const metadataSnapshot = await metadataRef.once('value');
        const factionMetadata = metadataSnapshot.val() || {};
        
        const result = {
            isMember: true,
            character: {
                characterId: memberData.characterId,
                characterName: memberData.characterName,
                rank: memberData.rank,
                scriptRank: memberData.scriptRank,
                factionId: memberData.factionId,
                lastOnline: memberData.lastOnline,
                activity: memberData.activity,
                dataVersion: memberData.dataVersion
            },
            permissions,
            accessLevel,
            factionInfo: {
                factionId,
                lastUpdated: factionMetadata.lastUpdated,
                memberCount: factionMetadata.statistics?.validRecords || 0
            },
            message: `Access granted - ${memberData.rank} (Rank ${memberData.scriptRank})`
        };
        
        console.log('[Faction Check] Faction check complete:', {
            characterName: result.character.characterName,
            scriptRank: result.character.scriptRank,
            accessLevel: result.accessLevel,
            permissionCount: result.permissions.length
        });
        
        return result;
        
    } catch (error) {
        console.error('[Faction Check] Error checking faction membership:', error);
        
        throw new functions.https.HttpsError('internal', 'Failed to check faction membership', {
            originalError: error.message
        });
    }
});

/**
 * Helper function to get permissions based on script rank
 */
function getPermissionsForRank(scriptRank) {
    const permissionMap = {
        15: ['admin_full_access', 'upload_faction_data', 'manage_all_reports', 'view_all_members', 'configure_permissions', 'access_audit_logs', 'manage_webhooks', 'database_access'],
        14: ['admin_full_access', 'upload_faction_data', 'manage_department_reports', 'view_all_members', 'access_audit_logs', 'manage_webhooks'],
        13: ['admin_limited_access', 'manage_department_reports', 'view_department_members', 'create_reports', 'view_audit_logs'],
        12: ['admin_limited_access', 'manage_own_reports', 'view_department_members', 'create_reports'],
        11: ['view_own_reports', 'create_reports', 'view_team_members', 'manage_webhooks'],
        10: ['view_own_reports', 'create_basic_reports']
    };
    
    // Handle ranges for lower ranks
    if (scriptRank >= 7 && scriptRank <= 9) {
        return ['view_own_reports', 'create_basic_reports'];
    } else if (scriptRank >= 4 && scriptRank <= 6) {
        return ['view_own_reports'];
    } else if (scriptRank >= 1 && scriptRank <= 3) {
        return ['limited_access'];
    }
    
    return permissionMap[scriptRank] || [];
}

/**
 * Helper function to get access level based on script rank
 */
function getAccessLevel(scriptRank) {
    if (scriptRank >= 15) return 'leadership';
    if (scriptRank >= 14) return 'leadership';
    if (scriptRank >= 13) return 'senior_management';
    if (scriptRank >= 12) return 'middle_management';
    if (scriptRank >= 11) return 'supervisor';
    if (scriptRank >= 10) return 'attending';
    if (scriptRank >= 9) return 'resident';
    if (scriptRank >= 8) return 'upper_level';
    if (scriptRank >= 7) return 'mid_level';
    if (scriptRank >= 6) return 'administration';
    if (scriptRank >= 5) return 'entry_level';
    return 'none';
}