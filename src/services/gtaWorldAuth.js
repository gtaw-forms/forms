import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import * as Sentry from "@sentry/react";
import { getCharacterID, getCharacterName } from '../utils/characterUtils';
import { logAuthErrorToDiscord } from '../utils/authLogger';
/**
 * Unified GTA World Authentication Service
 * Consolidates all OAuth functionality into a single service
 */

// Configuration constants
const GTA_WORLD_CONFIG = {
    AUTHORIZE_URL: 'https://ucp.gta.world/oauth/authorize',
    TOKEN_URL: 'https://ucp.gta.world/oauth/token',
    USER_API_URL: 'https://ucp.gta.world/api/user',
    CLIENT_ID: import.meta.env.VITE_GTAWORLD_CLIENT_ID || '',
    FIREBASE_FUNCTION: 'processGtaWorldAuth'
};

// Session storage keys
const STORAGE_KEYS = {
    OAUTH_STATE: 'gta-oauth-state',
    OAUTH_REQUEST_LOCK: 'gta-oauth-request-lock',
    AUTH_CODE: 'gta-auth-code',
    USER_DATA: 'gta-user-data',
    ACCESS_TOKEN: 'gta-access-token',
    FALLBACK_USER_DATA: 'user'
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

const sendLoginWebhook = (userData) => {
    const webhookUrl = import.meta.env.VITE_DEV_WEBHOOK;
    if (!webhookUrl) {
        return; // Don't do anything if webhook is not configured
    }

    try {
        const embed = {
            title: 'GTAW User Login',
            description: `**${userData.username}** (ID: ${userData.id}) just logged in.`,
            color: userData.isFactionMember ? 0x00ff00 : 0x0000ff, // Green for faction, blue for public
            fields: [
                { name: 'Faction Member', value: userData.isFactionMember ? 'Yes' : 'No', inline: true },
            ],
            timestamp: new Date().toISOString(),
            footer: { text: 'PHMC Forms Login' }
        };

        if (userData.isFactionMember && userData.faction) {
            const oAuthRank = userData.faction.rank ? userData.faction.rank.replace(/-/g, '').trim() : 'N/A';
            embed.fields.push({ name: 'Faction Character', value: `${userData.faction.characterName} (ID: ${userData.faction.characterId})`, inline: true });
            embed.fields.push({ name: 'Faction Rank', value: oAuthRank, inline: true });
        }

        const characterArray = userData.character || userData.characters;
        if (characterArray && Array.isArray(characterArray) && characterArray.length > 0) {
            const allCharsFieldExists = embed.fields.some(f => f.name === 'All Characters');
            if (!allCharsFieldExists) {
                const characterList = characterArray.map(c => {
                    if (c.name) {
                        return `• ${c.name} (ID: ${c.id})`;
                    } else if (c.firstname && c.lastname) {
                        return `• ${c.firstname} ${c.lastname} (ID: ${c.id})`;
                    } else {
                        return `• Character ID: ${c.id}`;
                    }
                }).join('\n');
                embed.fields.push({ name: 'All Characters', value: characterList, inline: false });
            }
        }

        // Add OAuth credentials debug information
        if (userData.isFactionMember && userData.faction) {
            const oauthName = getCharacterName(userData);
            const oauthBadgeId = getCharacterID(userData);
            const oauthRank = userData.faction?.rank ? userData.faction.rank.replace(/-/g, ' ').trim() : 'N/A';
            
            const debugInfo = `**Character Name:** ${oauthName}\n**UCP Username:** ${userData.username}\n**Badge Number:** ${oauthBadgeId}\n**Rank:** ${oauthRank}`;
            embed.fields.push({ name: 'DEBUG: Using GTAW OAuth Credentials', value: debugInfo, inline: false });
        }

        if (userData.allFactionCharacters && userData.allFactionCharacters.length > 1) {
            const characterList = userData.allFactionCharacters.map(c => `• ${c.character.characterName} (Rank: ${c.character.rank})`).join('\n');
            embed.fields.push({ name: 'Multiple PHMC Characters Detected', value: characterList, inline: false });
        }

        const payload = {
            username: 'Login Bot',
            embeds: [embed]
        };

        fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).then(response => {
            if (!response.ok) {
                console.error(`Error sending login webhook: ${response.status} ${response.statusText}`);
            }
        }).catch(error => {
            console.error('Failed to send login webhook:', error);
            Sentry.captureException(error, { extra: { context: 'GTAW Login Webhook' } });
        });
    } catch (error) {
        console.error('Failed to construct login webhook payload:', error);
        Sentry.captureException(error, { extra: { context: 'GTAW Login Webhook Payload Construction' } });
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
            console.info('[GTA Auth] User is already authenticated, restoring session.');
            
            // Send Discord webhook for session restoration login
            sendLoginWebhook(restoredSession.user);
            
            // Call onSuccess callback if available (for consistency with OAuth flow)
            if (options.onSuccess) {
                options.onSuccess(restoredSession.user, options.returnPath || '#/');
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
                    console.warn('[GTA Auth] OAuth flow already in progress, ignoring new request.');
                    return;
                }
            } catch (e) {
                console.warn('[GTA Auth] Invalid existing OAuth data, proceeding with new flow');
            }
        }

        // Generate state for CSRF protection
        const state = generateOAuthState();
        const redirectUri = getRedirectUri();
        const returnPath = options.returnPath || window.location.hash || '#/';

        // Store OAuth state information
        const oauthData = {
            state,
            returnPath,
            redirectUri,
            timestamp: Date.now(),
            clientId: GTA_WORLD_CONFIG.CLIENT_ID
        };

        sessionStorage.setItem(STORAGE_KEYS.OAUTH_STATE, JSON.stringify(oauthData));

        console.debug('[GTA Auth] Stored OAuth state (obfuscated).');

        // Build authorization URL
        const authUrl = new URL(GTA_WORLD_CONFIG.AUTHORIZE_URL);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('client_id', GTA_WORLD_CONFIG.CLIENT_ID);
        authUrl.searchParams.set('redirect_uri', redirectUri);
        authUrl.searchParams.set('state', state);
        authUrl.searchParams.set('scope', ''); // Can be customized as needed

        console.debug('[GTA Auth] Authorization URL details (obfuscated).');

        console.debug('[GTA Auth] Redirecting to GTA World OAuth endpoint.');

        // Redirect to GTA World OAuth
        window.location.href = authUrl.toString();

    } catch (error) {
        console.error('[GTA Auth] Failed to initiate OAuth flow:', error);
        logAuthErrorToDiscord(error, 'OAuth Initiation');
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
 * @param {Function} onProgress - Progress callback function (optional)
 */

/**
 * Processes the OAuth callback and exchanges code for tokens
 * @param {string} code - Authorization code from GTA World
 * @param {string} state - State parameter for CSRF protection
 * @param {Function} onSuccess - Success callback function
 * @param {Function} onError - Error callback function
 * @param {Function} onProgress - Progress callback function (optional)
 */
export const handleOAuthCallback = async (code, state, onSuccess, onError, onProgress) => {
    // Performance monitoring setup
    const perfStart = performance.now();
    const perfMetrics = {
        sessionId: Date.now() + '-' + Math.random().toString(36).substr(2, 5),
        startTime: perfStart,
        phases: {},
        userAgent: navigator?.userAgent || 'unknown',
        timestamp: new Date().toISOString()
    };
    
    const logPhase = (phase, startTime) => {
        const duration = performance.now() - startTime;
        perfMetrics.phases[phase] = Math.round(duration);
        console.log(`[Perf] ${phase}: ${duration.toFixed(2)}ms`);
        return duration;
    };
    
    try {
        console.info('[GTA Auth] Processing OAuth callback');
        console.log(`[Perf] OAuth session started [${perfMetrics.sessionId}]`);
        
        onProgress?.({ 
            step: 'initializing', 
            message: 'Starting authentication...', 
            progress: 10 
        });

        // Phase: Validation
        const validationStart = performance.now();
        
        const callbackKey = `callback-${code}-${state}`;
        const lockKey = sessionStorage.getItem(STORAGE_KEYS.OAUTH_REQUEST_LOCK);
        
        logPhase('validation', validationStart);
        
        if (lockKey === callbackKey) {
            console.warn('[GTA Auth] Duplicate callback detected, ignoring...');
            return;
        }

        sessionStorage.setItem(STORAGE_KEYS.OAUTH_REQUEST_LOCK, callbackKey);
        
        setTimeout(() => {
            const currentLock = sessionStorage.getItem(STORAGE_KEYS.OAUTH_REQUEST_LOCK);
            if (currentLock === callbackKey) {
                sessionStorage.removeItem(STORAGE_KEYS.OAUTH_REQUEST_LOCK);
            }
        }, OAUTH_REQUEST_TIMEOUT);

        let storedOAuthData;
        try {
            storedOAuthData = JSON.parse(sessionStorage.getItem(STORAGE_KEYS.OAUTH_STATE) || '{}');
        } catch (e) {
            console.error('[GTA Auth] Failed to parse stored OAuth data:', e);
            storedOAuthData = {};
        }
        
        if (!storedOAuthData.state || storedOAuthData.state !== state) {
            console.error('[GTA Auth] OAuth state validation failed.');
            const isProduction = import.meta.env.NODE_ENV === 'production';
            if (!isProduction || (state && state.length > 20)) {
                console.warn('[GTA Auth] STATE VALIDATION BYPASSED - This could be a race condition or development mode');
                if (!storedOAuthData.returnPath) {
                    storedOAuthData.returnPath = '#/';
                    storedOAuthData.redirectUri = getRedirectUri();
                }
            } else {
                throw new Error('Invalid OAuth state - possible CSRF attack');
            }
        }

        console.debug('[GTA Auth] OAuth state validated successfully');

        onProgress?.({ 
            step: 'token_exchange', 
            message: 'Exchanging authorization code for access token...', 
            progress: 30 
        });
        
        // Phase: Token Exchange (and faction check, all in one)
        const tokenStart = performance.now();
        const result = await exchangeAuthCodeForToken(code, storedOAuthData.redirectUri);
        logPhase('unified_auth_flow', tokenStart);

        if (result.success) {
            // The new unified backend provides a complete user object with faction data.
            sendLoginWebhook(result.userData);
            console.log(`[GTA Auth] User data received from unified backend.`);
            
            sessionStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(result.userData));
            sessionStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, result.accessToken);
            
            console.info('[GTA Auth] Authentication successful');
            
            const totalDuration = performance.now() - perfStart;
            perfMetrics.totalDuration = Math.round(totalDuration);
            perfMetrics.success = true;
            console.log(`[Perf] OAuth completed successfully [${perfMetrics.sessionId}].`);
            
            onProgress?.({ 
                step: 'complete', 
                message: 'Authentication successful!', 
                progress: 100,
                metrics: { totalTime: Math.round(totalDuration), phases: perfMetrics.phases }
            });
            
            storePerformanceMetrics(perfMetrics);
            
            sessionStorage.removeItem(STORAGE_KEYS.OAUTH_STATE);
            sessionStorage.removeItem(STORAGE_KEYS.OAUTH_REQUEST_LOCK);
            
            if (onSuccess) {
                onSuccess(result.userData, storedOAuthData.returnPath);
            }
        } else {
            throw new Error(result.error || 'Token exchange failed');
        }

    } catch (error) {
        const totalDuration = performance.now() - perfStart;
        perfMetrics.totalDuration = Math.round(totalDuration);
        perfMetrics.success = false;
        perfMetrics.error = error.message;
        
        console.error('[GTA Auth] OAuth callback error:', error);
        logAuthErrorToDiscord(error, 'OAuth Callback');
        
        onProgress?.({ 
            step: 'error', 
            message: 'Authentication failed. Analyzing error...', 
            progress: 0,
            error: true,
            metrics: { totalTime: Math.round(totalDuration), phases: perfMetrics.phases }
        });
        
        storePerformanceMetrics(perfMetrics);

        Sentry.captureException(error, {
            extra: { 
                context: 'GTA World OAuth Callback',
                code: code?.substring(0, 10) + '...',
                state,
            }
        });

        sessionStorage.removeItem(STORAGE_KEYS.OAUTH_STATE);
        sessionStorage.removeItem(STORAGE_KEYS.AUTH_CODE);
        sessionStorage.removeItem(STORAGE_KEYS.OAUTH_REQUEST_LOCK);

        const userFriendlyMessage = getUserFriendlyErrorMessage(error);
        
        if (onError) {
            onError(userFriendlyMessage, {
                originalError: error.message,
            });
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
                    // Add client-side timeout for Firebase function call
                    const timeoutPromise = new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Firebase function call timed out after 20 seconds')), 20000)
                    );
                    
                    const exchangePromise = exchangeFunction({
                        code,
                        redirectUri,
                        clientId: GTA_WORLD_CONFIG.CLIENT_ID
                        // Client secret is handled server-side for security
                    });
                    
                    result = await Promise.race([exchangePromise, timeoutPromise]);
                    
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

                console.debug(`📋 [GTA Auth] Raw Firebase response received [${firebaseCallId}].`);
                console.log(`🔍 [GTA Auth] Detailed API response analysis completed [${firebaseCallId}].`);

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
        logAuthErrorToDiscord(error, 'Token Exchange');

        
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
                    userFriendlyMessage = 'The GTA World API is currently under significant load, this request has failed. Please try again later..';
                    break;
                default:
                    userFriendlyMessage = 'An internal error occurred. Please try again or contact the PHMC Discord.';
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
        
        console.info('[GTA Auth] Successfully restored session for user.');
        
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
    
    // Clear all stored authentication data from sessionStorage
    Object.values(STORAGE_KEYS).forEach(key => {
        sessionStorage.removeItem(key);
    });

    // Also clear localStorage flags related to credential persistence
    localStorage.removeItem('phmc_gtaw_oauth_persist_enabled');
    localStorage.removeItem('seenKeepCredentialsPrompt');
    
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

        // Instead of making a direct API call, check if we have valid stored user data.
        // The initial authentication flow already fetches and stores this data via Firebase function,
        // so a direct client-side call to /user is redundant and causes CORS issues.
        const currentUser = getCurrentUser();
        if (currentUser && currentUser.id && currentUser.username) {
            console.debug('[GTA Auth] Session validated using stored user data.');
            return { 
                valid: true, 
                userData: currentUser 
            };
        } else {
            console.warn('[GTA Auth] Stored user data is incomplete or invalid, session considered invalid.');
            logout(); // Clear potentially corrupted session
            return { valid: false, error: 'Incomplete user data in session' };
        }

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
        issues.push('VITE_GTAWORLD_CLIENT_ID environment variable not set');
    }

    console.info('[GTA Auth] Configuration validation complete.');
    
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
    if (!userData) {
        throw new Error('No authenticated user found');
    }

    // Since processGtaWorldAuth now returns full user data with faction info,
    // we can simply re-fetch the user's profile to refresh faction data.
    // We pass the existing accessToken to ensure we refresh the data for the current user.
    const accessToken = getAccessToken();
    if (!accessToken) {
        throw new Error('No access token available to refresh faction data.');
    }

    try {
        const getCachedGtaWorldProfileCallable = httpsCallable(functions, 'getCachedGtaWorldProfile');
        const refreshCallId = Date.now() + '-' + Math.random().toString(36).substr(2, 5);
        const refreshStartTime = Date.now();
        
        console.log(`🔥 [GTA Auth] Refreshing faction data by re-fetching profile [${refreshCallId}].`);
        
        // Pass the accessToken to the Firebase function to get the latest profile
        const result = await getCachedGtaWorldProfileCallable({ 
            accessToken: accessToken,
            useCache: false // Force refresh, don't use client-side cache for a "refresh" operation
        });
        
        const refreshDuration = Date.now() - refreshStartTime;
        console.log(`✅ [GTA Auth] Faction refresh completed by re-fetching profile [${refreshCallId}]:`, {
            duration: refreshDuration,
            hasUserData: !!result.data?.userData,
        });

        if (!result.data || !result.data.userData) {
            throw new Error('Failed to retrieve updated user profile data.');
        }
        
        // Update stored user data with the fresh profile
        const updatedUserData = result.data.userData;
        sessionStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(updatedUserData));
        
        console.log('[GTA Auth] Faction data refreshed by re-fetching profile.');
        
        return updatedUserData;
        
    } catch (error) {
        console.error('[GTA Auth] Failed to refresh faction data by re-fetching profile:', error);
        throw error;
    }
};

