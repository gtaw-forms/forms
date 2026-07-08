import { setGlobalOptions } from "firebase-functions/v2";
import { onCall } from "firebase-functions/v2/https";
import * as functions from "firebase-functions";
import { getDatabase } from "firebase-admin/database";
import { initializeApp, getApps } from "firebase-admin/app";
import { syncFactionMembers } from './src/maintenance/factionSync.js';

const MORGUE_API_URL = process.env.MORGUE_API_URL || 'http://88.208.243.254';
const MORGUE_API_KEY = process.env.MORGUE_API_KEY;

// Ensure Admin SDK is initialized for Firebase cleanup in delete/purge functions
if (!getApps().length) {
    initializeApp();
}
const adminDb = getDatabase();

// Set global options for all v2 functions in this file
setGlobalOptions({
    region: "europe-west2"
});

// Export all functions from sub-modules
export * from './src/auth/index.js';
export * from './src/maintenance/index.js';
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

/**
 * Fetches morgue records from the VPS API instead of Firebase RTDB.
 * The VPS serves from a local JSON file, eliminating Firebase read bandwidth.
 *
 * Replaces the direct Firebase RTDB read that was in DataContext.jsx.
 *
 * Request data:
 *   { q?: string, limit?: number }
 *     q      — search term (name, caseId, location)
 *     limit  — max records to return (default 100, max 500)
 */
export const getMorgueRecords = onCall({
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

    if (!MORGUE_API_KEY) {
        console.error('[getMorgueRecords] MORGUE_API_KEY environment variable is not set.');
        throw new functions.https.HttpsError('internal', 'Server configuration error.');
    }

    const { q, limit } = request.data || {};
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (limit) params.set('limit', String(limit));
    params.set('source', 'FirebaseFunction');

    const url = `${MORGUE_API_URL}/api/morgue?${params.toString()}`;

    try {
        const response = await fetch(url, {
            headers: {
                'x-api-key': MORGUE_API_KEY,
            },
        });

        if (!response.ok) {
            const text = await response.text();
            console.error(`[getMorgueRecords] VPS API returned ${response.status}: ${text}`);
            throw new functions.https.HttpsError('internal', 'Failed to fetch morgue records from data source.');
        }

        const data = await response.json();
        return data;
    } catch (err) {
        if (err instanceof functions.https.HttpsError) throw err;
        console.error('[getMorgueRecords] Error:', err.message);
        throw new functions.https.HttpsError('internal', `Failed to fetch morgue records: ${err.message}`);
    }
});

/**
 * Deletes a single morgue record from both the VPS local file and Firebase.
 * Called from the Morgue Manager admin panel.
 *
 * Request data: { caseId: string }
 */
export const deleteMorgueRecord = onCall({
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

    if (!MORGUE_API_KEY) {
        throw new functions.https.HttpsError('internal', 'Server configuration error.');
    }

    const { caseId } = request.data || {};
    if (!caseId) {
        throw new functions.https.HttpsError('invalid-argument', 'caseId is required.');
    }

    const url = `${MORGUE_API_URL}/api/morgue/records/${caseId}`;

    try {
        const response = await fetch(url, {
            method: 'DELETE',
            headers: { 'x-api-key': MORGUE_API_KEY },
        });

        // 404 from VPS means record was already deleted from local file.
        // Still clean up Firebase in case it exists there.
        if (response.status === 404) {
            console.log(`[deleteMorgueRecord] Record ${caseId} not found on VPS (already deleted). Cleaning up Firebase.`);
            try {
                await adminDb.ref(`morgue-records/${caseId}`).remove();
            } catch (fbErr) {
                console.warn(`[deleteMorgueRecord] Firebase cleanup warning: ${fbErr.message}`);
            }
            return { success: true, note: 'already_gone_from_vps' };
        }

        if (!response.ok) {
            const text = await response.text();
            console.error(`[deleteMorgueRecord] VPS API returned ${response.status}: ${text}`);
            throw new functions.https.HttpsError('internal', 'Failed to delete record.');
        }

        return await response.json();
    } catch (err) {
        if (err instanceof functions.https.HttpsError) throw err;
        console.error('[deleteMorgueRecord] Error:', err.message);
        throw new functions.https.HttpsError('internal', `Failed to delete record: ${err.message}`);
    }
});

/**
 * Purges ALL morgue records from both the VPS local file and Firebase.
 * Requires the caller to send a confirmation flag.
 *
 * Request data: { confirmed: true }
 */
export const purgeMorgueRecords = onCall({
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

    if (!request.data?.confirmed) {
        throw new functions.https.HttpsError('invalid-argument', 'Confirmation required.');
    }

    if (!MORGUE_API_KEY) {
        throw new functions.https.HttpsError('internal', 'Server configuration error.');
    }

    try {
        const response = await fetch(`${MORGUE_API_URL}/api/morgue/purge`, {
            method: 'POST',
            headers: {
                'x-api-key': MORGUE_API_KEY,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ confirmed: true }),
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`VPS API returned ${response.status}: ${text}`);
        }

        return { success: true };
    } catch (err) {
        console.error('[purgeMorgueRecords] Error:', err.message);
        throw new functions.https.HttpsError('internal', `Failed to purge records: ${err.message}`);
    }
});