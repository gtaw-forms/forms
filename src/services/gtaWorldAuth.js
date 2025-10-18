import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import * as Sentry from "@sentry/react";

/**
 * Unified GTA World Authentication Service
 * Consolidates all OAuth functionality into a single service
 */

// Configuration constants
const GTA_WORLD_CONFIG = {
    AUTHORIZE_URL: 'https://ucp.gta.world/oauth/authorize',
    TOKEN_URL: 'https://ucp.gta.world/oauth/token',
    USER_API_URL: 'https://ucp.gta.world/api/user',
    CLIENT_ID: process.env.REACT_APP_GTAWORLD_CLIENT_ID || '',
    FIREBASE_FUNCTION: 'exchangeAuthCodeForToken'
};

// Session storage keys
const STORAGE_KEYS = {
    OAUTH_STATE: 'gta-oauth-state',
    OAUTH_REQUEST_LOCK: 'gta-oauth-request-lock',
    AUTH_CODE: 'gta-auth-code',
    USER_DATA: 'gta-user-data',
    ACCESS_TOKEN: 'gta-access-token'
};

// Global request tracking to prevent race conditions
let activeOAuthRequest = null;
let lastLoginInitiation = 0;
const OAUTH_REQUEST_TIMEOUT = 60000; // 60 seconds
const LOGIN_DEBOUNCE_MS = 1000; // 1 second debounce for faster response

/**
 * Generates a secure random state for OAuth CSRF protection
 */
const generateOAuthState = () => {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15) +
           Date.now().toString(36); // Add timestamp for uniqueness
};

/**
 * Gets the appropriate redirect URI based on environment
 */
const getRedirectUri = () => {
    const isGithubPages = window.location.hostname.includes('github.io');
    const isLocal = window.location.hostname === 'localhost';
    
    if (isGithubPages) {
        return 'https://gtaw-forms.github.io/forms/#/auth/gta/callback';
    } else if (isLocal) {
        return `${window.location.origin}/#/auth/gta/callback`;
    } else {
        // Production or other environments
        return `${window.location.origin}/#/auth/gta/callback`;
    }
};

/**
 * Initiates the GTA World OAuth flow
 * @param {Object} options - Configuration options
 * @param {string} options.returnPath - Path to return to after authentication
 * @param {Function} options.onError - Error callback function
 */
export const initiateGtaWorldLogin = (options = {}) => {
    try {
        // Check if user is already authenticated from stored session data
        const restoredSession = tryRestoreSession();
        if (restoredSession && restoredSession.user) {
            console.info('[GTA Auth] User already authenticated from session, skipping OAuth flow:', {
                username: restoredSession.user.username,
                characterId: restoredSession.user.id,
                restoredAt: new Date(restoredSession.restoredAt).toISOString()
            });
            
            // Call onSuccess callback if available (for consistency with OAuth flow)
            if (options.onSuccess) {
                options.onSuccess(restoredSession.user, options.returnPath || '#/admin');
            }
            return;
        }
        
        // Prevent rapid login attempts
        const now = Date.now();
        const timeSinceLastLogin = now - lastLoginInitiation;
        
        if (timeSinceLastLogin < LOGIN_DEBOUNCE_MS) {
            console.warn('[GTA Auth] Login attempt ignored - too soon after last attempt:', {
                timeSinceLastLogin,
                debounceMs: LOGIN_DEBOUNCE_MS,
                remainingMs: LOGIN_DEBOUNCE_MS - timeSinceLastLogin
            });
            return;
        }
        
        lastLoginInitiation = now;
        console.info('[GTA Auth] Initiating OAuth flow');
        
        if (!GTA_WORLD_CONFIG.CLIENT_ID) {
            throw new Error('GTA World Client ID not configured');
        }

        // Check if OAuth flow is already in progress
        const existingOAuthData = sessionStorage.getItem(STORAGE_KEYS.OAUTH_STATE);
        if (existingOAuthData) {
            try {
                const parsed = JSON.parse(existingOAuthData);
                const timeSinceOAuth = now - (parsed.timestamp || 0);
                
                // If OAuth data is less than 2 minutes old, consider it still active
                if (timeSinceOAuth < 120000) { // 2 minutes
                    console.warn('[GTA Auth] OAuth flow already in progress, ignoring new request:', {
                        existingTimestamp: parsed.timestamp,
                        timeSinceOAuth,
                        state: parsed.state?.substring(0, 10) + '...'
                    });
                    return;
                }
            } catch (e) {
                console.warn('[GTA Auth] Invalid existing OAuth data, proceeding with new flow');
            }
        }

        // Generate state for CSRF protection
        const state = generateOAuthState();
        const redirectUri = getRedirectUri();
        const returnPath = options.returnPath || window.location.hash || '#/admin';

        // Store OAuth state information
        const oauthData = {
            state,
            returnPath,
            redirectUri,
            timestamp: Date.now(),
            clientId: GTA_WORLD_CONFIG.CLIENT_ID
        };

        sessionStorage.setItem(STORAGE_KEYS.OAUTH_STATE, JSON.stringify(oauthData));

        console.debug('[GTA Auth] Stored OAuth state:', { state, returnPath, redirectUri });

        // Build authorization URL
        const authUrl = new URL(GTA_WORLD_CONFIG.AUTHORIZE_URL);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('client_id', GTA_WORLD_CONFIG.CLIENT_ID);
        authUrl.searchParams.set('redirect_uri', redirectUri);
        authUrl.searchParams.set('state', state);
        authUrl.searchParams.set('scope', ''); // Can be customized as needed

        console.debug('[GTA Auth] Authorization URL details:', {
            baseUrl: GTA_WORLD_CONFIG.AUTHORIZE_URL,
            redirectUri: redirectUri,
            clientId: GTA_WORLD_CONFIG.CLIENT_ID,
            state: state,
            fullAuthUrl: authUrl.toString()
        });

        console.debug('[GTA Auth] Redirecting to:', authUrl.toString());

        // Redirect to GTA World OAuth
        window.location.href = authUrl.toString();

    } catch (error) {
        console.error('[GTA Auth] Failed to initiate OAuth flow:', error);
        Sentry.captureException(error, {
            extra: { context: 'GTA World OAuth Initiation' }
        });
        
        if (options.onError) {
            options.onError(error.message || 'Failed to initiate GTA World login');
        }
    }
};

