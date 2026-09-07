/**
 * Activity Log — tiny in-memory ring buffer of what the bot is currently doing.
 * Fed by forumClient (every browser navigation) so the dashboard can answer
 * "why are the chrome processes open?" — e.g. scanning, posting, login checks.
 * Zero dependencies; lives for the process lifetime.
 */

const MAX = 14;
const IDLE_AFTER_MS = 60 * 1000; // no navigation for 60s → browser considered Idle

const entries = [];
let _inFlight = 0;

export function logActivity(label, detail = '') {
    _inFlight++;
    entries.push({ label, detail, at: Date.now() });
    if (entries.length > MAX) entries.shift();
}

/**
 * Mark a navigation as finished (called after page.goto resolves/throws).
 * Balanced against logActivity so _inFlight reflects active browser work.
 */
export function markActivityDone() {
    if (_inFlight > 0) _inFlight--;
}

/**
 * Is the forum browser currently doing work?
 * Active = an in-flight navigation, OR a navigation within the last IDLE_AFTER_MS.
 * (Some operations like login chain several navigations with waits between them,
 * so a short recency window keeps those chains from flickering to Idle.)
 */
export function isBrowserActive() {
    if (_inFlight > 0) return true;
    const last = lastActivity();
    if (!last) return false;
    return Date.now() - last.at < IDLE_AFTER_MS;
}

export function lastActivity() {
    return entries.length ? { ...entries[entries.length - 1] } : null;
}

export function getRecentActivity(limit = 4) {
    return entries.slice(-limit).map(e => ({ ...e }));
}

/**
 * Derive a short human label + detail from a forum URL.
 */
export function describeActivity(url) {
    try {
        const u = new URL(url);
        const p = u.pathname;
        const mode = u.searchParams.get('mode');
        let label = 'browsing';
        if (p.includes('posting.php')) {
            label = mode === 'post' ? 'posting' : mode === 'quote' ? 'quoting' : 'composing';
        } else if (p.includes('search.php')) {
            label = 'scanning';
        } else if (p.includes('viewtopic.php')) {
            label = 'reading topic';
        } else if (p.includes('viewforum.php')) {
            label = 'scanning forum';
        } else if (p.includes('ucp.php')) {
            label = 'login/session';
        } else if (p.includes('index.php') || p === '/') {
            label = 'site check';
        } else if (p.includes('download') || p.includes('dl_attachment')) {
            label = 'downloading';
        }
        return { label, detail: `${u.hostname}${p}` };
    } catch {
        return { label: 'browsing', detail: String(url).slice(0, 80) };
    }
}