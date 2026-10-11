/**
 * doePlaceholders.js — unidentified-person placeholder handling for morgue matching.
 *
 * Requesters write "(J. DOE)" (single parens) instead of the required ((OOC))
 * identity, and titles carry "(DOE and DOE)". These placeholders are NOT
 * identities: they must never become case names, OOC names, or match tokens.
 * Twin of the bot-side guards in discord-bot/services/autopsyRequestMonitor.js
 * (isDoePlaceholder) and singlePanelV2.js (resolveMorgueStatus) — kept in sync
 * by convention, not import (web/bot bundles are separate).
 */

/** "DOE", "J. DOE", "John Doe", "Jane Doe", "DOE and DOE" (whole string). */
const DOE_PLACEHOLDER_RE = /^\s*((J\.?|JOHN|JANE)\s+)?DOE(\s*(AND|&|\/)\s*((J\.?|JOHN|JANE)\s+)?DOE)?\s*$/i;

/** Parenthesised markers: "(J. DOE)", "(John Doe)", "(Jane Doe)". */
const DOE_PAREN_RE = /\(\s*(J\.?\s*)?DOE\s*\)|\(\s*JOHN\s+DOE\s*\)|\(\s*JANE\s+DOE\s*\)/gi;

/** Bare glued markers as stored pre-fix: "Trinity Dalton J. DOE". */
const DOE_BARE_RE = /\b(J\.?|JOHN|JANE)\s+DOE\b\.?/gi;

/** Tokens that must never match on their own. */
const PLACEHOLDER_TOKENS = new Set(['unknown', 'doe', 'john', 'jane', 'j']);

/** True when the whole value is a DOE placeholder (or empty) — not an identity. */
export function isDoePlaceholder(value) {
    const v = String(value || '').trim();
    if (!v) return true;
    return DOE_PLACEHOLDER_RE.test(v);
}

/** Strip placeholder parentheticals/bare markers from a name for matching. */
export function stripDoePlaceholders(value) {
    return String(value || '')
        .replace(DOE_PAREN_RE, '')
        .replace(DOE_BARE_RE, '')
        .replace(/[[\]()]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Search terms for morgue matching from a case's (name, oocName).
 * Drops DOE-ish OOC terms (they false-positive on substring "doe"/"and")
 * and normalizes the name term. Returns [] when nothing usable remains.
 */
export function matchTerms(name, oocName) {
    const terms = [];
    const ooc = String(oocName || '').trim();
    if (ooc && !isDoePlaceholder(ooc)) terms.push(ooc.toLowerCase());
    const clean = stripDoePlaceholders(name).toLowerCase();
    if (clean && !isDoePlaceholder(clean)) terms.push(clean);
    return terms;
}

/** True when a single match token may count (length + placeholder gate). */
export function isUsableToken(token) {
    const t = String(token || '').toLowerCase();
    return t.length >= 4 && !PLACEHOLDER_TOKENS.has(t);
}

/**
 * Recover the ((OOC)) identity from a request's parsed "Decedent Name" value:
 *   "John Doe ((Ilya Baranov))" -> "Ilya Baranov"
 * A hand-written forum title can omit the ((OOC)) (leaving autopsy-requested's
 * `oocName` blank) while Section 2 still carries it — this is the fallback the
 * Load-Case fill and Assigned Autopsies modal use so the real identity and the
 * morgue match are not lost (t=10364 / Case 538). Returns '' when none.
 */
export function oocFromParsedName(parsedDecedentName) {
    const m = String(parsedDecedentName || '').match(/\(\(\s*([^()]*)\s*\)\)/);
    return m ? m[1].trim() : '';
}
