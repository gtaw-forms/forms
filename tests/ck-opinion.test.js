import { describe, it, expect } from 'vitest';
import {
    CK_OPINION_MIN_MORE_THAN,
    CK_OPINION_REQUIRED_CHARS,
    isCkDeath,
    opinionLength,
    ckOpinionProblem,
    ckOpinionMessage,
} from '../src/utils/autopsyOpinion.js';

const long = 'x'.repeat(CK_OPINION_REQUIRED_CHARS);
const tooShort = 'x'.repeat(CK_OPINION_MIN_MORE_THAN);

describe('isCkDeath', () => {
    it('detects CK from Manner of Death, case/whitespace tolerant', () => {
        expect(isCkDeath({ deathType: 'CK' })).toBe(true);
        expect(isCkDeath({ deathType: ' ck ' })).toBe(true);
    });

    it('ignores typeOfDeath (coroner reports use a different classification)', () => {
        expect(isCkDeath({ typeOfDeath: 'CK' })).toBe(false);
    });

    it('is false for PK, other values and empty input', () => {
        expect(isCkDeath({ deathType: 'PK' })).toBe(false);
        expect(isCkDeath({ deathType: 'Unknown' })).toBe(false);
        expect(isCkDeath({})).toBe(false);
        expect(isCkDeath()).toBe(false);
    });
});

describe('opinionLength', () => {
    it('ignores surrounding whitespace', () => {
        expect(opinionLength({ synopsis: '  abc  ' })).toBe(3);
        expect(opinionLength({ synopsis: '   ' })).toBe(0);
        expect(opinionLength({})).toBe(0);
    });
});

describe('ckOpinionProblem', () => {
    it('requires MORE than 250 characters for a CK', () => {
        expect(ckOpinionProblem({ deathType: 'CK', synopsis: tooShort }))
            .toEqual({ length: 250, required: 251, remaining: 1 });
        expect(ckOpinionProblem({ deathType: 'CK', synopsis: long })).toBeNull();
    });

    it('reports an empty CK opinion as fully outstanding', () => {
        expect(ckOpinionProblem({ deathType: 'CK' }))
            .toEqual({ length: 0, required: 251, remaining: 251 });
    });

    it('does not police PK or unmarked reports', () => {
        expect(ckOpinionProblem({ deathType: 'PK', synopsis: 'short' })).toBeNull();
        expect(ckOpinionProblem({ synopsis: 'short' })).toBeNull();
    });

    it('whitespace padding cannot satisfy the minimum', () => {
        const padded = `${'x'.repeat(100)}${' '.repeat(400)}`;
        expect(ckOpinionProblem({ deathType: 'CK', synopsis: padded })?.length).toBe(100);
    });
});

describe('ckOpinionMessage', () => {
    it('names the shortfall in readable terms', () => {
        const msg = ckOpinionMessage({ deathType: 'CK', synopsis: 'abc' });
        expect(msg).toContain('longer than 250 characters');
        expect(msg).toContain('3 so far');
        expect(msg).toContain('248 more needed');
    });

    it('is empty when the opinion passes or the report is not CK', () => {
        expect(ckOpinionMessage({ deathType: 'CK', synopsis: long })).toBe('');
        expect(ckOpinionMessage({ deathType: 'PK', synopsis: 'abc' })).toBe('');
    });
});