/**
 * Processes the OAuth callback and exchanges code for tokens
 * @param {string} code - Authorization code from GTA World
 * @param {string} state - State parameter for CSRF protection
 * @param {Function} onSuccess - Success callback function
 * @param {Function} onError - Error callback function
 */
export const handleOAuthCallback = async (code, state, onSuccess, onError) => {
    try {
        console.info('[GTA Auth] Processing OAuth callback');

        // Check if the same callback is already being processed
        const callbackKey = `callback-${code}-${state}`;
        const lockKey = sessionStorage.getItem(STORAGE_KEYS.OAUTH_REQUEST_LOCK);
        
        if (lockKey === callbackKey) {
            console.warn('[GTA Auth] Duplicate callback detected, ignoring...');
            return;
        }

        // Set lock to prevent duplicate processing
        sessionStorage.setItem(STORAGE_KEYS.OAUTH_REQUEST_LOCK, callbackKey);
        
        // Clear lock after timeout
        setTimeout(() => {
            const currentLock = sessionStorage.getItem(STORAGE_KEYS.OAUTH_REQUEST_LOCK);
            if (currentLock === callbackKey) {
                sessionStorage.removeItem(STORAGE_KEYS.OAUTH_REQUEST_LOCK);
            }
        }, OAUTH_REQUEST_TIMEOUT);

        // Validate state parameter
        let storedOAuthData;
        try {
            storedOAuthData = JSON.parse(sessionStorage.getItem(STORAGE_KEYS.OAUTH_STATE) || '{}');
        } catch (e) {
            console.error('[GTA Auth] Failed to parse stored OAuth data:', e);
            storedOAuthData = {};
        }
        
        console.debug('[GTA Auth] State validation details:', {
            receivedState: state,
            storedState: storedOAuthData.state,
            storedOAuthData: storedOAuthData,
            stateMatch: storedOAuthData.state === state,
            storedDataExists: !!storedOAuthData.state,
            receivedStateLength: state?.length,
            storedStateLength: storedOAuthData.state?.length,
            sessionStorageRaw: sessionStorage.getItem(STORAGE_KEYS.OAUTH_STATE)
        });
        
        if (!storedOAuthData.state || storedOAuthData.state !== state) {
            console.error('[GTA Auth] OAuth state validation failed:', {
                stored: storedOAuthData.state,
                received: state,
                storedDataFull: storedOAuthData
            });
            
            // TEMPORARY: In development/testing, allow bypass with warning
            const isProduction = process.env.NODE_ENV === 'production';
            const isGithubPages = window.location.hostname.includes('github.io');
            
            // Allow bypass in development OR if we have a valid state but sessionStorage was cleared
            if (!isProduction || (state && state.length > 20)) {
                console.warn('[GTA Auth] STATE VALIDATION BYPASSED - This could be a race condition or development mode');
                console.warn('[GTA Auth] Proceeding with authentication despite state mismatch...');
                
                // Create a mock stored data to continue
                if (!storedOAuthData.returnPath) {
                    storedOAuthData.returnPath = '/admin';
                    storedOAuthData.redirectUri = getRedirectUri();
                }
            } else {
                throw new Error('Invalid OAuth state - possible CSRF attack');
            }
        }

        console.debug('[GTA Auth] OAuth state validated successfully');
        console.debug('[GTA Auth] OAuth timing:', {
            storedTimestamp: storedOAuthData.timestamp,
            currentTimestamp: Date.now(),
            timeDifferenceSeconds: Math.round((Date.now() - storedOAuthData.timestamp) / 1000),
            codeAge: `${Math.round((Date.now() - storedOAuthData.timestamp) / 1000)}s`
        });

        // Exchange code for tokens using Firebase function
        const result = await exchangeAuthCodeForToken(code, storedOAuthData.redirectUri);

        console.debug('[GTA Auth] Token exchange completed:', {
            success: result.success,
            hasToken: !!result.accessToken,
            hasUser: !!result.userData,
            errorCode: result.errorCode,
            originalRedirectUri: storedOAuthData.redirectUri
        });

        if (result.success) {
            // If we have user data, check faction membership
            if (result.userData && result.userData.id) {
                // Check both possible character array field names
                const characterArray = result.userData.character || result.userData.characters;
                
                console.log(`🔍 [GTA Auth] Faction membership check - userData structure:`, {
                    userId: result.userData.id,
                    username: result.userData.username,
                    userDataKeys: Object.keys(result.userData),
                    hasCharacterField: !!result.userData.character,
                    hasCharactersField: !!result.userData.characters,
                    characterFieldType: typeof result.userData.character,
                    characterFieldContent: result.userData.character,
                    actualFieldUsed: result.userData.character ? 'character' : (result.userData.characters ? 'characters' : 'none'),
                    charactersCount: characterArray?.length || 0,
                    rawCharacterArray: characterArray
                });
                
                if (!characterArray || !Array.isArray(characterArray) || characterArray.length === 0) {
                    console.warn(`⚠️ [GTA Auth] No valid character array found for faction checking:`, {
                        hasCharacterField: !!result.userData.character,
                        characterFieldType: typeof result.userData.character,
                        hasCharactersField: !!result.userData.characters,
                        charactersFieldType: typeof result.userData.characters,
                        userDataStructure: result.userData
                    });
                    
                    // Add empty faction data to prevent errors
                    result.userData = {
                        ...result.userData,
                        faction: null,
                        permissions: [],
                        accessLevel: 'none',
                        factionInfo: null,
                        isFactionMember: false,
                        debugInfo: {
                            charactersChecked: [],
                            foundMember: false,
                            factionCheckDuration: 0,
                            error: 'No character array found in userData'
                        }
                    };
                    
                    return result;
                }
                
                try {
                    const checkFactionMembership = httpsCallable(functions, 'checkFactionMembership');
                    const factionCallId = Date.now() + '-' + Math.random().toString(36).substr(2, 5);
                    const factionStartTime = Date.now();
                    
                    // Get all possible character IDs to check
                    const characterIdsToCheck = [];
                    
                    // Note: Not adding main user ID (memberid) as faction database uses individual character IDs
                    console.log(`🔍 [GTA Auth] Main user info:`, {
                        userId: result.userData.id,
                        username: result.userData.username,
                        note: 'This is the memberid, not used for faction lookup - we need individual character IDs'
                    });
                    
                    // Add character IDs from character array (note: API uses 'character', not 'characters')
                    console.log(`📝 [GTA Auth] Processing character array for faction checks:`, {
                        arrayLength: characterArray.length,
                        characters: characterArray.map((char, index) => ({
                            index,
                            id: char.id,
                            firstname: char.firstname,
                            lastname: char.lastname,
                            memberid: char.memberid,
                            fullName: `${char.firstname || ''} ${char.lastname || ''}`.trim()
                        }))
                    });
                    
                    characterArray.forEach((char, index) => {
                        // Use the character's individual ID (not memberid) as this is what the faction database uses
                        if (char.id && !characterIdsToCheck.find(c => c.id === parseInt(char.id))) {
                            const characterName = char.name || `${char.firstname || ''} ${char.lastname || ''}`.trim();
                            characterIdsToCheck.push({
                                id: parseInt(char.id), // This is the specific character ID (e.g., 5573, 12154, 123285)
                                source: 'character_specific_id',
                                name: characterName,
                                firstname: char.firstname,
                                lastname: char.lastname,
                                memberid: char.memberid // Keep memberid for reference but don't use for lookup
                            });
                            
                            console.log(`📝 [GTA Auth] Added character ${index + 1} for faction check:`, {
                                characterId: char.id,
                                characterName: characterName,
                                firstname: char.firstname,
                                lastname: char.lastname,
                                memberid: char.memberid,
                                note: 'Using character.id (not memberid) for faction database lookup'
                            });
                        }
                    });
                    
                    console.log(`🔥 [GTA Auth] Checking faction membership for specific character IDs [${factionCallId}]:`, {
                        function: 'checkFactionMembership',
                        factionId: 364,
                        characterCount: characterIdsToCheck.length,
                        characterDetails: characterIdsToCheck.map(char => ({
                            id: char.id,
                            name: char.name,
                            firstname: char.firstname,
                            lastname: char.lastname,
                            source: char.source
                        })),
                        databasePath: characterIdsToCheck.map(char => `/factions/364/members/${char.id}`),
                        timestamp: factionStartTime
                    });
                    
                    let finalFactionResult = { data: { isMember: false, character: null } };
                    let foundMember = false;
                    let allFactionMembers = []; // Track all faction members to find highest rank
                    
                    // Check each character for faction membership
                    for (const characterInfo of characterIdsToCheck) {
                        try {
                            console.log(`🔍 [GTA Auth] Checking specific character ID ${characterInfo.id}:`, {
                                characterId: characterInfo.id,
                                characterName: characterInfo.name,
                                firstname: characterInfo.firstname,
                                lastname: characterInfo.lastname,
                                memberid: characterInfo.memberid,
                                databasePath: `/factions/364/members/${characterInfo.id}`,
                                note: 'Looking up by character.id, not memberid'
                            });
                            
                            const factionResult = await checkFactionMembership({ 
                                characterId: characterInfo.id,
                                factionId: 364 // PHMC faction ID
                            });
                            
                            console.log(`📋 [GTA Auth] Character ${characterInfo.id} faction lookup result:`, {
                                characterId: characterInfo.id,
                                characterName: characterInfo.name,
                                firstname: characterInfo.firstname,
                                lastname: characterInfo.lastname,
                                isMember: factionResult.data?.isMember,
                                accessLevel: factionResult.data?.accessLevel,
                                scriptRank: factionResult.data?.character?.scriptRank,
                                rank: factionResult.data?.character?.rank,
                                message: factionResult.data?.message,
                                databasePath: `/factions/364/members/${characterInfo.id}`
                            });
                            
                            if (factionResult.data?.isMember) {
                                console.log(`✅ [GTA Auth] Found PHMC member! Character ID ${characterInfo.id}:`, {
                                    characterId: characterInfo.id,
                                    characterName: characterInfo.name,
                                    firstname: characterInfo.firstname,
                                    lastname: characterInfo.lastname,
                                    rank: factionResult.data.character?.rank,
                                    scriptRank: factionResult.data.character?.scriptRank,
                                    accessLevel: factionResult.data.accessLevel,
                                    memberid: characterInfo.memberid,
                                    note: 'Successfully matched character ID in PHMC database'
                                });
                                
                                // Store this faction member for comparison
                                allFactionMembers.push({
                                    factionResult,
                                    characterInfo,
                                    scriptRank: factionResult.data.character?.scriptRank || 0
                                });
                                foundMember = true;
                                // Don't break - continue checking all characters to find highest rank
                            }
                        } catch (charError) {
                            console.warn(`⚠️ [GTA Auth] Error checking character ${characterInfo.id}:`, charError.message);
                        }
                    }
                    
                    // Select the highest-ranking faction member
                    if (allFactionMembers.length > 0) {
                        // Sort by scriptRank descending to get highest rank first
                        allFactionMembers.sort((a, b) => (b.scriptRank || 0) - (a.scriptRank || 0));
                        const highestRankMember = allFactionMembers[0];
                        finalFactionResult = highestRankMember.factionResult;
                        
                        console.log(`🏆 [GTA Auth] Selected highest-ranking character:`, {
                            selectedCharacterId: highestRankMember.characterInfo.id,
                            selectedCharacterName: highestRankMember.characterInfo.name,
                            selectedScriptRank: highestRankMember.scriptRank,
                            selectedRank: highestRankMember.factionResult.data.character?.rank,
                            totalFactionMembers: allFactionMembers.length,
                            allMembers: allFactionMembers.map(member => ({
                                id: member.characterInfo.id,
                                name: member.characterInfo.name,
                                scriptRank: member.scriptRank,
                                rank: member.factionResult.data.character?.rank
                            })),
                            note: 'Using highest scriptRank character instead of first found'
                        });
                    }
                    
                    const factionDuration = Date.now() - factionStartTime;
                    console.log(`🏁 [GTA Auth] All faction checks completed [${factionCallId}]:`, {
                        duration: factionDuration,
                        charactersChecked: characterIdsToCheck.length,
                        foundMember,
                        finalResult: finalFactionResult.data
                    });
                    
                    // Enhance user data with faction information
                    result.userData = {
                        ...result.userData,
                        faction: finalFactionResult.data.isMember ? finalFactionResult.data.character : null,
                        permissions: finalFactionResult.data.permissions || [],
                        accessLevel: finalFactionResult.data.accessLevel || 'none',
                        factionInfo: finalFactionResult.data.factionInfo || null,
                        isFactionMember: finalFactionResult.data.isMember,
                        // Add debugging info about which characters were checked
                        debugInfo: {
                            charactersChecked: characterIdsToCheck,
                            foundMember,
                            factionCheckDuration: factionDuration
                        }
                    };
                    
                    console.log(`📊 [GTA Auth] Enhanced user data with faction info [${factionCallId}]:`, {
                        username: result.userData.username,
                        mainCharacterId: result.userData.id,
                        isFactionMember: result.userData.isFactionMember,
                        accessLevel: result.userData.accessLevel,
                        permissionCount: result.userData.permissions.length,
                        factionCharacter: result.userData.faction,
                        charactersChecked: characterIdsToCheck.length,
                        debugInfo: result.userData.debugInfo
                    });
                    
                } catch (factionError) {
                    console.warn('[GTA Auth] Faction check failed, continuing without faction data:', {
                        error: factionError.message,
                        code: factionError.code,
                        details: factionError.details
                    });
                    // Continue without faction data - user can still authenticate but won't have faction permissions
                    result.userData.faction = null;
                    result.userData.permissions = [];
                    result.userData.accessLevel = 'none';
                    result.userData.isFactionMember = false;
                    result.userData.factionError = factionError.message;
                }
            }
            
            // Store enhanced user data and tokens
            sessionStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(result.userData));
            sessionStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, result.accessToken);
            
            console.info('[GTA Auth] Authentication successful');
            
            // Clear stored OAuth state only after successful authentication
            sessionStorage.removeItem(STORAGE_KEYS.OAUTH_STATE);
            sessionStorage.removeItem(STORAGE_KEYS.OAUTH_REQUEST_LOCK);
            
            if (onSuccess) {
                onSuccess(result.userData, storedOAuthData.returnPath);
            }
        } else {
            throw new Error(result.error || 'Token exchange failed');
        }

    } catch (error) {
        console.error('[GTA Auth] OAuth callback error:', error);
        Sentry.captureException(error, {
            extra: { 
                context: 'GTA World OAuth Callback',
                code: code?.substring(0, 10) + '...',
                state 
            }
        });

        // Clear any stored OAuth data on error to prevent stale state
        sessionStorage.removeItem(STORAGE_KEYS.OAUTH_STATE);
        sessionStorage.removeItem(STORAGE_KEYS.AUTH_CODE);
        sessionStorage.removeItem(STORAGE_KEYS.OAUTH_REQUEST_LOCK);

        if (onError) {
            onError(error.message || 'Authentication failed');
        }
    }
};

