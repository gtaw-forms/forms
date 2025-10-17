import { getFunctions, httpsCallable } from 'firebase/functions';
import * as Sentry from "@sentry/react";

/**
 * Unified GTA World Authentication Service
 * Consolidates all OAuth functionality into a single service
 */

// Configuration constants
const GTA_WORLD_CONFIG = {
    AUTHORIZE_URL: 'https://ucp.gta.world/oauth/authorize',
    TOKEN_URL: 'https://ucp.gta.world/oauth/token',
    USER_API_URL: 'https://ucp.gta.world/api/v1/user',
    CLIENT_ID: process.env.REACT_APP_GTAWORLD_CLIENT_ID || '',
    FIREBASE_FUNCTION: 'exchangeAuthCodeForToken'
};

// Session storage keys
const STORAGE_KEYS = {
    OAUTH_STATE: 'gta-oauth-state',
    AUTH_CODE: 'gta-auth-code',
    USER_DATA: 'gta-user-data',
    ACCESS_TOKEN: 'gta-access-token'
};

/**
 * Generates a secure random state for OAuth CSRF protection
 */
const generateOAuthState = () => {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
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
        console.info('[GTA Auth] Initiating OAuth flow');
        
        if (!GTA_WORLD_CONFIG.CLIENT_ID) {
            throw new Error('GTA World Client ID not configured');
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

        // Validate state parameter
        const storedOAuthData = JSON.parse(sessionStorage.getItem(STORAGE_KEYS.OAUTH_STATE) || '{}');
        
        if (!storedOAuthData.state || storedOAuthData.state !== state) {
            throw new Error('Invalid OAuth state - possible CSRF attack');
        }

        console.debug('[GTA Auth] OAuth state validated successfully');

        // Clear stored OAuth state
        sessionStorage.removeItem(STORAGE_KEYS.OAUTH_STATE);

        // Exchange code for tokens using Firebase function
        const result = await exchangeAuthCodeForToken(code, storedOAuthData.redirectUri);

        if (result.success) {
            // Store user data and tokens
            sessionStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(result.userData));
            sessionStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, result.accessToken);
            
            console.info('[GTA Auth] Authentication successful');
            
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

        // Clear any stored OAuth data on error
        sessionStorage.removeItem(STORAGE_KEYS.OAUTH_STATE);
        sessionStorage.removeItem(STORAGE_KEYS.AUTH_CODE);

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
        console.debug('[GTA Auth] Calling Firebase function for token exchange');

        const functions = getFunctions();
        const exchangeFunction = httpsCallable(functions, GTA_WORLD_CONFIG.FIREBASE_FUNCTION);

        const result = await exchangeFunction({
            code,
            redirectUri,
            clientId: GTA_WORLD_CONFIG.CLIENT_ID
            // Client secret is handled server-side for security
        });

        console.debug('[GTA Auth] Token exchange response:', {
            hasData: !!result.data,
            hasToken: !!result.data?.token,
            hasUser: !!result.data?.user,
            success: result.data?.success
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

    } catch (error) {
        console.error('[GTA Auth] Token exchange failed:', error);
        
        // Parse Firebase function errors with enhanced error types
        if (error.code && error.message) {
            let userFriendlyMessage = error.message;
            
            switch (error.code) {
                case 'invalid-argument':
                    userFriendlyMessage = 'Invalid request parameters. Please try logging in again.';
                    break;
                case 'invalid-client':
                    userFriendlyMessage = 'OAuth client configuration error. Please contact support.';
                    break;
                case 'invalid-redirect-uri':
                    userFriendlyMessage = 'Invalid redirect URI. Please try again.';
                    break;
                case 'token-exchange-failed':
                    userFriendlyMessage = 'Failed to exchange authorization code. The code may have expired.';
                    break;
                case 'user-profile-failed':
                    userFriendlyMessage = 'Failed to fetch user profile from GTA World.';
                    break;
                case 'network-error':
                    userFriendlyMessage = 'Unable to connect to GTA World servers. Please try again.';
                    break;
                case 'timeout':
                    userFriendlyMessage = 'Request timed out. Please try again.';
                    break;
                case 'internal':
                default:
                    userFriendlyMessage = 'An internal error occurred. Please try again or contact support.';
                    break;
            }
            
            return {
                success: false,
                error: userFriendlyMessage,
                errorCode: error.code,
                details: error.details,
                originalMessage: error.message
            };
        }

        return {
            success: false,
            error: error.message || 'Token exchange failed',
            errorCode: 'unknown'
        };
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

        const url = endpoint.startsWith('http') ? endpoint : `${GTA_WORLD_CONFIG.USER_API_URL}${endpoint}`;
        
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

// Export configuration for external use if needed
export const GTA_WORLD_AUTH_CONFIG = GTA_WORLD_CONFIG;