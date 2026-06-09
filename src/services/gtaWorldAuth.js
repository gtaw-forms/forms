import { httpsCallable } from 'firebase/functions';
import { signInWithCustomToken, signOut } from 'firebase/auth';
import { ref, get } from 'firebase/database';
import { functions, auth, database } from '../firebase';
import * as Sentry from "@sentry/react";
import { getCharacterID, getCharacterName } from '../utils/identityUtils';
import { logAuthErrorToDiscord } from '../utils/logging';
import { triggerValidateGtaWorldToken, triggerCheckFactionMembership, triggerRefreshGtawUser, triggerWebhookProxy, triggerGetPublicConfig } from './firebaseFunctions';

/**
 * Unified GTA World Authentication Service
 * Consolidates all OAuth functionality into a single service
 */

// Configuration constants
const GTA_WORLD_CONFIG = {
    AUTHORIZE_URL: 'https://ucp.gta.world/oauth/authorize',
    TOKEN_URL: 'https://ucp.gta.world/oauth/token',
    USER_API_URL: 'https://ucp.gta.world/api/user',
    FIREBASE_FUNCTION: 'processGtaWorldAuth'
};

let cachedClientId = null;

const getClientId = async () => {
    if (cachedClientId) return cachedClientId;
    try {
        const config = await triggerGetPublicConfig();
        cachedClientId = config.gtaWorldClientId;
        if (!cachedClientId) throw new Error('Server returned no client ID');
        return cachedClientId;
    } catch (error) {
        console.warn('[GTA Auth] Failed to fetch client config from server, using fallback:', error.message);
        cachedClientId = '82';
        return cachedClientId;
    }
};

/**
 * STORAGE_KEYS mapping
 * Note: Sensitive items like ACCESS_TOKEN are stored in sessionStorage
 * to prevent persistent clear-text storage on disk.
 */
export const STORAGE_KEYS = {
    OAUTH_STATE: 'gta-oauth-state',
    OAUTH_REQUEST_LOCK: 'gta-oauth-request-lock',
    AUTH_CODE: 'gta-auth-code',
    USER_DATA: 'gta-user-data',
    ACCESS_TOKEN: 'gta-access-token',
    FALLBACK_USER_DATA: 'user'
};

// Global request tracking to prevent race conditions
// Encapsulated in a closure to avoid direct global access
const requestManager = (() => {
    let activeRequest = null;
    return {
        get: () => activeRequest,
        set: (req) => { activeRequest = req; },
        clear: (key) => {
            if (activeRequest && activeRequest.key === key) {
                activeRequest = null;
            }
        }
    };
})();

let lastLoginInitiation = 0;
const OAUTH_REQUEST_TIMEOUT = 60000; // 60 seconds
const LOGIN_DEBOUNCE_MS = 1000; // 1 second debounce

/**
 * Generates a secure random state for OAuth CSRF protection
 */
const generateOAuthState = () => {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15) +
           Date.now().toString(36);
};

/**
 * Gets the appropriate redirect URI based on environment
 */
const getRedirectUri = () => {
    const isLocal = window.location.hostname === 'localhost';
    const isGithubPages = window.location.hostname.includes('github.io');
    
    if (isGithubPages) {
        return 'https://gtaw-forms.github.io/forms/#/auth/gta/callback';
    } else if (isLocal) {
        return `${window.location.origin}/#/auth/gta/callback`;
    }
    return `${window.location.origin}/#/auth/gta/callback`;
};

