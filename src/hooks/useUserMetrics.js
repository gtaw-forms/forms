import { useCallback } from 'react';
import { database } from '../firebase';
import { ref, update, increment, serverTimestamp } from 'firebase/database';
import useGtaWorldAuth from './useGtaWorldAuth';

/**
 * Hook to track user metrics and engagement in Firebase.
 * Logs data under /user_metrics/{ucpName}/{category}/{subCategory}
 */
export const useUserMetrics = () => {
    const { user } = useGtaWorldAuth();

    const trackMetric = useCallback(async (category, subCategory) => {
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        
        let usernameToLog = null;
        if (isLocalhost) {
            usernameToLog = 'DEV_STAGING';
        } else if (user && user.username) {
            usernameToLog = user.username;
        }

        if (!usernameToLog) {
            // console.warn("[Metrics] User not authenticated, skipping metric tracking.");
            return;
        }

        // Clean up names for Firebase paths (replace dots, hashes, etc. if they exist in UCP/Category)
        const cleanUcp = usernameToLog.replace(/[.#$[\]]/g, '_');
        const cleanCategory = category.replace(/[.#$[\]]/g, '_');
        const cleanSubCategory = subCategory.replace(/[.#$[\]]/g, '_');

        const metricsRef = ref(database, `user_metrics/${cleanUcp}/${cleanCategory}/${cleanSubCategory}`);

        try {
            await update(metricsRef, {
                visit_count: increment(1),
                last_visited: serverTimestamp(),
            });
            // console.log(`[Metrics] Logged: ${cleanCategory}/${cleanSubCategory} for ${cleanUcp}`);
        } catch (error) {
            console.error("[Metrics] Failed to log user metric:", error);
        }
    }, [user]);

    return { trackMetric };
};

export default useUserMetrics;
