// src/utils/duplicateCheck.js
// Pure duplicate-report matcher (Tier 1: photo-URL overlap OR metadata triple).
// No React, no Firebase, no network — safe to unit test directly and reused
// verbatim by useFormSaver. Warn-never-block lives with the caller; this
// module only answers "which recent report matches, if any".

export const dupNormText = (v) =>
    String(v ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

export const dupNormUrl = (u) => {
    const s = String(u ?? '').trim();
    if (!/^https?:\/\//i.test(s) || s.length > 2000) return null;
    try {
        const parsed = new URL(s);
        return (parsed.host + parsed.pathname).toLowerCase().replace(/\/$/, '');
    } catch {
        return s.toLowerCase();
    }
};

export const dupCollectUrls = (node, out = new Set()) => {
    if (out.size >= 50) return out;
    if (typeof node === 'string') {
        const norm = dupNormUrl(node);
        if (norm) out.add(norm);
    } else if (Array.isArray(node)) {
        for (const item of node) { dupCollectUrls(item, out); if (out.size >= 50) break; }
    } else if (node && typeof node === 'object') {
        for (const value of Object.values(node)) { dupCollectUrls(value, out); if (out.size >= 50) break; }
    }
    return out;
};

export const dupDayOf = (v) => {
    const t = Date.parse(String(v ?? ''));
    if (Number.isNaN(t)) return null;
    const d = new Date(t);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Find a duplicate candidate among recent saves.
 * @param {object} current - { formId, key, data } for the in-progress save.
 * @param {Array} candidates - recent saved reports (VPS list items).
 * @returns {{ key, title, timestamp, reason } | null} reason is a
 *   user-facing string ('same photo detected' / 'same decedent, date and
 *   location').
 */
export function findDuplicateCandidate(current, candidates = []) {
    const data = current?.data || {};
    const mineUrls = dupCollectUrls(data);
    const mineDecedent = dupNormText(data.decedentName || data.patientName);
    const mineDay = dupDayOf(data.dateTime);
    const minePlace = dupNormText(data.placeOfDeath);
    const mineFormId = current?.formId;
    const minePhotoCount = mineUrls.size;

    for (const cand of candidates) {
        if (!cand || cand.key === current?.key) continue;
        const cData = cand.report?.data || cand.data || {};
        const cFormId = cand.formId || cand.report?.formId;
        if (cFormId && mineFormId && cFormId !== mineFormId) continue;
        // Signal 1: shared photo URL (re-attached/reused uploads, copies).
        let urlOverlap = false;
        if (minePhotoCount > 0) {
            const candUrls = dupCollectUrls(cData);
            for (const u of mineUrls) {
                if (candUrls.has(u)) { urlOverlap = true; break; }
            }
        }
        // Signal 2: same decedent + day + place (both-empty place needs
        // equal non-zero photo counts to count).
        const cDecedent = dupNormText(cData.decedentName || cData.patientName);
        const cDay = dupDayOf(cData.dateTime);
        const cPlace = dupNormText(cData.placeOfDeath);
        const metaTriple = !!mineDecedent && !!cDecedent && mineDecedent === cDecedent
            && !!mineDay && !!cDay && mineDay === cDay
            && (minePlace && cPlace
                ? minePlace === cPlace
                : (!minePlace && !cPlace && minePhotoCount > 0
                    && minePhotoCount === dupCollectUrls(cData).size));
        if (urlOverlap || metaTriple) {
            return {
                key: cand.key,
                title: cand.originalKey || cand.report?.originalKey || cand.key,
                timestamp: cand.timestamp || cand.report?.timestamp || null,
                reason: urlOverlap ? 'same photo detected' : 'same decedent, date and location',
            };
        }
    }
    return null;
}
