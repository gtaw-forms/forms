/**
 * Per-browser-session debounce guard for the `triggerFactionSync` Cloud Function.
 *
 * Background: triggerFactionSync was the heaviest callable (725 invocations/7d)
 * because automatic paths (post-login, Firebase-auth recovery, identity-refresh
 * follow-up) re-ran it on every revisit. This module owns the session flag so
 * every call site shares one rule:
 *
 * - At most ONE automatic sync per browser session (sessionStorage flag).
 * - `{ force: true }` bypasses the guard: fresh OAuth login, explicit user
 *   Reload, manual admin Cloud Sync, or stale/missing faction data.
 * - Manual/admin triggers mark the flag on success so later automatic paths
 *   skip their duplicates.
 *
 * sessionStorage is per-tab lifetime: a fresh tab/profile = fresh session = one
 * sync allowed. All access is try/catch-guarded (private mode / SSR safety).
 */

export const FACTION_SYNC_SESSION_KEY = 'phmc_faction_sync_done';

export const hasSyncedFactionThisSession = () => {
    try {
        return sessionStorage.getItem(FACTION_SYNC_SESSION_KEY) === '1';
    } catch {
        return false;
    }
};

export const markFactionSyncedThisSession = () => {
    try {
        sessionStorage.setItem(FACTION_SYNC_SESSION_KEY, '1');
    } catch {
        // Storage unavailable (private mode/SSR) — sync proceeds unguarded.
    }
};

export const clearFactionSyncSessionFlag = () => {
    try {
        sessionStorage.removeItem(FACTION_SYNC_SESSION_KEY);
    } catch {
        // No-op when storage is unavailable.
    }
};
