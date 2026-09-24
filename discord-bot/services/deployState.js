/**
 * Deploy State — shared mutable state + constants for all deploy sub-modules.
 *
 * Sub-modules import { state, C } and read/write state properties directly.
 * The state object itself is never reassigned — only its properties are mutated.
 */

export const state = {
    /** @type {import('discord.js').Client|null} */
    discordClient: null,

    /** @type {import('firebase-admin').database.Database|null} */
    dbRef: null,

    /** @type {Map<string, {timer: *, type: string, data: *, label: string, fireTime: number}>} */
    pendingDeployments: new Map(),

    /** @type {Set<string>|null} */
    knownReportKeys: null,

    /** Whether a deploy is currently in progress (sequential gate) */
    processing: false,

    /** @type {{ label: string, type: string, forum: string }|null} */
    currentProcessing: null,

    /** Recent patient records cache (avoids full-table scan for duplicate detection) */
    recentPatientRecords: new Map(),

    /** In-memory maintenance mode fallback */
    maintenanceMode: false,

    /** Pending autopsy topic selections (interactive picker) */
    pendingAutopsyPicks: new Map(),

    /** Counter for autopsy pick custom IDs */
    autopsyPickCounter: 0,
};

export const C = {
    // Queue defer: staff get 3 min to re-save/edit before auto-deploy fires.
    DEFER_MS: 3 * 60 * 1000,
    // Retry spacing: 1h (outages can need many attempts; retries never expire).
    RETRY_DELAY_MS: 1 * 60 * 60 * 1000,
    // Legacy: retry exhaustion was removed (transport failures retry forever;
    // only data-terminal states end a report). Kept so old references don't break.
    MAX_RETRIES: 3,
    CASE_MGMT_FORUM_ID: 266,
    AUTOPSY_REQUEST_FORUM_ID: 265,
    MAINTENANCE_PATH: 'appMetadata/botMaintenance',
    CONSENT_PATH: 'user-consent',
    CLEANUP_AFTER_MS: 24 * 60 * 60 * 1000,
};
