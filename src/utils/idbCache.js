/**
 * Minimal IndexedDB wrapper for storing large data (like morgue records)
 * that exceeds localStorage's 5MB quota.
 * Uses a single object store "cache" with versioned keys.
 */

const DB_NAME = 'phmc-cache';
const DB_VERSION = 1;
const STORE_NAME = 'cache';

let _dbPromise = null;

function openDb() {
    if (_dbPromise) return _dbPromise;
    _dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => {
            _dbPromise = null;
            reject(event.target.error);
        };
    });
    return _dbPromise;
}

export async function idbGet(key) {
    try {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    } catch {
        return null;
    }
}

export async function idbSet(key, value) {
    try {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const request = store.put(value, key);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    } catch {
        // Silently fail — fall back to in-memory only
    }
}

export async function idbRemove(key) {
    try {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            store.delete(key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch { /* best effort */ }
}

export async function idbClear() {
    try {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            store.clear();
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch { /* best effort */ }
}

const PROBE_DB = 'phmc-idb-probe';

/**
 * Probe whether IndexedDB is actually usable on this browser/disk.
 * Opens a throwaway database, forces a real disk write, then deletes it.
 * Returns `{ available: true }` or `{ available: false, error }`.
 * Used at startup to detect quota/disk-full failures early (e.g.
 * "Encountered full disk while opening backing store for indexedDB.open").
 */
export async function checkIndexedDBAvailability() {
    try {
        const db = await new Promise((resolve, reject) => {
            const request = indexedDB.open(PROBE_DB, 1);
            request.onupgradeneeded = () => {
                const probeDb = request.result;
                if (!probeDb.objectStoreNames.contains('probe')) {
                    probeDb.createObjectStore('probe');
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });

        try {
            await new Promise((resolve, reject) => {
                const tx = db.transaction('probe', 'readwrite');
                tx.objectStore('probe').put({ ok: true }, 'probe-key');
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
                tx.onabort = () => reject(tx.error || new Error('Probe write aborted'));
            });
        } finally {
            db.close();
        }

        await new Promise((resolve) => {
            const delReq = indexedDB.deleteDatabase(PROBE_DB);
            delReq.onsuccess = () => resolve();
            delReq.onerror = () => resolve();
            delReq.onblocked = () => resolve();
        });

        return { available: true };
    } catch (error) {
        return { available: false, error };
    }
}

const KNOWN_SITE_DBS = [
    'phmc-cache',
    PROBE_DB,
    'firebaseLocalStorageDb',        // firebase/auth persisted session
    'firebase-heartbeat-database',   // @firebase/app heartbeat controller
    'firebaseInstallationsDB',       // @firebase/installations
];

/**
 * Targeted, per-user site-data purge — the safe alternative to the global
 * kill-switch. Deletes every IndexedDB database for this origin (morgue cache,
 * Firebase auth session/heartbeat/installations stores) and clears the
 * localStorage cache segments + version trackers. Keeps `gta-user-data` so the
 * user's OAuth login survives.
 */
export async function clearSiteData() {
    const removed = [];

    const deleteDb = (name) => new Promise((resolve) => {
        try {
            const req = indexedDB.deleteDatabase(name);
            req.onsuccess = () => { removed.push(name); resolve(); };
            req.onerror = () => resolve();
            req.onblocked = () => resolve();
        } catch { resolve(); }
    });

    try {
        const dbNames = typeof indexedDB.databases === 'function'
            ? (await indexedDB.databases()).map(d => d.name).filter(Boolean)
            : [];
        const toDelete = [...new Set([...dbNames, ...KNOWN_SITE_DBS])];
        await Promise.all(toDelete.map(deleteDb));
    } catch { /* best effort */ }

    // Collect keys first (indexes shift while removing), then remove.
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('firebaseCache_') || key.endsWith('DataVersion') || key === 'formVersions' || key === 'lastSelectedFormName')) {
            keysToRemove.push(key);
        }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    sessionStorage.clear();

    return removed;
}
