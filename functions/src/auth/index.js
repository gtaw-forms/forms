import { onCall } from "firebase-functions/v2/https";
import * as functions from "firebase-functions";
import { db, auth } from '../utils/firebase.js';
import { getConfigValue, getConfig } from '../utils/config.js';
import { sendWebhook } from '../utils/helpers.js';

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

// A list of exact role names that are considered staff.
const STAFF_ROLES = [
    'Developer',
    'Admin',
    'Administrator',
    'Head Admin',
    'Senior Admin',
    'Trial Admin',
    'Moderator',
    'Head Moderator',
    'Senior Moderator',
    'Trial Moderator',
    'Game Tester',
    'Support Staff',
    'Community Manager',
    'Project Manager',
    'Owner'
];

/**
 * Helper function to check if a GTA World role is considered staff
 */
function isStaffRole(roleId) {
    if (!roleId) return false;
    
    // Check for an exact match in the predefined list
    if (STAFF_ROLES.includes(roleId)) {
        return true;
    }

    // Also, check for the "Admin Level X" pattern
    if (roleId.startsWith('Admin Level ')) {
        return true;
    }

    return false;
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
    if (isSuperAdmin) return 'superadmin';
    if (scriptRank >= 14) return 'admin';
    if (scriptRank >= 12) return 'management';
    if (scriptRank >= 1) return 'member';
    return 'none';
}

export const processGtaWorldAuth = onCall({
    region: "europe-west2",
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
        console.error('[UnifiedAuth] Missing OAuth client credentials in configuration', {
            hasClientId: !!clientId,
            hasClientSecret: !!clientSecret,
            configKeys: Object.keys(getConfig())
        });
        throw new functions.https.HttpsError('internal', `Server OAuth misconfiguration: ${!clientId ? 'GTAWORLD_CLIENT_ID' : 'GTAWORLD_CLIENT_SECRET'} is missing from PHMC_CONFIG.`);
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
            console.error('[UnifiedAuth] Token exchange failed:', {
                status: tokenResponse.status,
                statusText: tokenResponse.statusText,
                body: tokenData
            });
            const hint = tokenData.hint || '';
            const userMessage = hint.includes('expired')
                ? 'Your login attempt has expired. Please try logging in again.'
                : `GTA World OAuth token exchange failed (HTTP ${tokenResponse.status}). ${hint || tokenData.error_description || ''}`.trim();
            throw new functions.https.HttpsError('invalid-argument', userMessage, tokenData);
        }
        if (!tokenData.access_token) {
            const knownKeys = Object.keys(tokenData);
            console.error('[UnifiedAuth] Token response missing access_token. Keys received:', knownKeys);
            throw new functions.https.HttpsError('internal', `GTA World OAuth returned no access_token. Available fields: ${knownKeys.join(', ')}`);
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
            console.error('[UnifiedAuth] Failed to parse user profile JSON (first 500 chars):', userResponseText.substring(0, 500));
            throw new functions.https.HttpsError('internal', 'Failed to parse user profile from GTA World API: invalid JSON response.');
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
            console.error('[UnifiedAuth] Failed to fetch user profile:', {
                status: userResponse.status,
                statusText: userResponse.statusText,
                body: userData
            });
            throw new functions.https.HttpsError('internal', `GTA World API user profile request failed (HTTP ${userResponse.status}): ${userResponse.statusText}`, userData);
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
                    // If user is elevated, ensure they get full permissions regardless of character's rank
                    permissions: isElevated ? getPermissionsForRank(0, true) : highestRankMember.permissions,
                    accessLevel: isElevated ? getAccessLevel(0, finalUser.username, isSuperAdmin) : highestRankMember.accessLevel,
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
            firebaseCustomToken = await auth.createCustomToken(firebaseUid, additionalClaims);
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
        console.error(`[UnifiedAuth] Error after ${processingTime}ms:`, {
            name: error.name,
            message: error.message,
            stack: error.stack?.split('\n').slice(0, 3).join('\n'),
            code: error.code,
            status: error.status
        });
        if (error instanceof functions.https.HttpsError) {
            throw error;
        } else if (error.name === 'AbortError') {
            throw new functions.https.HttpsError('deadline-exceeded', 'Request to GTA World timed out. Please try again.');
        } else {
            throw new functions.https.HttpsError('internal', `Unexpected auth error: ${error.message}`, { originalError: error.message });
        }
    }
});



/**
 * Helper function to get access token for Firebase Secrets setup
 * This function performs OAuth and clearly logs the token for easy copying
 */
