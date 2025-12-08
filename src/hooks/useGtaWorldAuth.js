import { useState, useEffect, useCallback, useMemo } from 'react';
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

        if (user?.allFactionCharacters && user.allFactionCharacters.length > 0) {
            return user.allFactionCharacters.map(fc => {
                // Robustly handle both nested and flat structures to prevent crashes
                const characterData = fc.character || fc;

                if (!characterData || !characterData.characterId) {
                    console.warn("Skipping invalid/malformed character data in allFactionCharacters:", fc);
                    return null;
                }

                const namesFromCharacterName = extractNames(characterData.characterName);
                return {
                    id: characterData.characterId,
                    characterName: characterData.characterName,
                    firstname: characterData.firstname || namesFromCharacterName.firstname,
                    lastname: characterData.lastname || namesFromCharacterName.lastname,
                    scriptRank: characterData.scriptRank,
                };
            }).filter(Boolean); // Filter out any null entries that were skipped
        }
        const fallbackChars = user?.character || user?.characters || [];
        return fallbackChars.map(char => {
            const namesFromCharacterName = extractNames(char.characterName);
            return {
                id: char.id,
                characterName: char.characterName || `${char.firstname || ''} ${char.lastname || ''}`.trim(),
                firstname: char.firstname || namesFromCharacterName.firstname,
                lastname: char.lastname || namesFromCharacterName.lastname,
                scriptRank: char.scriptRank || 0,
            };
        });
    }, [user]);
    // --- END POC ---

    useEffect(() => {
        const initializeAuth = async () => {
            try {
                if (user) {
                    setIsLoading(false);
                    try {
                        setIsValidatingSession(true);
                        const validation = await validateSession();
                        setIsValidatingSession(false);
                        if (!validation.valid) {
                            setUser(null);
                            setError('Session expired. Please log in again.');
                        }
                    } catch (validationError) {
                        setIsValidatingSession(false);
                    }
                    return;
                }
                
                setIsLoading(true);
                setError(null);

                const restoredSession = tryRestoreSession();
                
                if (restoredSession) {
                    setUser(restoredSession.user);
                    setIsLoading(false);
                    
                    refreshFactionData().then(updatedUser => {
                        setUser(updatedUser);
                    });

                    setIsValidatingSession(true);
                    try {
                        const validation = await validateSession();
                        setIsValidatingSession(false);
                        
                        if (!validation.valid) {
                            setUser(null);
                            setError('Session expired. Please log in again.');
                        } else {
                        }
                    } catch (validationError) {
                        setIsValidatingSession(false);
                    }
                    return;
                }

                if (isAuthenticated()) {
                    const currentUser = getCurrentUser();
                    setUser(currentUser);
                    
                    setIsValidatingSession(true);
                    const validation = await validateSession();
                    setIsValidatingSession(false);
                    
                    if (!validation.valid) {
                        setUser(null);
                        setError('Session expired. Please log in again.');
                    }
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
        try {
            setIsValidatingSession(true);
            const userData = await apiRequest('/user');
            setUser(userData.user || userData);
            return userData;
        } catch (err) {
            throw err;
        } finally {
            setIsValidatingSession(false);
        }
    }, [apiRequest]);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    const loadFromSavedProfile = useCallback((savedProfile) => {
        if (!savedProfile) return;

        // Construct a user object from the saved profile
        const userFromProfile = {
            username: savedProfile.username,
            id: savedProfile.userId,
            isFactionMember: savedProfile.isFactionMember,
            faction: savedProfile.faction,
            allFactionCharacters: savedProfile.swappableCharacters,
            character: savedProfile.swappableCharacters,
            characters: savedProfile.swappableCharacters,
            accessLevel: savedProfile.accessLevel,
            permissions: savedProfile.permissions,
        };
        setUser(userFromProfile);
        setActiveCharacter(savedProfile.faction);
        setIsLoading(false);
    }, []);

    return {
        user,
        isAuthenticated: !!user,
        isLoading,
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
        isFactionMember: isFactionMember(),
        isPhmcMember: user?.isFactionMember || false,
        
        // --- POC Values ---
        factionData: activeCharacter,
        factionRank: activeCharacter?.scriptRank || 0,
        characterName: activeCharacter?.characterName || null,
        swappableCharacters: swappableCharacters,
        swapCharacter,
        canSwapCharacters: swappableCharacters.length > 0,
        updateFactionData,
        loadFromSavedProfile,
    };
};

export default useGtaWorldAuth;