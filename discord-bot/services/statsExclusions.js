/**
 * statsExclusions.js — authors excluded from usage stats (shared).
 *
 * Used server-side by morgue-api `/api/reports/stats` (skips their report
 * dirs, so byForm/byAuthor/byMonth/heat/total are all consistent) and
 * client-side by the `global-stats` command (skips their RTDB
 * `scheduledReports` entries, which the API never sees).
 *
 * Matching is normalized (lowercased, letters only) so `Roger_Rose`,
 * "Roger Rose" and `rogerrose` all hit the same entry.
 */

const EXCLUDED_NORMALIZED = new Set([
    'rogerrose', // Roger Rose
    'rogermcfarlane', // Roger McFarlane
]);

export function normalizeAuthorKey(name) {
    return String(name || '').toLowerCase().replace(/[^a-z]/g, '');
}

/** True when the author dir, display name or RTDB key belongs to an excluded author. */
export function isExcludedAuthor(name) {
    return EXCLUDED_NORMALIZED.has(normalizeAuthorKey(name));
}

/** Human-readable list for embed footers / logs. */
export const EXCLUDED_DISPLAY = ['Roger Rose', 'Roger McFarlane'];
