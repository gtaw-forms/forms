import { describe, it, expect } from 'vitest';
import {
    morgueLastUpdatedAt,
    isMorgueOverdue,
    formatMorgueAge,
    MORGUE_REFRESH_CADENCE_MS,
} from '../src/utils/morgue.js';

const HOUR = 60 * 60 * 1000;
const NOW = 1_763_300_000_000; // fixed reference (2025-11-16T…Z)

describe('morgueLastUpdatedAt', () => {
    it('takes the newest record lastUpdated', () => {
        const records = [{ lastUpdated: NOW - 10 * HOUR }, { lastUpdated: NOW - 2 * HOUR }, {}];
        expect(morgueLastUpdatedAt(records, null)).toBe(NOW - 2 * HOUR);
    });

    it('uses an epoch-shaped data version when it is newer (covers deletions)', () => {
        const records = [{ lastUpdated: NOW - 30 * HOUR }];
        expect(morgueLastUpdatedAt(records, NOW - HOUR)).toBe(NOW - HOUR);
    });

    it('ignores a counter-shaped version (MorgueManager increments it)', () => {
        const records = [{ lastUpdated: NOW - 30 * HOUR }];
        expect(morgueLastUpdatedAt(records, 27)).toBe(NOW - 30 * HOUR);
        expect(morgueLastUpdatedAt([], 27)).toBe(null);
    });

    it('returns null without any timestamp', () => {
        expect(morgueLastUpdatedAt([], null)).toBe(null);
        expect(morgueLastUpdatedAt(null, undefined)).toBe(null);
    });

    it('ignores junk values', () => {
        expect(morgueLastUpdatedAt([{ lastUpdated: 'nope' }, { lastUpdated: 0 }], 'abc')).toBe(null);
    });
});

describe('isMorgueOverdue', () => {
    it('is false inside the 48-hour window and true past it', () => {
        expect(isMorgueOverdue(NOW - 47 * HOUR, NOW)).toBe(false);
        expect(isMorgueOverdue(NOW - MORGUE_REFRESH_CADENCE_MS, NOW)).toBe(false);
        expect(isMorgueOverdue(NOW - 49 * HOUR, NOW)).toBe(true);
    });

    it('is false when there is no timestamp', () => {
        expect(isMorgueOverdue(null, NOW)).toBe(false);
    });
});

describe('formatMorgueAge', () => {
    it('formats minutes, hours and days', () => {
        expect(formatMorgueAge(NOW - 20 * 1000, NOW)).toBe('just now');
        expect(formatMorgueAge(NOW - 60 * 1000, NOW)).toBe('1 minute ago');
        expect(formatMorgueAge(NOW - 12 * 60 * 1000, NOW)).toBe('12 minutes ago');
        expect(formatMorgueAge(NOW - 3 * HOUR, NOW)).toBe('3 hours ago');
        expect(formatMorgueAge(NOW - 50 * HOUR, NOW)).toBe('2 days ago');
    });

    it('says never without a timestamp', () => {
        expect(formatMorgueAge(null, NOW)).toBe('never');
    });

    it('never goes negative for a future timestamp', () => {
        expect(formatMorgueAge(NOW + HOUR, NOW)).toBe('just now');
    });
});
