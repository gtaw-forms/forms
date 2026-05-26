import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import * as Sentry from "@sentry/react";
import { httpsCallable } from 'firebase/functions';
import { database, functions } from '../firebase';
import { auth } from '../firebase';
import { ref, onValue, get } from 'firebase/database';
import { useAuth } from './AuthContext';
import { triggerRefreshGtawUser } from '../services/firebaseFunctions';
import { useInactivityReload } from '../hooks/useInactivityReload';
import { useNotification } from './NotificationContext.jsx';
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
    checkFactionMembershipInDb,
    validateStoredSession
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
    const { showNotification, removeNotification } = useNotification();
    const [user, setUser] = useState(() => {
        if (isAuthenticated()) {
            const currentUser = getCurrentUser();
            // Validate required fields
            if (currentUser && currentUser.id && currentUser.username) {
                return currentUser;
            }
            // Corrupted session - clear it
            if (currentUser) {
                console.warn('[GtaWorldAuthContext] Clearing corrupted session on init:', {
                    hasId: !!currentUser.id,
                    hasUsername: !!currentUser.username
                });
                localStorage.removeItem('gta-user-data');
            }
        }
        return null;
    });
    
    const [sessionLostReason, setSessionLostReason] = useState(null);
    
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

    const handleLogout = useCallback((reason = null) => {
        logout();
        setUser(null);
        setError(null);
        setActiveCharacter(null);
        if (reason) {
            setSessionLostReason(reason);
            showNotification(reason, 'exclamation-triangle', 10000);
        }
    }, [showNotification]);

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

                const storedData = JSON.parse(storedOAuthData || '{}');
                const userRole = storedData.role || 'employee';
                
                // --- Post-Login Verification Logic (Migrated from UnifiedGtaCallback) ---
                if (userRole === 'employee') {
                    const loadingNotifId = showNotification('Fetching Employee Credentials...', 'spinner fa-spin', 0);
                    console.warn('⚠️ [GtaWorldAuthContext] Performing faction sync for employee...');
                    try {
                        // Wait for Firebase Auth JWT to finish provisioning
                        for (let i = 0; i < 30; i++) {
                            if (auth.currentUser) break;
                            await new Promise(r => setTimeout(r, 200));
                        }
                        const triggerSync = httpsCallable(functions, 'triggerFactionSync');
                        await triggerSync();
                        
                        // Wait for sync propagation
                        await new Promise(resolve => setTimeout(resolve, 3000));
                        
                        const accessToken = sessionStorage.getItem('gta-access-token');
                        if (accessToken) {
                            const refreshedResult = await triggerRefreshGtawUser({ accessToken });
                            if (refreshedResult?.success && refreshedResult.user) {
                                console.log('✅ [GtaWorldAuthContext] Re-check successful after sync.');
                                const refreshedUser = { ...refreshedResult.user, loginRole: storedData.role || 'employee' };
                                setUser(refreshedUser);
                                localStorage.setItem('gta-user-data', JSON.stringify(refreshedUser));
                            }
                        }
                        removeNotification(loadingNotifId);
                    } catch (syncError) {
                        removeNotification(loadingNotifId);
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

            // validate user's faction membership with grace period for transient failures
            if (user && (!code && !state || getIsInactivityWarningTriggered())) {
                // Skip faction check entirely for non-employee logins
                const loginRole = user?.loginRole || 'employee';
                if (loginRole === 'non-employee') {
                    console.log('[GtaWorldAuthContext] Non-employee login detected, skipping faction check');
                } else {
                    // For employee logins, always verify faction characters exist in DB
                    // Superadmins get isFactionMember=true automatically but may not have actual faction characters
                    const activeId = user?.faction?.characterId || user?.activeCharacter?.characterId;
                    const allIds = (user?.allFactionCharacters || [])
                        .map(c => String(c?.character?.characterId || c?.id))
                        .filter(id => id && id !== 'undefined' && id !== 'null');
                    const charIds = [...new Set([activeId ? String(activeId) : null, ...allIds].filter(id => id && id !== 'undefined' && id !== 'null'))];
                    
                    console.log('[GtaWorldAuthContext] Faction check evaluation:', {
                        loginRole,
                        firebaseIsPhmcMember,
                        storedIsMember: user?.isFactionMember === true,
                        hasFactionChar: !!activeId,
                        hasAllFactionChars: !!(user?.allFactionCharacters?.length),
                        charIds
                    });

                    if (charIds.length > 0 && !authLoading) {
                        setIsValidatingSession(true);
                        let retryCount = 0;
                        const maxRetries = 2;
                        
                        const checkWithRetry = async () => {
                            try {
                                const isMember = await checkFactionMembershipInDb(charIds);
                                console.log('[GtaWorldAuthContext] Faction DB check result:', isMember);
                                
                                if (isMember === false) {
                                    console.warn('[GtaWorldAuthContext] No faction character found in faction DB. User is not a verified faction member but session will continue.');
                                } else if (isMember === null) {
                                    if (retryCount < maxRetries) {
                                        retryCount++;
                                        console.warn(`[GtaWorldAuthContext] Faction DB check failed, retry ${retryCount}/${maxRetries}...`);
                                        setTimeout(checkWithRetry, 2000 * retryCount);
                                    } else {
                                        console.error('[GtaWorldAuthContext] Faction DB check failed after retries. Allowing session to continue.');
                                    }
                                }
                            } catch (err) {
                                console.error('[GtaWorldAuthContext] Unexpected error during faction check:', err);
                                if (retryCount < maxRetries) {
                                    retryCount++;
                                    setTimeout(checkWithRetry, 2000 * retryCount);
                                }
                            } finally {
                                setIsValidatingSession(false);
                            }
                        };
                        
                        checkWithRetry();
                    } else if (charIds.length === 0 && !authLoading) {
                        console.log('[GtaWorldAuthContext] No faction character IDs available to check. User may need faction sync.');
                    } else {
                        console.log('[GtaWorldAuthContext] Faction check deferred - Firebase auth still loading');
                    }
                }
            }
            
            // Clean up URL if there are stray params but no session state
            if (code || state) {
                const cleanHash = window.location.hash.split('?')[0];
                const newUrl = window.location.pathname + cleanHash;
                window.history.replaceState({}, document.title, newUrl);
            }
        }
    }, [processCallback, getIsInactivityWarningTriggered, firebaseIsPhmcMember, authLoading, user]);

    // SESSION VALIDATION ON MOUNT
    useEffect(() => {
        if (!user || isGoogleAdmin || isStaff || authLoading) return;
        
        // Skip token validation if stored user data confirms membership (token was valid at login)
        if (user?.isFactionMember === true) {
            console.log('[GtaWorldAuthContext] Session validation skipped - stored data confirms membership');
            return;
        }
        
        const validateSession = async () => {
            try {
                const result = await validateStoredSession();
                if (!result.valid) {
                    console.warn('[GtaWorldAuthContext] Session validation failed:', result.reason);
                    handleLogout(`Your session has expired. Reason: ${result.reason}`);
                } else if (result.warning) {
                    console.warn('[GtaWorldAuthContext] Session validation warning:', result.warning);
                }
            } catch (err) {
                console.error('[GtaWorldAuthContext] Session validation error:', err);
            }
        };
        
        validateSession();
    }, [authLoading]);

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
                handleLogout('Your faction membership has been revoked. Please contact an administrator.');
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            }
        }, (error) => {
            console.error('[GtaWorldAuthContext] Real-time membership listener error:', error);
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
        sessionLostReason,
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
        user, isLoading, authLoading, error, isValidatingSession, sessionLostReason, login, handleLogout, processCallback, 
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