/**
 * Determines if an error is retryable
 * @param {Error} error - The error to analyze
 * @returns {boolean} - Whether the error is retryable
 */
const isRetryableError = (error) => {
    if (!error) return false;
    
    const retryablePatterns = [
        /timeout/i,
        /network/i,
        /connection/i,
        /fetch/i,
        /ENOTFOUND/i,
        /ECONNREFUSED/i,
        /ETIMEDOUT/i,
        /AbortError/i,
        /502|503|504/,  // Server errors
        /deadline.{0,10}exceeded/i,
        /unavailable/i
    ];
    
    const errorMessage = error.message || error.toString();
    const errorCode = error.code || '';
    
    return retryablePatterns.some(pattern => 
        pattern.test(errorMessage) || pattern.test(errorCode)
    );
};

/**
 * Converts technical errors to user-friendly messages
 * @param {Error} error - The error to convert
 * @returns {string} - User-friendly error message
 */
const getUserFriendlyErrorMessage = (error) => {
    if (!error) return 'An unknown error occurred during authentication.';
    
    const errorMessage = error.message || error.toString();
    
    if (errorMessage.includes('timeout') || errorMessage.includes('AbortError')) {
        return 'Authentication timed out. The GTA World servers may be busy. Please try again.';
    }
    
    if (errorMessage.includes('network') || errorMessage.includes('fetch') || errorMessage.includes('ENOTFOUND')) {
        return 'Network connection error. Please check your internet connection and try again.';
    }
    
    if (errorMessage.includes('invalid_request') || errorMessage.includes('revoked')) {
        return 'This login session has expired or was already used. Please start the login process again.';
    }
    
    if (errorMessage.includes('invalid_grant')) {
        return 'The login session has expired. Please try logging in again.';
    }
    
    if (errorMessage.includes('invalid_client')) {
        return 'Authentication service configuration error. Please notify PHMC Leadership in the PHMC Discord.';
    }
    
    if (errorMessage.includes('502') || errorMessage.includes('503') || errorMessage.includes('504')) {
        return 'GTA World servers are temporarily unavailable. Please try again in a few moments.';
    }
    
    if (errorMessage.includes('deadline') || errorMessage.includes('unavailable')) {
        return 'Authentication service is temporarily unavailable. Please try again.';
    }
    
    // Fallback for unknown errors
    return 'Something went wrong during authentication. Please notify PHMC Leadership in the PHMC Discord';
};

