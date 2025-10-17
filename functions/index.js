import { onSchedule } from "firebase-functions/v2/scheduler";
import { setGlobalOptions } from "firebase-functions/v2";
import admin from "firebase-admin";
import fetch from "node-fetch";
import { onCall } from "firebase-functions/v2/https";

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

import { onRequest } from "firebase-functions/v2/https";

export const exchangeAuthCodeForToken = onRequest({ 
    secrets: ["GTAWORLD_CLIENT_ID", "GTAWORLD_CLIENT_SECRET"],
    cors: {
        origin: [
            'https://ancad-studios.github.io',
            'http://localhost:3000',
            'https://gtaw-forms.github.io',
            'https://phmc-tools.gta.world'
        ],
        methods: ['POST', 'OPTIONS']
    }
}, async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'method-not-allowed', message: 'Only POST requests are allowed' });
        return;
    }

    // Handle data from both httpsCallable (req.body.data) and direct fetch (req.body)
    const data = req.body.data || req.body;
    
    console.log('[OAuth] Received token exchange request');
    console.log('[OAuth] Request method:', req.method);
    console.log('[OAuth] Request origin:', req.get('origin'));
    console.log('[OAuth] Has code:', !!data?.code);
    console.log('[OAuth] Has redirectUri:', !!data?.redirectUri);
    
    const { code, redirectUri, clientId: providedClientId } = data || {};
    const clientId = process.env.GTAWORLD_CLIENT_ID;
    const clientSecret = process.env.GTAWORLD_CLIENT_SECRET;

    // Validate that the provided clientId matches the configured one (security check)
    if (providedClientId && providedClientId !== clientId) {
        console.error('[OAuth] Client ID mismatch');
        res.status(400).json({ 
            error: 'invalid-client', 
            message: 'Invalid client ID provided' 
        });
        return;
    }

    // Validate required arguments
    if (!code) {
        console.error('[OAuth] Missing authorization code parameter');
        res.status(400).json({ 
            error: 'invalid-argument', 
            message: 'Authorization code is required' 
        });
        return;
    }

    if (!redirectUri) {
        console.error('[OAuth] Missing redirectUri parameter');
        res.status(400).json({ 
            error: 'invalid-argument', 
            message: 'Redirect URI is required and must match the registered URI' 
        });
        return;
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
        res.status(400).json({ 
            error: 'invalid-redirect-uri', 
            message: 'Redirect URI is not allowed' 
        });
        return;
    }

    if (!clientId || !clientSecret) {
        console.error('[OAuth] Missing OAuth client credentials in environment');
        res.status(500).json({ 
            error: 'internal', 
            message: 'OAuth client credentials not configured properly' 
        });
        return;
    }

    try {
        console.log('[OAuth] Starting token exchange with GTA World');
        
        // Exchange auth code for access token
        const tokenResponse = await fetch('https://ucp.gta.world/oauth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'PHMC-Tools/1.0 (Firebase Functions)'
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirectUri,
                code: code,
            }),
        });

        const tokenData = await tokenResponse.json();
        console.log('[OAuth] Token response status:', tokenResponse.status);

        if (!tokenResponse.ok) {
            console.error('[OAuth] Token exchange failed:', tokenData);
            res.status(400).json({ 
                error: 'token-exchange-failed', 
                message: 'Failed to exchange authorization code for access token',
                details: tokenData 
            });
            return;
        }

        // Validate token response structure
        if (!tokenData.access_token) {
            console.error('[OAuth] Invalid token response - missing access_token');
            res.status(500).json({ 
                error: 'invalid-token-response', 
                message: 'Invalid response from GTA World OAuth server' 
            });
            return;
        }

        console.log('[OAuth] Token exchange successful, fetching user profile');

        // Fetch user profile with enhanced error handling
        const userResponse = await fetch('https://ucp.gta.world/api/v1/user', {
            headers: {
                'Authorization': `Bearer ${tokenData.access_token}`,
                'Accept': 'application/json',
                'User-Agent': 'PHMC-Tools/1.0 (Firebase Functions)'
            },
        });

        const userData = await userResponse.json();
        console.log('[OAuth] User profile response status:', userResponse.status);

        if (!userResponse.ok) {
            console.error('[OAuth] Failed to fetch user profile:', userData);
            res.status(400).json({ 
                error: 'user-profile-failed', 
                message: 'Failed to fetch user profile from GTA World API',
                details: userData 
            });
            return;
        }

        // Validate user data structure
        if (!userData.user && !userData.id && !userData.username) {
            console.error('[OAuth] Invalid user response structure:', userData);
            res.status(500).json({ 
                error: 'invalid-user-response', 
                message: 'Invalid user data received from GTA World API' 
            });
            return;
        }

        console.log('[OAuth] Authentication successful for user:', userData.user?.username || userData.username);

        // Return successful response with enhanced data structure
        res.status(200).json({ 
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
        });

    } catch (error) {
        console.error('[OAuth] Unexpected error during token exchange:', error);
        console.error('[OAuth] Error stack:', error.stack);
        
        // Determine error type for better client-side handling
        let errorType = 'internal';
        let errorMessage = 'An internal error occurred during authentication';
        
        if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
            errorType = 'network-error';
            errorMessage = 'Unable to connect to GTA World OAuth server';
        } else if (error.name === 'AbortError') {
            errorType = 'timeout';
            errorMessage = 'Request to GTA World OAuth server timed out';
        }
        
        res.status(500).json({ 
            error: errorType,
            message: errorMessage,
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});