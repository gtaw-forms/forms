// Per-key token bucket (best-effort, per instance): MAX calls per rolling
// WINDOW; over that the caller gets resource-exhausted (fail closed, no
// retry). Same pattern as the sendWebhookProxy limiter; factored out so
// read-heavy callables (getMorgueRecords) can share it.
export function createRateLimiter({ windowMs = 60000, maxCalls = 10, maxBuckets = 5000 } = {}) {
    const buckets = new Map(); // key -> number[] (epoch ms of recent calls)
    return function checkRateLimit(key) {
        const now = Date.now();
        const calls = (buckets.get(key) || []).filter((t) => now - t < windowMs);
        if (calls.length >= maxCalls) {
            buckets.set(key, calls);
            return false;
        }
        calls.push(now);
        if (buckets.size > maxBuckets) buckets.clear();
        buckets.set(key, calls);
        return true;
    };
}