/**
 * Clean up old session storage data to prevent memory bloat
 */
const cleanupSessionStorage = () => {
    try {
        const keysToCheck = [];
        
        // Find all faction cache keys
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key?.startsWith('factionData_')) {
                keysToCheck.push(key);
            }
        }
        
        // Remove expired cache entries
        const now = Date.now();
        const maxAge = 30 * 60 * 1000; // 30 minutes
        
        keysToCheck.forEach(key => {
            try {
                const data = JSON.parse(sessionStorage.getItem(key) || '{}');
                if (data.timestamp && (now - data.timestamp) > maxAge) {
                    sessionStorage.removeItem(key);
                    console.log(`[Storage Cleanup] Removed expired cache: ${key}`);
                }
            } catch {
                // Remove corrupted entries
                sessionStorage.removeItem(key);
            }
        });
        
        // Limit total session storage size (rough estimate)
        const totalSize = Object.keys(sessionStorage).reduce((size, key) => {
            return size + (sessionStorage.getItem(key)?.length || 0);
        }, 0);
        
        if (totalSize > 1024 * 1024) { // 1MB limit
            console.warn('[Storage Cleanup] Session storage size exceeding 1MB, consider clearing old data');
        }
        
    } catch (error) {
        console.warn('[Storage Cleanup] Error during cleanup:', error);
    }
};

