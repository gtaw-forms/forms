import { describe, it, expect } from 'vitest';
import {
    SHARE_CODE_ALPHABET,
    SHARE_CODE_LENGTH,
    MAX_SEGMENT_LENGTH,
    isShareSegment,
    newShareCode,
} from '../functions/src/utils/shareCode.js';

describe('isShareSegment', () => {
    it('accepts real report address segments', () => {
        expect(isShareSegment('Alyson_Frost')).toBe(true);
        expect(isShareSegment('_PK_John_Doe_Benji_Clemons_10_24_2026_1792872179619')).toBe(true);
        expect(isShareSegment('GTAW_Dev')).toBe(true);
        expect(isShareSegment('a b c')).toBe(true); // spaces are legal in an RTDB key
    });

    it('rejects values that are not one RTDB path segment', () => {
        for (const bad of ['', '   ', 'a/b', 'a.b', 'a#b', 'a$b', 'a[b', 'a]b']) {
            expect(isShareSegment(bad)).toBe(false);
        }
    });

    it('rejects control characters and non-strings', () => {
        expect(isShareSegment('a\u0000b')).toBe(false);
        expect(isShareSegment('a\nb')).toBe(false);
        expect(isShareSegment(null)).toBe(false);
        expect(isShareSegment(42)).toBe(false);
    });

    it('rejects over-long segments', () => {
        expect(isShareSegment('a'.repeat(MAX_SEGMENT_LENGTH))).toBe(true);
        expect(isShareSegment('a'.repeat(MAX_SEGMENT_LENGTH + 1))).toBe(false);
    });
});

describe('newShareCode', () => {
    it('is SHARE_CODE_LENGTH characters from the unambiguous alphabet', () => {
        for (let i = 0; i < 200; i++) {
            const code = newShareCode();
            expect(code).toHaveLength(SHARE_CODE_LENGTH);
            for (const ch of code) expect(SHARE_CODE_ALPHABET.includes(ch)).toBe(true);
        }
    });

    it('never uses look-alike characters', () => {
        for (const ch of '0O1lI') expect(SHARE_CODE_ALPHABET.includes(ch)).toBe(false);
    });

    it('maps injected bytes through the alphabet', () => {
        const code = newShareCode(() => Uint8Array.from([0, 1, 2, 3, 4, 5]));
        expect(code).toBe(SHARE_CODE_ALPHABET.slice(0, 6));
    });
});