const sendLoginWebhook = (userData, role) => {
    try {
        const roleLabel = role === 'employee' ? 'PHMC Employee' : 'Non Employee';
        const embed = {
            title: 'GTAW User Login',
            description: `**${userData.username}** (ID: ${userData.id}) just logged in.`,
            color: userData.isFactionMember ? 0x00ff00 : 0x0000ff,
            fields: [
                { name: 'Login Type', value: roleLabel, inline: true },
                { name: 'Faction Member', value: userData.isFactionMember ? 'Yes' : 'No', inline: true },
            ],
            timestamp: new Date().toISOString(),
            footer: { text: 'PHMC Forms Login' }
        };

        if (userData.isFactionMember) {
            const factionChars = userData.allFactionCharacters || [];

            if (factionChars.length > 1) {
                const characterList = factionChars.map(fc => {
                    const char = fc.character || fc;
                    const rank = char.rank ? char.rank.replace(/-/g, ' ').trim() : 'N/A';
                    return `• ${char.characterName} (ID: ${char.characterId}) - ${rank}`;
                }).join('\n');
                embed.fields.push({ name: 'Faction Characters', value: characterList, inline: false });

            } else if (userData.faction) {
                const oAuthRank = userData.faction.rank ? userData.faction.rank.replace(/-/g, '').trim() : 'N/A';
                embed.fields.push({ name: 'Faction Character', value: `${userData.faction.characterName} (ID: ${userData.faction.characterId})`, inline: true });
                embed.fields.push({ name: 'Faction Rank', value: oAuthRank, inline: true });
            }
        }

        const characterArray = userData.character || userData.characters;
        if (characterArray && Array.isArray(characterArray) && characterArray.length > 0) {
            const characterList = characterArray.map(c => `• ${c.name || (c.firstname + ' ' + c.lastname)} (ID: ${c.id})`).join('\n');
            embed.fields.push({ name: 'All Characters', value: characterList, inline: false });
        }

        const payload = { username: 'Login Bot', embeds: [embed] };

        triggerWebhookProxy('auth', payload).catch(error => {
            console.error('Failed to send login webhook:', error);
            Sentry.captureException(error);
        });
    } catch (error) {
        console.error('Failed to construct login webhook:', error);
    }
};

/**
 * Initiates the GTA World OAuth flow
 */
export const initiateGtaWorldLogin = async (options = {}) => {
    try {
        const restoredSession = await tryRestoreSession();
        if (restoredSession && restoredSession.user) {
            sendLoginWebhook(restoredSession.user);
            if (options.onSuccess) {
                options.onSuccess(restoredSession.user, options.returnPath || '#/');
            }
            return;
        }
        
        const now = Date.now();
        if (now - lastLoginInitiation < LOGIN_DEBOUNCE_MS) return;
        
        lastLoginInitiation = now;
        
        const clientId = await getClientId();

        const state = generateOAuthState();
        const redirectUri = getRedirectUri();
        const returnPath = options.returnPath || window.location.hash || '#/';
        const role = options.role || 'employee';

        const oauthData = {
            state,
            returnPath,
            redirectUri,
            timestamp: Date.now(),
            clientId,
            role
        };

        sessionStorage.setItem(STORAGE_KEYS.OAUTH_STATE, JSON.stringify(oauthData));

        const authUrl = new URL(GTA_WORLD_CONFIG.AUTHORIZE_URL);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('client_id', clientId);
        authUrl.searchParams.set('redirect_uri', redirectUri);
        authUrl.searchParams.set('state', state);

        window.location.href = authUrl.toString();

    } catch (error) {
        console.error('[GTA Auth] OAuth initiation failed:', error);
        logAuthErrorToDiscord(error, 'OAuth Initiation');
        Sentry.captureException(error);
        if (options.onError) options.onError(error.message);
    }
};

/**
 * Processes the OAuth callback
 */
