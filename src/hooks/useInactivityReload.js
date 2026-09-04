import { useEffect, useRef, useCallback, useMemo } from 'react';
import { useNotification } from '../contexts/NotificationContext.jsx';

const INACTIVITY_WARNING_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const INACTIVITY_RELOAD_TIMEOUT = (35 * 60 * 1000 + 1000);  // ~35 minutes 1 sec

// Singleton guard — DataContext + GtaWorldAuthContext + FormHandler all call this hook.
// Without this, 3x timers are created and any re-render that recreates resetTimers
// clears the pending reloadTimer that was set at t=0, so the 35-min reload never fires.
let __inactivitySingletonActive = false;
let __globalWarningTriggered = false;
let __globalWasReloaded = (()=>{ try{ return sessionStorage.getItem('inactivityReloadTriggered') === 'true'; }catch{ return false; } })();

/**
 * Custom hook to automatically reload the page after a period of user inactivity.
 * Displays a warning notification 5 minutes before reloading.
 */
export const useInactivityReload = () => {
    const { showNotification, removeNotification } = useNotification();
    
    const warningTimer = useRef(null);
    const reloadTimer = useRef(null);
    const heartbeatInterval = useRef(null);
    const notificationId = useRef(null);
    const inactivityWarningTriggered = useRef(false);
    const lastActivityTime = useRef(Date.now());
    
    // Check if the page was reloaded due to inactivity
    const wasReloadedDueToInactivity = useRef(__globalWasReloaded);

    // Clear the flag from sessionStorage so it doesn't persist to subsequent manual reloads
    useEffect(() => {
        try{
            if (sessionStorage.getItem('inactivityReloadTriggered')) {
                sessionStorage.removeItem('inactivityReloadTriggered');
                __globalWasReloaded = false;
            }
        }catch{}
    }, []);

    const reloadPage = useCallback(() => {
        console.log("[Inactivity] Reloading page due to inactivity.");
        try{ sessionStorage.setItem('inactivityReloadTriggered', 'true'); }catch{}
        __globalWarningTriggered = true;

        if (window.location.hash && window.location.hash.includes('/auth/gta/callback')) {
            window.location.href = window.location.origin + window.location.pathname;
            return;
        }

        // Hard reload — window.location.reload() can be soft-cached or throttled when hidden.
        // Try reload(), then fallback to href assignment after 500ms if still on same page.
        try { window.location.reload(); } catch(e) { window.location.href = window.location.href; }
        setTimeout(() => {
            // If reload didn't navigate (e.g. throttled while hidden), force via href
            try{ window.location.href = window.location.origin + window.location.pathname + window.location.search + window.location.hash; }catch{}
        }, 800);
    }, []);

    const showWarning = useCallback(() => {
        console.log("[Inactivity] Displaying inactivity warning.");
        inactivityWarningTriggered.current = true;
        __globalWarningTriggered = true;
        if (notificationId.current) {
            try{ removeNotification(notificationId.current); }catch{}
        }
        notificationId.current = showNotification(
            'NO ACTIVITY DETECTED - GETTING LATEST BUILD IN 5 MINUTES',
            'exclamation-triangle',
            0 // Persistent
        );
    }, [removeNotification, showNotification]);

    const resetTimers = useCallback(() => {
        if (warningTimer.current) clearTimeout(warningTimer.current);
        if (reloadTimer.current) clearTimeout(reloadTimer.current);

        inactivityWarningTriggered.current = false;
        __globalWarningTriggered = false;
        lastActivityTime.current = Date.now();

        if (notificationId.current) {
            try{ removeNotification(notificationId.current); }catch{}
            notificationId.current = null;
        }

        warningTimer.current = setTimeout(showWarning, INACTIVITY_WARNING_TIMEOUT);
        reloadTimer.current = setTimeout(reloadPage, INACTIVITY_RELOAD_TIMEOUT);
    }, [removeNotification, showNotification, showWarning, reloadPage]);

    useEffect(() => {
        // Singleton: only the first mounted instance owns timers/listeners.
        // Subsequent callers (DataContext, GtaWorldAuthContext) just share the getter.
        if (__inactivitySingletonActive) {
            console.log("[Inactivity] Singleton already active — sharing state.");
            return;
        }
        __inactivitySingletonActive = true;

        const activityEvents = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];

        console.log("[Inactivity] Initializing inactivity reload timer (singleton).");
        resetTimers();

        activityEvents.forEach(event => {
            window.addEventListener(event, resetTimers, { passive: true });
        });

        // Heartbeat fallback — setTimeout can be throttled when tab is hidden/background.
        // Check every 60s if the deadline has passed and force reload.
        heartbeatInterval.current = setInterval(() => {
            const elapsed = Date.now() - lastActivityTime.current;
            if (elapsed >= INACTIVITY_RELOAD_TIMEOUT) {
                console.log("[Inactivity] Heartbeat detected deadline exceeded — forcing reload.");
                reloadPage();
            } else if (elapsed >= INACTIVITY_WARNING_TIMEOUT && !inactivityWarningTriggered.current) {
                showWarning();
            }
        }, 60 * 1000);

        // Track when the tab is hidden separately from activity timers.
        let tabHiddenAt = null;
        const handleVisibilityChange = () => {
            if (document.hidden) {
                tabHiddenAt = Date.now();
            } else if (tabHiddenAt !== null) {
                const elapsed = Date.now() - tabHiddenAt;
                tabHiddenAt = null;
                if (elapsed >= INACTIVITY_RELOAD_TIMEOUT) {
                    reloadPage();
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            console.log("[Inactivity] Cleaning up inactivity timers and listeners.");
            if (warningTimer.current) clearTimeout(warningTimer.current);
            if (reloadTimer.current) clearTimeout(reloadTimer.current);
            if (heartbeatInterval.current) clearInterval(heartbeatInterval.current);
            activityEvents.forEach(event => {
                window.removeEventListener(event, resetTimers);
            });
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            __inactivitySingletonActive = false;
        };
    }, [resetTimers, reloadPage, showWarning]);

    const getIsInactivityWarningTriggered = useCallback(() => {
        return inactivityWarningTriggered.current || __globalWarningTriggered || wasReloadedDueToInactivity.current;
    }, []);

    // Expose a getter for the inactivity warning state
    return useMemo(() => ({
        getIsInactivityWarningTriggered,
    }), [getIsInactivityWarningTriggered]);
};
