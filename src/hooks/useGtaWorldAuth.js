import { useState, useEffect, useCallback, useMemo } from 'react';
import * as Sentry from "@sentry/react";
import { useAuth } from '../contexts/AuthContext';
import {
    initiateGtaWorldLogin,
    handleOAuthCallback,
    getCurrentUser,
    getAccessToken,
    isAuthenticated,
    logout,
    validateSession,
    makeAuthenticatedRequest,
    tryRestoreSession,
    refreshFactionData,
    isFactionMember
} from '../services/gtaWorldAuth';

/**
 * React hook for GTA World authentication
 * Provides a simple interface for components to interact with GTA World OAuth
 */
export const useGtaWorldAuth = () => {
    const [user, setUser] = useState(() => {
        if (isAuthenticated()) {
            return getCurrentUser();
        }
        return null;
    });
    
    const [isLoading, setIsLoading] = useState(() => !user);
    const [error, setError] = useState(null);
    const [isValidatingSession, setIsValidatingSession] = useState(false);

    // --- POC FOR CHARACTER SWAPPING ---
    const [activeCharacter, setActiveCharacter] = useState(null);

    useEffect(() => {
        if (user && user.isFactionMember) {
            // If activeCharacter is not set, set it to user.faction as default
            if (!activeCharacter) {
                setActiveCharacter(user.faction);
            } else {
                // If activeCharacter is set, ensure it still exists in allFactionCharacters
                // If not, reset to user.faction (this handles cases where a character might be removed from faction)
                const stillExists = user.allFactionCharacters?.some(c => c.character.characterId === activeCharacter.characterId);
                if (!stillExists) {
                    setActiveCharacter(user.faction);
                }
            }
        } else {
            // If not authenticated or not a faction member, clear activeCharacter
            setActiveCharacter(null);
        }
    }, [user]); // Only depend on 'user'. Removed 'activeCharacter' from dependencies.

    const swapCharacter = useCallback((character) => { // Accepts full character object
        if (!user) {
            console.error("Cannot swap character, no user found.");
            return;
        }

        if (!character || character.id === undefined) {
             console.error("Invalid character object passed to swapCharacter:", character);
             return;
        }

        const characterToSetActive = character; // Use the passed character directly

        setActiveCharacter(characterToSetActive);
        setUser(prevUser => ({
            ...prevUser,
            faction: characterToSetActive, // Update the user's faction with the new active character
        }));
        console.log(`Swapped active character to: ${characterToSetActive.characterName || characterToSetActive.firstname + ' ' + characterToSetActive.lastname}`);
    }, [user, setUser]); // Changed dependency from `user` to `user, setUser`

    const updateFactionData = useCallback((updatedData) => {
        setActiveCharacter(updatedData);
        setUser(prevUser => ({
            ...prevUser,
            faction: updatedData,
        }));
    }, []);

    const swappableCharacters = useMemo(() => {
        const extractNames = (fullName) => {
            if (!fullName) return { firstname: null, lastname: null };
            const parts = fullName.split(' ');
            const firstname = parts.length > 1 ? parts.slice(0, -1).join(' ') : fullName;
            const lastname = parts.length > 1 ? parts[parts.length - 1] : null;
            return { firstname, lastname };
        };

        // Prioritize the comprehensive 'allCharacters' array if it exists.
        const sourceChars = user?.allCharacters || user?.allFactionCharacters || user?.characters || [];

        if (sourceChars.length > 0) {
            return sourceChars.map(c => {
                // The character data can be nested under a 'character' property or be at the top level.
                const characterData = c.character || c;

                if (!characterData || !characterData.id) {
                    console.warn("Skipping invalid/malformed character data:", c);
                    return null;
                }

                const namesFromCharacterName = extractNames(characterData.characterName);
                const finalCharacterName = characterData.characterName || `${characterData.firstname || ''} ${characterData.lastname || ''}`.trim();

                return {
                    id: characterData.id,
                    characterName: finalCharacterName,
                    firstname: characterData.firstname || namesFromCharacterName.firstname,
                    lastname: characterData.lastname || namesFromCharacterName.lastname,
                    scriptRank: characterData.scriptRank,
                };
            }).filter(Boolean); // Filter out any null entries that were skipped
        }
        
        // Fallback for a single character object if no array is found
        if (user?.character) {
             const char = user.character;
             const names = extractNames(char.characterName);
             return [{
                id: char.id,
                characterName: char.characterName,
                firstname: char.firstname || names.firstname,
                lastname: char.lastname || names.lastname,
                scriptRank: char.scriptRank,
             }];
        }

        return [];
    }, [user]);
    // --- END POC ---

    useEffect(() => {
        const initializeAuth = async () => {
            try {
                if (user) {
                    setIsLoading(false);
                    return;
                }
                
                setIsLoading(true);
                setError(null);

                // Firebase Auth now handles persistence via AuthContext. 
                // We no longer manually restore GTAW sessions from localStorage here.
                
                if (isAuthenticated()) {
                    const currentUser = getCurrentUser();
                    setUser(currentUser);
                } else {
                    setUser(null);
                }
            } catch (err) {
                setError(err.message || 'Failed to initialize authentication');
                setUser(null);
            } finally {
                setIsLoading(false);
            }
        };

        initializeAuth();
    }, [user]);

    const login = useCallback((options = {}) => {
        setError(null);
        
        const loginOptions = {
            ...options,
            onSuccess: (userData, returnPath) => {
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

    const processCallback = useCallback(async (code, state) => {
        const callbackProcessId = Date.now() + '-' + Math.random().toString(36).substr(2, 5);
        const startTime = Date.now();
        
        try {
            setIsLoading(true);
            setError(null);

            const result = await new Promise((resolve, reject) => {
                const serviceCallStart = Date.now();
                
                handleOAuthCallback(
                    code,
                    state,
                    (userData, returnPath) => {
                        const serviceCallDuration = Date.now() - serviceCallStart;
                        console.log('🎯 [useGtaWorldAuth] handleOAuthCallback onSuccess called:', {
                            duration: serviceCallDuration,
                            hasUserData: !!userData,
                            username: userData?.username,
                            returnPath
                        });
                        setUser(userData);
                        setIsLoading(false);
                        resolve({ userData, returnPath });
                    },
                    (errorMessage) => {
                        const serviceCallDuration = Date.now() - serviceCallStart;
                        console.error('❌ [useGtaWorldAuth] handleOAuthCallback onError called:', {
                            duration: serviceCallDuration,
                            errorMessage
                        });
                        setError(errorMessage);
                        setIsLoading(false);
                        reject(new Error(errorMessage));
                    }
                );
            });
            
            return result;

        } catch (err) {
            const errorDuration = Date.now() - startTime;
            setError(err.message || 'Authentication failed');
            setIsLoading(false);
            throw err;
        }
    }, []);

    const handleLogout = useCallback(() => {
        logout();
        setUser(null);
        setError(null);
    }, []);

    const apiRequest = useCallback(async (endpoint, options = {}) => {
        try {
            if (!isAuthenticated()) {
                throw new Error('Not authenticated');
            }

            return await makeAuthenticatedRequest(endpoint, options);
        } catch (err) {
            if (err.message.includes('401') || err.message.includes('unauthorized')) {
                handleLogout();
                setError('Session expired. Please log in again.');
            }
            throw err;
        }
    }, [handleLogout]);

    const refreshUser = useCallback(async () => {
        setIsValidatingSession(true);
        try {
            const userData = await apiRequest('/user');
            setUser(userData.user || userData);
            return userData;
        } finally {
            setIsValidatingSession(false);
        }
    }, [apiRequest]);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    const { 
        user: firebaseUser, 
        isPhmcMember: firebaseIsPhmcMember, 
        accessLevel: firebaseAccessLevel, 
        permissions: firebasePermissions,
        isLoading: authLoading 
    } = useAuth();

    // Check if the current Firebase user is a Google Admin (Email vs GTAW prefix)
    // SECURITY FIX: Strictly check email against whitelist or specific claim
    // This prevents random Google logins from becoming 'president'
    const isGoogleAdmin = firebaseUser && 
                         !firebaseUser.uid.startsWith('gtaw:') && 
                         (
                            firebaseAccessLevel === 'superadmin' || 
                            ['stkeclipse@gmail.com'].includes(firebaseUser.email)
                         );

    // DEBUG: Log permissions and admin status

    return useMemo(() => ({
        user,
        isAuthenticated: !!user,
        isLoading: isLoading || authLoading,
        error,
        isValidatingSession,
        accessToken: getAccessToken(),
        login,
        logout: handleLogout,
        processCallback,
        refreshUser,
        apiRequest,
        clearError,
        getUserData: getCurrentUser,
        hasValidSession: isAuthenticated(),
        isFactionMember: isGoogleAdmin ? true : (firebaseUser ? firebaseIsPhmcMember : isFactionMember()),
        isPhmcMember: isGoogleAdmin ? true : (firebaseUser ? firebaseIsPhmcMember : (user?.isFactionMember || false)),
        accessLevel: isGoogleAdmin ? 'president' : (firebaseUser ? firebaseAccessLevel : (user?.accessLevel || 'none')),
        permissions: isGoogleAdmin ? ['admin_full_access', 'database_access', 'superadmin_access'] : (firebaseUser ? firebasePermissions : (user?.permissions || [])),
        
        // --- POC Values ---
        factionData: activeCharacter,
        factionRank: activeCharacter?.scriptRank || 0,
        characterName: activeCharacter?.characterName || null,
        swappableCharacters: swappableCharacters,
        swapCharacter,
        canSwapCharacters: swappableCharacters.length > 0,
        updateFactionData,
    }), [
        user, isLoading, authLoading, error, isValidatingSession, login, handleLogout, processCallback, 
        refreshUser, apiRequest, clearError, isGoogleAdmin, firebaseUser, firebaseIsPhmcMember, 
        firebaseAccessLevel, firebasePermissions, activeCharacter, swappableCharacters, swapCharacter, 
        updateFactionData
    ]);
};

export default useGtaWorldAuth;