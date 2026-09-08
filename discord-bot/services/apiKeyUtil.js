/**
 * apiKeyUtil.js — shared helpers for labeled morgue API keys.
 *
 * Format: MORGUE_API_KEYS="label:pmc_morgue_xxx,other-label:pmc_morgue_yyy"
 * Bare keys without a label keep working. Pure module — safe to import from
 * the bot, morgue-api, and standalone debug scripts (no side effects).
 */

export const API_KEY_LABEL_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/;

/**
 * Strip an optional "label:" prefix from a single key entry.
 * Entries whose prefix is not a valid label are returned untouched, so raw
 * keys (even ones containing ':') never break.
 */
export function stripKeyLabel(entry) {
    const e = String(entry || '').trim();
    if (!e) return '';
    const ci = e.indexOf(':');
    if (ci > 0) {
        const maybeLabel = e.slice(0, ci).trim();
        const maybeKey = e.slice(ci + 1).trim();
        if (API_KEY_LABEL_RE.test(maybeLabel) && maybeKey) return maybeKey;
    }
    return e;
}

/** First raw key from a comma-separated MORGUE_API_KEYS value. */
export function firstApiKey(raw) {
    const first = String(raw || '').split(',').map(s => s.trim()).filter(Boolean)[0] || '';
    return stripKeyLabel(first);
}
