// src/utils/duplicateCheck.test.js
// Tier 1 duplicate matcher: photo-URL overlap OR metadata triple.
// Covers the real-world shapes (VPS list items with nested report.data,
// legacy flat items) and the fail-open edges (unparseable dates, missing
// fields, self-key). The matcher is pure — no mocks needed.
import { describe, it, expect } from 'vitest';
import {
    dupNormText,
    dupNormUrl,
    dupCollectUrls,
    dupDayOf,
    findDuplicateCandidate,
} from './duplicateCheck';

describe('dupNormText', () => {
    it('lowercases and collapses whitespace', () => {
        expect(dupNormText('  John   DOE ')).toBe('john doe');
    });
    it('handles nullish input', () => {
        expect(dupNormText(null)).toBe('');
        expect(dupNormText(undefined)).toBe('');
    });
});

describe('dupNormUrl', () => {
    it('normalizes host+path, strips query and trailing slash', () => {
        expect(dupNormUrl('https://i.ibb.co/ABC123/x.png?foo=1')).toBe('i.ibb.co/abc123/x.png');
        expect(dupNormUrl('https://i.ibb.co/ABC123/x.png')).toBe('i.ibb.co/abc123/x.png');
    });
    it('rejects non-http, oversize, and empty strings', () => {
        expect(dupNormUrl('data:image/png;base64,AAA')).toBeNull();
        expect(dupNormUrl('not a url at all')).toBeNull();
        expect(dupNormUrl('')).toBeNull();
        expect(dupNormUrl('https://x.co/' + 'a'.repeat(2100))).toBeNull();
    });
});

describe('dupCollectUrls', () => {
    it('collects recursively and caps at 50', () => {
        const urls = Array.from({ length: 60 }, (_, i) => `https://x.co/${i}.png`);
        const out = dupCollectUrls({ a: urls, b: { c: ['https://y.co/1.png'] } });
        expect(out.size).toBe(50);
    });
    it('skips data: URLs and non-strings', () => {
        const out = dupCollectUrls({ img: 'data:image/png;base64,AAA', n: 42, u: 'https://x.co/a.png' });
        expect([...out]).toEqual(['x.co/a.png']);
    });
});

describe('dupDayOf', () => {
    it('parses ISO dates to calendar day', () => {
        expect(dupDayOf('2026-09-27T20:15:59')).toBe('2026-09-27');
    });
    it('returns null for unparseable input', () => {
        expect(dupDayOf('sometime yesterday')).toBeNull();
        expect(dupDayOf(null)).toBeNull();
    });
});

const current = (data, extra = {}) => ({
    formId: 'coroner-report',
    key: 'new_report_123',
    data,
    ...extra,
});

describe('findDuplicateCandidate', () => {
    it('matches on shared photo URL (exact and query-variant)', () => {
        const mine = current({ decedentName: 'Jane Doe', scenePhotos: ['https://i.ibb.co/a/1.png?x=1'] });
        const cands = [{
            key: 'old_1', originalKey: 'Old', timestamp: 1,
            report: { data: { decedentName: 'Someone Else', scenePhotos: ['https://i.ibb.co/a/1.png'] } },
        }];
        const hit = findDuplicateCandidate(mine, cands);
        expect(hit?.key).toBe('old_1');
        expect(hit?.reason).toBe('same photo detected');
    });

    it('matches on metadata triple despite case/whitespace noise', () => {
        const mine = current({ decedentName: '  JOHN doe ', dateTime: '2026-09-27T10:00:00', placeOfDeath: 'Davis  Ave' });
        const cands = [{
            key: 'old_2', originalKey: 'Old 2', timestamp: 2,
            report: { data: { decedentName: 'john DOE', dateTime: '2026-09-27', placeOfDeath: 'davis ave' } },
        }];
        const hit = findDuplicateCandidate(mine, cands);
        expect(hit?.key).toBe('old_2');
        expect(hit?.reason).toBe('same decedent, date and location');
    });

    it('matches legacy flat candidate shape and patientName fallback', () => {
        const mine = current({ patientName: 'Alex Roe', dateTime: '2026-01-02', placeOfDeath: 'Sandy' });
        const cands = [{
            key: 'old_3', timestamp: 3,
            data: { patientName: 'alex roe', dateTime: '2026-01-02T23:00:00', placeOfDeath: 'SANDY' },
        }];
        expect(findDuplicateCandidate(mine, cands)?.key).toBe('old_3');
    });

    it('ignores different formId, self key, and null entries', () => {
        const mine = current({ decedentName: 'John Doe', dateTime: '2026-09-27', placeOfDeath: 'Davis' });
        const cands = [
            null,
            { key: 'new_report_123', report: { data: { decedentName: 'John Doe', dateTime: '2026-09-27', placeOfDeath: 'Davis' } } },
            { key: 'other', formId: 'autopsy', report: { data: { decedentName: 'John Doe', dateTime: '2026-09-27', placeOfDeath: 'Davis' } } },
        ];
        expect(findDuplicateCandidate(mine, cands)).toBeNull();
    });

    it('does not match on different date or unparseable dates', () => {
        const mine = current({ decedentName: 'John Doe', dateTime: '2026-09-27', placeOfDeath: 'Davis' });
        expect(findDuplicateCandidate(mine, [{
            key: 'a', report: { data: { decedentName: 'John Doe', dateTime: '2026-09-28', placeOfDeath: 'Davis' } },
        }])).toBeNull();
        expect(findDuplicateCandidate(mine, [{
            key: 'b', report: { data: { decedentName: 'John Doe', dateTime: 'yesterday-ish', placeOfDeath: 'Davis' } },
        }])).toBeNull();
    });

    it('both-empty place requires equal non-zero photo counts', () => {
        const base = { decedentName: 'John Doe', dateTime: '2026-09-27', placeOfDeath: '' };
        const withPhotos = (prefix, n) => ({
            ...base,
            scenePhotos: Array.from({ length: n }, (_, i) => `https://x.co/${prefix}-${i}.png`),
        });
        // Equal non-zero counts match (distinct URL sets isolate the count rule).
        const mine = current(withPhotos('m', 2));
        const cands = [{ key: 'c', report: { data: withPhotos('c', 2) } }];
        // Distinct URLs each time, so only the count rule can fire.
        expect(findDuplicateCandidate(mine, cands)?.key).toBe('c');
        const bare = current({ decedentName: 'John Doe', dateTime: '2026-09-27', placeOfDeath: '' });
        expect(findDuplicateCandidate(bare, [{ key: 'd', report: { data: { ...bare.data } } }])).toBeNull();
    });

    it('returns null for empty candidates and passes through title/timestamp', () => {
        expect(findDuplicateCandidate(current({}), [])).toBeNull();
        const hit = findDuplicateCandidate(
            current({ decedentName: 'A B', dateTime: '2026-05-01', placeOfDeath: 'X' }),
            [{ key: 'e', originalKey: 'Report E', timestamp: 1714500000000, report: { data: { decedentName: 'a b', dateTime: '2026-05-01', placeOfDeath: 'x' } } }]
        );
        expect(hit).toMatchObject({ key: 'e', title: 'Report E', timestamp: 1714500000000 });
    });
});
