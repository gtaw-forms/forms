/**
 * BBCode Sanity Check — deploy-point gate mirroring the golden-test invariants.
 *
 * The golden suite (tests/golden-core.test.js) pins two render invariants for
 * the coroner/mass forms. The bot deploys the WEB-generated BBCode, so this
 * module re-checks those two invariants right before dispatch:
 *   1. No leftover {{...}} placeholders in the rendered BBCode.
 *   2. A known department short code renders as its FULL name (the web
 *      generator's STATIC_AGENCY_NAMES lookup in src/utils/bbcodeHelpers.js).
 *
 * Unknown codes (e.g. 'XYZ') are allowed to fall back to the raw code — never
 * blocked. A department value that is already a full name (legacy data)
 * passes. This mirrors the web STATIC_AGENCY_NAMES — the bot checks the
 * WEB-generated content; the bot's own deployCoronerEmail map is a separate
 * path and intentionally not consulted here.
 */

export const SANITY_DEPARTMENT_NAMES = {
    lspd: 'Los Santos Police Department',
    lssd: 'Los Santos County Sheriffs Department',
    sadcr: 'San Andreas Department of Corrections and Rehabilitation',
    dao: "District Attorney's Office",
    lsfd: 'Los Santos Fire Department',
};

/**
 * Check a rendered BBCode string for the golden-test invariants.
 *
 * @param {string} bbCode — rendered BBCode to sanity-check.
 * @param {string|object} department — report department value (raw short code,
 *   full name, or the { label, value } object shape the web app writes).
 * @returns {{ ok: boolean, problems: string[] }} ok=true when no invariant is
 *   violated; problems lists every violation found.
 */
export function checkBbcodeSanity(bbCode, department) {
    const problems = [];
    const text = String(bbCode || '');

    // Invariant 1: no leftover {{...}} placeholders.
    const leftovers = text.match(/\{\{[^}]*\}\}/g) || [];
    if (leftovers.length > 0) {
        problems.push(`Leftover placeholder(s): ${leftovers.slice(0, 3).join(', ')}`);
    }

    // Invariant 2: a known department short code must render as its full name.
    // Normalize the department value (object -> .label || .value, else String),
    // then lowercase+trim for the short-code lookup. Unknown codes and values
    // that are already full names are NOT in the map -> no check -> pass.
    const rawDept = department && typeof department === 'object' ? (department.label || department.value || '') : department;
    const code = String(rawDept ?? '').trim().toLowerCase();
    const fullName = SANITY_DEPARTMENT_NAMES[code];
    if (fullName && !text.includes(fullName)) {
        problems.push(`Department "${code}" rendered without its full name`);
    }

    return { ok: problems.length === 0, problems };
}