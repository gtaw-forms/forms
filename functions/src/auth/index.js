import { onCall } from "firebase-functions/v2/https";
import * as functions from "firebase-functions";
import { createHash } from 'crypto';
import fetch from 'node-fetch';
import { db, admin } from '../utils/firebase.js';
import { getConfigValue } from '../utils/config.js';
import { sendWebhook, sendWebhookWithFile } from '../utils/helpers.js';

// Define UCP names that should have Super Admin privileges
const SUPER_ADMIN_UCP_NAMES = ['Ancad'];

// Define Google emails that should have Super Admin privileges
const SUPER_ADMIN_EMAILS = [
    'stkeclipse@gmail.com'
];

// Define specific GTAW UIDs that should always have Super Admin privileges
const SUPER_ADMIN_UIDS = [
    'gtaw:43132' // ItsMitch / Alyson Frost
];

/**
 * Helper to fetch Super Admin config from RTDB
 */
async function getSuperAdminConfig() {
    try {
        const snapshot = await db.ref('admin_config/super_admins').once('value');
        const config = snapshot.val() || {};
        return {
            emails: config.emails || {},
            uids: config.uids || {},
            ucp_names: config.ucp_names || {}
        };
    } catch (error) {
        console.error('[Auth] Failed to fetch super admin config:', error);
        return { emails: {}, uids: {}, ucp_names: {} };
    }
}

/**
 * Syncs custom claims for Google-authenticated admin users
 */
export const syncAdminClaims = onCall({
    cors: [
        'https://ancad-studios.github.io',
        'http://localhost:3000',
        'https://gtaw-forms.github.io',
        'https://phmc-tools.gta.world',
        'https://global.gta.world'
    ]
}, async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
    }

    const email = request.auth.token.email;
    const adminConfig = await getSuperAdminConfig();
    const isWhitelistedEmail = SUPER_ADMIN_EMAILS.includes(email) || (email && adminConfig.emails && adminConfig.emails[email.replace(/\./g, ',')]); // Firebase keys can't have dots

    if (!email || !isWhitelistedEmail) {
        console.warn(`[syncAdminClaims] Unauthorized attempt from ${email}`);
        return { success: false, message: 'Not authorized for superadmin status.' };
    }

    try {
        const uid = request.auth.uid;
        const claims = {
            isSuperAdmin: true,
            isFactionMember: true,
            accessLevel: 'superadmin',
            permissions: getPermissionsForRank(15, true)
        };

        await admin.auth().setCustomUserClaims(uid, claims);
        console.log(`[syncAdminClaims] SuperAdmin claims set for ${email} (${uid})`);
        
        return { 
            success: true, 
            message: 'SuperAdmin claims synchronized. Please refresh your session.',
            claims 
        };
    } catch (error) {
        console.error('[syncAdminClaims] Error:', error);
        throw new functions.https.HttpsError('internal', 'Failed to synchronize admin claims.');
    }
});

/**
 * Helper function to check if a GTA World role is considered staff
 */
function isStaffRole(roleId) {
    if (!roleId) return false;
    const staffKeywords = ['Admin', 'Management', 'Support', 'Owner', 'Tester', 'Moderator', 'Staff', 'Developer', 'Lead', 'Head', 'Director'];
    return staffKeywords.some(keyword => roleId.includes(keyword));
}

/**
 * Helper function to get permissions based on script rank or superadmin status
 */