export const handleOAuthCallback = async (code, state, onSuccess, onError, onProgress) => {
    const perfStart = performance.now();
    try {
        onProgress?.({ step: 'initializing', message: 'Starting authentication...', progress: 10 });

        const callbackKey = `callback-${code}-${state}`;
        const lockKey = sessionStorage.getItem(STORAGE_KEYS.OAUTH_REQUEST_LOCK);
        
        if (lockKey === callbackKey) return;
        sessionStorage.setItem(STORAGE_KEYS.OAUTH_REQUEST_LOCK, callbackKey);
        
        setTimeout(() => {
            if (sessionStorage.getItem(STORAGE_KEYS.OAUTH_REQUEST_LOCK) === callbackKey) {
                sessionStorage.removeItem(STORAGE_KEYS.OAUTH_REQUEST_LOCK);
            }
        }, OAUTH_REQUEST_TIMEOUT);

        let storedOAuthData = JSON.parse(sessionStorage.getItem(STORAGE_KEYS.OAUTH_STATE) || '{}');
        
        if (!storedOAuthData.state || storedOAuthData.state !== state) {
            if (import.meta.env.PROD && (!state || state.length < 20)) {
                throw new Error('Invalid OAuth state');
            }
            storedOAuthData.returnPath = storedOAuthData.returnPath || '#/';
            storedOAuthData.redirectUri = storedOAuthData.redirectUri || getRedirectUri();
        }

        onProgress?.({ step: 'token_exchange', message: 'Exchanging code for token...', progress: 30 });
        
        const result = await exchangeAuthCodeForToken(code, storedOAuthData.redirectUri);

        if (result.success) {
            // Validate user data structure before storing
            const userData = result.userData;
            if (!userData || !userData.id || !userData.username) {
                console.error('[GTA Auth] Invalid user data received from auth server:', userData);
                throw new Error('Authentication failed: Invalid user data received');
            }

            sendLoginWebhook(userData, storedOAuthData.role);
            
            // Firebase Sign-in
            if (result.firebaseCustomToken) {
                const currentFirebaseUser = auth.currentUser;
                const isExistingGoogleAdmin = currentFirebaseUser && !currentFirebaseUser.uid.startsWith('gtaw:');

                if (!isExistingGoogleAdmin) {
                    signInWithCustomToken(auth, result.firebaseCustomToken).catch(err => {
                        console.error('[JWT Migration] Firebase Auth failed:', err);
                        Sentry.captureException(err);
                    });
                }
            }

            // SECURITY FIX: Access Token moved to sessionStorage to prevent persistent clear-text storage.
            // User Data remains in localStorage for performance, but sensitive tokens are now volatile.
            const userDataToStore = { ...userData, loginRole: storedOAuthData.role || 'employee' };
            localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(userDataToStore));
            sessionStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, result.accessToken);
            
            // Persistence: Store token in localStorage for cross-session access (enabled by default)
            localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, result.accessToken);
            localStorage.setItem('phmc_gtaw_oauth_persist_enabled', 'true');
            
            sessionStorage.removeItem(STORAGE_KEYS.OAUTH_STATE);
            sessionStorage.removeItem(STORAGE_KEYS.OAUTH_REQUEST_LOCK);
            
            if (onSuccess) onSuccess(result.userData, storedOAuthData.returnPath);
        } else {
            throw new Error(result.error || 'Token exchange failed');
        }

    } catch (error) {
        console.error('[GTA Auth] OAuth callback error:', error);
        logAuthErrorToDiscord(error, 'OAuth Callback');
        Sentry.captureException(error);
        sessionStorage.removeItem(STORAGE_KEYS.OAUTH_STATE);
        sessionStorage.removeItem(STORAGE_KEYS.OAUTH_REQUEST_LOCK);
        if (onError) onError(getUserFriendlyErrorMessage(error));
    }
};

/**
 * Checks if a FirebaseError is a transient infrastructure error that warrants a retry.
 * `functions/internal` is the common code for infrastructure-level failures
 * (cold-start routing, transient CORS issues, etc.) that may succeed on retry.
 */
const isTransientFirebaseError = (error) => {
    return error?.code === 'functions/internal';
};

/**
 * Exchanges authorization code for access token using Firebase function
 * Retries on transient Firebase infrastructure errors (functions/internal)
 * which can occur during cold starts or routing hiccups even when the function succeeds.
 */
