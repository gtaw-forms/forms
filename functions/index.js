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

    // Only faction members or super admins may trigger a sync
    const isSuperAdmin = request.auth.token.isSuperAdmin === true || request.auth.token.accessLevel === 'superadmin';
    const isFactionMember = request.auth.token.isFactionMember === true;
    if (!isSuperAdmin && !isFactionMember) {
        throw new functions.https.HttpsError('permission-denied', 'Only Faction Members or Super Admins can trigger a faction sync.');
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
 * getProtocolsDev — Returns the dev EMS protocols dataset (for localhost
 * preview). Hosted on the VPS (data/protocols-dev.json) to keep the heavy
 * base64 images out of RTDB.
 *
 * Security: any signed-in user may fetch it — it is dev-only content.
 */
export const getProtocolsDev = onCall({
    region: "europe-west2",
    cors: [
        'https://gtaw-forms.github.io',
        'https://phmc-tools.gta.world',
        'http://localhost:3000',
        'http://localhost:5173'
    ]
}, async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
    }
    if (!MORGUE_API_KEY) {
        console.error('[getProtocolsDev] MORGUE_API_KEY environment variable is not set.');
        throw new functions.https.HttpsError('internal', 'Server configuration error.');
    }

    const url = `${MORGUE_API_URL}/api/protocols-dev`;
    try {
        const response = await fetch(url, {
            headers: { 'x-api-key': MORGUE_API_KEY },
        });
        if (!response.ok) {
            const text = await response.text();
            console.error(`[getProtocolsDev] VPS API returned ${response.status}: ${text}`);
            throw new functions.https.HttpsError('internal', 'Failed to fetch dev protocols.');
        }
        return await response.json();
    } catch (err) {
        if (err instanceof functions.https.HttpsError) throw err;
        console.error('[getProtocolsDev] Error:', err.message);
        throw new functions.https.HttpsError('internal', `Failed to fetch dev protocols: ${err.message}`);
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

/**
 * Syncs the VPS local morgue data file from Firebase after an admin panel write.
 * Called by the MorgueManager after any save/delete/upload operation so the
 * VPS morgue API (which serves all lookups) stays in sync with Firebase.
 *
 * Calls the VPS API's /api/morgue/export endpoint, which pulls all records
 * from Firebase into morgue-data.json on the VPS.
 */
export const syncMorgueFile = onCall({
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
        console.error('[syncMorgueFile] MORGUE_API_KEY environment variable is not set.');
        throw new functions.https.HttpsError('internal', 'Server configuration error.');
    }

    console.log('[syncMorgueFile] Syncing VPS local morgue file from Firebase...');

    try {
        const response = await fetch(`${MORGUE_API_URL}/api/morgue/export`, {
            method: 'POST',
            headers: {
                'x-api-key': MORGUE_API_KEY,
            },
        });

        if (!response.ok) {
            const text = await response.text();
            console.error(`[syncMorgueFile] VPS API returned ${response.status}: ${text}`);
            throw new functions.https.HttpsError('internal', `VPS export failed: ${response.status}`);
        }

        const data = await response.json();
        console.log(`[syncMorgueFile] VPS local file synced — ${data.count || 0} records exported`);
        return { success: true, count: data.count || 0 };
    } catch (err) {
        if (err instanceof functions.https.HttpsError) throw err;
        console.error('[syncMorgueFile] Error:', err.message);
        throw new functions.https.HttpsError('internal', `Failed to sync morgue file: ${err.message}`);
    }
});

/**
 * getCctvData — Returns CCTV camera data from the VPS.
 *
 * Proxies to the morgue-api's /api/cctv/* endpoints.
 *
 * Request data:
 *   { cameraId?: number | 'cameras' | 'stats' }
 *     omitted / 'cameras'  →  list all cameras with metadata
 *     'stats'              →  aggregate statistics
 *     <number>             →  logs for a specific camera
 */
export const getCctvData = onCall({
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
        console.error('[getCctvData] MORGUE_API_KEY environment variable is not set.');
        throw new functions.https.HttpsError('internal', 'Server configuration error.');
    }

    const { cameraId, search } = request.data || {};
    let url;

    if (search) {
        url = `${MORGUE_API_URL}/api/cctv/search?q=${encodeURIComponent(search)}`;
    } else if (cameraId === 'stats') {
        url = `${MORGUE_API_URL}/api/cctv/stats`;
    } else if (cameraId && cameraId !== 'cameras') {
        url = `${MORGUE_API_URL}/api/cctv/cameras/${cameraId}`;
    } else {
        url = `${MORGUE_API_URL}/api/cctv/cameras`;
    }

    const t0 = Date.now();
    console.log(`[getCctvData] Fetching: ${url}`);

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

        const response = await fetch(url, {
            headers: { 'x-api-key': MORGUE_API_KEY },
            signal: controller.signal,
        });
        clearTimeout(timeout);

        const t1 = Date.now();
        console.log(`[getCctvData] VPS responded in ${t1 - t0}ms with status ${response.status}`);

        if (!response.ok) {
            const text = await response.text();
            console.error(`[getCctvData] VPS API returned ${response.status}: ${text}`);
            throw new functions.https.HttpsError('internal', 'Failed to fetch CCTV data from data source.');
        }

        const data = await response.json();
        console.log(`[getCctvData] Parsed JSON, total ${Date.now() - t0}ms`);
        return data;
    } catch (err) {
        if (err instanceof functions.https.HttpsError) throw err;
        if (err.name === 'AbortError') {
            console.error(`[getCctvData] VPS API timed out after 15s`);
            throw new functions.https.HttpsError('deadline-exceeded', 'CCTV data source timed out.');
        }
        console.error(`[getCctvData] Error after ${Date.now() - t0}ms:`, err.message);
        throw new functions.https.HttpsError('internal', `Failed to fetch CCTV data: ${err.message}`);
    }
});