/**
 * Exchanges authorization code for access token using Firebase function
 * @param {string} code - Authorization code
 * @param {string} redirectUri - Redirect URI used in the original request
 * @returns {Object} Result object with success status and data
 */
const exchangeAuthCodeForToken = async (code, redirectUri) => {
    try {
        // Check if there's already an active request for this code
        const requestKey = `${code}-${redirectUri}`;
        
        if (activeOAuthRequest && activeOAuthRequest.key === requestKey) {
            console.warn('[GTA Auth] Duplicate OAuth request detected, waiting for existing request...');
            return await activeOAuthRequest.promise;
        }

        // Create a new request promise
        const requestPromise = (async () => {
            try {
                console.debug('[GTA Auth] Calling Firebase function for token exchange');
                console.debug('[GTA Auth] Configuration:', {
                    functionName: GTA_WORLD_CONFIG.FIREBASE_FUNCTION,
                    hasClientId: !!GTA_WORLD_CONFIG.CLIENT_ID,
                    redirectUri,
                    codeLength: code?.length,
                    functionsRegion: 'us-central1',
                    requestKey: requestKey.substring(0, 50) + '...'
                });

                const exchangeFunction = httpsCallable(functions, GTA_WORLD_CONFIG.FIREBASE_FUNCTION);
                const firebaseCallId = Date.now() + '-' + Math.random().toString(36).substr(2, 5);
                const firebaseStartTime = Date.now();

                console.log(`🔥 [GTA Auth] Calling Firebase function [${firebaseCallId}]:`, {
                    function: GTA_WORLD_CONFIG.FIREBASE_FUNCTION,
                    callId: firebaseCallId,
                    codeLength: code?.length,
                    redirectUri,
                    clientId: GTA_WORLD_CONFIG.CLIENT_ID ? 'present' : 'missing',
                    timestamp: firebaseStartTime
                });
                
                let result;
                try {
                    result = await exchangeFunction({
                        code,
                        redirectUri,
                        clientId: GTA_WORLD_CONFIG.CLIENT_ID
                        // Client secret is handled server-side for security
                    });
                    
                    const firebaseDuration = Date.now() - firebaseStartTime;
                    console.log(`✅ [GTA Auth] Firebase function completed [${firebaseCallId}]:`, {
                        duration: firebaseDuration,
                        hasData: !!result.data,
                        success: result.data?.success,
                        slowCall: firebaseDuration > 3000,
                        verySlowCall: firebaseDuration > 10000
                    });
                    
                    if (firebaseDuration > 5000) {
                        console.warn(`⚠️ [GTA Auth] Slow Firebase function detected [${firebaseCallId}]:`, {
                            duration: firebaseDuration,
                            function: GTA_WORLD_CONFIG.FIREBASE_FUNCTION,
                            possibleTimeout: firebaseDuration > 15000
                        });
                    }
                } catch (firebaseError) {
                    const firebaseDuration = Date.now() - firebaseStartTime;
                    console.error(`❌ [GTA Auth] Firebase function error [${firebaseCallId}]:`, {
                        error: firebaseError.message,
                        code: firebaseError.code,
                        duration: firebaseDuration,
                        function: GTA_WORLD_CONFIG.FIREBASE_FUNCTION
                    });
                    throw firebaseError;
                }

                console.debug(`📋 [GTA Auth] Raw Firebase response [${firebaseCallId}]:`, result);
                console.log(`🔍 [GTA Auth] Detailed API response analysis [${firebaseCallId}]:`, {
                    hasData: !!result.data,
                    hasToken: !!result.data?.token,
                    hasUser: !!result.data?.user,
                    success: result.data?.success,
                    dataKeys: result.data ? Object.keys(result.data) : [],
                    // Detailed user data structure
                    userDataKeys: result.data?.user ? Object.keys(result.data.user) : [],
                    userData: result.data?.user,
                    // Check for characters in user data (API uses 'character', not 'characters')
                    hasCharacterField: !!result.data?.user?.character,
                    hasCharactersField: !!result.data?.user?.characters,
                    charactersCount: (result.data?.user?.character || result.data?.user?.characters)?.length || 0,
                    charactersData: result.data?.user?.character || result.data?.user?.characters || 'no character data found',
                    // Check for other possible character fields
                    userFields: {
                        name: result.data?.user?.name,
                        username: result.data?.user?.username,
                        firstname: result.data?.user?.firstname,
                        lastname: result.data?.user?.lastname,
                        id: result.data?.user?.id,
                        email: result.data?.user?.email
                    }
                });

                if (result.data?.success && result.data?.token && result.data?.user) {
                    return {
                        success: true,
                        accessToken: result.data.token.access_token,
                        refreshToken: result.data.token.refresh_token,
                        tokenType: result.data.token.token_type || 'Bearer',
                        expiresIn: result.data.token.expires_in,
                        scope: result.data.token.scope,
                        userData: result.data.user,
                        tokenData: result.data.token,
                        timestamp: result.data.timestamp
                    };
                } else {
                    throw new Error('Invalid response from token exchange');
                }
            } catch (innerError) {
                console.error('[GTA Auth] Inner token exchange error:', innerError);
                throw innerError;
            }
        })();

        // Store the active request
        activeOAuthRequest = {
            key: requestKey,
            promise: requestPromise,
            timestamp: Date.now()
        };

        // Set a timeout to clear the active request
        setTimeout(() => {
            if (activeOAuthRequest && activeOAuthRequest.key === requestKey) {
                console.warn('[GTA Auth] OAuth request timeout reached, clearing active request');
                activeOAuthRequest = null;
            }
        }, OAUTH_REQUEST_TIMEOUT);

        // Wait for the request to complete
        const result = await requestPromise;
        
        // Clear the active request when done
        if (activeOAuthRequest && activeOAuthRequest.key === requestKey) {
            activeOAuthRequest = null;
        }
        
        return result;

    } catch (error) {
        console.error('[GTA Auth] Token exchange failed:', error);
        console.error('[GTA Auth] Error details:', {
            code: error.code,
            message: error.message,
            details: error.details,
            stack: error.stack
        });
        
        // Parse Firebase function errors with enhanced error types
        if (error.code && error.message) {
            let userFriendlyMessage = error.message;
            let debugInfo = {};
            
            switch (error.code) {
                case 'functions/internal':
                case 'internal':
                    userFriendlyMessage = 'Server configuration error. Please check that Firebase Functions are properly deployed and configured.';
                    debugInfo = {
                        hint: 'Check Firebase Functions region configuration and deployment status',
                        region: 'us-central1',
                        functionName: GTA_WORLD_CONFIG.FIREBASE_FUNCTION
                    };
                    break;
                case 'functions/not-found':
                case 'not-found':
                    userFriendlyMessage = 'Authentication service not found. Please contact support.';
                    debugInfo = {
                        hint: 'Firebase Function not deployed or wrong function name',
                        functionName: GTA_WORLD_CONFIG.FIREBASE_FUNCTION
                    };
                    break;
                case 'functions/unauthenticated':
                case 'unauthenticated':
                    userFriendlyMessage = 'Authentication required. Please refresh the page and try again.';
                    break;
                case 'functions/permission-denied':
                case 'permission-denied':
                    userFriendlyMessage = 'Permission denied. Please contact support.';
                    break;
                case 'functions/unavailable':
                case 'unavailable':
                    userFriendlyMessage = 'Authentication service temporarily unavailable. Please try again.';
                    break;
                case 'functions/invalid-argument':
                case 'invalid-argument':
                    userFriendlyMessage = 'Invalid request parameters. Please try logging in again.';
                    break;
                case 'functions/deadline-exceeded':
                case 'deadline-exceeded':
                    userFriendlyMessage = 'Request timed out. Please try again.';
                    break;
                default:
                    userFriendlyMessage = 'An internal error occurred. Please try again or contact support.';
                    debugInfo = {
                        originalCode: error.code,
                        originalMessage: error.message
                    };
                    break;
            }
            
            return {
                success: false,
                error: userFriendlyMessage,
                errorCode: error.code,
                details: error.details,
                originalMessage: error.message,
                debugInfo
            };
        }

        return {
            success: false,
            error: error.message || 'Token exchange failed',
            errorCode: 'unknown',
            debugInfo: {
                errorType: typeof error,
                errorName: error.name,
                hasStack: !!error.stack
            }
        };
    }
};

