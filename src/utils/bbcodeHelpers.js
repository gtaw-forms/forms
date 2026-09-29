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


export { getDepartmentFullName, transformReportTitle };
