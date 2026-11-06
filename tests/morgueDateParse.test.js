/**
 * Morgue date parsing + same-name tie-break (2026-10-18 fix).
 *
 * The autopsy request template writes DATE OF DEATH as "14/OCT/2026". parseDate
 * did not understand a day-first date with a month NAME, so it returned NaN,
 * findMorgueRecord skipped its closest-date tie-break, and the FIRST same-named
 * record in the store won — t=10392's "Unknown (( Ryan Kennedy ))" body matched
 * the May record (#75003) instead of the Oct 14 one (#85282).
 */
import { describe, it, expect } from 'vitest';
import { parseDate, findMorgueRecord } from '../discord-bot/services/deathRecordDraftCache.js';

const iso = (ms) => new Date(ms).toISOString();

describe('parseDate', () => {
    it('parses the autopsy request DD/MMM/YYYY date (day-first month name)', () => {
        expect(iso(parseDate('14/OCT/2026'))).toBe('2026-10-14T00:00:00.000Z');
        expect(iso(parseDate('14/Oct/2026 22:25'))).toBe('2026-10-14T22:25:00.000Z');
        expect(iso(parseDate('14-October-2026 22:25:30'))).toBe('2026-10-14T22:25:30.000Z');
        expect(iso(parseDate('14 OCT 2026'))).toBe('2026-10-14T00:00:00.000Z');
    });

    it('parses bare ISO dates and keeps the time when present', () => {
        expect(iso(parseDate('2026-10-14'))).toBe('2026-10-14T00:00:00.000Z');
        expect(iso(parseDate('2026-10-14T22:25:00'))).toBe('2026-10-14T22:25:00.000Z');
        expect(iso(parseDate('2026-10-14 22:25'))).toBe('2026-10-14T22:25:00.000Z');
    });

    it('still parses the legacy formats', () => {
        expect(iso(parseDate('Wednesday, 14 October 2026 22:25:00'))).toBe('2026-10-14T22:25:00.000Z');
        expect(iso(parseDate('10/14/2026 - 22:25'))).toBe('2026-10-14T22:25:00.000Z');
        expect(iso(parseDate('14/10/2026 22:25'))).toBe('2026-10-14T22:25:00.000Z');
    });

    it('returns NaN for unparseable values', () => {
        expect(Number.isNaN(parseDate('not a date'))).toBe(true);
        expect(Number.isNaN(parseDate(''))).toBe(true);
        expect(Number.isNaN(parseDate(null))).toBe(true);
    });
});

describe('findMorgueRecord same-name tie-break', () => {
    // Oldest-first order mirrors the local JSON (numeric keys ascend).
    const records = [
        { caseId: '75003', firebaseKey: '75003', name: 'Unknown (( Ryan Kennedy ))', timeOfDeathISO: '2026-05-02T03:25:42' },
        { caseId: '81446', firebaseKey: '81446', name: 'Unknown (( Ryan Kennedy ))', timeOfDeathISO: '2026-08-13T00:52:13' },
        { caseId: '85282', firebaseKey: '85282', name: 'Unknown (( Ryan Kennedy ))', timeOfDeathISO: '2026-10-14T21:56:00' },
    ];
    const db = {
        ref: () => ({
            once: async () => ({
                exists: () => true,
                forEach: (cb) => records.forEach((r) => cb({ key: r.caseId, val: () => r })),
            }),
        }),
    };

    it('picks the same-named record closest to a DD/MMM/YYYY reference date', async () => {
        const hit = await findMorgueRecord(db, 'Ryan Kennedy', '14/OCT/2026', '');
        expect(hit?.caseId).toBe('85282');
    });

    it('still picks the closest record for an ISO reference date', async () => {
        const hit = await findMorgueRecord(db, 'Ryan Kennedy', '2026-08-13', '');
        expect(hit?.caseId).toBe('81446');
    });
});
