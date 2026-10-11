import { describe, it, expect } from 'vitest';
import { getEntityKey } from '../discord-bot/services/deployEntityKey.js';

// Dry-run scenarios for the pending-deploy dedup key. No network, no Firebase,
// no forum — these simulate the two saves that produced the 2026-10-02
// duplicate post (John Doe / Ryan Schmidt) and assert the newest save now
// collapses onto the oldest instead of queueing a second deploy.
//
// Regression context: the web app mints a fresh report key per save
// (`useFormSaver.js`: `title + '_' + Date.now()`), so two saves of the same
// report are two `scheduledReports` nodes. `enqueue()` collapses them only
// when `getEntityKey()` matches.

const AUTHOR = 'Sadie_Voss';

function coronerReport({ name = 'John Doe', ooc = 'Ryan Schmidt', dateTime = '', caseNumber = '' } = {}) {
    return {
        authorId: AUTHOR,
        key: `PK_${name}_${ooc}_${Date.now()}`,
        report: {
            formId: 'coroner-report',
            data: { decedentName: name, decedentOOC: ooc, dateTime, caseNumber },
        },
    };
}

// Mirrors deployQueue.enqueue()'s map decision, using the real key function:
// a matching key replaces the existing entry (old timer cleared, old report
// trashed in production); a new key adds a second entry.
function enqueueSim(map, data) {
    const key = getEntityKey(data);
    const replaced = map.has(key);
    map.set(key, data);
    return { key, replaced, size: map.size };
}

describe('getEntityKey — stable report identity', () => {
    it('the reported bug: first save with no date and re-save with date collapse to one entry', () => {
        const first = coronerReport({ dateTime: '' });          // title "... - NO_DATE"
        const second = coronerReport({ dateTime: '2026-10-02' }); // title "... 10/02/2026"

        expect(getEntityKey(first)).toBe(getEntityKey(second));

        // Simulate the queue: only the newest survives.
        const queue = new Map();
        expect(enqueueSim(queue, first)).toMatchObject({ replaced: false, size: 1 });
        const after = enqueueSim(queue, second);
        expect(after).toMatchObject({ replaced: true, size: 1 });
        expect(queue.get(after.key)).toBe(second);
    });

    it('ignores a case-number added/changed between saves', () => {
        const a = coronerReport({ dateTime: '2026-10-02', caseNumber: '' });
        const b = coronerReport({ dateTime: '2026-10-02', caseNumber: 'CASE-123' });
        expect(getEntityKey(a)).toBe(getEntityKey(b));
    });

    it('treats a different decedent as a different report (no over-collapse)', () => {
        expect(getEntityKey(coronerReport({ name: 'John Doe' })))
            .not.toBe(getEntityKey(coronerReport({ name: 'Jane Roe' })));
    });

    it('treats a different OOC name as a different report', () => {
        expect(getEntityKey(coronerReport({ ooc: 'Ryan Schmidt' })))
            .not.toBe(getEntityKey(coronerReport({ ooc: 'Alex Carter' })));
    });

    it('treats a different author as a different report (no cross-author collision)', () => {
        const a = coronerReport();
        const b = { ...coronerReport(), authorId: 'Alyson_Frost' };
        expect(getEntityKey(a)).not.toBe(getEntityKey(b));
    });

    it('same form + same patient but different authors do not collide', () => {
        const queue = new Map();
        enqueueSim(queue, coronerReport());
        expect(enqueueSim(queue, { ...coronerReport(), authorId: 'Someone_Else' }).size).toBe(2);
    });

    it('PM routing: same recipient/dept dedups despite a changed date; a new recipient does not', () => {
        const pm = (recipient, dateTime) => ({
            authorId: AUTHOR,
            key: `CE_${Math.random()}`,
            report: {
                formId: 'coroner_email',
                data: { requestingOfficer: recipient, department: 'LSPD', dateTime },
            },
        });
        expect(getEntityKey(pm('Det. Smith', ''))).toBe(getEntityKey(pm('Det. Smith', '2026-10-02')));
        expect(getEntityKey(pm('Det. Smith', ''))).not.toBe(getEntityKey(pm('Det. Jones', '')));
    });

    it('medical records: same patient id dedups, a different patient does not', () => {
        const med = (id, dateTime) => ({
            authorId: AUTHOR,
            key: `MR_${Math.random()}`,
            report: { formId: 'patient_notes', data: { patientID: id, dateTime } },
        });
        expect(getEntityKey(med('1424', ''))).toBe(getEntityKey(med('1424', '2026-10-02')));
        expect(getEntityKey(med('1424', ''))).not.toBe(getEntityKey(med('1919', '')));
    });

    it('falls back to the report key only when the report has no identity at all', () => {
        const emptyA = { authorId: AUTHOR, key: 'KEY_A', report: { formId: 'coroner-report', data: {} } };
        const emptyB = { authorId: AUTHOR, key: 'KEY_B', report: { formId: 'coroner-report', data: {} } };
        expect(getEntityKey(emptyA)).toBe('KEY_A');
        expect(getEntityKey(emptyB)).toBe('KEY_B');
        expect(getEntityKey(emptyA)).not.toBe(getEntityKey(emptyB));
    });

    it('is deterministic and length-bounded for long identities', () => {
        const long = coronerReport({ name: 'X'.repeat(200), ooc: 'Y'.repeat(200) });
        const k1 = getEntityKey(long);
        const k2 = getEntityKey(long);
        expect(k1).toBe(k2);
        expect(k1.startsWith('sk_')).toBe(true);
        expect(k1.length).toBeLessThanOrEqual(20);
    });

    it('handles missing/malformed data without throwing', () => {
        expect(() => getEntityKey({})).not.toThrow();
        expect(() => getEntityKey({ report: null })).not.toThrow();
        expect(() => getEntityKey(null)).not.toThrow();
    });
});
