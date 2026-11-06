// src/utils/bbcodeHelpers.js
// Static fallback mirror of RTDB /agencies (fullName values). Used when the
// live store hasn't loaded (permissions, race, offline) so BBCode never
// prints a raw short code. The live store wins when present.
const STATIC_AGENCY_NAMES = {
    LSPD: 'Los Santos Police Department',
    LSSD: 'Los Santos County Sheriffs Department',
    SADCR: 'San Andreas Department of Corrections and Rehabilitation',
    DAO: "District Attorney's Office",
    LSFD: 'Los Santos Fire Department',
    LSGOV: 'Los Santos City Government',
    PHMC: 'Pillbox Hill Medical Center',
    SANFIRE: 'State Fire Marshal',
    SAAA: 'San Andreas Aviation Administration',
};
// Static forum URLs (bot resolveForum defaults) so the manual-post guide keeps
// working when the live agency store hasn't loaded (localhost/offline).
const STATIC_AGENCY_URLS = {
    LSPD: 'http://lspd.gta.world',
    LSSD: 'http://lssd.gta.world',
    SADCR: 'http://sadcr.gta.world',
    DAO: 'https://lsda.gta.world',
};
/**
 * Offline agency entry { shortCode, fullName, url } for a short code or full
 * name (case-insensitive), or null. Mirrors the RTDB /agencies shape closely
 * enough for the manual-post guide (icon lookup by key, compose link, creds
 * domain match) when the live store is unavailable.
 */
const findStaticAgency = (code) => {    if (!code) return null;
    const raw = String(code).trim();
    const upper = raw.toUpperCase();
    if (STATIC_AGENCY_NAMES[upper]) {
        return { shortCode: upper, fullName: STATIC_AGENCY_NAMES[upper], url: STATIC_AGENCY_URLS[upper] || '' };
    }
    const lower = raw.toLowerCase();
    if (lower.length >= 4) {
        const hit = Object.entries(STATIC_AGENCY_NAMES).find(([, name]) => name.toLowerCase() === lower || name.toLowerCase().includes(lower));
        if (hit) return { shortCode: hit[0], fullName: hit[1], url: STATIC_AGENCY_URLS[hit[0]] || '' };
    }
    return null;
};
const getDepartmentFullName = (departmentShortCode, agencyDataStore) => {
    if (!departmentShortCode) return departmentShortCode;
    const raw = String(departmentShortCode);
    if (agencyDataStore) {
        // RTDB keys are UPPERCASE ('LSPD'); stored values drifted between
        // codes ('lspd') and full names depending on client version — match
        // case-insensitively, pass full names straight through.
        const hit = agencyDataStore[raw] || agencyDataStore[raw.toUpperCase()] || agencyDataStore[raw.toLowerCase()];
        if (hit?.fullName) return hit.fullName;
    }
    const staticHit = STATIC_AGENCY_NAMES[raw.toUpperCase()];
    if (staticHit) return staticHit;
    return raw; // Fallback (already a full name or unknown code)
};

// Helper to transform the report title on attachment
const transformReportTitle = (originalKey) => {
    if (typeof originalKey !== 'string') {
        return 'Attached Report';
    }

    let finalKey = originalKey;

    // 1. Handle Death Report prefix and date stripping
    if (finalKey.startsWith('[DEATH-REPORT]')) {
        finalKey = finalKey.replace('[DEATH-REPORT]', 'Coroner Report -').trim();
        // Remove date like MM/DD/YYYY from the end
        finalKey = finalKey.replace(/\s+\d{2}\/\d{2}\/\d{4}$/, '').trim();
    } 
    // 2. Handle Mass Fatality Report titles (prefix and x{times})
    else if (finalKey.startsWith('[Mass Fatality Report]') || finalKey.startsWith('[Multi Fatality Report]')) {
        // Remove the leading "[Mass Fatality Report]" or "[Multi Fatality Report]"
        finalKey = finalKey.replace(/\[(Mass|Multi) Fatality Report\]\s*/i, '').trim();
        // Remove the date from the end (e.g., "- 03/01/2026")
        finalKey = finalKey.replace(/\s*-\s*\d{2}\/\d{2}\/\d{4}$/, '').trim();
        // Remove any pipe separators from concatenated names
        finalKey = finalKey.replace(/\s*\|\s*/g, ', ').trim(); // Replace '|' with ', ' for better display

        // Prepend the standardized report type
        finalKey = `Mass Fatality Report - ${finalKey}`;
        // Ensure "x{times}" is correctly formatted without parentheses if it was " (x{times})"
        finalKey = finalKey.replace(/\s*\(x(\d+)\)/g, ' x$1');
    }
    
    // Replace text within double parentheses ((...)) with "OOC - <content>"
    finalKey = finalKey.replace(/\(\((.*?)\)\)/g, 'OOC - $1').trim();

    // Finally, remove any remaining square brackets to prevent breaking spoilers
    finalKey = finalKey.replace(/\[|\]/g, '').trim();

    return finalKey;
};


export { getDepartmentFullName, transformReportTitle, findStaticAgency };

/** Short codes of agencies on the OAuth portal stack (phpBB creds N/A). */
const PORTAL_AGENCY_CODES = ['LSPD'];

/** Community Portal sign-in for portal-stack agencies. */
const PORTAL_LOGIN_URLS = {
    LSPD: 'https://lspd.gta.world/portal/login',
};

/**
 * True when an agency authenticates via its Community Portal (OAuth) rather
 * than phpBB credentials — no username/password block applies to it.
 * Accepts a short code or full name (case-insensitive).
 */
export function isPortalAgency(code) {
    if (!code) return false;
    const upper = String(code).trim().toUpperCase();
    if (PORTAL_AGENCY_CODES.includes(upper)) return true;
    const snap = findStaticAgency(code);
    return !!snap && PORTAL_AGENCY_CODES.includes(snap.shortCode);
}

/** Portal sign-in URL for a portal-stack agency, or ''. */
export function portalLoginUrl(code) {
    if (!isPortalAgency(code)) return '';
    const snap = findStaticAgency(code);
    const key = snap ? snap.shortCode : String(code).trim().toUpperCase();
    return PORTAL_LOGIN_URLS[key] || '';
}
