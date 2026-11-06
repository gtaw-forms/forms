/**
 * autopsyCompletionGuards.js — pure decision helpers for the autopsy completion
 * flow (deployAutopsyReply.js: the DM step + the last-resort name match).
 *
 * Leaf module (imports only doePlaceholders.js) so it stays unit-testable and
 * cheap to import from the deploy flow — no forum/Discord/Firebase graph.
 *
 * Why these exist (Hawick incident, 2026-10-14):
 *   1. A report filed as `decedentName: "Unknown"` (the morgue's unidentified/
 *      PK convention) fell through the caseTopicId and OOC matches to the
 *      last-resort NAME lookup. `isDoePlaceholder("Unknown")` is false, the
 *      lookup returned every "Unknown" entry, and the flow completed ALL of the
 *      open ones (t=10076/t=10083) — writing one decedent's report onto two
 *      unrelated stale duplicate requests and creating two junk LSPD crossposts.
 *   2. The DM fallback target was the literal 'CASELINK [BOT]' while the guard
 *      that skips that account tested 'CASELINK [Bot]'. Case-sensitive
 *      comparison → the guard never fired, the bot really composed a PM to a
 *      username that does not exist, the step stayed failed, and the hourly
 *      Recovery Sweep retried it forever.
 */

import { isNonIdentityPlaceholder } from './doePlaceholders.js';

/** The automated CASELINK requester account (display casing). */
export const CASELINK_ACCOUNT = 'CASELINK [Bot]';

/**
 * True when a recipient is the CASELINK bot. Matches any casing/variant
 * ("CASELINK [BOT]", "CASELINK [Bot]", "caselink") — the forum returns whatever
 * phpBB stores, and the monitor already identifies it with /caselink/i.
 *
 * @param {string} value
 * @returns {boolean}
 */
export function isCaselinkAccount(value) {
    return /caselink/i.test(String(value || '').trim());
}

/** Template "recipients" that are never real forum accounts. */
const UNUSABLE_DM_TARGETS = new Set(['requesting party', 'phmc forms bot', 'phmc bot', 'none', 'unknown']);

/**
 * True when a DM target must NOT be PM'd: empty, a template placeholder, or the
 * CASELINK bot (which reads the forums directly and cannot receive these PMs).
 * The DM step records a skipped step in that case — never a failure, so the
 * recovery sweep cannot retry a permanently unsendable DM forever.
 *
 * @param {string} value
 * @returns {boolean}
 */
export function isUnusableDmTarget(value) {
    const v = String(value || '').trim();
    if (!v) return true;
    if (isCaselinkAccount(v)) return true;
    return UNUSABLE_DM_TARGETS.has(v.toLowerCase());
}

/**
 * Verdict for the completion flow's last-resort NAME match. The name lookup is
 * only trusted when the name actually identifies a person AND exactly one open
 * request answers to it; anything else is quarantined for supervisor triage
 * (the report stays posted, the request simply is not completed) — completing
 * the wrong records is worse than deferring.
 *
 * @param {string} name — decedent name from the report
 * @param {Array<{completedAt?: string|null}>} candidates — every entry the name query returned
 * @returns {{accept: boolean, reason: string, openCount: number}}
 */
export function nameFallbackVerdict(name, candidates = []) {
    const list = Array.isArray(candidates) ? candidates.filter(Boolean) : [];
    if (!String(name || '').trim()) return { accept: false, reason: 'no decedent name', openCount: 0 };
    if (isNonIdentityPlaceholder(name)) return { accept: false, reason: `placeholder decedent name "${name}"`, openCount: 0 };
    const open = list.filter((c) => !c.completedAt);
    if (open.length === 0) return { accept: false, reason: 'no OPEN request answers to that name', openCount: 0 };
    if (open.length > 1) return { accept: false, reason: `${open.length} OPEN requests answer to that name`, openCount: open.length };
    return { accept: true, reason: 'single open match', openCount: 1 };
}
