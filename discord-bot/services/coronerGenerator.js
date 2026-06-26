/**
 * Coroner Report BBCode Generator
 *
 * Renders the bbcodeTemplate from coroner-report.json with user-supplied
 * field values. Handles {{variable}} substitution and [conditional] blocks.
 */

/**
 * Render a template string by replacing {{variables}} with values.
 * @param {string} template - BBCode template with {{placeholder}} markers
 * @param {Object} data - Flat key→value map (e.g. { decedentName: 'John Doe' })
 * @returns {string} Rendered BBCode
 */
export function renderCoronerBBCode(template, data) {
    let output = template;

    // 1. Replace all {{variables}} with their values (empty string if missing)
    output = output.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        const val = data[key];
        if (val === undefined || val === null) return '';
        return String(val);
    });

    // 2. Handle [conditional field="X" value="true"] … [/conditional] blocks
    //    Keep the block content only if data[X] is truthy; remove entirely otherwise.
    const condRegex = /\[conditional\s+field="(\w+)"\s+value="([^"]*)"\]([\s\S]*?)\[\/conditional\]/g;
    output = output.replace(condRegex, (match, fieldName, expectedValue, content) => {
        const fieldVal = data[fieldName];
        const fieldStr = String(fieldVal ?? '').trim().toLowerCase();
        const expected = expectedValue.toLowerCase();

        if (fieldStr === expected || (expected === 'true' && fieldVal === true)) {
            return content;
        }
        return '';
    });

    // 3. Clean up excessive blank lines left by removed conditionals
    output = output.replace(/\n{3,}/g, '\n\n');

    return output.trim();
}

/**
 * Map the 3-step coroner modal field names to the template variable names.
 */
export function mapCoronerData(sceneData, decData, docsData) {
    return {
        // Scene Info
        dateTime: sceneData.disp_datetime || '',
        pronouncedTimeOfDeath: sceneData.tod || '',
        department: sceneData.dept || '',
        coronerEmployee: sceneData.coroner_emp || '',
        coronerRank: sceneData.coroner_rank || '',

        // Decedent Info
        decedentName: decData.dec_name || '',
        decedentOOC: decData.dec_ooc || '',
        typeOfDeath: decData.death_type || '',
        mannerOfDeath: decData.manner || '',
        placeOfDeath: decData.place || '',

        // Documentation
        probableCauseOfDeath: docsData.prob_cause || '',
        synopsis: docsData.synopsis || '',
        additionalstaff: docsData.assist_staff || '',
        ReportRequested: docsData.req_officer ? 'true' : 'false',
        requestingOfficer: docsData.req_officer || '',
        evidenceLocker: docsData.evid_items ? 'true' : 'false',
        evidenceLockerItems: docsData.evid_items || '',

        // Images (not yet collected via modals)
        scenePhotosBBCode: '',
        additionalPhotos: '',
        additionalPhotos_narrative: '',
    };
}

/**
 * Generate a full coroner report BBCode string.
 * @param {string} template - Raw bbcodeTemplate from the JSON schema
 * @param {Object} sceneData - Raw fields from Step 1 modal
 * @param {Object} decData - Raw fields from Step 2 modal
 * @param {Object} docsData - Raw fields from Step 3 modal
 * @param {Object} opts - Optional overrides (e.g. { coronerEmployee: 'John Coroner' })
 * @returns {string} Rendered BBCode
 */
export function generateCoronerBBCode(template, sceneData, decData, docsData, opts = {}) {
    const data = {
        ...mapCoronerData(sceneData, decData, docsData),
        ...opts,
    };
    return renderCoronerBBCode(template, data);
}
