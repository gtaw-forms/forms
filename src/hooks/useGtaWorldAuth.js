import { useState, useEffect, useCallback } from 'react';
import {
    initiateGtaWorldLogin,
    handleOAuthCallback,
    getCurrentUser,
    getAccessToken,
    isAuthenticated,
    logout,
    validateSession,
    makeAuthenticatedRequest,
    tryRestoreSession
} from '../services/gtaWorldAuth';

/**
 * React hook for GTA World authentication
 * Provides a simple interface for components to interact with GTA World OAuth
 */
export const useGtaWorldAuth = () => {
    // Initialize with immediate authentication check to reduce loading time
    const [user, setUser] = useState(() => {
        // Immediately check if user is authenticated on hook initialization
        if (isAuthenticated()) {
            return getCurrentUser();
        }
        return null;
    });
    
    const [isLoading, setIsLoading] = useState(() => {
        // If we found a user immediately, start with minimal loading
        return !user;
    });
    
    const [error, setError] = useState(null);
    const [isValidatingSession, setIsValidatingSession] = useState(false);

    // Initialize authentication state on mount
    useEffect(() => {
        const initializeAuth = async () => {
            try {
                // If we already have user data from initial state, validate in background
                if (user) {
                    setIsLoading(false); // Immediately stop loading since we have user data
                    
                    // Validate session in background without showing loading
                    try {
                        setIsValidatingSession(true);
                        const validation = await validateSession();
                        setIsValidatingSession(false);
                        
                        if (!validation.valid) {
                            console.warn('[GTA Auth Hook] Session invalid, logging out');
                            setUser(null);
                            setError('Session expired. Please log in again.');
                        }
                    } catch (validationError) {
                        console.error('[GTA Auth Hook] Background validation error:', validationError);
                        setIsValidatingSession(false);
                        // Don't clear user data for validation errors - keep them logged in
                    }
                    return;
                }
                
                setIsLoading(true);
                setError(null);

                // First, try to restore session from sessionStorage
                console.debug('[GTA Auth Hook] Attempting to restore session from stored data...');
                const restoredSession = tryRestoreSession();
                
                if (restoredSession) {
                    console.info('[GTA Auth Hook] Session restored successfully from stored data');
                    setUser(restoredSession.user);
                    setIsLoading(false);
                    
                    // Validate the restored session in the background
                    setIsValidatingSession(true);
                    try {
                        const validation = await validateSession();
                        setIsValidatingSession(false);
                        
                        if (!validation.valid) {
                            console.warn('[GTA Auth Hook] Restored session invalid, logging out');
                            setUser(null);
                            setError('Session expired. Please log in again.');
                        } else {
                            console.info('[GTA Auth Hook] Restored session validated successfully');
                        }
                    } catch (validationError) {
                        console.error('[GTA Auth Hook] Restored session validation error:', validationError);
                        setIsValidatingSession(false);
                        // Keep user logged in even if validation fails
                    }
                    return;
                }

                // Fallback to traditional authentication check
                if (isAuthenticated()) {
                    const currentUser = getCurrentUser();
                    setUser(currentUser);
                    
                    // Validate the session in the background
                    setIsValidatingSession(true);
                    const validation = await validateSession();
                    setIsValidatingSession(false);
                    
                    if (!validation.valid) {
                        console.warn('[GTA Auth Hook] Session invalid, logging out');
                        setUser(null);
                        setError('Session expired. Please log in again.');
                    }
                } else {
                    console.debug('[GTA Auth Hook] No authentication data found');
                    setUser(null);
                }
            } catch (err) {
                console.error('[GTA Auth Hook] Initialization error:', err);
                setError(err.message || 'Failed to initialize authentication');
                setUser(null);
            } finally {
                setIsLoading(false);
            }
        };

        initializeAuth();
    }, [user]); // Include user in dependencies to re-validate when user changes externally

    /**
     * Initiates the GTA World login process
     */
    const login = useCallback((options = {}) => {
        setError(null);
        
        const loginOptions = {
            ...options,
            onSuccess: (userData, returnPath) => {
                console.info('[GTA Auth Hook] Login successful, updating state:', userData);
                setUser(userData);
                if (options.onSuccess) {
                    options.onSuccess(userData, returnPath);
                }
            },
            onError: (errorMessage) => {
                setError(errorMessage);
                if (options.onError) {
                    options.onError(errorMessage);
                }
            }
        };

        initiateGtaWorldLogin(loginOptions);
    }, []);

    /**
     * Processes OAuth callback
     */
    const processCallback = useCallback(async (code, state) => {
        try {
            setIsLoading(true);
            setError(null);

            await new Promise((resolve, reject) => {
                handleOAuthCallback(
                    code,
                    state,
                    (userData, returnPath) => {
                        setUser(userData);
                        setIsLoading(false);
                        resolve({ userData, returnPath });
                    },
                    (errorMessage) => {
                        setError(errorMessage);
                        setIsLoading(false);
                        reject(new Error(errorMessage));
                    }
                );
            });

        } catch (err) {
            console.error('[GTA Auth Hook] Callback processing error:', err);
            setError(err.message || 'Authentication failed');
            setIsLoading(false);
            throw err;
        }
    }, []);

    /**
     * Logs out the current user
     */
    const handleLogout = useCallback(() => {
        logout();
        setUser(null);
        setError(null);
    }, []);

    /**
     * Makes an authenticated API request
     */
    const apiRequest = useCallback(async (endpoint, options = {}) => {
        try {
            if (!isAuthenticated()) {
                throw new Error('Not authenticated');
            }

            return await makeAuthenticatedRequest(endpoint, options);
        } catch (err) {
            // If the request fails due to authentication, clear the session
            if (err.message.includes('401') || err.message.includes('unauthorized')) {
                handleLogout();
                setError('Session expired. Please log in again.');
            }
            throw err;
        }
    }, [handleLogout]);

    /**
     * Refreshes user data from the API
     */
    const refreshUser = useCallback(async () => {
        try {
            setIsValidatingSession(true);
            const userData = await apiRequest('/user');
            setUser(userData.user || userData);
            return userData;
        } catch (err) {
            console.error('[GTA Auth Hook] Failed to refresh user data:', err);
            throw err;
        } finally {
            setIsValidatingSession(false);
        }
    }, [apiRequest]);

    /**
     * Clears the current error
     */
    const clearError = useCallback(() => {
        setError(null);
    }, []);

    return {
        // Authentication state
        user,
        isAuthenticated: !!user,
        isLoading,
        error,
        isValidatingSession,
        accessToken: getAccessToken(),

        // Authentication actions
        login,
        logout: handleLogout,
        processCallback,
        refreshUser,
        apiRequest,
        clearError,

        // Utility functions
        getUserData: getCurrentUser,
        hasValidSession: isAuthenticated()
    };
};

export default useGtaWorldAuth;