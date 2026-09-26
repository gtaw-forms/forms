// Chunk-load self-heal: lazy route chunks 404 when the tab holds an
// index.html older than the latest deploy (vite empties outDir per build, so
// each push deletes the previous hashed chunks). The fix is NOT to stop
// code-splitting (entry is already ~2MB) — it's to detect the stale-chunk
// signature and reload once to the fresh bundle instead of embedding an
// "unhandled" error and pinging the owner.

const CHUNK_LOAD_RE =
    /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk [\w-]+ failed|ChunkLoadError|error loading dynamically imported module/i;

const RELOAD_KEY = 'phmc_chunk_reload_ts';
const RELOAD_COOLDOWN_MS = 60 * 1000;

export function isChunkLoadError(err) {
    const msg = String((err && (err.message || err)) || '');
    return CHUNK_LOAD_RE.test(msg);
}

/**
 * Reload to the current bundle when a chunk load fails. Guarded by a
 * sessionStorage timestamp so a still-broken deploy (or storage-less
 * environment) can never reload-loop: at most one auto-reload per minute,
 * afterwards the normal error UI takes over.
 * @returns {boolean} true when a reload was initiated.
 */
export function reloadForStaleChunks() {
    try {
        const last = parseInt(sessionStorage.getItem(RELOAD_KEY) || '0', 10);
        if (Date.now() - last < RELOAD_COOLDOWN_MS) return false;
        sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    } catch {
        return false;
    }
    window.location.reload();
    return true;
}
