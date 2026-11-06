/**
 * doePlaceholders.js — unidentified-person placeholder handling (bot shared).
 *
 * Requesters write "(J. DOE)" (single parens) instead of the required ((OOC))
 * identity, titles carry "(DOE and DOE)", and reports file under bare
 * "Jane Doe". These placeholders are NOT identities: adopting or matching on
 * them files/matches the wrong cases (t=10328 filed "Trinity Dalton J. DOE
 * ((DOE and DOE))"; an autopsy-reply for Jane Doe matched test collection
 * #10161's "Jane Doe" body instead of the real case).
 *
 * Pure leaf module (no imports) — safe to import from the monitor, panels,
 * and deploy flows without cycles. Web twin: src/utils/doePlaceholders.js
 * (kept in sync by convention; separate bundles).
 */

/** Whole-value placeholders: "DOE", "J. DOE", "John/Jane Doe", "DOE and DOE". */
export const DOE_PLACEHOLDER_RE = /^\s*((J\.?|JOHN|JANE)\s+)?DOE(\s*(AND|&|\/)\s*((J\.?|JOHN|JANE)\s+)?DOE)?\s*$/i;

/** Parenthesised markers: "(J. DOE)", "(John Doe)", "(Jane Doe)". */
export const DOE_PAREN_RE = /\(\s*(J\.?\s*)?DOE\s*\)|\(\s*JOHN\s+DOE\s*\)|\(\s*JANE\s+DOE\s*\)/gi;

/** Bare glued markers as stored pre-fix: "Trinity Dalton J. DOE". */
export const DOE_BARE_RE = /\b(J\.?|JOHN|JANE)\s+DOE\b\.?/gi;

/**
 * Whole-value unidentified-body placeholders the request parser, the morgue and
 * the templates emit: "Unknown", "Unknown ()", "Unidentified", "Unidentified
 * Male", "N/A". Like the DOE markers these are NOT identities.
 */
export const UNKNOWN_PLACEHOLDER_RE = /^(unknown|unidentified(\s+(male|female|person|body))?|n\/a)$/i;

/** Placeholder normaliser: drops trailing empty brackets/parens ("Unknown ()"). */
const PLACEHOLDER_SHAPE = (v) => String(v || '')
    .replace(/\(\s*\)|\[\s*\]|\{\s*\}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** True when the value is a DOE placeholder (or empty) — not an identity. */
export function isDoePlaceholder(value) {
    const v = String(value || '').trim();
    if (!v) return true;
    return DOE_PLACEHOLDER_RE.test(v);
}

/**
 * True when the value can never identify a person: empty, a DOE marker, or the
 * unidentified-body placeholder ("Unknown"). Use this — not isDoePlaceholder —
 * wherever a NAME is matched against a record, so one unidentified decedent's
 * report can never be attributed to every other unidentified decedent.
 *
 * @param {string} value
 * @returns {boolean}
 */
export function isNonIdentityPlaceholder(value) {
    const v = PLACEHOLDER_SHAPE(value);
    if (!v) return true;
    return DOE_PLACEHOLDER_RE.test(v) || UNKNOWN_PLACEHOLDER_RE.test(v);
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