// Run cleanup periodically
if (typeof window !== 'undefined') {
    // Clean up on page load
    cleanupSessionStorage();
    
    // Set up periodic cleanup every 10 minutes
    setInterval(cleanupSessionStorage, 10 * 60 * 1000);
}

/**
 * Store performance metrics for analysis and optimization
 * @param {Object} metrics - Performance metrics object
 */
const storePerformanceMetrics = (metrics) => {
    try {
        const perfKey = 'oauth_performance_metrics';
        const existing = JSON.parse(sessionStorage.getItem(perfKey) || '[]');
        
        // Keep only the last 10 entries to prevent storage bloat
        const updated = [...existing, metrics].slice(-10);
        
        sessionStorage.setItem(perfKey, JSON.stringify(updated));
        
        // Log performance summary for immediate feedback
        const avgTime = updated.reduce((sum, m) => sum + (m.totalDuration || 0), 0) / updated.length;
        const successRate = updated.filter(m => m.success).length / updated.length * 100;
        
        console.log(`[Perf Summary] Last ${updated.length} OAuth attempts: avg ${avgTime.toFixed(0)}ms, ${successRate.toFixed(0)}% success`);
        
        // Alert if performance is degrading
        if (metrics.totalDuration > 15000) {
            console.warn(`[Perf Alert] Slow OAuth detected: ${metrics.totalDuration}ms - investigate bottlenecks`);
        }
        
    } catch (error) {
        console.warn('[Perf] Failed to store performance metrics:', error);
    }
};