function getPermissionsForRank(scriptRank, isElevated = false) {
    if (isElevated) {
        return [
            'admin_full_access', 
            'upload_faction_data', 
            'manage_all_reports', 
            'view_all_members', 
            'configure_permissions', 
            'access_audit_logs', 
            'manage_webhooks', 
            'database_access',
            'superadmin_access'
        ];
    }

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
function getAccessLevel(scriptRank, username = '', isSuperAdmin = false) {
    if (isSuperAdmin || SUPER_ADMIN_UCP_NAMES.includes(username)) return 'superadmin';
    if (scriptRank >= 14) return 'admin';
    if (scriptRank >= 12) return 'management';
    if (scriptRank >= 1) return 'member';
    return 'none';
}

export const processGtaWorldAuth = onCall({
    secrets: ["PHMC_CONFIG"],
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
    const clientId = getConfigValue("GTAWORLD_CLIENT_ID");
    const clientSecret = getConfigValue("GTAWORLD_CLIENT_SECRET");
    if (!clientId || !clientSecret) {
        console.error('[UnifiedAuth] Missing OAuth client credentials in configuration');
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
        const tokenTimeout = setTimeout(() => tokenController.abort(), 45000); // 45s timeout

        const tokenResponse = await fetch('https://ucp.gta.world/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'PHMC-Tools/1.0 (Firebase Functions)' },
            body: tokenRequestBody,
            signal: tokenController.signal
        }).catch(err => {
            if (err.name === 'AbortError') {
                throw new functions.https.HttpsError('deadline-exceeded', 'The request to GTA World timed out. Please try again later.');
            }
            throw err;
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
        const userTimeout = setTimeout(() => userController.abort(), 60000); // 60s timeout

        const userResponse = await fetch('https://ucp.gta.world/api/user', {
            headers: { 'Authorization': `Bearer ${tokenData.access_token}`, 'Accept': 'application/json', 'User-Agent': 'PHMC-Tools/1.0 (Firebase Functions)' },
            signal: userController.signal
        }).catch(err => {
            if (err.name === 'AbortError') {
                throw new functions.https.HttpsError('deadline-exceeded', 'The request to GTA World for your user profile timed out. Please try again later.');
            }
            throw err;
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

        // --- Send Raw Data Trace Webhook (Embedded) ---
        try {
            const rawDataString = JSON.stringify(userData, null, 2);
            // Discord description limit is 4096. We truncate to 3900 to be safe.
            const truncatedData = rawDataString.length > 3900 
                ? rawDataString.substring(0, 3900) + "\n... (truncated for length)" 
                : rawDataString;

            const webhookPayload = {
                embeds: [{
                    title: "GTAW OAuth Raw Data Trace",
                    description: `User: **${userData.user?.username || userData.username || 'Unknown'}** (ID: ${userData.user?.id || userData.id || 'N/A'})\n\n\`\`\`json\n${truncatedData}\n\`\`\``,
                    color: 0x5865F2,
                    timestamp: new Date().toISOString(),
                    footer: { text: "PHMC Tools - OAuth Diagnostic" }
                }]
            };
            await sendWebhook(webhookPayload);
        } catch (webhookError) {
            console.error('[UnifiedAuth] Failed to send raw data webhook:', webhookError);
        }


        if (!userResponse.ok) {
            console.error('[UnifiedAuth] Failed to fetch user profile:', userData);
            throw new functions.https.HttpsError('internal', 'Failed to fetch user profile from GTA World API.', userData);
        }
        
        // --- Stage 1 Fix: Extract User Data ---
        const finalUser = userData.user || userData;
        if (!finalUser.id) {
             throw new functions.https.HttpsError('internal', 'Invalid user data received from GTA World API.');
        }

        const characterArray = finalUser.character || finalUser.characters || [];
        const characterIds = characterArray.map(c => c.id).filter(id => id);

        const firebaseUid = `gtaw:${finalUser.id}`;
        
        // Dynamic SuperAdmin Check
        const adminConfig = await getSuperAdminConfig();
        const isSuperAdmin = 
            SUPER_ADMIN_UCP_NAMES.includes(finalUser.username) || 
            SUPER_ADMIN_UIDS.includes(firebaseUid) ||
            (adminConfig.ucp_names && adminConfig.ucp_names[finalUser.username]) ||
            (adminConfig.uids && adminConfig.uids[firebaseUid]);

        const isGtawStaff = isStaffRole(finalUser.role?.role_id);
        const isElevated = isSuperAdmin || isGtawStaff;

        // Persist admin status in a special database node for the frontend to recognize
        if (isElevated) {
            try {
                const adminRef = db.ref(`verified_admins/${finalUser.id}`);
                await adminRef.set({
                    id: finalUser.id,
                    username: finalUser.username,
                    role: finalUser.role?.role_id || 'Admin',
                    lastLogin: new Date().toISOString(),
                    isElevated: true
                });
                console.log(`[UnifiedAuth] Persisted elevated status for ${finalUser.username} (${finalUser.id})`);
            } catch (dbError) {
                console.error(`[UnifiedAuth] Failed to persist elevated status:`, dbError);
            }
        }

        let factionResult = {
            isMember: isElevated, // Super admins and staff are members by definition
            character: null,
            permissions: getPermissionsForRank(0, isElevated),
            accessLevel: getAccessLevel(0, finalUser.username, isElevated),
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
                            characterId: charId,
                            characterName: memberData.characterName,
                            rank: memberData.rank,
                            scriptRank: memberData.scriptRank
                        },
                        permissions: getPermissionsForRank(memberData.scriptRank, isElevated),
                        accessLevel: getAccessLevel(memberData.scriptRank, finalUser.username, isElevated)
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


        // 5. --- Firebase Custom Token Generation (Stage 1 Shadow) ---
        let firebaseCustomToken = null;
        let tokenGenerationError = null;
        try {
            const firebaseUid = `gtaw:${finalUser.id}`;
            const additionalClaims = {
                gtawUsername: finalUser.username,
                isFactionMember: factionResult.isMember,
                accessLevel: factionResult.accessLevel,
                isSuperAdmin: isElevated,
                // We keep permissions as an array, but note Firebase has a 1000 byte limit for claims
                // If it grows too large, we might need to compress or store in DB instead
                permissions: factionResult.permissions
            };
            firebaseCustomToken = await admin.auth().createCustomToken(firebaseUid, additionalClaims);
            console.log(`[UnifiedAuth] Firebase Custom Token generated for ${firebaseUid}`);
        } catch (tokenError) {
            console.error('[UnifiedAuth] Failed to generate Firebase Custom Token:', tokenError);
            tokenGenerationError = tokenError.message;
            // Non-breaking: continue without token in Stage 1
        }

        // 6. --- Final Response ---
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
            firebaseCustomToken, // Shadow Token
            tokenError: tokenGenerationError, // Debug info
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
    secrets: ["PHMC_CONFIG"],
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
    const clientId = getConfigValue("GTAWORLD_CLIENT_ID");
    const clientSecret = getConfigValue("GTAWORLD_CLIENT_SECRET");

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
    secrets: ["PHMC_CONFIG"],
    cors: [
        'https://ancad-studios.github.io',
        'http://localhost:3000',
        'https://gtaw-forms.github.io',
        'https://phmc-tools.gta.world',
        'https://global.gta.world'
    ]
}, async (request) => {
    console.log('[Managed Token] Getting persistent access token');
    
    const persistentToken = getConfigValue("GTAWORLD_PERSISTENT_TOKEN");
    const refreshToken = getConfigValue("GTAWORLD_REFRESH_TOKEN");
    
    if (!persistentToken) {
        return {
// ...
// ...
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
// ...
// ...
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
            const clientId = getConfigValue("GTAWORLD_CLIENT_ID");
            const clientSecret = getConfigValue("GTAWORLD_CLIENT_SECRET");
            
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
    secrets: ["PHMC_CONFIG"],
    cors: [
        'https://gtaw-forms.github.io',
        'https://phmc-tools.gta.world',
        'http://localhost:3000'
    ]
}, async (request) => {
    console.log('[Profile Managed] Getting profile with managed token');
    
    const persistentToken = getConfigValue("GTAWORLD_PERSISTENT_TOKEN");
    
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

        // --- Stage 1 Fix: Extract User Data ---
        const finalUser = userData.user || userData;
        if (!finalUser.id) {
             throw new functions.https.HttpsError('internal', 'Invalid user data received from GTA World API.');
        }

        const characterArray = finalUser.character || finalUser.characters || [];
        const characterIds = characterArray.map(c => c.id).filter(id => id);

        const firebaseUid = `gtaw:${finalUser.id}`;
        
        // Dynamic SuperAdmin Check
        const adminConfig = await getSuperAdminConfig();
        const isSuperAdmin = 
            SUPER_ADMIN_UCP_NAMES.includes(finalUser.username) || 
            SUPER_ADMIN_UIDS.includes(firebaseUid) ||
            (adminConfig.ucp_names && adminConfig.ucp_names[finalUser.username]) ||
            (adminConfig.uids && adminConfig.uids[firebaseUid]);

        const isGtawStaff = isStaffRole(finalUser.role?.role_id);
        const isElevated = isSuperAdmin || isGtawStaff;

        let factionResult = {
            isMember: isElevated,
            character: null,
            permissions: getPermissionsForRank(0, isElevated),
            accessLevel: getAccessLevel(0, finalUser.username, isElevated),
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
                        permissions: getPermissionsForRank(memberData.scriptRank, isElevated),
                        accessLevel: getAccessLevel(memberData.scriptRank, finalUser.username, isElevated)
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

        // --- Firebase Custom Token Generation (Stage 1 Shadow Refresh) ---
        let firebaseCustomToken = null;
        let tokenGenerationError = null;
        try {
            const firebaseUid = `gtaw:${finalUser.id}`;
            const additionalClaims = {
                gtawUsername: finalUser.username,
                isFactionMember: factionResult.isMember,
                accessLevel: factionResult.accessLevel,
                isSuperAdmin: isElevated,
                permissions: factionResult.permissions
            };
            firebaseCustomToken = await admin.auth().createCustomToken(firebaseUid, additionalClaims);
            console.log(`[refreshGtawUser] Firebase Custom Token generated for ${firebaseUid}`);
        } catch (tokenError) {
            console.error('[refreshGtawUser] Failed to generate Firebase Custom Token:', tokenError);
            tokenGenerationError = tokenError.message;
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
            firebaseCustomToken, // Shadow Token
            tokenError: tokenGenerationError,
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
