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
            if (activeCharacter) {
                const stillExists = user.allFactionCharacters?.find(c => c.character.characterId === activeCharacter.characterId);
                if (!stillExists) {
                    setActiveCharacter(user.faction);
                }
            } else {
                setActiveCharacter(user.faction);
            }
        } else {
            setActiveCharacter(null);
        }
    }, [user, activeCharacter]);

    const swapCharacter = useCallback((characterId) => {
        if (!user) {
            console.error("Cannot swap character, no user found.");
            return;
        }

        const sources = [
            user.allFactionCharacters,
            user.character,
            user.characters,
        ].filter(Array.isArray);

        let characterToSetActive = null;

        for (const source of sources) {
            // Try nested structure: [{ character: { characterId: ... } }]
            const nestedFind = source.find(c => c?.character?.characterId === characterId);
            if (nestedFind) {
                characterToSetActive = nestedFind.character;
                break;
            }

            // Try flat structure: [{ id: ... }]
            const flatFind = source.find(c => c?.id === characterId);
            if (flatFind) {
                // This is a partial character. We need to find the full data if possible.
                // The best source for full data is likely allFactionCharacters if it exists.
                const fullData = user.allFactionCharacters?.find(c => c?.character?.characterId === flatFind.id)?.character;
                if (fullData) {
                    characterToSetActive = fullData;
                } else {
                    // Fallback to constructing from flat data. Rank/scriptRank will be missing.
                    characterToSetActive = {
                        characterId: flatFind.id,
                        characterName: flatFind.name || `${flatFind.firstname || ''} ${flatFind.lastname || ''}`.trim(),
                    };
                }
                break;
            }
        }

        if (characterToSetActive) {
            setActiveCharacter(characterToSetActive);
            console.log(`Swapped active character to: ${characterToSetActive.characterName}`);
        } else {
            console.error(`Character with ID ${characterId} not found for this user.`);
        }
    }, [user]);

    const updateFactionData = useCallback((updatedData) => {
        setActiveCharacter(updatedData);
        setUser(prevUser => ({
            ...prevUser,
            faction: updatedData,
        }));
    }, []);

    const swappableCharacters = user?.character || user?.characters || [];
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