/**
 * Get performance analytics for debugging
 * @returns {Object} Performance analytics
 */
export const getOAuthPerformanceAnalytics = () => {
    try {
        const metrics = JSON.parse(sessionStorage.getItem('oauth_performance_metrics') || '[]');
        
        if (metrics.length === 0) {
            return { message: 'No performance data available' };
        }
        
        const successful = metrics.filter(m => m.success);
        const failed = metrics.filter(m => !m.success);
        
        const analytics = {
            totalAttempts: metrics.length,
            successfulAttempts: successful.length,
            failedAttempts: failed.length,
            successRate: `${(successful.length / metrics.length * 100).toFixed(1)}%`,
            averageTime: {
                all: `${(metrics.reduce((s, m) => s + (m.totalDuration || 0), 0) / metrics.length).toFixed(0)}ms`,
                successful: successful.length > 0 ? `${(successful.reduce((s, m) => s + m.totalDuration, 0) / successful.length).toFixed(0)}ms` : 'N/A'
            },
            phaseBreakdown: {},
            commonErrors: {},
            performanceGrade: 'unknown'
        };
        
        // Calculate phase averages
        if (successful.length > 0) {
            const phases = ['validation', 'token_exchange', 'character_processing', 'faction_check'];
            phases.forEach(phase => {
                const phaseTimes = successful
                    .map(m => m.phases?.[phase])
                    .filter(t => t !== undefined);
                if (phaseTimes.length > 0) {
                    analytics.phaseBreakdown[phase] = `${(phaseTimes.reduce((s, t) => s + t, 0) / phaseTimes.length).toFixed(0)}ms`;
                }
            });
        }
        
        // Analyze errors
        failed.forEach(m => {
            const errorType = m.error?.split(' ')[0] || 'Unknown';
            analytics.commonErrors[errorType] = (analytics.commonErrors[errorType] || 0) + 1;
        });
        
        // Performance grading
        const avgTime = successful.reduce((s, m) => s + m.totalDuration, 0) / successful.length;
        if (avgTime < 8000) analytics.performanceGrade = 'A (Excellent)';
        else if (avgTime < 12000) analytics.performanceGrade = 'B (Good)';
        else if (avgTime < 20000) analytics.performanceGrade = 'C (Acceptable)';
        else analytics.performanceGrade = 'D (Needs Improvement)';
        
        return analytics;
        
    } catch (error) {
        return { error: 'Failed to analyze performance data', details: error.message };
    }
};

// Export configuration for external use if needed
export const GTA_WORLD_AUTH_CONFIG = GTA_WORLD_CONFIG;

