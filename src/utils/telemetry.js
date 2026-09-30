// Pure bucket-mutation core for hourly request telemetry. Shared by the
// useWebhooks accumulator (localStorage bucket) and future producers. Kept
// free of firebase/DOM references so it can be unit-tested offline.
export const TELEMETRY_MAX_USERS = 20;
const TELEMETRY_MAX_USER_ACTIVITY = 20;
const TELEMETRY_MAX_USER_ROUTES = 10;

const TELEMETRY_MAX_ROUTES = 20;
const TELEMETRY_ERROR_SAMPLE_LIMIT = 10;
const TELEMETRY_ERROR_SAMPLE_MAX_LENGTH = 200;
const TELEMETRY_USER_LABEL_MAX_LENGTH = 80;

const asKb = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
};

// Mutates `bucket` with one telemetry entry and returns it. All opts are
// optional: `getInactivityFlag` is a function returning whether the inactivity
// warning fired; `route` is the current route string used when the entry does
// not carry one.
export const accumulateTelemetryEntry = (bucket, entry = {}, opts = {}) => {
    bucket.events += 1;
    if (entry.cached) bucket.cacheHits += 1; else bucket.network += 1;
    if (entry.error) {
        bucket.errors += 1;
        if ((bucket.errorSamples || []).length < TELEMETRY_ERROR_SAMPLE_LIMIT) {
            bucket.errorSamples = [...(bucket.errorSamples || []), String(entry.error).slice(0, TELEMETRY_ERROR_SAMPLE_MAX_LENGTH)];
        }
    }
    bucket.totalKb = asKb(bucket.totalKb) + asKb(entry.totalKb);
    bucket.netKb = asKb(bucket.netKb) + asKb(entry.netKb);
    // Preserve the old inactivity flag signal as an aggregate counter.
    try {
        if (opts.getInactivityFlag && opts.getInactivityFlag()) {
            bucket.inactive = (bucket.inactive || 0) + 1;
        }
    } catch { /* flag must never break logging */ }
    const trigger = entry.trigger || entry.file || 'unknown';
    bucket.byTrigger = bucket.byTrigger || {};
    bucket.byTrigger[trigger] = (bucket.byTrigger[trigger] || 0) + 1;
    const route = entry.route || opts.route || '/';
    bucket.routes = bucket.routes || [];
    if (!bucket.routes.includes(route) && bucket.routes.length < TELEMETRY_MAX_ROUTES) bucket.routes.push(route);
    // Visited identity set for the V2 rollup ("username (character)").
    // Contributes to the hourly union; capped, never sent per-event.
    if (entry.loggedIn && entry.user) {
        bucket.authed = true;
        const label = String(entry.user).slice(0, TELEMETRY_USER_LABEL_MAX_LENGTH);
        bucket.users = bucket.users || [];
        if (label && !bucket.users.includes(label) && bucket.users.length < TELEMETRY_MAX_USERS) {
            bucket.users.push(label);
        }
    }
    // Per-user activity for the V2 rollup ("who did what"). Keyed by the same
    // label as `users` so the two stay consistent. Capped — users past the cap
    // fall back to aggregate-only counts (no per-user row for them).
    if (entry.loggedIn && entry.user) {
        const ulabel = String(entry.user).slice(0, TELEMETRY_USER_LABEL_MAX_LENGTH);
        if (ulabel) {
            bucket.userActivity = bucket.userActivity || {};
            let ua = bucket.userActivity[ulabel];
            if (!ua) {
                if (Object.keys(bucket.userActivity).length >= TELEMETRY_MAX_USER_ACTIVITY) {
                    ua = null;
                } else {
                    ua = { events: 0, errors: 0, cacheHits: 0, network: 0, totalKb: 0, netKb: 0, routes: [] };
                    bucket.userActivity[ulabel] = ua;
                }
            }
            if (ua) {
                ua.events += 1;
                if (entry.cached) ua.cacheHits += 1; else ua.network += 1;
                if (entry.error) ua.errors += 1;
                ua.totalKb = asKb(ua.totalKb) + asKb(entry.totalKb);
                ua.netKb = asKb(ua.netKb) + asKb(entry.netKb);
                const uroute = entry.route || opts.route || '/';
                if (ua.routes.length < TELEMETRY_MAX_USER_ROUTES && !ua.routes.includes(uroute)) ua.routes.push(uroute);
            }
        }
    }
    return bucket;
};