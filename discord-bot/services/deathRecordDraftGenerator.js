/**
 * deathRecordDraftGenerator.js — Template loading + BBcode draft generation.
 *
 * Pure functions: no Discord, no Firebase state.
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = resolve(__dirname, '..', 'templates', 'death-record.json');

// ── Template Loading ──

let _template = null;

export function loadTemplate() {
    if (_template) return _template;
    try {
        const raw = readFileSync(TEMPLATE_PATH, 'utf-8');
        _template = JSON.parse(raw);
        console.log('[DRAFT] [OK] Death Record template loaded');
        return _template;
    } catch (err) {
        console.error('[DRAFT] [ERR] Failed to load template:', err.message);
        return null;
    }
}

// ── BBCode Filler ──

/**
 * Fill the Death Record BBCode template with field values.
 * Only replaces {{fieldName}} placeholders that have a value.
 */
export function fillTemplate(template, values) {
    let bbcode = template.bbcodeTemplate;
    for (const [key, val] of Object.entries(values)) {
        const placeholder = `{{${key}}}`;
        if (bbcode.includes(placeholder)) {
            bbcode = bbcode.replaceAll(placeholder, val ?? '');
        }
    }
    return bbcode;
}

// ── Report helpers (mass fatality decedents) ──

/**
 * The stored Firebase key of the parent report, stripping any `_decedentN`
 * suffix added by the mass-fatality drafting path.
 */
export function baseReportKey(reportKey) {
    return String(reportKey || '').replace(/_decedent\d+$/, '');
}

/**
 * Index of the decedent inside a mass-fatality report's `decedents` array,
 * derived from a draft key ending in `_decedentN`. Returns -1 for non-suffixed keys.
 */
export function decedentIndexFromKey(reportKey) {
    const m = String(reportKey || '').match(/_decedent(\d+)$/);
    return m ? parseInt(m[1], 10) : -1;
}

/**
 * The decedent object for a draft key, or null when the report is not a
 * mass-fatality report or the key has no `_decedentN` suffix.
 */
export function decedentFromReport(reportData, reportKey) {
    const idx = decedentIndexFromKey(reportKey);
    if (idx < 0) return null;
    return Array.isArray(reportData?.data?.decedents) ? reportData.data.decedents[idx] : null;
}

/**
 * Normalize a user-entered date to ISO. Handles the mass-fatality form's
 * `MM/DD/YYYY - HH:MM` convention (day-first), so it no longer yields an
 * Invalid Date when fed to `new Date()`. Passes ISO strings through unchanged.
 */