/**
 * triggerCctvFetch — Triggers a manual CCTV data fetch on the VPS.
 * Calls POST /api/cctv/fetch which spawns fetch-all.js --headless in the
 * background and returns immediately.
 */
export const triggerCctvFetch = onCall({
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
        console.error('[triggerCctvFetch] MORGUE_API_KEY environment variable is not set.');
        throw new functions.https.HttpsError('internal', 'Server configuration error.');
    }

    console.log('[triggerCctvFetch] Triggering manual CCTV fetch...');

    const t0 = Date.now();
    console.log('[triggerCctvFetch] Calling VPS...');

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const response = await fetch(`${MORGUE_API_URL}/api/cctv/fetch`, {
            method: 'POST',
            headers: { 'x-api-key': MORGUE_API_KEY },
            signal: controller.signal,
        });
        clearTimeout(timeout);

        console.log(`[triggerCctvFetch] VPS responded in ${Date.now() - t0}ms with status ${response.status}`);

        if (!response.ok) {
            const text = await response.text();
            console.error(`[triggerCctvFetch] VPS API returned ${response.status}: ${text}`);
            throw new functions.https.HttpsError('internal', 'Failed to trigger CCTV fetch.');
        }

        const data = await response.json();
        return data;
    } catch (err) {
        if (err instanceof functions.https.HttpsError) throw err;
        if (err.name === 'AbortError') {
            console.error('[triggerCctvFetch] VPS API timed out after 10s');
            throw new functions.https.HttpsError('deadline-exceeded', 'CCTV fetch trigger timed out.');
        }
        console.error(`[triggerCctvFetch] Error after ${Date.now() - t0}ms:`, err.message);
        throw new functions.https.HttpsError('internal', `Failed to trigger CCTV fetch: ${err.message}`);
    }
});

/**
 * checkOfficerName — Checks a requesting officer name against LSPD/LSSD rosters.
 * Proxies to the VPS morgue-api's /api/roster/check endpoint.
 *
 * Request data: { name: string, department?: string }
 *   name       — officer name to look up (required)
 *   department — optional hint ("lspd" or "lssd"). If omitted, both rosters
 *                are checked and ALL matches are returned.
 *
 * Returns (with dept):
 *   { found: bool, department: string, name: string, altMatch: object|null }
 *
 * Returns (auto-detect, no dept):
 *   { found: bool, count: number, matches: Array<{ name: string, department: string }> }
 */
export const checkOfficerName = onCall({
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
        console.error('[checkOfficerName] MORGUE_API_KEY environment variable is not set.');
        throw new functions.https.HttpsError('internal', 'Server configuration error.');
    }

    const { name, department } = request.data || {};
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
        throw new functions.https.HttpsError('invalid-argument', 'name is required (min 2 chars)');
    }

    // Build URL — include dept only if provided and valid
    const dept = (department || '').toLowerCase().trim();
    const hasDept = dept === 'lspd' || dept === 'lssd';
    let url;
    if (hasDept) {
        url = `${MORGUE_API_URL}/api/roster/check?name=${encodeURIComponent(name.trim())}&dept=${dept}`;
    } else {
        url = `${MORGUE_API_URL}/api/roster/check?name=${encodeURIComponent(name.trim())}`;
    }

    try {
        const response = await fetch(url, {
            headers: { 'x-api-key': MORGUE_API_KEY },
        });

        if (!response.ok) {
            const text = await response.text();
            console.error(`[checkOfficerName] VPS API returned ${response.status}: ${text}`);
            throw new functions.https.HttpsError('internal', 'Failed to check officer name.');
        }

        const data = await response.json();
        return data;
    } catch (err) {
        if (err instanceof functions.https.HttpsError) throw err;
        console.error('[checkOfficerName] Error:', err.message);
        throw new functions.https.HttpsError('internal', `Failed to check officer name: ${err.message}`);
    }
});

/**
 * getAgencyCredentials — Returns the shared faction-forum account credentials
 * (keyed by forum hostname, e.g. "lspd.gta.world").
 *
 * Security: the credentials are stored ONLY on the VPS (data/agency-credentials.json)
 * and served via the morgue-api with the API key. The web client never ships them;
 * it calls this function, which requires a PHMC employee (isFactionMember claim).
 */
