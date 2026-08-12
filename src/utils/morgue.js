import { sanitizeMorgueText } from './textUtils';

// ---------------------------------------------------------------------------
// Morgue Record Parsing
// ---------------------------------------------------------------------------

const MORGUE_MONTH_INDEX = { january: 0, february: 1, march: 2, april: 3, may: 4, june: 5, july: 6, august: 7, september: 8, october: 9, november: 10, december: 11 };

/**
 * Normalize the game's "Weekday, DD Month YYYY HH:MM:SS" time-of-death into an
 * ISO string ("YYYY-MM-DDTHH:MM:SS"). The bot prefers this over the display
 * string so its date tie-break never depends on the game's format. Returns ''
 * when unparseable.
 */
export const morgueTimeToIso = (value) => {
    if (!value) return '';
    const m = String(value).match(/(\d{1,2})\s+([A-Za-z]+),?\s+(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (!m) return '';
    const month = MORGUE_MONTH_INDEX[m[2].toLowerCase()];
    if (month === undefined) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${m[3]}-${pad(month + 1)}-${pad(m[1])}T${pad(m[4])}:${pad(m[5])}:${m[6] ? pad(m[6]) : '00'}`;
};

export const parseMorgueRecord = (text) => {
    if (!text || !text.trim()) return null;

    const sanitizedText = sanitizeMorgueText(text);

    const record = {};
    const lines = sanitizedText.split('\n').map(line => line.trim());

    const caseMatch = sanitizedText.match(/CASE\s+#(\d+)/i);
    record.caseId = caseMatch ? caseMatch[1] : 'Unknown';

    const extractField = (label) => {
        const boundaries = '(?:NAME:|SEX:|IDENTIFIED:|LOCATION:|TIME OF DEATH:|CAUSE OF DEATH:|SIGNATURE:|DNA PROFILE|PHYSICAL DESCRIPTION|FORENSIC DETAILS|AUTOPSY FINDINGS|-----------------|$|\\n[A-Z\\s]+:)';
        const regex = new RegExp(`${label}:\\s*\\n?\\s*([\\s\\S]*?)(?=\\s*${boundaries})`, 'i');
        const match = sanitizedText.match(regex);
        return match ? match[1].trim() : 'Unknown';
    };

    record.name = extractField('NAME');
    record.sex = extractField('SEX');
    record.identified = extractField('IDENTIFIED');
    record.location = extractField('LOCATION');
    record.timeOfDeath = extractField('TIME OF DEATH');
    record.timeOfDeathISO = morgueTimeToIso(record.timeOfDeath);
    record.causeOfDeath = extractField('CAUSE OF DEATH');

    const dnaMatch = sanitizedText.match(/DNA PROFILE\s*\n?\s*([0-9A-F]{10,})/i);
    record.dnaProfile = dnaMatch ? dnaMatch[1].trim() : 'N/A';

    const ageMatch = sanitizedText.match(/Estimated age:\s*([\s\S]*?)(?=\n[A-Z\s]{3,}:|Tattoos description:|FORENSIC DETAILS|AUTOPSY FINDINGS|Visible injuries:|$)/i);
    record.estimatedAge = ageMatch ? ageMatch[1].trim() : 'Unknown';

    const tattooMatch = sanitizedText.match(/Tattoos description:\s*([\s\S]*?)(?=\n[A-Z\s]{3,}:|Estimated age:|FORENSIC DETAILS|AUTOPSY FINDINGS|Visible injuries:|$)/i);
    record.tattoos = tattooMatch ? tattooMatch[1].trim() : 'None';

    const bacMatch = sanitizedText.match(/Blood alcohol concentration \(BAC\)\s*([\d.]+%?)/i);
    record.bac = bacMatch ? bacMatch[1].trim() : '0.00%';

    const narcoticsMatch = sanitizedText.match(/Traces of narcotics\s*([\s\S]*?)(?=\n[A-Z\s]{3,}:|Bullet|AUTOPSY FINDINGS|FORENSIC DETAILS|$)/i);
    record.narcotics = narcoticsMatch ? narcoticsMatch[1].trim() : 'None';

    const bulletMatches = [...sanitizedText.matchAll(/Bullet recovered with striation marks - (.*)\s*#(\d+)/gi)];
    record.bullets = bulletMatches.map(m => ({ type: m[1].trim(), id: m[2] }));

    const findingsSectionMatch = sanitizedText.match(/AUTOPSY FINDINGS[\s\S]*?TIME\s+WOUND TYPE\s+BODY PART\s+DIST\.([\s\S]*?)(?=\n----------------|$)/i);
    if (findingsSectionMatch) {
        const tableBody = findingsSectionMatch[1].trim();
        const rows = tableBody.split(/(?=\d{2}:\d{2}:\d{2})/).filter(r => r.trim());

        record.findings = rows.map(row => {
            const timeMatch = row.match(/(\d{2}:\d{2}:\d{2})/);
            if (!timeMatch) return null;

            const time = timeMatch[1];
            const rest = row.replace(time, '').trim();

            const parts = rest.split(/\t|\s{2,}/).map(p => p.trim()).filter(Boolean);

            return {
                time: time,
                type: parts[0] || 'Unknown',
                part: parts[1] || '—',
                dist: parts[2] || '—'
            };
        }).filter(Boolean);
    } else {
        record.findings = [];
    }

    const physicalStart = sanitizedText.indexOf('PHYSICAL DESCRIPTION');
    if (physicalStart !== -1) {
        const ageStart = sanitizedText.indexOf('Estimated age:');
        const tattooStart = sanitizedText.indexOf('Tattoos description:');
        const forensicStart = sanitizedText.indexOf('FORENSIC DETAILS');
        const stopKeywords = [ageStart, tattooStart, forensicStart].filter(idx => idx !== -1 && idx > physicalStart);
        const stopIndex = stopKeywords.length > 0 ? Math.min(...stopKeywords) : sanitizedText.length;
        record.physicalDescription = sanitizedText.substring(physicalStart + 20, stopIndex).trim();
    }

    return record;
};

export const parseBulkMorgueRecords = (text) => {
    if (!text || !text.trim()) return [];

    const blocks = text.split(/\bMORGUE\b/i).filter(block => block.trim().length > 50);
    return blocks.map(block => parseMorgueRecord(block)).filter(record => record !== null);
};

// ---------------------------------------------------------------------------
// Morgue BBCode Generation
// ---------------------------------------------------------------------------

export const generateMorgueBBCode = (record, { redacted = false } = {}) => {
    if (!record) return '';

    const findingsTable = record.findings && record.findings.length > 0
        ? `[table]
[tr]
[td][b]TIME[/b][/td]
[td][b]WOUND TYPE[/b][/td]
[td][b]BODY PART[/b][/td]
[td][b]DIST.[/b][/td]
[/tr]
${record.findings.map(f => `[tr]
[td]${f.time}[/td]
[td]${f.type}[/td]
[td]${f.part}[/td]
[td]${f.dist}[/td]
[/tr]`).join('\n')}
[/table]`
        : '[i]No findings recorded.[/i]';

    const adminNoteSection = record.adminNote
        ? `[hr][/hr]
[b]ADMINISTRATIVE NOTES:[/b]
[quote]
${record.adminNote}
[/quote]`
        : '';

    const bulletsArr = Array.isArray(record.bullets) ? record.bullets : [];
    const bulletsText = redacted
        ? (bulletsArr.length > 0
            ? bulletsArr.map(b => `[*] REDACTED STRIATION - REDACTED ${(b.type || '').toLowerCase().includes('gauge') ? 'PELLET' : 'BULLET'} TYPE`).join('\n')
            : '[*] None')
        : (bulletsArr.length > 0
            ? bulletsArr.map(b => `[*] Bullet recovered with striation marks - ${b.type} #${b.id}`).join('\n')
            : '[*] None');

    return `[divbox=white]
[center][size=150][b]MORGUE INTAKE RECORD[/b][/size]
[size=120][b]CASE #${record.caseId}[/b][/size][/center]

${adminNoteSection}

[hr][/hr]

[b]NAME:[/b] ${record.name}
[b]SEX:[/b] ${record.sex}
[b]IDENTIFIED:[/b] ${record.identified}
[b]LOCATION:[/b] ${record.location}
[b]TIME OF DEATH:[/b] ${record.timeOfDeath}
[b]CAUSE OF DEATH:[/b] ${record.causeOfDeath}

[hr][/hr]

[b]DNA PROFILE:[/b] 
[code]${record.dnaProfile}[/code]

[hr][/hr]

[b]PHYSICAL DESCRIPTION:[/b]
[quote]
${record.physicalDescription}
[b]Estimated age:[/b] ${record.estimatedAge}
[b]Tattoos description:[/b] ${record.tattoos}
[/quote]

[hr][/hr]

[b]FORENSIC DETAILS:[/b]
[list]
[*] [b]Blood alcohol concentration (BAC):[/b] ${record.bac}
[*] [b]Traces of narcotics:[/b] ${record.narcotics}
${bulletsText}
[/list]

[hr][/hr]

[b]AUTOPSY FINDINGS:[/b]
${findingsTable}

[hr][/hr]

[right][size=85][i]Generated by PHMC Morgue E-Portal[/i][/size][/right]
[/divbox]`;
};
