/**
 * formsCacheSync.js — Mirror the RTDB `forms` / `forms_staging` nodes to the
 * VPS disk cache (discord-bot/data/forms.json + forms-staging.json).
 *
 * morgue-api serves GET /api/forms (+staging) straight off those files, so
 * form edits should reach clients without a manual seed. This service keeps
 * the cache fresh: it watches appMetadata.formsDataVersion(+_staging) and
 * re-syncs a node whenever its version key bumps. The initial listener fire
 * is used as the bootstrap seed (see below).
 *
 * READ ONLY — never writes to RTDB, never logs secrets/webhooks.
 */

import { existsSync, readFileSync, writeFileSync, renameSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ESM has no global __dirname — derive it from import.meta.url (same shim the
// bot's morgue-api.js uses).
const __dirname = dirname(fileURLToPath(import.meta.url));

const FORMS_FILE = resolve(__dirname, '..', 'data', 'forms.json');
const FORMS_STAGING_FILE = resolve(__dirname, '..', 'data', 'forms-staging.json');

const VERSION_NODE = 'appMetadata';
const VERSION_KEY_FORMS = 'formsDataVersion';
const VERSION_KEY_STAGING = 'formsDataVersion_staging';

// Coalesce bursts: a single timer, replaced on each version bump, so N rapid
// edits collapse into one sync 5s after the last one lands.
const DEBOUNCE_MS = 5000;

const SYNC_NODES = [
    { nodePath: 'forms', filePath: FORMS_FILE },
    { nodePath: 'forms_staging', filePath: FORMS_STAGING_FILE },
];

let _lastSeenFormsVersion = '';
let _lastSeenStagingVersion = '';
let _debounceTimer = null;

/**
 * Read a node, compare against the on-disk cache and write it back only when
 * it changed. Writes are atomic (tmp file + rename) so morgue-api never reads
 * a half-written cache.
 * @returns {Promise<{ changed: boolean, keys: number }>}
 */
async function syncNode(db, nodePath, filePath) {
    let snapshot;
    try {
        snapshot = await db.ref(nodePath).once('value');
    } catch (err) {
        console.error(`[ERR] formsCacheSync: failed to read node "${nodePath}":`, err.message);
        return { changed: false, keys: 0 };
    }

    const val = snapshot.exists() ? snapshot.val() : {};
    const json = JSON.stringify(val, null, 2);
    const keys = Array.isArray(val) ? val.length : Object.keys(val).length;
    const bytes = Buffer.byteLength(json, 'utf-8');

    try {
        if (existsSync(filePath) && readFileSync(filePath, 'utf-8') === json) {
            console.log(`[OK] forms unchanged (${keys} keys) — ${nodePath}`);
            return { changed: false, keys };
        }

        const tmpFile = `${filePath}.tmp`;
        writeFileSync(tmpFile, json, 'utf-8');
        renameSync(tmpFile, filePath);
        console.log(`[OK] forms synced (${keys} keys, ${bytes} bytes) — ${nodePath}`);
        return { changed: true, keys };
    } catch (err) {
        console.error(`[ERR] formsCacheSync: failed to write cache for "${nodePath}":`, err.message);
        return { changed: false, keys };
    }
}

/**
 * Debounced full sync of both nodes. Safe to call on every version bump.
 */
function scheduleSync(db) {
    if (_debounceTimer) clearTimeout(_debounceTimer);
    _debounceTimer = setTimeout(() => {
        _debounceTimer = null;
        syncNode(db, SYNC_NODES[0].nodePath, SYNC_NODES[0].filePath)
            .then(() => syncNode(db, SYNC_NODES[1].nodePath, SYNC_NODES[1].filePath))
            .catch((err) => console.warn(`[WARN] formsCacheSync: sync cycle failed: ${err.message}`));
    }, DEBOUNCE_MS);
}

/**
 * Start the forms cache mirror. Listens on appMetadata for version bumps and
 * force-seeds both cache files at boot (even with unchanged versions).
 * @param {object} db — Firebase Admin RTDB instance
 */
export async function startFormsCacheSync(db) {
    try {
        const versionRef = db.ref(VERSION_NODE);
        versionRef.on('value', (snap) => {
            try {
                const data = snap.val() || {};
                const formsVersion = String(data[VERSION_KEY_FORMS] ?? '');
                const stagingVersion = String(data[VERSION_KEY_STAGING] ?? '');

                if (formsVersion === _lastSeenFormsVersion && stagingVersion === _lastSeenStagingVersion) {
                    // No version change — nothing to mirror.
                    return;
                }

                _lastSeenFormsVersion = formsVersion;
                _lastSeenStagingVersion = stagingVersion;
                console.log(`[OK] forms version bump — forms=${formsVersion || '(empty)'} staging=${stagingVersion || '(empty)'}`);
                scheduleSync(db);
            } catch (err) {
                console.warn(`[WARN] formsCacheSync: listener callback error: ${err.message}`);
            }
        });

        // Bootstrap: force one sync of both nodes regardless of version change
        // so the cache is seeded at boot even when versions are unchanged.
        await syncNode(db, SYNC_NODES[0].nodePath, SYNC_NODES[0].filePath);
        await syncNode(db, SYNC_NODES[1].nodePath, SYNC_NODES[1].filePath);

        console.log('[OK] formsCacheSync started — watching appMetadata.formsDataVersion(+_staging)');
    } catch (err) {
        console.warn(`[WARN] formsCacheSync failed to start: ${err.message}`);
    }
}