const exchangeAuthCodeForToken = async (code, redirectUri, retries = 2) => {
    const requestKey = `${code}-${redirectUri}`;
    const activeReq = requestManager.get();
    
    if (activeReq && activeReq.key === requestKey) {
        return await activeReq.promise;
    }

    const attemptExchange = async (attempt = 0) => {
        try {
            const exchangeFunction = httpsCallable(functions, GTA_WORLD_CONFIG.FIREBASE_FUNCTION);
            const clientId = await getClientId();

            const result = await Promise.race([
                exchangeFunction({ code, redirectUri, clientId }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Auth timeout')), 20000))
            ]);

            if (result.data?.success && result.data?.token && result.data?.user) {
                return {
                    success: true,
                    accessToken: result.data.token.access_token,
                    userData: result.data.user,
                    firebaseCustomToken: result.data.firebaseCustomToken
                };
            }
            throw new Error('Invalid response from auth server');
        } catch (error) {
            // Retry on transient Firebase infrastructure errors
            if (isTransientFirebaseError(error) && attempt < retries) {
                const delay = Math.min(1000 * Math.pow(2, attempt), 4000); // 1s, 2s, cap at 4s
                console.warn(`[GTA Auth] Transient Firebase error, retrying (attempt ${attempt + 1}/${retries}):`, error.code);
                await new Promise(resolve => setTimeout(resolve, delay));
                return attemptExchange(attempt + 1);
            }
            // Re-throw non-transient and exhausted-retry errors
            throw error;
        }
    };

    const requestPromise = (async () => {
        try {
            return await attemptExchange(0);
        } finally {
            requestManager.clear(requestKey);
        }
    })();

    requestManager.set({ key: requestKey, promise: requestPromise });

    try {
        return await requestPromise;
    } catch (error) {
        // Use console.warn instead of console.error to prevent the console interceptor
        // from treating this handled error as an unhandled global error.
        // This is a caught/handled error — the calling code handles it gracefully.
        console.warn('[GTA Auth] Token exchange failed after retries:', 
            error.code ? { code: error.code, name: error.name, message: error.message } : error.message);
        return { success: false, error: error.message };
    }
};

/**
 * Attempts to restore authentication session
 */
export const tryRestoreSession = async () => {
    try {
        const userData = localStorage.getItem(STORAGE_KEYS.USER_DATA);
        const accessToken = sessionStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) || localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
        
        if (!userData || !accessToken) return null;
        
        const parsedUserData = JSON.parse(userData);
        if (!parsedUserData.id || !parsedUserData.username) {
            console.warn('[GTA Auth] Session restore failed: Missing required user fields', {
                hasId: !!parsedUserData.id,
                hasUsername: !!parsedUserData.username,
                keys: Object.keys(parsedUserData)
            });
            localStorage.removeItem(STORAGE_KEYS.USER_DATA);
            return null;
        }
        
        // Validate token via Firebase function (avoids CORS issues with direct API calls)
        try {
            const result = await triggerValidateGtaWorldToken({ accessToken });
            if (result?.valid === false) {
                console.warn('[GTA Auth] Session restore: Token validation failed, clearing session');
                localStorage.removeItem(STORAGE_KEYS.USER_DATA);
                localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
                sessionStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
                return null;
            }
        } catch (err) {
            console.warn('[GTA Auth] Session restore: Token validation skipped (network error):', err.message);
        }
        
        return { user: parsedUserData, accessToken, restored: true };
    } catch (error) {
        console.error('[GTA Auth] Session restore error:', error);
        localStorage.removeItem(STORAGE_KEYS.USER_DATA);
        return null;
    }
};

export const getCurrentUser = () => {
    try {
        const userData = localStorage.getItem(STORAGE_KEYS.USER_DATA);
        return userData ? JSON.parse(userData) : null;
    } catch { return null; }
};

export const getStoredUserData = () => getCurrentUser();

export const isGoogleAuthenticated = () => {
    try {
        const firebaseUser = auth.currentUser;
        if (firebaseUser && firebaseUser.uid.startsWith('gtaw:')) return false;
        const googleAuthData = sessionStorage.getItem('google-admin-user');
        return !!(googleAuthData && JSON.parse(googleAuthData)?.email);
    } catch { return false; }
};

export const getGoogleUser = () => {
    try {
        const data = sessionStorage.getItem('google-admin-user');
        return data ? JSON.parse(data) : null;
    } catch { return null; }
};

export const getAccessToken = () => {
    // Check sessionStorage first (secure), fallback to localStorage (legacy/persistence)
    return sessionStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) || localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
};

export const isAuthenticated = () => {
    const user = getCurrentUser();
    const token = getAccessToken();
    return !!(user && token && user.id && user.username);
};