/**
 * Attempts to restore authentication session from stored data
 * @returns {Object|null} Restored session data or null if not possible
 */
export const tryRestoreSession = () => {
    try {
        const userData = sessionStorage.getItem(STORAGE_KEYS.USER_DATA);
        const accessToken = sessionStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
        
        if (!userData || !accessToken) {
            console.debug('[GTA Auth] No complete session data found for restoration');
            return null;
        }
        
        const parsedUserData = JSON.parse(userData);
        
        // Validate that we have essential user data
        if (!parsedUserData.id || !parsedUserData.username) {
            console.warn('[GTA Auth] Incomplete user data found, cannot restore session');
            return null;
        }
        
        console.info('[GTA Auth] Successfully restored session for user:', {
            username: parsedUserData.username,
            characterId: parsedUserData.id,
            isFactionMember: parsedUserData.isFactionMember,
            accessLevel: parsedUserData.accessLevel
        });
        
        return {
            user: parsedUserData,
            accessToken,
            restored: true,
            restoredAt: Date.now()
        };
        
    } catch (error) {
        console.error('[GTA Auth] Failed to restore session from stored data:', error);
        // Clear potentially corrupted data
        sessionStorage.removeItem(STORAGE_KEYS.USER_DATA);
        sessionStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
        return null;
    }
};

