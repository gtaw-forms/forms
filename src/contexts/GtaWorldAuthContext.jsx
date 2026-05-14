import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import * as Sentry from "@sentry/react";
import { httpsCallable } from 'firebase/functions';
import { database, functions } from '../firebase';
import { ref, onValue, get } from 'firebase/database';
import { useAuth } from './AuthContext';
import { triggerRefreshGtawUser } from '../services/firebaseFunctions';
import { useInactivityReload } from '../hooks/useInactivityReload';
import {
    initiateGtaWorldLogin,
    handleOAuthCallback,
    getCurrentUser,
    getAccessToken,
    isAuthenticated,
    logout,
    makeAuthenticatedRequest,
    isFactionMember as checkIsFactionMember,
    isGtawStaff,
    checkFactionMembershipInDb
} from '../services/gtaWorldAuth';

const GtaWorldAuthContext = createContext(null);

// Utility to parse params from both search and hash (for HashRouter support)
const getUrlParams = () => {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.has('code')) return searchParams;
    
    const hash = window.location.hash;
    const qIndex = hash.indexOf('?');
    if (qIndex !== -1) {
        return new URLSearchParams(hash.substring(qIndex));
    }
    
    return new URLSearchParams();
};

export const GtaWorldAuthProvider = ({ children }) => {
    const { getIsInactivityWarningTriggered } = useInactivityReload();
    const [user, setUser] = useState(() => {
        if (isAuthenticated()) {
            return getCurrentUser();
        }
        return null;
    });
    
    const [isLoading, setIsLoading] = useState(() => {
        if (isAuthenticated()) return false;
        
        const params = getUrlParams();
        const hasCallback = params.has('code') && params.has('state');
        const hasInitiated = !!sessionStorage.getItem('gta-oauth-state');
        
        return hasCallback && hasInitiated;
    });
    
    const [error, setError] = useState(null);
    const [isValidatingSession, setIsValidatingSession] = useState(false);
    const [activeCharacter, setActiveCharacter] = useState(null);

    // Sync active character when user changes
    useEffect(() => {
        if (user && user.isFactionMember) {
            if (!activeCharacter) {
                setActiveCharacter(user.faction);
            } else {
                const stillExists = user.allFactionCharacters?.some(c => (c.character?.characterId || c.id) === (activeCharacter.characterId || activeCharacter.id));
                if (!stillExists) {
                    setActiveCharacter(user.faction);
                }
            }
        } else {
            setActiveCharacter(null);
        }
    }, [user]);

    const swapCharacter = useCallback((character) => {
        if (!user) return;
        if (!character || (character.id === undefined && character.characterId === undefined)) return;

        const characterToSetActive = { ...user.faction, ...character };
        setActiveCharacter(characterToSetActive);
        
        const updatedUser = { ...user, faction: characterToSetActive };
        setUser(updatedUser);
        
        try {
            localStorage.setItem('gta-user-data', JSON.stringify(updatedUser));
        } catch (e) {
            console.error("Failed to update localStorage:", e);
        }
    }, [user]);

    const updateFactionData = useCallback((updatedData) => {
        setActiveCharacter(updatedData);
        const updatedUser = { ...user, faction: updatedData };
        setUser(updatedUser);
        try {
            localStorage.setItem('gta-user-data', JSON.stringify(updatedUser));
        } catch (e) {
            console.error("Failed to update localStorage:", e);
        }
    }, [user]);

    const login = useCallback((options = {}) => {
        setError(null);
        initiateGtaWorldLogin({
            ...options,
            onSuccess: (userData, returnPath) => {
                setUser(userData);
                if (options.onSuccess) options.onSuccess(userData, returnPath);
            },
            onError: (errorMessage) => {
                setError(errorMessage);
                if (options.onError) options.onError(errorMessage);
            }
        });
    }, []);

    const processCallback = useCallback(async (code, state) => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await new Promise((resolve, reject) => {
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
            return result;
        } catch (err) {
            setError(err.message || 'Authentication failed');
            setIsLoading(false);
            throw err;
        }
    }, []);

    const handleLogout = useCallback(() => {
        logout();
        setUser(null);
        setError(null);
        setActiveCharacter(null);
    }, []);

    const clearError = useCallback(() => setError(null), []);

    const triggerFactionSync = useCallback(async () => {
        try {
            const syncFn = httpsCallable(functions, 'triggerFactionSync');
            return await syncFn();
        } catch (err) {
            console.error('[GtaWorldAuthContext] triggerFactionSync failed:', err);
            throw err;
        }
    }, []);

    const { 
        user: firebaseUser, 
        isPhmcMember: firebaseIsPhmcMember, 
        accessLevel: firebaseAccessLevel, 
        permissions: firebasePermissions,
        isLoading: authLoading 
    } = useAuth();

    const isGoogleAdmin = firebaseUser && 
                         !firebaseUser.uid.startsWith('gtaw:') && 
                         (firebaseAccessLevel === 'superadmin');

    const isStaff = isGtawStaff();

    // Swappable characters memo
    const swappableCharacters = useMemo(() => {
        if (!user) return [];
        const extractNames = (fullName) => {
            if (!fullName) return { firstname: null, lastname: null };
            const parts = fullName.split(' ');
            const firstname = parts.length > 1 ? parts.slice(0, -1).join(' ') : fullName;
            const lastname = parts.length > 1 ? parts[parts.length - 1] : null;
            return { firstname, lastname };
        };

        const apiChars = user?.character || user?.characters || [];
        const factionChars = user?.allFactionCharacters || [];
        const sourceChars = apiChars.length > 0 ? apiChars : factionChars;

        return sourceChars.map(c => {
            const characterData = c.character || c;
            if (!characterData || (!characterData.id && !characterData.characterId)) return null;
            
            // Normalize character ID to string for strict comparison
            const charId = String(characterData.characterId || characterData.id);
            
            // Use strict equality with normalized IDs
            const factionMatch = factionChars.find(fc => {
                const fcId = String(fc.character?.characterId || fc.id);
                return fcId === charId;
            });
            
            const names = extractNames(characterData.characterName || characterData.name);
            const finalName = characterData.characterName || characterData.name || (characterData.firstname ? `${characterData.firstname} ${characterData.lastname || ''}`.trim() : null) || 'Unknown';

            return {
                id: charId,
                characterId: charId,
                characterName: finalName,
                firstname: characterData.firstname || names.firstname,
                lastname: characterData.lastname || names.lastname,
                scriptRank: factionMatch?.character?.scriptRank || characterData.scriptRank || 0,
                rank: factionMatch?.character?.rank || characterData.rank || 'Non Faction Member',
                isFactionMember: !!factionMatch
            };
        }).filter(Boolean);
    }, [user]);

    // INITIALIZATION & BACKGROUND CALLBACK HANDLER
    useEffect(() => {
        const params = getUrlParams();
        const code = params.get('code');
        const state = params.get('state');
        const storedOAuthData = sessionStorage.getItem('gta-oauth-state');

        if (code && state && storedOAuthData) {
            console.log('🔄 [GtaWorldAuthContext] Background auth callback detected and verified. Processing...');
            
            // Remove code/state from URL without reloading
            const cleanHash = window.location.hash.split('?')[0];
            const newUrl = window.location.pathname + cleanHash;
            window.history.replaceState({}, document.title, newUrl);
            
            processCallback(code, state).then(async ({ userData, returnPath }) => {
                console.log('✅ [GtaWorldAuthContext] Background login successful.');
                
                // --- Post-Login Verification Logic (Migrated from UnifiedGtaCallback) ---
                if (!userData.isFactionMember) {
                    console.warn('⚠️ [GtaWorldAuthContext] User is NOT a PHMC Faction Member. Attempting sync...');
                    try {
                        const triggerSync = httpsCallable(functions, 'triggerFactionSync');
                        await triggerSync();
                        
                        // Wait for sync propagation
                        await new Promise(resolve => setTimeout(resolve, 3000));
                        
                        const accessToken = sessionStorage.getItem('gta-access-token');
                        if (accessToken) {
                            const refreshedResult = await triggerRefreshGtawUser({ accessToken });
                            if (refreshedResult?.success && refreshedResult.user) {
                                console.log('✅ [GtaWorldAuthContext] Re-check successful after sync.');
                                setUser(refreshedResult.user);
                                localStorage.setItem('gta-user-data', JSON.stringify(refreshedResult.user));
                            }
                        }
                    } catch (syncError) {
                        if (syncError.code === 'permission-denied') {
                            console.warn('[GtaWorldAuthContext] Background sync skipped (Permission Denied). This is expected for non-faction members.');
                        } else {
                            console.error('[GtaWorldAuthContext] Background sync failed:', syncError);
                        }
                    }
                }

                // Redirect to return path after logic is complete
                if (returnPath && returnPath !== window.location.hash) {
                    console.log(`➡️ [GtaWorldAuthContext] Redirecting to ${returnPath}`);
                    // Use a small timeout to ensure state has settled
                    setTimeout(() => {
                        window.location.hash = returnPath;
                    }, 500);
                }
            }).catch(err => {
                console.error('[GtaWorldAuthContext] Background callback failed:', err);
                setIsLoading(false);
            });
        } else {
            // No callback detected or no matching session state
            setIsLoading(false);

            // validate user's faction membership
            if (user && (!code && !state || getIsInactivityWarningTriggered())) {
                const activeId = user?.faction?.characterId || user?.activeCharacter?.characterId;
                const allIds = (user?.allFactionCharacters || [])
                    .map(c => String(c?.character?.characterId || c?.id))
                    .filter(Boolean);
                const charIds = [...new Set([String(activeId), ...allIds].filter(Boolean))];

                if (charIds.length > 0) {
                    setIsValidatingSession(true);
                    checkFactionMembershipInDb(charIds)
                        .then(isMember => {
                            if (isMember === false) {
                                console.warn('[GtaWorldAuthContext] No faction character found in faction DB. Clearing session.');
                                logout();
                                setUser(null);
                                setActiveCharacter(null);
                            }
                        })
                        .catch(err => {
                            console.error('[GtaWorldAuthContext] Faction membership check failed:', err);
                        })
                        .finally(() => {
                            setIsValidatingSession(false);
                        });
                }
            }
            
            // Clean up URL if there are stray params but no session state
            if (code || state) {
                const cleanHash = window.location.hash.split('?')[0];
                const newUrl = window.location.pathname + cleanHash;
                window.history.replaceState({}, document.title, newUrl);
            }
        }
    }, [processCallback, getIsInactivityWarningTriggered]);

    // REAL-TIME MEMBERSHIP ENFORCEMENT
    useEffect(() => {
        if (!user || isGoogleAdmin || isStaff) return;

        const activeId = user?.faction?.characterId || user?.activeCharacter?.characterId;
        if (!activeId) return;

        console.log(`[GtaWorldAuthContext] Setting up real-time membership listener for character ${activeId}`);
        const memberRef = ref(database, `factions/364/members/${activeId}`);

        const unsubscribe = onValue(memberRef, (snapshot) => {
            if (!snapshot.exists()) {
                console.warn('[GtaWorldAuthContext] Real-time check: Membership revoked or character deleted from DB. Logging out...');
                handleLogout();
                // We use a small delay before reload to ensure state settles
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            }
        });

        return () => {
            console.log('[GtaWorldAuthContext] Cleaning up real-time membership listener');
            unsubscribe();
        };
    }, [user, isGoogleAdmin, isStaff, handleLogout]);

    const value = useMemo(() => ({
        user,
        username: user?.username || null,
        isAuthenticated: !!user,
        isLoading: isLoading || authLoading,
        error,
        isValidatingSession,
        login,
        logout: handleLogout,
        processCallback,
        clearError,
        isFactionMember: (isGoogleAdmin || isStaff) ? true : (firebaseUser ? firebaseIsPhmcMember : checkIsFactionMember()),
        isPhmcMember: (isGoogleAdmin || isStaff) ? true : (firebaseUser ? firebaseIsPhmcMember : (user?.isFactionMember || false)),
        accessLevel: isGoogleAdmin ? 'president' : isStaff ? 'staff' : (firebaseUser ? firebaseAccessLevel : (user?.accessLevel || 'none')),
        permissions: (isGoogleAdmin || isStaff) ? ['admin_full_access', 'database_access', 'superadmin_access', 'upload_faction_data', 'manage_all_reports', 'manage_webhooks'] : (firebaseUser ? firebasePermissions : (user?.permissions || [])),
        factionData: activeCharacter,
        factionRank: activeCharacter?.scriptRank || 0,
        characterName: activeCharacter?.characterName || null,
        swappableCharacters,
        swapCharacter,
        canSwapCharacters: swappableCharacters.length > 0,
        updateFactionData,
        triggerFactionSync,
    }), [
        user, isLoading, authLoading, error, isValidatingSession, login, handleLogout, processCallback, 
        clearError, isGoogleAdmin, firebaseUser, firebaseIsPhmcMember, firebaseAccessLevel, 
        firebasePermissions, activeCharacter, swappableCharacters, swapCharacter, updateFactionData,
        triggerFactionSync
    ]);

    return (
        <GtaWorldAuthContext.Provider value={value}>
            {children}
        </GtaWorldAuthContext.Provider>
    );
};

export const useGtaWorldAuthContext = () => {
    const context = useContext(GtaWorldAuthContext);
    if (!context) throw new Error('useGtaWorldAuthContext must be used within a GtaWorldAuthProvider');
    return context;
};
