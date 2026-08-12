/**
 * deathRecordDraftCache.js — Morgue in-memory cache + name-based lookup.
 *
 * Loaded once at startup, updated incrementally via child_added/child_changed
 * listeners. Eliminates repeated full-subtree reads of morgue-records.
 */

let _morgueCache = null;       // Array<{name, caseId, ...firebaseKey}>
let _morgueCacheLoaded = false;

// ── shortId ──

export function shortId(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
        h = ((h << 5) - h) + str.charCodeAt(i);
        h |= 0;
    }
    let h2 = 0;
    for (let i = 0; i < str.length; i += 3) {
        h2 = ((h2 << 7) - h2) + str.charCodeAt(i);
        h2 |= 0;
    }
    return Math.abs(h).toString(36).slice(0, 6) + Math.abs(h2).toString(36).slice(0, 6);
}

// ── Morgue Cache ──

/**
 * Initialize the morgue cache by loading all records from Firebase.
 * Called from autoDeploy startup alongside startMorgueListener().
 * @param {object} db - Firebase database ref
 */
export async function initMorgueCache(db) {
    try {
        const snap = await db.ref('morgue-records').once('value');
        _morgueCache = [];
        _morgueCacheLoaded = true;
        if (snap.exists()) {
            snap.forEach((child) => {
                _morgueCache.push({ ...child.val(), firebaseKey: child.key });
            });
        }
        console.log(`[DRAFT] [OK] Morgue cache loaded — ${_morgueCache.length} records`);
    } catch (err) {
        console.error('[DRAFT] [ERR] Failed to load morgue cache:', err.message);
        _morgueCache = [];
        _morgueCacheLoaded = true;
    }
}

/**
 * Update the morgue cache when a record is added or changed.
 * Called by the morgue listener on child_added / child_changed events.
 * @param {string} firebaseKey
 * @param {object} record
 */
export function updateMorgueCache(firebaseKey, record) {
    if (!_morgueCache) return;
    const idx = _morgueCache.findIndex(r => r.firebaseKey === firebaseKey);
    if (idx !== -1) {
        _morgueCache[idx] = { ...record, firebaseKey };
    } else {
        _morgueCache.push({ ...record, firebaseKey });
    }
}

/**
 * Remove a record from the morgue cache (child_removed event).
 * @param {string} firebaseKey
 */
export function removeMorgueCache(firebaseKey) {
    if (!_morgueCache) return;
    _morgueCache = _morgueCache.filter(r => r.firebaseKey !== firebaseKey);
}

/**
 * Get the morgue cache (for external use).
 * @returns {Array} cached morgue records
 */
export function getMorgueCache() {
    return _morgueCache || [];
}

/**
 * Whether the morgue cache has been loaded at least once.
 * @returns {boolean}
 */
export function isMorgueCacheLoaded() {
    return _morgueCacheLoaded;
}

// ── Morgue Lookup ──

/**
 * Parse a date value to a UTC epoch ms, returning NaN when unparseable.
 * Handles the date/time formats that flow through the draft pipeline:
 *  - ISO: "YYYY-MM-DD[T ]HH:MM[:SS]"
 *  - Slash: "MM/DD/YYYY - HH:MM[:SS]" (mass-fatality form convention, day-first)
 *  - Morgue: "Weekday, DD Month YYYY HH:MM:SS"
 *
 * `new Date()` alone cannot be trusted here — "05/08/2026 - 22:36" yields
 * Invalid Date, and "05/08/2026" is ambiguous, which silently skipped the
 * closest-date tie-break and picked the oldest name match instead.
 */
