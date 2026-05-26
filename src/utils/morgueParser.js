import { sanitizeMorgueText } from './textUtils';

/**
 * Utility to parse raw morgue records from text logs.
 */

export const parseMorgueRecord = (text) => {
    if (!text || !text.trim()) return null;

    // Sanitize input text to handle malformed characters
    const sanitizedText = sanitizeMorgueText(text);

    const record = {};
    const lines = sanitizedText.split('\n').map(line => line.trim());

    // Case Number
    const caseMatch = sanitizedText.match(/CASE\s+#(\d+)/i);
    record.caseId = caseMatch ? caseMatch[1] : 'Unknown';

    // Helper to extract multiline or single line values (Newline-agnostic)
    const extractField = (label) => {
        // Look for the label and capture everything until the next known header or section divider
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
    record.causeOfDeath = extractField('CAUSE OF DEATH');

    // DNA Profile (Resilient extraction)
    const dnaMatch = sanitizedText.match(/DNA PROFILE\s*\n?\s*([0-9A-F]{10,})/i);
    record.dnaProfile = dnaMatch ? dnaMatch[1].trim() : 'N/A';

    // Estimated Age (More restrictive boundary)
    const ageMatch = sanitizedText.match(/Estimated age:\s*([\s\S]*?)(?=\n[A-Z\s]{3,}:|Tattoos description:|FORENSIC DETAILS|AUTOPSY FINDINGS|Visible injuries:|$)/i);
    record.estimatedAge = ageMatch ? ageMatch[1].trim() : 'Unknown';

    // Tattoos (More restrictive boundary)
    const tattooMatch = sanitizedText.match(/Tattoos description:\s*([\s\S]*?)(?=\n[A-Z\s]{3,}:|Estimated age:|FORENSIC DETAILS|AUTOPSY FINDINGS|Visible injuries:|$)/i);
    record.tattoos = tattooMatch ? tattooMatch[1].trim() : 'None';

    // Forensic Details (Resilient extraction)
    const bacMatch = sanitizedText.match(/Blood alcohol concentration \(BAC\)\s*([\d.]+%?)/i);
    record.bac = bacMatch ? bacMatch[1].trim() : '0.00%';

    const narcoticsMatch = sanitizedText.match(/Traces of narcotics\s*([\s\S]*?)(?=\n[A-Z\s]{3,}:|Bullet|AUTOPSY FINDINGS|FORENSIC DETAILS|$)/i);
    record.narcotics = narcoticsMatch ? narcoticsMatch[1].trim() : 'None';

    // Bullets (Multiple)
    const bulletMatches = [...sanitizedText.matchAll(/Bullet recovered with striation marks - (.*)\s*#(\d+)/gi)];
    record.bullets = bulletMatches.map(m => ({ type: m[1].trim(), id: m[2] }));

    // Autopsy Findings Table (Ultra Robust - identifies rows by timestamp)
    const findingsSectionMatch = sanitizedText.match(/AUTOPSY FINDINGS[\s\S]*?TIME\s+WOUND TYPE\s+BODY PART\s+DIST\.([\s\S]*?)(?=\n----------------|$)/i);
    if (findingsSectionMatch) {
        const tableBody = findingsSectionMatch[1].trim();
        // Split by timestamp pattern to identify rows even if newlines are missing
        const rows = tableBody.split(/(?=\d{2}:\d{2}:\d{2})/).filter(r => r.trim());
        
        record.findings = rows.map(row => {
            const timeMatch = row.match(/(\d{2}:\d{2}:\d{2})/);
            if (!timeMatch) return null;
            
            const time = timeMatch[1];
            const rest = row.replace(time, '').trim();
            
            // Split the rest by tabs or multiple spaces
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

    // Physical Description Text (Full) - Re-calculate stop index to be sure
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

    // Split by "MORGUE" header
    const blocks = text.split(/\bMORGUE\b/i).filter(block => block.trim().length > 50);
    return blocks.map(block => parseMorgueRecord(block)).filter(record => record !== null);
};
