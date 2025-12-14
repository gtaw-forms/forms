import { useEffect, useRef, useCallback } from 'react';
import { useNotification } from '../contexts/NotificationContext.jsx';

const INACTIVITY_WARNING_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const INACTIVITY_RELOAD_TIMEOUT = 35 * 60 * 1000;  // 35 minutes

/**
 * Custom hook to automatically reload the page after a period of user inactivity.
 * Displays a warning notification 5 minutes before reloading.
 */
export const useInactivityReload = () => {
    const { showNotification, removeNotification } = useNotification();
    
    const warningTimer = useRef(null);
    const reloadTimer = useRef(null);
    const notificationId = useRef(null);
    const inactivityWarningTriggered = useRef(false); // NEW REF to track if warning was triggered

    const reloadPage = () => {
        console.log("[Inactivity] Reloading page due to inactivity.");
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
        // Clear existing timers
        if (warningTimer.current) clearTimeout(warningTimer.current);
        if (reloadTimer.current) clearTimeout(reloadTimer.current);

        // Reset inactivity state - crucial!
        inactivityWarningTriggered.current = false; 

        // Dismiss notification if it's showing
        if (notificationId.current) {
            removeNotification(notificationId.current);
            notificationId.current = null;
        }

        // Set new timers
        warningTimer.current = setTimeout(showWarning, INACTIVITY_WARNING_TIMEOUT);
        reloadTimer.current = setTimeout(reloadPage, INACTIVITY_RELOAD_TIMEOUT);
    }, [removeNotification, showNotification]);

    useEffect(() => {
        const activityEvents = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];

        console.log("[Inactivity] Initializing inactivity reload timer.");
        resetTimers();

        // Add event listeners
        activityEvents.forEach(event => {
            window.addEventListener(event, resetTimers, { passive: true });
        });

        // Cleanup function
        return () => {
            console.log("[Inactivity] Cleaning up inactivity timers and listeners.");
            if (warningTimer.current) clearTimeout(warningTimer.current);
            if (reloadTimer.current) clearTimeout(reloadTimer.current);
            activityEvents.forEach(event => {
                window.removeEventListener(event, resetTimers);
            });
        };
    }, [resetTimers]);

    // Expose a getter for the inactivity warning state
    return {
        getIsInactivityWarningTriggered: () => inactivityWarningTriggered.current,
    };
};
