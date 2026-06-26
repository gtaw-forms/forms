import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Sanitize text for BBCode safety
 */
function sanitize(text) {
    if (!text) return '';
    return String(text)
        .replace(/\[/g, '&#91;')
        .replace(/\]/g, '&#93;')
        .trim();
}

/**
 * Format a bullet list from an array or newline-separated string
 */
function formatBulletList(items) {
    if (!items) return '[list][*] None[/list]';

    const lines = Array.isArray(items)
        ? items
        : String(items).split('\n').map(s => s.trim()).filter(Boolean);

    if (lines.length === 0) return '[list][*] None[/list]';

    return '[list]\n' + lines.map(l => `[*] ${sanitize(l)}`).join('\n') + '\n[/list]';
}

/**
 * Extract the OOC name and clean IC name from a morgue record name field.
 * e.g. "Byron Lawrence ((fr0stydev))" → { ic: "Byron Lawrence", ooc: "fr0stydev" }
 */
function parseName(rawName) {
    if (!rawName) return { ic: 'Unknown', ooc: 'Unknown' };

    const name = String(rawName).trim();
    const oocMatch = name.match(/\(\(\s*(.*?)\s*\)\)/);

    if (oocMatch) {
        return {
            ic: sanitize(name.replace(/\(\(\s*(.*?)\s*\)\)/, '').trim()) || 'Unknown',
            ooc: sanitize(oocMatch[1].trim()),
        };
    }
    return { ic: sanitize(name), ooc: 'Unknown' };
}

/**
 * Format autopsy findings into anatomic summary bullet items.
 * Mirrors the logic from FormFieldRenderer.jsx mapMorgueRecordToFormData
 */
function formatAnatomicSummary(findings) {
    if (!findings || !Array.isArray(findings) || findings.length === 0) return '';

    return findings
        .map(f => {
            const type = sanitize(f.type || '');
            const part = sanitize(f.part || '');
            const typeLower = type.toLowerCase();
            const partLower = part.toLowerCase();

            if (
                !typeLower ||
                typeLower.includes('wound type') ||
                partLower.includes('body part') ||
                typeLower === 'blood loss' ||
                part === '—' ||
                part === 'N/A'
            ) {
                return null;
            }

            const dist = f.dist ? f.dist.replace(/[^\d.]/g, '') : '';
            const distParsed = parseFloat(dist);
            const distRounded = !isNaN(distParsed) ? Math.floor(distParsed) : null;

            if (typeLower.includes('gunshot wound')) {
                const rangeText = distRounded !== null ? `, estimated range ${distRounded}m` : '';
                return `Gunshot Wound to ${part}${rangeText}`;
            }

            const hideDist = typeLower.includes('blunt force trauma') || typeLower.includes('stab wound');
            return `${type} to ${part}${distRounded !== null && !hideDist ? ` (${distRounded}m)` : ''}`;
        })
        .filter(Boolean);
}

/**
 * Format bullets/casings from morgue record
 */
function formatCasings(bullets) {
    if (!bullets) return '';
    const arr = Array.isArray(bullets) ? bullets : [bullets];
    return arr.map(b => {
        const type = sanitize(b.type || 'Unknown');
        const id = b.id || '?';
        return `Bullet found with striation marks (${type}) #${id}`;
    }).join('\n');
}

/**
 * Generate a complete BBCode autopsy report from a morgue record + user input.
 *
 * @param {Object} record - Morgue record from Firebase
 * @param {Object} userInput - User-provided fields
 * @param {string} userInput.deathCausesListItems - Newline-separated causes
 * @param {string} userInput.causeOfDeath - How injury occurred
 * @param {string} userInput.deathType - Manner of death (PK, CK, etc.)
 * @param {string} userInput.synopsis - ME opinion
 * @param {string} discordUserTag - Discord user's display name for coronerEmployee
 * @returns {string} Filled BBCode template
 */
export function generateAutopsyBBCode(record, userInput, discordUserTag) {
    console.log('[AUTOPSY] 🔧 Generating BBCode...');

    const name = parseName(record.name);
    const now = new Date();
    const autopsyTime = now.toISOString().replace('T', ' ').slice(0, 16);

    // ── Build anatomic summary from findings ──
    const anatomicItems = formatAnatomicSummary(record.findings);
    const anatomicSummary = anatomicItems.length > 0
        ? '[list]\n' + anatomicItems.map(i => `[*] ${i}`).join('\n') + '\n[/list]'
        : 'None recorded.';

    // ── Build casings ──
    const casingsText = formatCasings(record.bullets);

    // ── Radiology result ──
    const bulletCount = Array.isArray(record.bullets) ? record.bullets.length : (record.bullets ? 1 : 0);
    const radiologyResult = bulletCount > 0
        ? `${bulletCount} projectiles/slugs were identified via fluoroscopy and recovered during the autopsy.`
        : 'No foreign objects detected.';

    // ── External examination ──
    let externalExam = '';
    if (record.physicalDescription) {
        externalExam = `Physical Description:\n${sanitize(record.physicalDescription)}`;
    }
    if (record.tattoos && record.tattoos !== 'None' && record.tattoos !== 'Unknown') {
        if (!record.physicalDescription || !record.physicalDescription.includes(record.tattoos)) {
            externalExam += `\nTattoos/Marks:\n${sanitize(record.tattoos)}`;
        }
    }
    if (record.estimatedAge && record.estimatedAge !== 'Unknown') {
        externalExam += `\nEst. Age: ${sanitize(record.estimatedAge)}`;
    }
    if (!externalExam) {
        externalExam = 'Not available in morgue records.';
    }

    // ── Load the BBCode template ──
    const templatePath = resolve(process.cwd(), 'templates', 'Autopsy.json');
    const json = JSON.parse(readFileSync(templatePath, 'utf-8'));
    let bbcode = json.bbcodeTemplate || json.template;

    // ── Fill placeholders ──
    const replacements = {
        '{{decedentName}}': name.ic,
        '{{decedentOOC}}': name.ooc,
        '{{autopsyStartTime}}': autopsyTime,
        '{{dnaProfile}}': sanitize(record.dnaProfile || 'N/A'),
        '{{placeOfDeath}}': sanitize(record.location || 'Unknown'),
        '{{deathCausesListItems}}': formatBulletList(userInput.deathCausesListItems),
        '{{deathType}}': sanitize(userInput.deathType || 'Unknown'),
        '{{causeOfDeath}}': sanitize(userInput.causeOfDeath || 'Unknown'),
        '{{autopsyDiagramBBCode}}': '',
        '{{anatomicSummaryListItems}}': anatomicSummary,
        '{{externalExamination}}': externalExam,
        '{{bacLevel}}': sanitize(record.bac || '0.00%'),
        '{{narcoticTraces}}': sanitize(record.narcotics || 'None'),
        '{{photographySectionBBCode}}': 'Decedent Autopsy Photography Attached.',
        '{{RadiologyResult}}': radiologyResult,
        '{{casings}}': casingsText || 'None',
        '{{synopsis}}': sanitize(userInput.synopsis || 'No synopsis provided.'),
        '{{coronerEmployee}}': sanitize(discordUserTag || 'Medical Examiner'),
    };

    for (const [key, value] of Object.entries(replacements)) {
        bbcode = bbcode.replaceAll(key, value);
    }

    // Clean up any remaining unreplaced placeholders
    bbcode = bbcode.replace(/\{\{.*?\}\}/g, '');

    console.log(`[AUTOPSY] ✅ BBCode generated (${bbcode.length} chars)`);
    return bbcode;
}