export const getAgencyCredentials = onCall({
    region: "europe-west2",
    cors: [
        'https://gtaw-forms.github.io',
        'https://phmc-tools.gta.world',
        'http://localhost:3000',
        'http://localhost:5173'
    ]
}, async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
    }

    // PHMC staff only. The isFactionMember / isSuperAdmin / accessLevel claims
    // are set at GTA World auth time. Super admins & any staff (accessLevel >= 1)
    // are allowed so elevated accounts can also fetch the shared credentials.
    // @gmail.com accounts are treated as PHMC members (matches the web app's
    // access model in AuthContext — Gmail users get member access).
    const t = request.auth.token || {};
    const email = String(t.email || '').toLowerCase();
    const isPhmcStaff = t.isFactionMember === true
        || t.isSuperAdmin === true
        || (t.accessLevel || 0) >= 1
        || email.endsWith('@gmail.com');
    console.log('[getAgencyCredentials] access check:', JSON.stringify({
        uid: request.auth.uid,
        email: t.email || null,
        isFactionMember: t.isFactionMember,
        isSuperAdmin: t.isSuperAdmin,
        accessLevel: t.accessLevel,
        permissions: Array.isArray(t.permissions) ? t.permissions.slice(0, 8) : t.permissions,
        granted: isPhmcStaff,
    }));
    if (!isPhmcStaff) {
        throw new functions.https.HttpsError('permission-denied', 'PHMC staff access required.');
    }

    if (!MORGUE_API_KEY) {
        console.error('[getAgencyCredentials] MORGUE_API_KEY environment variable is not set.');
        throw new functions.https.HttpsError('internal', 'Server configuration error.');
    }

    try {
        const response = await fetch(`${MORGUE_API_URL}/api/agency-credentials`, {
            headers: { 'x-api-key': MORGUE_API_KEY },
        });

        if (!response.ok) {
            const text = await response.text();
            console.error(`[getAgencyCredentials] VPS API returned ${response.status}: ${text}`);
            throw new functions.https.HttpsError('internal', 'Failed to fetch agency credentials.');
        }

        return await response.json();
    } catch (err) {
        if (err instanceof functions.https.HttpsError) throw err;
        console.error('[getAgencyCredentials] Error:', err.message);
        throw new functions.https.HttpsError('internal', `Failed to fetch agency credentials: ${err.message}`);
    }
});

/**
 * getPatientNames — Patient Name autocomplete lookup for medical record forms.
 * Proxies to the VPS morgue-api's /api/patients endpoint (the patient index is
 * built by the bot's services/patientIndex.js).
 *
 * Request data: { q?: string }
 *   q — partial name to search (min 2 chars). Omitted → full index.
 *
 * Returns:
 *   with q: { count, matches: [{ name, id, lastSeen }] }
 *   without q: { version, lastUpdated, lastFullBuild, count, patients }
 *
 * Auth: any signed-in PHMC staff (same gate as getAgencyCredentials).
 */
export const getPatientNames = onCall({
    region: "europe-west2",
    cors: [
        'https://gtaw-forms.github.io',
        'https://phmc-tools.gta.world',
        'http://localhost:3000',
        'http://localhost:5173'
    ]
}, async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
    }

    const t = request.auth.token || {};
    const email = String(t.email || '').toLowerCase();
    const isPhmcStaff = t.isFactionMember === true
        || t.isSuperAdmin === true
        || (t.accessLevel || 0) >= 1
        || email.endsWith('@gmail.com');
    if (!isPhmcStaff) {
        throw new functions.https.HttpsError('permission-denied', 'PHMC staff access required.');
    }

    if (!MORGUE_API_KEY) {
        console.error('[getPatientNames] MORGUE_API_KEY environment variable is not set.');
        throw new functions.https.HttpsError('internal', 'Server configuration error.');
    }

    const q = typeof request.data?.q === 'string' ? request.data.q.trim() : '';
    if (q && q.length < 2) {
        throw new functions.https.HttpsError('invalid-argument', 'q must be at least 2 characters');
    }

    const url = q
        ? `${MORGUE_API_URL}/api/patients?q=${encodeURIComponent(q)}`
        : `${MORGUE_API_URL}/api/patients`;

    try {
        const response = await fetch(url, {
            headers: { 'x-api-key': MORGUE_API_KEY },
            signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
            const text = await response.text();
            console.error(`[getPatientNames] VPS API returned ${response.status}: ${text}`);
            throw new functions.https.HttpsError('internal', 'Failed to fetch patient names.');
        }

        return await response.json();
    } catch (err) {
        if (err instanceof functions.https.HttpsError) throw err;
        console.error('[getPatientNames] Error:', err.message);
        throw new functions.https.HttpsError('internal', `Failed to fetch patient names: ${err.message}`);
    }
});