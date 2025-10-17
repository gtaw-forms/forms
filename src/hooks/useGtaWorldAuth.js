import { useState, useEffect, useCallback } from 'react';
import {
    initiateGtaWorldLogin,
    handleOAuthCallback,
    getCurrentUser,
    getAccessToken,
    isAuthenticated,
    logout,
    validateSession,
    makeAuthenticatedRequest
} from '../services/gtaWorldAuth';

/**
 * React hook for GTA World authentication
 * Provides a simple interface for components to interact with GTA World OAuth
 */
export const useGtaWorldAuth = () => {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isValidatingSession, setIsValidatingSession] = useState(false);

    // Initialize authentication state on mount
    useEffect(() => {
        const initializeAuth = async () => {
            try {
                setIsLoading(true);
                setError(null);

                // Check if user is already authenticated
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
    }, []);

    /**
     * Initiates the GTA World login process
     */
    const login = useCallback((options = {}) => {
        setError(null);
        
        const loginOptions = {
            ...options,
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