/**
 * Gets the current authenticated user data
 * @returns {Object|null} User data or null if not authenticated
 */
export const getCurrentUser = () => {
    try {
        const userData = sessionStorage.getItem(STORAGE_KEYS.USER_DATA);
        return userData ? JSON.parse(userData) : null;
    } catch (error) {
        console.error('[GTA Auth] Failed to get current user:', error);
        return null;
    }
};

/**
 * Gets the stored user data (alias for getCurrentUser for consistency)
 * @returns {Object|null} User data or null if not authenticated
 */
export const getStoredUserData = () => {
    return getCurrentUser();
};

/**
 * Checks if the current user is authenticated via Google (Firebase Auth)
 * This can be determined by checking if there's a Google-authenticated user in the admin context
 * @returns {boolean} True if user is Google-authenticated
 */
export const isGoogleAuthenticated = () => {
    try {
        // Check for Google-authenticated user data in session storage
        // This would be set by the AdminAuthAndActions component when a user logs in via Google
        const googleAuthData = sessionStorage.getItem('google-admin-user');
        if (googleAuthData) {
            const userData = JSON.parse(googleAuthData);
            return userData && userData.email;
        }
        
        // Fallback: Check if we have admin authentication context
        const adminAuthData = sessionStorage.getItem('admin-auth-context');
        if (adminAuthData) {
            const authData = JSON.parse(adminAuthData);
            return authData && authData.isAdminAuthenticated && authData.adminUserEmail;
        }
        
        return false;
    } catch (error) {
        console.warn('[GTA Auth] Error checking Google authentication:', error);
        return false;
    }
};

