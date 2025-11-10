import { getFunctions, httpsCallable } from 'firebase/functions';
import * as Sentry from "@sentry/react";

/**
 * Service for syncing GTAW account data with saved reports by calling a Firebase Function.
 */

/**
 * Checks if an error is a Firebase permission denied error and triggers global error reporting
 * @param {Error} error - The error to check and potentially report
 * @param {string} context - Context information about where the error occurred
 * @returns {boolean} True if this was a permission denied error that was reported
 */
const handleFirebasePermissionError = (error, context) => {
    if (!error || !error.code) return false;
    
    const isPermissionDenied = error.code === 'permission-denied' || error.code === 'functions/permission-denied';
    
    if (isPermissionDenied) {
        console.error(`🚨 [GTAW Sync] Firebase Permission Denied Error in ${context}:`, error);
        
        // Trigger global error handler to ensure this critical error reaches Discord/Sentry
        if (window.onerror) {
            window.onerror(
                `Firebase Permission Denied: ${error.message}`, 
                `gtawSyncService.js`, 
                0, // lineno
                0, // colno
                error // error object
            );
        }
        
        // Also send to Sentry directly as backup
        Sentry.captureException(error, {
            extra: { 
                context: `GTAW Sync - ${context}`,
                errorType: 'firebase_permission_denied',
                operation: 'sync_gtaw_reports'
            }
        });
        
        return true;
    }
    
    return false;
};


/**
 * Main sync function that orchestrates the entire process by calling the `gtawAccountSync` Firebase Function.
 * @param {Object} gtaUser - GTA World user data with characters
 * @param {Object} options - Sync options for safety and behavior control
 * @returns {Promise<Object>} Sync results
 */
export const syncGtawAccountWithReports = async (gtaUser, options = {}) => {
    try {
        console.log('🚀 [GTAW Sync] Calling gtawAccountSync Firebase Function:', {
            username: gtaUser.username,
            userId: gtaUser.id,
            options,
            timestamp: new Date().toISOString()
        });

        const functions = getFunctions();
        const gtawAccountSync = httpsCallable(functions, 'gtawAccountSync');
        const result = await gtawAccountSync({ gtaUser, options });

        console.log('✅ [GTAW Sync] Firebase Function returned:', result.data);
        return result.data;

    } catch (error) {
        console.error('❌ [GTAW Sync] Calling Firebase Function failed:', error);

        handleFirebasePermissionError(error, 'syncGtawAccountWithReports');
        
        return {
            success: false,
            message: `Sync failed: ${error.message}`,
            error: error.message,
        };
    }
};
