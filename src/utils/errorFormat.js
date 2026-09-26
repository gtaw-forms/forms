// Pure error-formatting helpers for the global error pipeline (no imports —
// safe to unit-test headlessly and to load anywhere).

export const OWNER_MENTION = '<@228306972204597248>';

/**
 * Serialize a console-interceptor arg. Error objects lose their
 * non-enumerable props (message, stack) under JSON.stringify — FirebaseErrors
 * used to arrive in Discord as bare {code, name}. Serialize Errors
 * explicitly so embeds show the actual response text.
 */
export const formatLogArg = (arg) => {
    if (arg instanceof Error) {
        const out = { name: arg.name || 'Error', message: String(arg.message || '') };
        if (arg.code !== undefined) out.code = String(arg.code);
        try {
            for (const k of Object.keys(arg)) {
                if (k in out) continue;
                const v = arg[k];
                out[k] = typeof v === 'object' && v !== null
                    ? JSON.stringify(v).slice(0, 500)
                    : String(v).slice(0, 500);
            }
        } catch { /* ignore */ }
        return JSON.stringify(out);
    }
    if (typeof arg === 'object' && arg !== null) {
        try {
            return JSON.stringify(arg, null, 2);
        } catch {
            return String(arg);
        }
    }
    return String(arg);
};

/**
 * Known-transient signatures: posted to the error channel for the audit
 * trail, but must never ping the owner (noisy, self-resolving, or already
 * handled elsewhere — UCP flaps, timeouts, stale-chunk reloads, offline).
 * Everything else keeps the ping.
 */
const TRANSIENT_ERROR_RE = /(functions\/)?(unavailable|deadline-exceeded)|not responding right now|try again in a minute|timed out|timing out|timeout|network request failed|failed to fetch|networkerror|offline|updating phmc tools|chunk/i;

export const isTransientLogError = (text) => TRANSIENT_ERROR_RE.test(String(text || ''));
