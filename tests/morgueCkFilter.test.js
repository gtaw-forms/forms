import { describe, it, expect } from 'vitest';
import { recordContainsCK, CK_MARKER_RE } from '../src/utils/morgue.js';

describe('CK marker regex', () => {
    it('matches (CK) case-insensitively', () => {
        expect(CK_MARKER_RE.test('Gunshot wounds (CK)')).toBe(true);
        expect(CK_MARKER_RE.test('gunshot (ck)')).toBe(true);
        expect(CK_MARKER_RE.test('( CK )')).toBe(true);
    });

    it('does not match bare ck inside words', () => {
        expect(CK_MARKER_RE.test('sick')).toBe(false);
        expect(CK_MARKER_RE.test('stock')).toBe(false);
        expect(CK_MARKER_RE.test('blockage')).toBe(false);
        expect(CK_MARKER_RE.test('CK')).toBe(false);
        expect(CK_MARKER_RE.test('')).toBe(false);
    });
});

describe('recordContainsCK', () => {
    it('finds the marker in name, cause, location and notes', () => {
        expect(recordContainsCK({ name: 'John Doe (CK)' })).toBe(true);
        expect(recordContainsCK({ causeOfDeath: 'Gunshot wounds (CK)' })).toBe(true);
        expect(recordContainsCK({ location: 'Davis (ck)' })).toBe(true);
        expect(recordContainsCK({ adminNote: 'confirmed (CK) by staff' })).toBe(true);
        expect(recordContainsCK({ physicalDescription: 'Tattoo reading (CK)' })).toBe(true);
    });

    it('finds the marker in nested ballistics and findings', () => {
        expect(recordContainsCK({ bullets: [{ type: 'Pistol (CK)', id: '1' }] })).toBe(true);
        expect(recordContainsCK({ findings: [{ time: '01:00:00', type: 'GSW (ck)', part: 'Head', dist: '-' }] })).toBe(true);
    });

    it('returns false for plain records and bad input', () => {
        expect(recordContainsCK({ name: 'Jane Doe', causeOfDeath: 'Fall from height' })).toBe(false);
        expect(recordContainsCK({ name: 'Sick patient Block' })).toBe(false);
        expect(recordContainsCK({})).toBe(false);
        expect(recordContainsCK(null)).toBe(false);
        expect(recordContainsCK('not an object')).toBe(false);
    });
});