export function parseDate(value) {
    if (!value && value !== 0) return NaN;
    if (value instanceof Date) return isNaN(value.getTime()) ? NaN : value.getTime();
    const str = String(value).trim();
    if (!str) return NaN;

    let m = str.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));

    m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s*[-–—]?\s*(?:(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (m) {
        let day = +m[1], month = +m[2];
        if (month > 12) { const t = day; day = month; month = t; }
        if (day < 1 || day > 31 || month < 1 || month > 12) return NaN;
        return Date.UTC(+m[3], month - 1, day, +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
    }

    m = str.match(/(\d{1,2})\s+([A-Za-z]+),?\s+(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (m) {
        const MONTHS = { january: 0, february: 1, march: 2, april: 3, may: 4, june: 5, july: 6, august: 7, september: 8, october: 9, november: 10, december: 11 };
        const month = MONTHS[m[2].toLowerCase()];
        if (month !== undefined) return Date.UTC(+m[3], month, +m[1], +m[4], +m[5], +(m[6] || 0));
    }

    return NaN;
}

/**
 * Resolve a morgue record's death time to epoch ms. Prefers the normalized
 * `timeOfDeathISO` field (written by the parsers), falling back to parsing the
 * display string. Returns NaN when neither is usable.
 */
export function morgueTimeMs(rec) {
    if (!rec) return NaN;
    if (rec.timeOfDeathISO) {
        const iso = parseDate(rec.timeOfDeathISO);
        if (!isNaN(iso)) return iso;
    }
    return rec.timeOfDeath ? parseDate(rec.timeOfDeath) : NaN;
}

/**
 * Extract the OOC/real identity from an unidentified morgue record name,
 * e.g. "Unknown (( Asaad Peterson ))" → "Asaad Peterson". Returns '' when none.
 */
export function extractMorgueOocName(name) {
    if (!name) return '';
    const m = String(name).match(/\(\s*\(\s*([^)]*?)\s*\)\s*\)/);
    return m ? m[1].trim() : '';
}

/**
 * Whether a morgue record represents an identified (not "Unknown ((") decedent.
 * Pass the report's `decedentOOC` to also accept unidentified records whose
 * `(( ))` name matches it — the (( )) name is the decedent's real identity.
 */
export function isMorgueRecordIdentified(rec, reportOoc) {
    if (!rec) return false;
    const nameLower = (rec.name || '').toLowerCase().trim();
    if (nameLower.startsWith('unknown') && nameLower.includes('((')) {
        if (reportOoc) {
            const recordOoc = extractMorgueOocName(rec.name).toLowerCase().replace(/[()]/g, '').trim();
            const reportOocNorm = String(reportOoc).toLowerCase().replace(/[()]/g, '').trim();
            if (recordOoc && recordOoc === reportOocNorm) return true;
        }
        return false;
    }
    return String(rec.identified || '').toLowerCase() !== 'no';
}

/**
 * Build a serializable match-debug object for a draft. Records the confidence
 * score plus every similarly-matching candidate so "why was case X matched"
 * can be answered later from the draft alone. Safe to persist to Firebase.
 *
 * @param {object} rec - The winning morgue record
 * @param {string} decedentName - The decedent name searched for
 * @param {string|number|Date} [referenceDate] - Reference date used for the tie-break
 * @param {Array<object>} [candidates] - All records that matched the name
 * @param {boolean} [usedTieBreak] - Whether the closest-date tie-break was applied
 * @param {string} [reportOoc] - Report decedentOOC, used to validate unidentified
 *                               "Unknown (( ... ))" records via their (( )) name
 */
export function morgueMatchDebug(rec, decedentName, referenceDate, candidates, usedTieBreak, reportOoc) {
    if (!rec) return null;
    const refTime = referenceDate ? parseDate(referenceDate) : NaN;
    const buildCandidate = (m) => {
        const mTime = morgueTimeMs(m);
        return {
            caseId: m.caseId || '',
            name: m.name || '',
            identified: isMorgueRecordIdentified(m),
            estimatedAge: m.estimatedAge || '',
            location: m.location || '',
            timeOfDeath: m.timeOfDeath || '',
            dateDistanceDays: (!isNaN(mTime) && !isNaN(refTime)) ? Math.round(Math.abs(mTime - refTime) / 86400000) : null,
        };
    };
    const identified = isMorgueRecordIdentified(rec, reportOoc);
    const oocMatched = identified && !isMorgueRecordIdentified(rec) && !!reportOoc;
    return {
        level: identified ? 'high' : 'low',
        identified,
        oocMatched,
        recordOocName: extractMorgueOocName(rec.name) || null,
        exactName: (rec.name || '').trim().toLowerCase() === String(decedentName || '').trim().toLowerCase(),
        referenceDateUsed: !!usedTieBreak,
        sourceAge: rec.estimatedAge || '',
        caseId: rec.caseId || '',
        name: rec.name || '',
        referenceDateRaw: referenceDate ? String(referenceDate) : null,
        referenceDateParsed: !isNaN(refTime) ? new Date(refTime).toISOString() : null,
        candidateCount: (candidates || []).length,
        candidates: (candidates || []).map(buildCandidate),
    };
}

/**
 * Find a morgue record by decedent name using the in-memory cache.
 * Falls back to Firebase if cache hasn't been loaded yet.
 *
 * When multiple records share the same name (a decedent can have several morgue
 * entries — e.g. a CK'd character), the record whose time-of-death is closest to
 * `referenceDate` wins. This keeps public death records matched to the correct
 * case instead of the first name-partial-match.
 *
 * The returned record carries a non-enumerable `matchQuality` object
 * ({ level: 'high'|'low', identified, exactName, referenceDateUsed, sourceAge })
 * so draft creation can gate low-confidence matches. Passing `reportOoc` lets an
 * unidentified "Unknown (( ... ))" record validate as high-confidence when its
 * (( )) name equals the report's decedentOOC.
 *
 * @param {object} db - Firebase ref (used as fallback only)
 * @param {string} decedentName
 * @param {string|number|Date} [referenceDate] - Report date-of-death to break ties
 * @param {string} [reportOoc] - Report decedentOOC, for (( )) name validation
 * @returns {Promise<object|null>} Best match or null
 */
export async function findMorgueRecord(db, decedentName, referenceDate, reportOoc) {
    if (!decedentName) return null;

    let records = _morgueCache;
    if (!records) {
        const snap = await db.ref('morgue-records').once('value');
        if (!snap.exists()) return null;
        records = [];
        snap.forEach((child) => {
            records.push({ ...child.val(), firebaseKey: child.key });
        });
    }

    const nameLower = decedentName.toLowerCase().trim();
    const refTime = referenceDate ? parseDate(referenceDate) : NaN;

    // Collect all records matching the name at the top score (ties are resolved
    // by date below, so an exact match no longer short-circuits).
    let bestScore = 0;
    let topMatches = [];

    for (const rec of records) {
        const recName = (rec.name || '').toLowerCase().trim();
        let score = 0;
        if (recName === nameLower) {
            score = Infinity;
        } else if (recName.includes(nameLower) || nameLower.includes(recName)) {
            score = Math.max(
                recName.includes(nameLower) ? recName.length : 0,
                nameLower.includes(recName) ? nameLower.length : 0
            );
        }
        if (score > bestScore) {
            bestScore = score;
            topMatches = [{ ...rec }];
        } else if (score > 0 && score === bestScore) {
            topMatches.push({ ...rec });
        }
    }

    if (topMatches.length === 0) return null;

    let best;
    let usedDateTieBreak = false;

    // Multiple records matched the same name — prefer the closest date of death.
    if (topMatches.length > 1 && !isNaN(refTime)) {
        let bestDist = Infinity;
        for (const rec of topMatches) {
            let mTime = morgueTimeMs(rec);
            if (isNaN(mTime)) mTime = rec.lastUpdated || 0;
            const dist = Math.abs((mTime || 0) - refTime);
            if (dist < bestDist) {
                bestDist = dist;
                best = rec;
            }
        }
        usedDateTieBreak = bestDist !== Infinity;
    } else {
        best = topMatches[0];
    }

    // Non-enumerable so it never leaks into cached copies or any record write.
    Object.defineProperty(best, 'matchQuality', {
        value: morgueMatchDebug(best, decedentName, referenceDate, topMatches, usedDateTieBreak, reportOoc),
        enumerable: false,
        configurable: true,
        writable: true,
    });

    return best;
}