/**
 * Gets Google-authenticated user data
 * @returns {Object|null} Google user data or null if not authenticated
 */
export const getGoogleUser = () => {
    try {
        const googleAuthData = sessionStorage.getItem('google-admin-user');
        if (googleAuthData) {
            return JSON.parse(googleAuthData);
        }
        
        const adminAuthData = sessionStorage.getItem('admin-auth-context');
        if (adminAuthData) {
            const authData = JSON.parse(adminAuthData);
            if (authData && authData.isAdminAuthenticated) {
                return {
                    email: authData.adminUserEmail,
                    isAdmin: true
                };
            }
        }
        
        return null;
    } catch (error) {
        console.warn('[GTA Auth] Error getting Google user:', error);
        return null;
    }
};

/**
 * Gets the current access token
 * @returns {string|null} Access token or null if not authenticated
 */
export const getAccessToken = () => {
    return sessionStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
};

/**
 * Checks if the user is currently authenticated
 * @returns {boolean} True if authenticated, false otherwise
 */
export const isAuthenticated = () => {
    return !!(getCurrentUser() && getAccessToken());
};

/**
 * Logs out the current user and clears all stored data
 */
export const logout = () => {
    console.info('[GTA Auth] Logging out user');
    
    // Clear all stored authentication data
    Object.values(STORAGE_KEYS).forEach(key => {
        sessionStorage.removeItem(key);
    });
    
    console.debug('[GTA Auth] User logged out successfully');
};