export function toIsoDate(value) {
    if (!value) return '';
    const m = String(value).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s*[-–—]?\s*(?:(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (m) {
        let day = +m[1], month = +m[2];
        if (month > 12) { const t = day; day = month; month = t; }
        const dateStr = `${m[3]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return m[4] ? `${dateStr}T${m[4]}:${m[5]}` : dateStr;
    }
    return value;
}

/**
 * Build the virtual `data` object for one decedent of a mass-fatality report,
 * mirroring what the web form collects per decedent. Used by the passive CK
 * path and by morgue re-checks so drafts always carry the per-decedent identity
 * (name/OOC/date) instead of falling back to the morgue record's raw name.
 */
export function buildVirtualReportData(reportData, dec) {
    const base = reportData?.data || {};
    const normPronounced = toIsoDate(dec?.pronouncedTimeOfDeath || dec?.dateOfDeath || '');
    return {
        ...base,
        decedentName: dec?.decedentName || 'Unknown',
        decedentOOC: dec?.decedentOOC || '',
        dateTime: normPronounced || base.dateTime || '',
        dateOfDeath: normPronounced || '',
        typeOfDeath: 'CK',
        age: dec?.age || '',
        sex: dec?.sex || '',
        ethnicity: dec?.ethnicity || '',
        placeOfDeath: dec?.location || dec?.placeOfDeath || '',
        bodyStatus: dec?.bodyStatus || 'HELD',
        Manner: dec?.mannerOfDeath || dec?.causeOfDeath || '',
    };
}

// ── Draft Generation ──

const ETHNICITY_KEYWORDS = [
    { words: ['asian', 'oriental', 'chinese', 'japanese', 'korean', 'vietnamese', 'filipino', 'thai', 'khmer', 'south asian', 'indian', 'pakistani', 'bangladeshi', 'sri lankan'], label: 'Asian' },
    { words: ['caucasian', 'white', 'european'], label: 'Caucasian' },
    { words: ['black', 'african', 'african american', 'caribbean'], label: 'Black' },
    { words: ['hispanic', 'latino', 'latina', 'mexican', 'puerto rican', 'cuban', 'central american', 'south american'], label: 'Hispanic' },
    { words: ['middle eastern', 'arab', 'persian', 'turkish'], label: 'Middle Eastern' },
    { words: ['native american', 'indigenous', 'american indian'], label: 'Native American' },
    { words: ['pacific islander', 'polynesian', 'micronesian', 'melanesian', 'hawaiian'], label: 'Pacific Islander' },
    { words: ['mixed', 'biracial', 'multiracial', 'mixed race'], label: 'Mixed' },
];

/**
 * Strip time from a date string — public records show date only.
 * Handles "YYYY-MM-DD HH:MM" (space-separated), "YYYY-MM-DDTHH:MM" (ISO),
 * "HH:MM:SS" with seconds, and any trailing " - " separator residue.
 */
export function stripTime(dateStr) {
    if (!dateStr || dateStr === 'UNKNOWN') return dateStr;
    const isoMatch = dateStr.match(/^(\d{4}-\d{2}-\d{2})T/i);
    if (isoMatch) return isoMatch[1];
    let out = dateStr.replace(/\s+\d{1,2}:\d{2}(?::\d{2})?(\s*(?:AM|PM))?$/i, '').trim();
    out = out.replace(/\s*[-–—]\s*$/i, '').trim();
    return out;
}

/**
 * Generate a Death Record draft from a coroner report + morgue data.
 * Returns { bbCode, title, values, filledFields } or null if essential data is missing.
 */
export function generateDraft(reportData, morgueRecord) {
    const data = reportData.data || {};
    const template = loadTemplate();
    if (!template) return null;

    const decedentName = data.decedentName || morgueRecord?.name || 'UNKNOWN';
    const decedentOOC = data.decedentOOC || 'N/A';

    const year = new Date().getFullYear();
    const caseNum = morgueRecord?.caseId || data.caseNumber || 'UNKNOWN';
    const rawDod = data.dateOfDeath || data.dateTime || morgueRecord?.timeOfDeathISO || morgueRecord?.timeOfDeath || 'UNKNOWN';
    const dod = stripTime(rawDod);
    const title = `[CASE #${year}-${caseNum}] ${decedentName} ((${decedentOOC})) | ${dod}`;

    let rawAge = data.age || morgueRecord?.estimatedAge || '';
    if (rawAge && rawAge !== 'Unknown' && rawAge !== 'unknown') {
        rawAge = rawAge.split('\n')[0].split('Tattoos')[0].trim();
    }
    const age = (rawAge && rawAge !== 'Unknown' && rawAge !== 'unknown')
        ? rawAge
        : 'Unknown';

    const bodyStatus = data.bodyStatus || 'HELD';

    let ethnicity = data.ethnicity || '';
    if (!ethnicity || ethnicity === 'Unknown' || ethnicity === 'unknown') {
        const physDesc = (morgueRecord?.physicalDescription || '').toLowerCase();
        for (const group of ETHNICITY_KEYWORDS) {
            if (group.words.some(w => physDesc.includes(w))) {
                ethnicity = group.label;
                break;
            }
        }
    }
    if (!ethnicity) ethnicity = 'Unknown';

    const values = {
        decedentName,
        decedentOOC: decedentOOC,
        age,
        caseNumber: String(morgueRecord?.caseId || data.caseNumber || ''),
        coldCaseStatus: data.coldCaseStatus || 'Active',
        bodyStatus,
        sex: data.sex || morgueRecord?.sex || 'Unknown',
        ethnicity,
        placeOfDeath: data.placeOfDeath || morgueRecord?.location || '',
        Manner: data.Manner || data.mannerOfDeath || morgueRecord?.causeOfDeath || 'Unknown',
        selectEmployee: data.selectEmployee || data.coronerEmployee || data.phmcEmployee || '',
        otherSignificantConditions: data.otherSignificantConditions || '',
        dateOfDeath: dod,
        deathRecordType: data.deathRecordType || 'Identified',
    };

    const bbCode = fillTemplate(template, values);

    const filledFields = Object.entries(values)
        .filter(([, v]) => v && v !== 'Unknown' && v !== 'N/A')
        .map(([k]) => k)
        .join(', ');

    return { bbCode, title, values, filledFields };
}
