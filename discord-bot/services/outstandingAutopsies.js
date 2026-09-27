/**
 * outstandingAutopsies.js — shared outstanding-case computation for the ME
 * Assignments dashboard block and the /outstanding-autopsies command.
 *
 * Wait windows mirror the overdue monitor (systemMonitor.js): CK 72h, PK 120h,
 * everything else 48h, all env-overridable (AUTOPSY_OVERDUE_HOURS*_CK/_PK).
 * A case with no examination (no completedAt) and not in a terminal state is
 * outstanding; intake-complete rows (caseState 'complete' without completedAt)
 * count — the examination is what's outstanding.
 */

const hours = (name, def) => {
    const v = parseFloat(process.env[name] || '');
    return Number.isFinite(v) && v > 0 ? v : def;
};

export const OUTSTANDING_LIMITS = {
    get defaultHours() { return hours('AUTOPSY_OVERDUE_HOURS', 48); },
    get ckHours() { return hours('AUTOPSY_OVERDUE_HOURS_CK', 72); },
    get pkHours() { return hours('AUTOPSY_OVERDUE_HOURS_PK', 120); },
};

export function limitHoursFor(deathType) {
    const t = String(deathType || '').toLowerCase();
    if (t.includes('ck')) return OUTSTANDING_LIMITS.ckHours;
    if (t.includes('pk')) return OUTSTANDING_LIMITS.pkHours;
    return OUTSTANDING_LIMITS.defaultHours;
}

export const TERMINAL_STATES = new Set(['dry_run', 'skipped', 'cancelled', 'denied']);

/**
 * All outstanding cases: assigned, unexamined, non-terminal. One row per
 * ME+body (mass collections fan out per case, like the dashboard).
 * @param {object} db — Firebase database
 * @returns {Promise<Array>} rows sorted by remaining time ascending (most urgent first)
 */
export async function getOutstandingCases(db) {
    const snap = await db.ref('autopsy-requested').orderByChild('completedAt').equalTo(null).once('value');
    if (!snap.exists()) return [];
    // Assignment timestamps live under the rotation tracker, keyed by REQUEST
    // topic id (mass batches share one key per request).
    let assignTimes = {};
    try {
        const asnap = await db.ref('autopsy-requests/assignments').once('value');
        const adata = asnap.val() || {};
        for (const [meKey, rec] of Object.entries(adata)) {
            const cases = (rec && rec.cases) || {};
            for (const [reqId, meta] of Object.entries(cases)) {
                if (meta && meta.assignedAt) assignTimes[`${String(meKey).toLowerCase()}|${reqId}`] = meta.assignedAt;
            }
        }
    } catch { /* assignment times are best-effort */ }

    const now = Date.now();
    const rows = [];
    snap.forEach((child) => {
        const c = child.val() || {};
        if (c.completedAt) return;
        if (TERMINAL_STATES.has(String(c.caseState || '').toLowerCase())) return;
        const deathType = String(c.parsed?.deathType || '').trim();
        const limitH = limitHoursFor(deathType);
        const detected = c.detectedAt ? new Date(c.detectedAt).getTime() : 0;
        const mk = (me, label, decedent, caseUrl, extra = {}) => {
            const assignedAt = extra.assignedAt || detected;
            const ageH = assignedAt ? Math.floor((now - assignedAt) / 3600000) : null;
            const remainingH = ageH == null ? null : limitH - ageH;
            rows.push({
                me, label, decedent, caseUrl,
                requestId: child.key,
                topicId: extra.topicId || c.topicId || child.key,
                detectedAt: c.detectedAt || null,
                assignedAt: assignedAt || null,
                deathType: deathType || '?',
                limitH, ageH, remainingH,
                overdue: remainingH != null && remainingH < 0,
                completed: false,
            });
        };
        if (String(c.caseState || '') === 'multi' && c.cases && typeof c.cases === 'object') {
            const indexed = Object.entries(c.cases)
                .filter(([k]) => /^\d+$/.test(k))
                .sort((a, b) => Number(a[0]) - Number(b[0]));
            const total = indexed.length;
            indexed.forEach(([_idx, cc], slot) => {
                if (!cc || !cc.assignedTo || cc.completedAt) return;
                // Shared-thread mass bodies carry no caseNum/title of their
                // own — fall back to the parent collection (parity with the
                // dashboard builder; else `Case ? (Body i/N)`).
                const numM = String(cc.caseNum || cc.caseTitle || '').match(/Case\s*(\w+)/i)
                    || String(c.caseNum || c.caseTitle || c.title || '').match(/Case\s*(\w+)/i);
                const num = cc.caseNum || (numM ? numM[1] : null) || c.caseNum || '?';
                mk(cc.assignedTo, `Case ${num} (Body ${slot + 1}/${total})`, cc.oocName || cc.name || '', c.caseUrl || cc.caseUrl || null, {
                    topicId: c.caseTopicId || cc.caseTopicId || null,
                    assignedAt: assignTimes[`${String(cc.assignedTo).toLowerCase()}|${child.key}`] || 0,
                });
            });
            return;
        }
        if (c.assignedTo) {
            mk(c.assignedTo, c.title || 'Case', c.oocName || c.name || '', c.caseUrl || null, {
                assignedAt: assignTimes[`${String(c.assignedTo).toLowerCase()}|${child.key}`] || 0,
            });
        }
    });
    rows.sort((a, b) => (a.remainingH ?? Infinity) - (b.remainingH ?? Infinity));
    return rows;
}

function fmtDur(h) {
    const a = Math.abs(Math.round(h));
    if (a < 1) return 'under 1h';
    if (a < 48) return `${a}h`;
    const d = Math.floor(a / 24);
    return `${d}d${a % 24 ? ` ${a % 24}h` : ''}`;
}

/**
 * Timing for a dashboard assignment row ({ assignedAt?, detectedAt?, deathType? }).
 * Falls back to detectedAt when no assignment timestamp is tracked.
 */
export function rowTiming(row) {
    const base = (row && (row.assignedAt || row.detectedAt)) || 0;
    const baseMs = base ? new Date(base).getTime() : 0;
    if (!baseMs) return { ageH: null, limitH: null, remainingH: null, overdue: false };
    const limitH = limitHoursFor(row.deathType);
    const ageH = Math.floor((Date.now() - baseMs) / 3600000);
    const remainingH = limitH - ageH;
    return { ageH, limitH, remainingH, overdue: remainingH < 0 };
}

/** Compact time suffix for dashboard lines: `· 3d waiting · 9h left` / `· OVERDUE 2d`. */
export function formatTimeSuffix(row) {
    const t = rowTiming(row);
    if (t.ageH == null || t.remainingH == null) return '';
    const waiting = `· ${fmtDur(t.ageH)} waiting`;
    if (t.overdue) return `${waiting} · OVERDUE ${fmtDur(t.remainingH)}`;
    return `${waiting} · ${fmtDur(t.remainingH)} left`;
}
