import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import * as Sentry from "@sentry/react";
import { httpsCallable } from 'firebase/functions';
import { database, functions } from '../firebase';
import { auth } from '../firebase';
import { ref, onValue, get } from 'firebase/database';
import { useAuth } from './AuthContext';
import { triggerRefreshGtawUser } from '../services/firebaseFunctions';
import { useInactivityReload } from '../hooks/useInactivityReload';
import { useNotification } from './NotificationContext.jsx';
import { logIdentityRefresh } from '../utils/logging';
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
    storeUser,
    clearUser,
    checkFactionMembershipInDb,
    validateStoredSession,
    tryRestoreFirebaseAuth
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
    const { showNotification } = useNotification();
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
                clearUser();
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
    const [credentialsLoading, setCredentialsLoading] = useState(false);

    // Tracks an in-flight OAuth callback so re-runs of the initialization effect
    // (triggered by Firebase authLoading flaps during sign-in) never treat the
    // callback as finished and drop isLoading to false while it is still running.
    const oauthInFlightRef = useRef(false);

    // Pristine OAuth faction data — set once at login during render, never
    // overwritten by character swaps. Used as a fallback in swappableCharacters
    // when allFactionCharacters is empty, so the original login character
    // always shows the correct rank and membership in the switch dropdown.
    const pristineFactionRef = useRef(null);
    if (!pristineFactionRef.current && user?.faction) {
        pristineFactionRef.current = user.faction;
        console.log('[GtaWorldAuthContext] Pristine faction preserved:', pristineFactionRef.current?.characterName, pristineFactionRef.current?.rank);
    }

    // Sync active character when user changes
    useEffect(() => {
        // Non-employees don't have faction data — don't override activeCharacter
        if (user?.loginRole === 'non-employee') return;
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

        // Build from the swappable character data + pristine OAuth fallback.
        // Do NOT spread from user.faction — that has the PREVIOUS character's
        // data and would leak stale fields (e.g. wrong rank, wrong badge).
        const charId = String(character.characterId || character.id);
        const pristineId = String(pristineFactionRef.current?.characterId || pristineFactionRef.current?.id || '');
        const isPristine = pristineId === charId;
        const fallback = isPristine ? pristineFactionRef.current : null;

        const characterToSetActive = {
            ...(fallback || {}),
            ...character,
        };
        setActiveCharacter(characterToSetActive);

        const updatedUser = { ...user, faction: characterToSetActive };
        setUser(updatedUser);

        try {
            storeUser(updatedUser);
        } catch (e) {
            console.error("Failed to update localStorage:", e);
        }
    }, [user]);

    const updateFactionData = useCallback((updatedData) => {
        setActiveCharacter(updatedData);
        const updatedUser = { ...user, faction: updatedData };
        setUser(updatedUser);
        try {
            storeUser(updatedUser);
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
        hadCharacter.current = false;
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

        // Reliable OAuth login data — never overwritten by character swaps.
        // Used as fallback when allFactionCharacters is sparse or empty.
        const pristineFaction = pristineFactionRef.current;
        const activeFactionId = pristineFaction ? String(pristineFaction.characterId || pristineFaction.id) : null;

        return sourceChars.map(c => {
            const characterData = c.character || c;
            if (!characterData || (!characterData.id && !characterData.characterId)) return null;

            const charId = String(characterData.characterId || characterData.id);

            // Try matching against allFactionCharacters first
            const factionMatch = factionChars.find(fc => {
                const fcId = String(fc.character?.characterId || fc.id);
                return fcId === charId;
            });

            // Fallback: if no match in allFactionCharacters, check if this
            // character is the one the user originally logged in with (pristine
            // OAuth data). This handles the case where allFactionCharacters
            // hasn't been populated — the login character always shows correct
            // rank and membership regardless of character swaps.
            const isPristineFallback = !factionMatch && activeFactionId && activeFactionId === charId;
            const effectiveFaction = factionMatch || (isPristineFallback ? pristineFaction : null);

            const names = extractNames(characterData.characterName || characterData.name);
            const finalName = characterData.characterName || characterData.name || (characterData.firstname ? `${characterData.firstname} ${characterData.lastname || ''}`.trim() : null) || 'Unknown';

            return {
                id: charId,
                characterId: charId,
                characterName: finalName,
                firstname: characterData.firstname || names.firstname,
                lastname: characterData.lastname || names.lastname,
                scriptRank: effectiveFaction?.character?.scriptRank || effectiveFaction?.scriptRank || characterData.scriptRank || 0,
                rank: effectiveFaction?.character?.rank || effectiveFaction?.rank || characterData.rank || 'Non Faction Member',
                isFactionMember: !!effectiveFaction
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
            // Guard against re-running this branch while the OAuth callback is
            // already being processed (this effect re-runs when authLoading/user
            // flap during Firebase sign-in).
            if (oauthInFlightRef.current) return;
            oauthInFlightRef.current = true;

            console.log('🔄 [GtaWorldAuthContext] Background auth callback detected and verified. Processing...');

            // Remove code/state from URL without reloading
            const cleanHash = window.location.hash.split('?')[0];
            const newUrl = window.location.pathname + cleanHash;
            window.history.replaceState({}, document.title, newUrl);
            
            processCallback(code, state).then(async ({ userData, returnPath }) => {

                const storedData = JSON.parse(storedOAuthData || '{}');
                const userRole = storedData.role || 'employee';
                
                // --- Post-Login Verification Logic (Migrated from UnifiedGtaCallback) ---
                if (userRole === 'employee') {
                    setCredentialsLoading(true);
                    console.warn('⚠️ [GtaWorldAuthContext] Performing faction sync for employee...');
                    try {
                        // Wait for Firebase Auth JWT to finish provisioning using
                        // an onAuthStateChanged listener (not polling). This correctly
                        // resolves even if signInWithCustomToken completes asynchronously.
                        const waitForFirebaseAuth = (timeoutMs = 10000) => new Promise((resolve, reject) => {
                            if (auth.currentUser) return resolve(auth.currentUser);
                            const timeout = setTimeout(() => {
                                unsubscribe();
                                reject(new Error('Firebase auth did not become available within timeout'));
                            }, timeoutMs);
                            const unsubscribe = auth.onAuthStateChanged(user => {
                                clearTimeout(timeout);
                                unsubscribe();
                                if (user) resolve(user);
                                else reject(new Error('Firebase auth state is null after signIn'));
                            });
                        });

                        try {
                            await waitForFirebaseAuth(10000);
                        } catch (fbAuthTimeout) {
                            console.warn('[GtaWorldAuthContext] Firebase auth did not become available:', fbAuthTimeout.message);
                            // Attempt silent recovery using stored access token
                            const restored = await tryRestoreFirebaseAuth();
                            if (!restored) {
                                console.warn('[GtaWorldAuthContext] Proceeding with faction sync despite no Firebase auth');
                            }
                        }
                        const triggerSync = httpsCallable(functions, 'triggerFactionSync');
                        await triggerSync();
                        
                        // Wait for sync propagation
                        await new Promise(resolve => setTimeout(resolve, 3000));
                        
                        const accessToken = getAccessToken();
                        if (accessToken) {
                            const refreshedResult = await triggerRefreshGtawUser({ accessToken });
                            if (refreshedResult?.success && refreshedResult.user) {
                                console.log('✅ [GtaWorldAuthContext] Re-check successful after sync.');
                                const refreshedUser = { ...refreshedResult.user, loginRole: storedData.role || 'employee' };
                                setUser(refreshedUser);
                                storeUser(refreshedUser);
                            }
                        }
                        setCredentialsLoading(false);
                    } catch (syncError) {
                        setCredentialsLoading(false);
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
            }).finally(() => {
                oauthInFlightRef.current = false;
            });
        } else {
            // No callback detected or no matching session state.
            // Only clear isLoading when no OAuth callback is in flight — otherwise a
            // re-run mid-callback would hide the loader while the flow is still going.
            if (!oauthInFlightRef.current) {
                setIsLoading(false);
            }

            // validate user's faction membership with grace period for transient failures
            if (user && (!code && !state || getIsInactivityWarningTriggered())) {
                // Skip faction check entirely for non-employee logins
                const loginRole = user?.loginRole || 'employee';
                if (loginRole === 'non-employee') {
                    console.log('[GtaWorldAuthContext] Non-employee login detected, skipping faction check');
                    // Populate activeCharacter from available user data so characterName resolves
                    if (!activeCharacter) {
                        const source = user?.faction || user?.character?.[0];
                        if (source) {
                            setActiveCharacter(normalizeChar(source));
                        }
                    }
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

            // Session recovery: if we have stored user data but no Firebase auth,
            // attempt silent re-authentication so Firebase-backed features work
            // without the user having to log out and back in.
            // Non-employees are never faction members, so skip recovery entirely.
            if (user && !auth.currentUser && !isGoogleAdmin && !isStaff && user?.loginRole !== 'non-employee') {
                console.log('[GtaWorldAuthContext] Stored session found but no Firebase auth. Attempting recovery...');
                tryRestoreFirebaseAuth().then(restored => {
                    if (restored) {
                        console.log('[GtaWorldAuthContext] Firebase auth recovered. Re-running faction sync.');
                        const syncFn = httpsCallable(functions, 'triggerFactionSync');
                        syncFn().catch(err => {
                            if (!err.code?.includes('permission-denied')) {
                                console.error('[GtaWorldAuthContext] Recovery sync failed:', err);
                            }
                        });
                    }
                });
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

    // ── BACKGROUND IDENTITY PROFILE REFRESH ──
    // On a revisit, silently re-sync the GTAW profile so the form's
    // coroner/PHMC credentials auto-fill without a manual log-out/in (users
    // reported that "logging out and back in" fixes blank credentials). Bounded
    // retries; only *prompts* re-auth if it still can't resolve. Never
    // auto-logs-out. Exposes identityRefreshStatus for a "Welcome back, verifying
    // your credentials" marker in the UI.
    const [identityRefreshStatus, setIdentityRefreshStatus] = useState('idle'); // idle | refreshing | success | failed
    const IDENTITY_REFRESH_MAX = 2;
    const IDENTITY_REFRESH_COOLDOWN_MS = 12 * 60 * 60 * 1000; // 12h periodic re-sync
    const identityAttemptsKey = 'identityRefreshAttempts';
    const identityLastKey = 'lastIdentityRefreshAt';

    useEffect(() => {
        if (!user || isGoogleAdmin || isStaff || authLoading) return;
        if (user?.loginRole === 'non-employee') return;

        const faction = user.faction || null;
        const factionStale = !!faction && !(faction.characterId || faction.id);
        const lastRefresh = Number(localStorage.getItem(identityLastKey) || 0);
        const needsPeriodic = user?.isFactionMember === true && (Date.now() - lastRefresh) > IDENTITY_REFRESH_COOLDOWN_MS;

        // Healthy session — no-op (no refresh, no log).
        if (!factionStale && !needsPeriodic) return;

        const attempts = Number(sessionStorage.getItem(identityAttemptsKey) || 0);
        if (attempts >= IDENTITY_REFRESH_MAX) {
            // Exhausted this session's budget. Prompt (once) only for the stale
            // case; periodic re-sync simply waits for the next visit.
            if (factionStale) {
                showNotification('Your identity couldn\u2019t be refreshed — please log out and back in to restore report signing.', 'warning');
            }
            return;
        }
        const attempt = attempts + 1;
        sessionStorage.setItem(identityAttemptsKey, String(attempt));

        let accessToken = null;
        try {
            accessToken = getAccessToken();
        } catch (err) {
            console.warn('[IdentityRefresh] No access token for profile refresh:', err?.message || err);
            return;
        }
        if (!accessToken) return;

        const trigger = factionStale ? 'stale-faction' : 'periodic-revisit';
        const characterName = faction?.characterName || user?.activeCharacter?.characterName || user?.characterName || null;
        setIdentityRefreshStatus('refreshing');

        triggerRefreshGtawUser({ accessToken })
            .then((res) => {
                if (res?.success && res.user) {
                    const refreshedUser = { ...res.user, loginRole: user.loginRole || 'employee' };
                    setUser(refreshedUser);
                    storeUser(refreshedUser);
                    localStorage.setItem(identityLastKey, String(Date.now()));
                    setIdentityRefreshStatus('success');
                    logIdentityRefresh({ username: user.username, characterName, trigger, attempt, maxAttempts: IDENTITY_REFRESH_MAX, matchedBy: 'id', success: true });
                    // Re-run the roster sync so the fresh character flows into
                    // the app's credential sync and the form auto-fills.
                    const syncFn = httpsCallable(functions, 'triggerFactionSync');
                    syncFn().catch((err) => {
                        if (!err?.code?.includes('permission-denied')) console.error('[IdentityRefresh] faction sync after refresh failed:', err?.message || err);
                    });
                } else {
                    console.warn('[IdentityRefresh] refreshGtawUser returned no user:', res);
                    setIdentityRefreshStatus('failed');
                    logIdentityRefresh({ username: user.username, characterName, trigger, attempt, maxAttempts: IDENTITY_REFRESH_MAX, matchedBy: 'none', success: false });
                    if (attempt >= IDENTITY_REFRESH_MAX && factionStale) {
                        showNotification('Your identity couldn\u2019t be refreshed — please log out and back in to restore report signing.', 'warning');
                    }
                }
            })
            .catch((err) => {
                console.warn('[IdentityRefresh] Profile refresh failed:', err?.message || err);
                setIdentityRefreshStatus('failed');
                logIdentityRefresh({ username: user.username, characterName, trigger, attempt, maxAttempts: IDENTITY_REFRESH_MAX, matchedBy: 'none', success: false, promptedReauth: attempt >= IDENTITY_REFRESH_MAX });
                if (attempt >= IDENTITY_REFRESH_MAX) {
                    showNotification('Your identity couldn\u2019t be refreshed — please log out and back in to restore report signing.', 'warning');
                }
            })
            .finally(() => {
                // Clear the marker shortly after it resolves so it doesn't linger.
                setTimeout(() => setIdentityRefreshStatus((s) => (s === 'success' || s === 'failed' ? 'idle' : s)), 4000);
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id, user?.loginRole, isGoogleAdmin, isStaff, authLoading]);

    // Normalize a raw API character object so it always has a characterName property.
    // The GTA World API returns characters in multiple formats:
    //   { id, name } or { firstname, lastname } or { characterId, characterName }.
    const normalizeChar = useCallback((char) => {
        if (!char) return null;
        if (char.characterName) return char; // already normalized
        const name = char.name || (char.firstname ? `${char.firstname} ${char.lastname || ''}`.trim() : null) || null;
        return { ...char, characterName: name };
    }, []);

    // POPULATE ACTIVE CHARACTER from user data (runs after OAuth callback fills character[])
    const hadCharacter = useRef(false);
    useEffect(() => {
        if (!user || hadCharacter.current) return;
        const source = user.faction || user.character?.[0];
        if (source) {
            const normalized = normalizeChar(source);
            console.log('[GtaWorldAuthContext] Setting active character from user data:', normalized?.characterName || source.firstname);
            setActiveCharacter(normalized);
            hadCharacter.current = true;
        }
    }, [user?.id, user?.faction, user?.character]);

    // REAL-TIME MEMBERSHIP ENFORCEMENT (skipped for non-employee logins)
    useEffect(() => {
        if (!user || !firebaseUser || isGoogleAdmin || isStaff) return;
        if (user?.loginRole === 'non-employee') return;

        const activeId = user?.faction?.characterId || user?.activeCharacter?.characterId;
        if (!activeId) return;

        console.log(`[GtaWorldAuthContext] Setting up real-time membership listener for character ${activeId}`);
        const memberRef = ref(database, `factions/364/members/${activeId}`);

        const unsubscribe = onValue(memberRef, (snapshot) => {
            if (!snapshot.exists()) {
                if (firebaseIsPhmcMember) {
                    console.warn('[GtaWorldAuthContext] Real-time check: Character not in faction members path but firebaseIsPhmcMember is true — skipping logout (likely Non Faction Member rank).');
                    return;
                }
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
    }, [user, firebaseUser, isGoogleAdmin, isStaff, handleLogout]);

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
        credentialsLoading,
        identityRefreshStatus,
    }), [
        user, isLoading, authLoading, error, isValidatingSession, sessionLostReason, login, handleLogout, processCallback,
        clearError, isGoogleAdmin, firebaseUser, firebaseIsPhmcMember, firebaseAccessLevel,
        firebasePermissions, activeCharacter, swappableCharacters, swapCharacter, updateFactionData,
        triggerFactionSync, credentialsLoading, identityRefreshStatus
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
