/**
 * Activity Log — tiny in-memory ring buffer of what the bot is currently doing.
 * Fed by forumClient (every browser navigation) so the dashboard can answer
 * "why are the chrome processes open?" — e.g. scanning, posting, login checks.
 * Zero dependencies; lives for the process lifetime.
 */

const MAX = 14;

const entries = [];

export function logActivity(label, detail = '') {
    entries.push({ label, detail, at: Date.now() });
    if (entries.length > MAX) entries.shift();
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