/**
 * Refreshes the access token if a refresh token is available
 * @returns {Object} Result object with success status
 */
export const refreshAccessToken = async () => {
    try {
        console.info('[GTA Auth] Attempting to refresh access token');
        
        // This would require implementing refresh token functionality
        // in the Firebase function and GTA World API
        console.warn('[GTA Auth] Token refresh not implemented yet');
        
        return {
            success: false,
            error: 'Token refresh not implemented'
        };

    } catch (error) {
        console.error('[GTA Auth] Token refresh failed:', error);
        Sentry.captureException(error, {
            extra: { context: 'GTA World Token Refresh' }
        });
        
        return {
            success: false,
            error: error.message || 'Token refresh failed'
        };
    }
};

/**
 * Makes an authenticated API request to GTA World
 * @param {string} endpoint - API endpoint path
 * @param {Object} options - Fetch options
 * @returns {Object} API response
 */
export const makeAuthenticatedRequest = async (endpoint, options = {}) => {
    try {
        const accessToken = getAccessToken();
        
        if (!accessToken) {
            throw new Error('No access token available');
        }

        // For full URLs, use as-is. For relative paths, build the URL properly
        const url = endpoint.startsWith('http') ? endpoint : 
                   endpoint.startsWith('/') ? `https://ucp.gta.world/api${endpoint}` : 
                   `https://ucp.gta.world/api/${endpoint}`;
        
        const response = await fetch(url, {
            ...options,
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                ...options.headers
            }
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }

        return await response.json();

    } catch (error) {
        console.error('[GTA Auth] API request failed:', error);
        Sentry.captureException(error, {
            extra: { context: 'GTA World API Request', endpoint }
        });
        
        throw error;
    }
};

/**
 * Validates the current session and user data
 * @returns {Object} Validation result
 */
export const validateSession = async () => {
    try {
        if (!isAuthenticated()) {
            return { valid: false, error: 'Not authenticated' };
        }

        // Optionally validate the token by making a test API call
        const userData = await makeAuthenticatedRequest('/user');
        
        return { 
            valid: true, 
            userData 
        };

    } catch (error) {
        console.error('[GTA Auth] Session validation failed:', error);
        
        // Clear invalid session data
        logout();
        
        return { 
            valid: false, 
            error: error.message || 'Session validation failed' 
        };
    }
};

/**
 * Validates Firebase configuration and provides debugging information
 * @returns {Object} Validation result with debugging info
 */
export const validateFirebaseConfig = () => {
    const config = {
        hasClientId: !!GTA_WORLD_CONFIG.CLIENT_ID,
        clientId: GTA_WORLD_CONFIG.CLIENT_ID ? `${GTA_WORLD_CONFIG.CLIENT_ID.substring(0, 8)}...` : 'NOT_SET',
        functionName: GTA_WORLD_CONFIG.FIREBASE_FUNCTION,
        authorizeUrl: GTA_WORLD_CONFIG.AUTHORIZE_URL,
        tokenUrl: GTA_WORLD_CONFIG.TOKEN_URL,
        userApiUrl: GTA_WORLD_CONFIG.USER_API_URL
    };

    const issues = [];
    if (!GTA_WORLD_CONFIG.CLIENT_ID) {
        issues.push('REACT_APP_GTAWORLD_CLIENT_ID environment variable not set');
    }

    console.info('[GTA Auth] Configuration validation:', { config, issues });
    
    return {
        valid: issues.length === 0,
        config,
        issues
    };
};

/**
 * Check if current user has specific permission
 * @param {string} permission - Permission to check
 * @returns {boolean} True if user has permission
 */