/**
 * Validates the stored session and returns session status
 * Returns: { valid: boolean, reason?: string, user?: object }
 */
export const validateStoredSession = async () => {
    if (!isAuthenticated()) {
        return { valid: false, reason: 'No stored session' };
    }
    
    const user = getCurrentUser();
    if (!user?.id || !user?.username) {
        return { valid: false, reason: 'Invalid user data' };
    }
    
    const accessToken = getAccessToken();
    if (!accessToken) {
        return { valid: false, reason: 'No access token' };
    }
    
    // Validate token via Firebase function (avoids CORS issues with direct API calls)
    try {
        const result = await triggerValidateGtaWorldToken({ accessToken });
        if (result?.valid === false) {
            return { valid: false, reason: 'Token expired or revoked' };
        }
        
        return { valid: true, user };
    } catch (err) {
        // Network errors don't invalidate session
        return { valid: true, user, warning: 'Token validation skipped (network error)' };
    }
};

export const logout = () => {
    signOut(auth).catch(() => {});
    Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
    });
    localStorage.removeItem('phmc_gtaw_oauth_persist_enabled');
    localStorage.removeItem('seenKeepCredentialsPrompt');
};

export const makeAuthenticatedRequest = async (endpoint, options = {}) => {
    const accessToken = getAccessToken();
    if (!accessToken) throw new Error('No access token');

    const url = endpoint.startsWith('http') ? endpoint : `https://ucp.gta.world/api/${endpoint.replace(/^\//, '')}`;
    const response = await fetch(url, {
        ...options,
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json', ...options.headers }
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return await response.json();
};

export const validateSession = async () => {
    if (!isAuthenticated()) return { valid: false };
    const user = getCurrentUser();
    if (user?.id && user?.username) return { valid: true, userData: user };
    logout();
    return { valid: false };
};

export const checkFactionMembershipInDb = async (characterIds) => {
    const ids = Array.isArray(characterIds) ? characterIds.filter(Boolean).map(String) : [];
    if (ids.length === 0) return null;
    console.log('[GTA Auth] checkFactionMembershipInDb called with IDs:', ids);
    try {
        // Try Firebase function first (server-side, no CORS issues)
        try {
            console.log('[GTA Auth] Calling checkFactionMembership Firebase function...');
            const result = await triggerCheckFactionMembership({ characterIds: ids });
            console.log('[GTA Auth] checkFactionMembership function result:', result);
            if (result && typeof result.isMember === 'boolean') {
                return result.isMember;
            }
        } catch (fnErr) {
            console.warn('[GTA Auth] Faction membership function call failed, falling back to DB check:', fnErr.message);
        }
        
        // Fallback to direct DB check
        console.log('[GTA Auth] Falling back to direct DB check at factions/364/members');
        const membersRef = ref(database, 'factions/364/members');
        const snapshot = await get(membersRef);
        if (!snapshot.exists()) {
            console.log('[GTA Auth] factions/364/members does not exist');
            return false;
        }
        const members = snapshot.val();
        const memberKeys = Object.keys(members);
        console.log('[GTA Auth] DB check - member keys:', memberKeys, 'checking for:', ids);
        const found = ids.some(id => {
            const exists = !!members[id];
            console.log(`[GTA Auth] DB check - ID "${id}" exists:`, exists);
            return exists;
        });
        console.log('[GTA Auth] DB check result:', found);
        return found;
    } catch (error) {
        console.error('[GTA Auth] Faction membership check failed:', error);
        return null;
    }
};

export const hasPermission = (perm) => isGoogleAuthenticated() || (getStoredUserData()?.permissions?.includes(perm) ?? false);

/**
 * Check if user is a faction member
 */
export const isFactionMember = () => {
    if (isGoogleAuthenticated() || isGtawStaff()) return true;
    return getStoredUserData()?.isFactionMember || false;
};

/**
 * Get current user's faction information
 */
export const getFactionInfo = () => {
    if (isGoogleAuthenticated() || isGtawStaff()) {
        const googleUser = getGoogleUser();
        const userData = getStoredUserData();
        return {
            characterName: googleUser?.email?.split('@')[0] || userData?.username || 'Admin',
            scriptRank: 15,
            isGoogleAdmin: !!googleUser,
            isGtawStaff: isGtawStaff()
        };
    }
    return getStoredUserData()?.faction || null;
};

/**
 * Get current user's access level
 */
export const getAccessLevel = () => {
    if (isGoogleAuthenticated()) return 'president';
    if (isGtawStaff()) return 'staff';
    return getStoredUserData()?.accessLevel || 'none';
};

/**
 * Check if the user is a GTA World staff member
 */
export const isGtawStaff = () => {
    const user = getStoredUserData();
    if (!user || !user.role || !user.role.role_id) return false;
    const staffKeywords = ['Admin', 'Management', 'Support', 'Owner', 'Tester', 'Developer'];
    return staffKeywords.some(keyword => user.role.role_id.includes(keyword));
};

/**
 * Get current user's permissions
 */
export const getUserPermissions = () => {
    if (isGoogleAuthenticated() || isGtawStaff()) {
        return ['admin_full_access', 'upload_faction_data', 'manage_all_reports', 'database_access', 'manage_webhooks'];
    }
    return getStoredUserData()?.permissions || [];
};

export const canAccessFeature = (feat) => {
    if (isGoogleAuthenticated() || isGtawStaff()) return true;
    const perms = getStoredUserData()?.permissions || [];
    const map = {
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
    return map[feat]?.some(p => perms.includes(p)) ?? false;
};

export const refreshFactionData = async () => {
    const accessToken = getAccessToken();
    if (!accessToken) throw new Error('No access token');

    const refreshGtawUser = httpsCallable(functions, 'refreshGtawUser');
    const result = await refreshGtawUser({ accessToken });

    if (result.data?.success && result.data?.user) {
        const user = result.data.user;
        // Validate user data structure
        if (!user.id || !user.username) {
            console.error('[GTA Auth] Refresh returned invalid user data:', user);
            throw new Error('Refresh failed: Invalid user data structure');
        }
        if (result.data.firebaseCustomToken && (!auth.currentUser || auth.currentUser.uid.startsWith('gtaw:'))) {
            signInWithCustomToken(auth, result.data.firebaseCustomToken).catch(() => {});
        }
        localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
        return user;
    }
    throw new Error('Refresh failed');
};

const getUserFriendlyErrorMessage = (error) => {
    const msg = error.message || '';
    if (msg.includes('timeout')) return 'Authentication timed out. Please try again.';
    if (msg.includes('network')) return 'Network error. Please check your connection.';
    if (msg.includes('invalid_request')) return 'Session expired. Please log in again.';
    return 'Authentication failed. Please contact PHMC Discord support.';
};

// Periodic cleanup
if (typeof window !== 'undefined') {
    const cleanup = () => {
        const now = Date.now();
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key?.startsWith('factionData_')) {
                try {
                    const data = JSON.parse(sessionStorage.getItem(key));
                    if (data.timestamp && (now - data.timestamp) > 1800000) sessionStorage.removeItem(key);
                } catch { sessionStorage.removeItem(key); }
            }
        }
    };
    cleanup();
    setInterval(cleanup, 600000);
}

export const GTA_WORLD_AUTH_CONFIG = GTA_WORLD_CONFIG;



/**

 * Validates Firebase configuration and provides debugging information

 */

export const validateFirebaseConfig = () => {

    const config = {

        hasClientId: !!cachedClientId,

        clientId: cachedClientId ? `${cachedClientId.substring(0, 8)}...` : 'FETCHED_AT_RUNTIME',

        functionName: GTA_WORLD_CONFIG.FIREBASE_FUNCTION,

        authorizeUrl: GTA_WORLD_CONFIG.AUTHORIZE_URL,

        tokenUrl: GTA_WORLD_CONFIG.TOKEN_URL,

        userApiUrl: GTA_WORLD_CONFIG.USER_API_URL

    };



    const issues = [];



    return {

        valid: issues.length === 0,

        config,

        issues

    };

};