export const getTokenForSecrets = onCall({
    region: "europe-west2",
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





/**
 * Validate an existing access token and return user data if valid
 */
export const validateGtaWorldToken = onCall({
    region: "europe-west2",
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
        
        const userResponse = await fetch('https://ucp.gta.world/api/user', {
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
 * Refreshes a user's GTAW data, including faction membership and permissions,
 * using their existing access token.
 */
export const refreshGtawUser = onCall({
    region: "europe-west2",
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
            const respText = await userResponse.text().catch(() => 'N/A');
            console.error('[refreshGtawUser] User profile fetch failed:', { status: userResponse.status, body: respText.substring(0, 500) });
            throw new functions.https.HttpsError('internal', `GTA World API user profile fetch failed (HTTP ${userResponse.status})`);
        }
        
        const responseText = await userResponse.text();
        let userData;
        try {
            userData = JSON.parse(responseText);
        } catch (e) {
            console.error('[refreshGtawUser] Failed to parse user profile JSON (first 500 bytes):', responseText.substring(0, 500));
            throw new functions.https.HttpsError('internal', 'GTA World API returned invalid JSON for user profile.');
        }

        const finalUser = userData.user || userData;
        if (!finalUser.id) {
            console.error('[refreshGtawUser] User profile missing ID. Keys:', Object.keys(finalUser));
            throw new functions.https.HttpsError('internal', `GTA World API returned user data without an ID. Keys: ${Object.keys(finalUser).join(', ')}`);
        }

        const characterArray = finalUser.character || finalUser.characters || [];
        const characterIds = characterArray.map(c => c.id).filter(id => id);

        const firebaseUid = `gtaw:${finalUser.id}`;
        
        // Dynamic SuperAdmin Check
        const adminConfig = await getSuperAdminConfig();
        const isSuperAdmin = 
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
            const factionId = 364;
            const membersRef = db.ref(`factions/${factionId}/members`);
            const membersSnapshot = await membersRef.once('value');
            const allMembers = membersSnapshot.val() || {};

            const factionMembers = [];
            for (const charId of characterIds) {
                if (allMembers[charId]) {
                    const memberData = allMembers[charId];
                    factionMembers.push({
                        character: {
                            // Use the roster record KEY as the character ID. The member
                            // records in factions/364/members do not store characterId as a
                            // field — it IS the key (written by factionSync as acc[charId]).
                            // Reading memberData.characterId produced `undefined` here,
                            // which made the client fall back to the UCP account id for
                            // gtawCharacterId and wiped the badge on every refresh.
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
            firebaseCustomToken = await auth.createCustomToken(firebaseUid, additionalClaims);
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

/**
 * Check if any of the given character IDs are members of the PHMC faction
 * Used by frontend to validate faction membership on session restore
 */
export const checkFactionMembership = onCall({
    region: "europe-west2",
    cors: [
        'https://gtaw-forms.github.io',
        'https://phmc-tools.gta.world',
        'http://localhost:3000'
    ]
}, async (request) => {
    const { characterIds } = request.data;
    
    if (!characterIds || !Array.isArray(characterIds) || characterIds.length === 0) {
        throw new functions.https.HttpsError('invalid-argument', 'characterIds array is required');
    }
    
    try {
        const factionId = 364; // PHMC Faction ID
        const membersRef = db.ref(`factions/${factionId}/members`);
        const membersSnapshot = await membersRef.once('value');
        
        if (!membersSnapshot.exists()) {
            console.log('[checkFactionMembership] No members found in faction DB');
            return { isMember: false, checkedIds: characterIds };
        }
        
        const allMembers = membersSnapshot.val() || {};
        
        // Check if any of the provided character IDs exist in the faction
        const normalizedIds = characterIds.map(id => String(id));
        const memberIds = Object.keys(allMembers).map(id => String(id));
        
        const matchedIds = normalizedIds.filter(id => memberIds.includes(id));
        const isMember = matchedIds.length > 0;
        
        console.log(`[checkFactionMembership] Checked ${characterIds.length} IDs, found ${matchedIds.length} matches`);
        
        return {
            isMember,
            checkedIds: characterIds,
            matchedIds,
            timestamp: new Date().toISOString()
        };
        
    } catch (error) {
        console.error('[checkFactionMembership] Error:', error);
        throw new functions.https.HttpsError('internal', 'Failed to check faction membership', {
            originalError: error.message
        });
    }
});

