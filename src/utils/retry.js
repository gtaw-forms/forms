// ---------------------------------------------------------------------------
// Retry Utility — Exponential backoff with jitter for transient errors
// ---------------------------------------------------------------------------

/**
 * Generic async retry wrapper with exponential backoff + jitter.
 *
 * @param {() => Promise<T>} fn  — the async function to retry
 * @param {object}           opts
 * @param {number}           [opts.maxRetries=3]  — max attempts (initial call + retries)
 * @param {number}           [opts.baseDelay=1000] — base delay in ms (doubles each attempt)
 * @param {(Error) => boolean} [opts.shouldRetry]  — predicate; return true to retry
 * @returns {Promise<T>}
 */
export const withRetry = async (fn, opts = {}) => {
    const { maxRetries = 3, baseDelay = 1000, shouldRetry = () => true } = opts;
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            if (attempt < maxRetries && shouldRetry(error)) {
                const delay = Math.min(baseDelay * Math.pow(2, attempt), 10000);
                const jitter = delay * 0.1 * Math.random();
                await new Promise(r => setTimeout(r, delay + jitter));
            } else {
                throw error;
            }
        }
    }

    // Should not reach here, but satisfies the compiler
    throw lastError;
};

/**
 * Predicate: true when the error is a transient Firebase Auth network error
 * that is safe to retry.
 */
export const isRetryableAuthError = (error) => {
    const code = error?.code || '';
    return code === 'auth/network-request-failed' || code === 'auth/internal-error';
};

/**
 * Predicate: true when the error is a transient Firebase Function
 * infrastructure error (cold-start routing, CORS hiccups, etc.).
 */
export const isRetryableFirebaseFunctionError = (error) => {
    return error?.code === 'functions/internal';
};
