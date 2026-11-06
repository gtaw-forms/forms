import * as functions from "firebase-functions";

const UCP_USER_URL = 'https://ucp.gta.world/api/user';
const UCP_UA = 'PHMC-Tools/1.0 (Firebase Functions)';

/**
 * GET the UCP user profile with retries on transient failures.
 *
 * The UCP origin flaps behind Cloudflare (seen live in GCP logs: HTTP 520 /
 * 522 clusters turning every login/refresh into functions/internal). Without
 * retries each flap surfaces to the user as an unhandled error. Non-2xx
 * responses that are NOT retryable (4xx = bad/expired token) are returned
 * as-is so callers keep their existing handling; 429 / 5xx / timeouts /
 * network errors retry, then throw HttpsError('unavailable') with a
 * user-actionable message instead of 'internal'.
 *
 * Budget: 15s per attempt × 3 attempts + 1.5s/3s backoff ≈ 50s worst case,
 * inside the 60s callable default timeout.
 */
export async function fetchUcpUserProfile(accessToken, { tag = 'UCP', timeoutMs = 15000, retries = 2, fetchFn = fetch, sleepFn = null } = {}) {
    const sleep = sleepFn || ((ms) => new Promise((r) => setTimeout(r, ms)));
    let lastStatus = null;
    let lastBody = '';
    for (let attempt = 0; attempt <= retries; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const res = await fetchFn(UCP_USER_URL, {
                headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json', 'User-Agent': UCP_UA },
                signal: controller.signal,
            });
            if (res.ok) return res;
            if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
                lastStatus = res.status;
                try { lastBody = (await res.text()).substring(0, 500); } catch { lastBody = ''; }
                console.warn(`[${tag}] UCP profile fetch HTTP ${res.status} (attempt ${attempt + 1}/${retries + 1}) — retrying`);
                if (attempt < retries) await sleep(1500 * (attempt + 1));
                continue;
            }
            return res;
        } catch (err) {
            if (err && err.name === 'AbortError') {
                console.warn(`[${tag}] UCP profile fetch timeout after ${timeoutMs}ms (attempt ${attempt + 1}/${retries + 1}) — retrying`);
                if (attempt < retries) await sleep(1500 * (attempt + 1));
                continue;
            }
            throw err;
        } finally {
            clearTimeout(timer);
        }
    }
    console.error(`[${tag}] UCP profile fetch failed after ${retries + 1} attempts (last HTTP ${lastStatus}):`, lastBody);
    throw new functions.https.HttpsError('unavailable', 'GTA World login servers are not responding right now. Please try again in a minute.');
}
