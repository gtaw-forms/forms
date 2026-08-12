import { useEffect, useRef, useCallback, useMemo } from 'react';
import { useNotification } from '../contexts/NotificationContext.jsx';

const INACTIVITY_WARNING_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const INACTIVITY_RELOAD_TIMEOUT = (35 * 60 * 1000 + 1000);  // ~35 minutes 1 sec

/**
 * Custom hook to automatically reload the page after a period of user inactivity.
 * Displays a warning notification 5 minutes before reloading.
 */
export const useInactivityReload = () => {
    const { showNotification, removeNotification } = useNotification();
    
    const warningTimer = useRef(null);
    const reloadTimer = useRef(null);
    const notificationId = useRef(null);
    const inactivityWarningTriggered = useRef(false);
    const lastActivityTime = useRef(Date.now());
    
    // Check if the page was reloaded due to inactivity
    const wasReloadedDueToInactivity = useRef(sessionStorage.getItem('inactivityReloadTriggered') === 'true');

    // Clear the flag from sessionStorage so it doesn't persist to subsequent manual reloads
    useEffect(() => {
        if (sessionStorage.getItem('inactivityReloadTriggered')) {
            sessionStorage.removeItem('inactivityReloadTriggered');
        }
    }, []);

    const reloadPage = () => {
        console.log("[Inactivity] Reloading page due to inactivity.");
        sessionStorage.setItem('inactivityReloadTriggered', 'true');

        if (window.location.hash && window.location.hash.includes('/auth/gta/callback')) {
            window.location.href = window.location.origin + window.location.pathname;
            return;
        }

        window.location.reload();
    };

    const showWarning = () => {
        console.log("[Inactivity] Displaying inactivity warning.");
        inactivityWarningTriggered.current = true; // Set to true when warning is shown
        if (notificationId.current) {
            removeNotification(notificationId.current);
        }
        notificationId.current = showNotification(
            'NO ACTIVITY DETECTED - GETTING LATEST BUILD IN 5 MINUTES',
            'exclamation-triangle',
            0 // Persistent
        );
    };

    const resetTimers = useCallback(() => {
        if (warningTimer.current) clearTimeout(warningTimer.current);
        if (reloadTimer.current) clearTimeout(reloadTimer.current);

        inactivityWarningTriggered.current = false;
        lastActivityTime.current = Date.now();

        if (notificationId.current) {
            removeNotification(notificationId.current);
            notificationId.current = null;
        }

        warningTimer.current = setTimeout(showWarning, INACTIVITY_WARNING_TIMEOUT);
        reloadTimer.current = setTimeout(reloadPage, INACTIVITY_RELOAD_TIMEOUT);
    }, [removeNotification, showNotification]);

    useEffect(() => {
        const activityEvents = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];

        console.log("[Inactivity] Initializing inactivity reload timer.");
        resetTimers();

        activityEvents.forEach(event => {
            window.addEventListener(event, resetTimers, { passive: true });
        });

        // Track when the tab is hidden separately from activity timers.
        // This avoids a race where the first mousemove on return resets
        // lastActivityTime before visibilitychange fires.
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
            activityEvents.forEach(event => {
                window.removeEventListener(event, resetTimers);
            });
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [resetTimers]);

    const getIsInactivityWarningTriggered = useCallback(() => {
        return inactivityWarningTriggered.current || wasReloadedDueToInactivity.current;
    }, []);

    // Expose a getter for the inactivity warning state
    return useMemo(() => ({
        getIsInactivityWarningTriggered,
    }), [getIsInactivityWarningTriggered]);
};
