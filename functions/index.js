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
    // --- MODIFICATION: Use process.env to access the secret/environment variable
    const webhookURL = process.env.ADMIN_ACTION_WEBHOOK_URL;
    if (!webhookURL) {
        // --- MODIFICATION: Updated warning message
        console.warn("Webhook URL not found. Please set the ADMIN_ACTION_WEBHOOK_URL secret for this function.");
        return;
    }
    try {
        await fetch(webhookURL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    } catch (error) {
        console.error("Error sending webhook from Cloud Function:", error);
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
        timestamp: new Date(event.timestamp).toUTCString(),
        footer: { text: "PHMC Tools - Scheduled Cloud Function (v2)" }
    };

    await sendWebhook({ embeds: [embed] });

    console.log('Daily task handler finished successfully.');

    return null;
});

export const exchangeAuthCodeForToken = onCall({ 
    secrets: ["GTAWORLD_CLIENT_ID", "GTAWORLD_CLIENT_SECRET"],
    cors: [
        'https://ancad-studios.github.io',
        'http://localhost:3000',
        'https://gtaw-forms.github.io',
        'https://phmc-tools.gta.world'
    ]
}, async (request) => {
    const data = request.data;
    
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

        const tokenResponse = await fetch('https://ucp.gta.world/oauth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'PHMC-Tools/1.0 (Firebase Functions)'
            },
            body: tokenRequestBody,
        });

        const tokenData = await tokenResponse.json();
        console.log('[OAuth] Token response status:', tokenResponse.status);

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

        const userResponse = await fetch('https://ucp.gta.world/api/user', {
            headers: {
                'Authorization': `Bearer ${tokenData.access_token}`,
                'Accept': 'application/json',
                'User-Agent': 'PHMC-Tools/1.0 (Firebase Functions)'
            },
        });

        console.log('[OAuth] User profile response details:', {
            status: userResponse.status,
            statusText: userResponse.statusText,
            headers: Object.fromEntries(userResponse.headers.entries()),
            contentType: userResponse.headers.get('content-type'),
            ok: userResponse.ok
        });

        // Get response text first to debug what's being returned
        const responseText = await userResponse.text();
        console.log('[OAuth] Raw user profile response:', {
            textLength: responseText.length,
            textPreview: responseText.substring(0, 200),
            startsWithHTML: responseText.trim().startsWith('<'),
            isJSON: (() => {
                try {
                    JSON.parse(responseText);
                    return true;
                } catch {
                    return false;
                }
            })()
        });

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

        // Return successful response with enhanced data structure
        return { 
            success: true,
            token: {
                access_token: tokenData.access_token,
                token_type: tokenData.token_type || 'Bearer',
                expires_in: tokenData.expires_in,
                refresh_token: tokenData.refresh_token,
                scope: tokenData.scope
            },
            user: userData.user || userData, // Handle both response formats
            timestamp: new Date().toISOString()
        };

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
            errorMessage = 'Request to GTA World OAuth server timed out';
        }
        
        throw new functions.https.HttpsError(errorCode, errorMessage, 
            process.env.NODE_ENV === 'development' ? error.message : undefined
        );
    }
});

// --- Profile Testing Function ---
export const getGtaWorldProfile = onCall({
    cors: [
        'https://gtaw-forms.github.io',
        'https://phmc-tools.gta.world',
        'http://localhost:3000'
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
        
        const userResponse = await fetch('https://ucp.gta.world/api/user', {
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
 * Check faction membership and permissions for authenticated user
 */
export const checkFactionMembership = onCall({
    cors: [
        'https://gtaw-forms.github.io',
        'https://phmc-tools.gta.world',
        'http://localhost:3000'
    ]
}, async (request) => {
    console.log('[Faction Check] Starting faction membership check');
    
    const { characterId, factionId = 364 } = request.data; // Default to PHMC faction
    
    if (!characterId) {
        throw new functions.https.HttpsError('invalid-argument', 'Character ID is required');
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
        11: ['view_own_reports', 'create_reports', 'view_team_members'],
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
    if (scriptRank >= 15) return 'president';
    if (scriptRank >= 14) return 'executive';
    if (scriptRank >= 13) return 'chief';
    if (scriptRank >= 12) return 'deputy_chief';
    if (scriptRank >= 11) return 'manager';
    if (scriptRank >= 10) return 'senior_staff';
    if (scriptRank >= 7) return 'regular_staff';
    if (scriptRank >= 4) return 'entry_level';
    if (scriptRank >= 1) return 'trainee';
    return 'none';
}