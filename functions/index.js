import { setGlobalOptions } from "firebase-functions/v2";
import { onCall } from "firebase-functions/v2/https";
import * as functions from "firebase-functions";
import { syncFactionMembers } from './src/maintenance/factionSync.js';

// Set global options for all v2 functions in this file
setGlobalOptions({
    region: "europe-west2"
});

// Export all functions from sub-modules
export * from './src/auth/index.js';
export * from './src/maintenance/index.js';
export * from './src/maintenance/monitor.js';
export * from './src/reports/index.js';
export * from './src/utils/media.js';
export * from './src/utils/proxy.js';
export * from './src/webhooks/index.js';

/**
 * Returns public configuration values needed by the client at startup.
 * Keeps env-var dependencies server-side so no VITE_* vars ship in the bundle.
 */
export const getPublicConfig = onCall({
    region: "europe-west2",
    cors: [
        'https://gtaw-forms.github.io',
        'https://phmc-tools.gta.world',
        'http://localhost:3000'
    ]
}, async () => {
    const { getConfigValue } = await import('./src/utils/config.js');
    const gtaWorldClientId = getConfigValue("GTAWORLD_CLIENT_ID");
    return {
        gtaWorldClientId: gtaWorldClientId || null
    };
});

/**
 * Triggers a faction sync - refreshes faction data from GTA World API
 * Defined here directly to ensure Firebase CLI detects it
 * Explicitly set to europe-west2 for frontend compatibility
 */
export const triggerFactionSync = onCall({
    region: "europe-west2",
    cors: [
        'https://gtaw-forms.github.io',
        'https://phmc-tools.gta.world',
        'http://localhost:3000'
    ]
}, async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
    }
    
    console.log('[triggerFactionSync] Starting faction sync for UID:', request.auth.uid);
    
    const syncResult = await syncFactionMembers('manual');
    if (!syncResult.success) {
        throw new functions.https.HttpsError('internal', `Faction sync failed: ${syncResult.error}`);
    }
    
    return {
        success: true,
        message: `Faction sync triggered successfully (${syncResult.count} members synced)`,
        timestamp: new Date().toISOString()
    };
});