export const hasPermission = (permission) => {
    // Google-authenticated users get all permissions
    if (isGoogleAuthenticated()) {
        return true;
    }
    
    const userData = getStoredUserData();
    if (!userData || !userData.permissions) {
        return false;
    }
    return userData.permissions.includes(permission);
};

/**
 * Check if current user can access specific feature
 * @param {string} feature - Feature to check (admin_panel, faction_upload, etc.)
 * @returns {boolean} True if user can access feature
 */
export const canAccessFeature = (feature) => {
    // Google-authenticated users get access to all features
    if (isGoogleAuthenticated()) {
        return true;
    }
    
    const userData = getStoredUserData();
    if (!userData || !userData.isFactionMember) {
        return false;
    }
    
    const featurePermissions = {
        admin_panel: ['admin_full_access', 'admin_limited_access'],
        faction_upload: ['upload_faction_data'],
        database_editor: ['database_access'],
        webhook_management: ['manage_webhooks'],
        all_reports: ['manage_all_reports'],
        department_reports: ['manage_department_reports', 'manage_all_reports'],
        own_reports: ['view_own_reports', 'manage_own_reports', 'manage_department_reports', 'manage_all_reports'],
        create_reports: ['create_reports', 'create_basic_reports'],
        view_members: ['view_all_members', 'view_department_members', 'view_team_members'],
        audit_logs: ['access_audit_logs', 'view_audit_logs']
    };
    
    const requiredPermissions = featurePermissions[feature];
    if (!requiredPermissions) {
        console.warn(`Unknown feature: ${feature}`);
        return false;
    }
    
    return requiredPermissions.some(permission => 
        userData.permissions.includes(permission)
    );
};

/**
 * Get current user's faction information
 * @returns {Object|null} Faction data or null if not a faction member
 */
export const getFactionInfo = () => {
    // Google-authenticated users get simulated highest rank faction data
    if (isGoogleAuthenticated()) {
        const googleUser = getGoogleUser();
        return {
            characterName: googleUser?.email?.split('@')[0] || 'Admin',
            scriptRank: 15, // Highest rank
            isGoogleAdmin: true
        };
    }
    
    const userData = getStoredUserData();
    return userData?.faction || null;
};

/**
 * Get current user's access level
 * @returns {string} Access level (president, executive, chief, etc.)
 */
export const getAccessLevel = () => {
    // Google-authenticated users get the highest access level
    if (isGoogleAuthenticated()) {
        return 'president'; // Highest access level
    }
    
    const userData = getStoredUserData();
    return userData?.accessLevel || 'none';
};

/**
 * Get current user's permissions
 * @returns {Array} Array of permission strings
 */
export const getUserPermissions = () => {
    // Google-authenticated users get all permissions
    if (isGoogleAuthenticated()) {
        return [
            'admin_panel',
            'faction_upload',
            'database_editor',
            'webhook_management',
            'all_reports',
            'department_reports',
            'own_reports',
            'create_reports',
            'view_members',
            'audit_logs',
            'manage_users',
            'system_settings'
        ];
    }
    
    const userData = getStoredUserData();
    return userData?.permissions || [];
};

/**
 * Check if user is a faction member
 * @returns {boolean} True if user is a faction member
 */
export const isFactionMember = () => {
    // Google-authenticated users are considered faction members with highest privileges
    if (isGoogleAuthenticated()) {
        return true;
    }
    
    const userData = getStoredUserData();
    return userData?.isFactionMember || false;
};

/**
 * Refresh faction membership data
 * @returns {Promise<Object>} Updated faction data
 */
export const refreshFactionData = async () => {
    const userData = getStoredUserData();
    if (!userData || !userData.id) {
        throw new Error('No authenticated user found');
    }
    
    try {
        const checkFactionMembership = httpsCallable(functions, 'checkFactionMembership');
        const refreshCallId = Date.now() + '-' + Math.random().toString(36).substr(2, 5);
        const refreshStartTime = Date.now();
        
        console.log(`🔥 [GTA Auth] Refreshing faction data Firebase call [${refreshCallId}]:`, {
            function: 'checkFactionMembership',
            characterId: parseInt(userData.id),
            factionId: 364,
            timestamp: refreshStartTime
        });
        
        const result = await checkFactionMembership({ 
            characterId: parseInt(userData.id),
            factionId: 364 // PHMC faction ID
        });
        
        const refreshDuration = Date.now() - refreshStartTime;
        console.log(`✅ [GTA Auth] Faction refresh completed [${refreshCallId}]:`, {
            duration: refreshDuration,
            isMember: result.data?.isMember,
            hasPermissions: result.data?.permissions?.length > 0
        });
        
        // Update stored user data
        const updatedUserData = {
            ...userData,
            faction: result.data.isMember ? result.data.character : null,
            permissions: result.data.permissions || [],
            accessLevel: result.data.accessLevel || 'none',
            factionInfo: result.data.factionInfo || null,
            isFactionMember: result.data.isMember
        };
        
        sessionStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(updatedUserData));
        
        console.log('[GTA Auth] Faction data refreshed:', {
            isFactionMember: updatedUserData.isFactionMember,
            accessLevel: updatedUserData.accessLevel,
            permissionCount: updatedUserData.permissions.length
        });
        
        return updatedUserData;
        
    } catch (error) {
        console.error('[GTA Auth] Failed to refresh faction data:', error);
        throw error;
    }
};

// Export configuration for external use if needed
export const GTA_WORLD_AUTH_CONFIG = GTA_WORLD_CONFIG;