/**
 * VPS report mirror — the durable copy of a deployed queue report.
 *
 * Deployment-tracked reports live in RTDB `scheduledReports` for the bot
 * queue; the new platform's records/LEO feeds read the VPS saved-report store.
 * The web app mirrors at save time (best effort), but that copy is written
 * before deployment and is skipped by old builds / non-web writers. After a
 * successful deploy this helper re-writes the final record (with
 * hasdeployed/deployStatus/deployUrl) so the VPS copy is authoritative.
 *
 * Never throws: a mirror failure must not turn a successful forum post into a
 * failed deploy. The VPS POST bumps appMetadata/reportsDataVersion, so open
 * migration UIs refresh their feed caches.
 */

const LOCAL_API_URL = 'http://127.0.0.1:3001';

/** First key from a labeled/comma-separated env value ("label:key,key2"). */
export function firstApiKey(value = '') {
    const first = String(value || '').split(',')[0].trim().replace(/^["']|["']$/g, '').trim();
    if (!first) return '';
    // MORGUE_API_KEYS uses "label:key"; a bare key has no colon.
    // Quote-tolerant (see apiKeyUtil.stripKeyLabel): a quoted .env value must
    // not leak a stray quote into the key.
    if (!first.includes(':')) return first;
    const key = first.slice(first.lastIndexOf(':') + 1).trim().replace(/^["']|["']$/g, '').trim();
    return key;
}

export function resolveVpsConfig(env = process.env) {
    return {
        apiUrl: String(env.MORGUE_API_URL || LOCAL_API_URL).replace(/\/$/, ''),
        apiKey: firstApiKey(env.MORGUE_API_KEY || env.MORGUE_WRITE_API_KEY
            || env.MORGUE_API_KEYS || env.MORGUE_WRITE_API_KEYS),
    };
}

export async function mirrorScheduledReportToVps(db, authorId, key, { type = '' } = {}) {
    if (!db || !authorId || !key) return { ok: false, skipped: 'missing-identity' };
    const { apiUrl, apiKey } = resolveVpsConfig();
    if (!apiKey) {
        console.warn('[REPORT-MIRROR] No MORGUE_API_KEYS / MORGUE_WRITE_API_KEYS — skipping VPS copy.');
        return { ok: false, skipped: 'no-api-key' };
    }

    try {
        const [reportSnap, bbSnap] = await Promise.all([
            db.ref(`scheduledReports/${authorId}/${key}`).once('value'),
            db.ref(`scheduledReportsBBCode/${authorId}/${key}`).once('value'),
        ]);
        const report = reportSnap.val();
        if (!report || typeof report !== 'object') {
            console.warn(`[REPORT-MIRROR] ${authorId}/${key} not found in scheduledReports — skipping.`);
            return { ok: false, skipped: 'report-missing' };
        }
        const bbCode = bbSnap.val()?.bbCode || '';

        const response = await fetch(`${apiUrl}/api/reports`, {
            method: 'POST',
            headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ author: authorId, key, report, bbCode }),
            signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) {
            const text = await response.text().catch(() => '');
            throw new Error(`HTTP ${response.status} ${text.slice(0, 200)}`);
        }
        console.log(`[REPORT-MIRROR] ${authorId}/${key} copied to VPS after ${type || 'deploy'}.`);
        return { ok: true };
    } catch (err) {
        // Best effort — the forum post already succeeded.
        console.warn(`[REPORT-MIRROR] ${authorId}/${key} VPS copy failed: ${err?.message || err}`);
        return { ok: false, error: err?.message || String(err) };
    }
}

/**
 * Read a saved report back from the VPS store.
 *
 * Report retention is opt-in: an author who opted OUT has no RTDB
 * `scheduledReports` copy at all, so a completion-step retry that only reads
 * RTDB has nothing to file (live: Ricci #10493 — the ME form had no report to
 * build a payload from). The VPS store is the durable copy either way.
 *
 * @returns {Promise<object|null>} the report record ({ data, … }) or null
 */
export async function fetchSavedReportFromVps(authorId, key, env = process.env) {
    if (!authorId || !key) return null;
    const { apiUrl, apiKey } = resolveVpsConfig(env);
    if (!apiKey) return null;
    try {
        const response = await fetch(`${apiUrl}/api/reports/${encodeURIComponent(authorId)}/${encodeURIComponent(key)}`, {
            headers: { 'x-api-key': apiKey },
            signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) {
            if (response.status !== 404) {
                console.warn(`[REPORT-MIRROR] ${authorId}/${key} read failed: HTTP ${response.status}`);
            }
            return null;
        }
        const body = await response.json().catch(() => null);
        const report = body?.report;
        return report && typeof report === 'object' ? report : null;
    } catch (err) {
        console.warn(`[REPORT-MIRROR] ${authorId}/${key} read failed: ${err?.message || err}`);
        return null;
    }
}
