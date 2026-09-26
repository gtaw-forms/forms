/**
 * towCache — IndexedDB cache for the Tow Reports server list.
 *
 * Shape: { version, reports, updatedAt }. The server bumps `tow-meta/version`
 * on every mutation; the client renders the cache instantly and only
 * re-renders from the network when the version moved (plus merging
 * browser-local unsynced entries, handled by the caller).
 */
const DB_NAME = 'phmc-tow';
const STORE = 'kv';
const KEY = 'list';

function openDb() {
    return new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') {
            reject(new Error('IndexedDB unavailable'));
            return;
        }
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
            if (!req.result.objectStoreNames.contains(STORE)) {
                req.result.createObjectStore(STORE);
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
    });
}

function tx(mode, fn) {
    return openDb().then(
        (db) =>
            new Promise((resolve, reject) => {
                let done = false;
                try {
                    const t = db.transaction(STORE, mode);
                    const store = t.objectStore(STORE);
                    const rq = fn(store);
                    rq.onsuccess = () => {
                        done = true;
                        resolve(rq.result);
                    };
                    rq.onerror = () => reject(rq.error || new Error('IndexedDB op failed'));
                    t.oncomplete = () => db.close();
                    t.onerror = () => {
                        if (!done) reject(t.error || new Error('IndexedDB tx failed'));
                        try { db.close(); } catch { /* ignore */ }
                    };
                } catch (err) {
                    try { db.close(); } catch { /* ignore */ }
                    reject(err);
                }
            })
    );
}

export async function getTowCache() {
    try {
        const val = await tx('readonly', (store) => store.get(KEY));
        if (!val || !Array.isArray(val.reports)) return null;
        return val;
    } catch {
        return null;
    }
}

export async function setTowCache(version, reports) {
    try {
        await tx('readwrite', (store) =>
            store.put({ version: version || 0, reports: reports || [], updatedAt: Date.now() }, KEY)
        );
        return true;
    } catch {
        return false;
    }
}
