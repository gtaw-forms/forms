// Tests for DOE-placeholder handling in morgue matching (t=10328 regression:
// "Trinity Dalton (J. DOE)" + title "(DOE and DOE)" filed cases as
// "Trinity Dalton J. DOE ((DOE and DOE))" and poisoned match tokens).
import { describe, it, expect } from 'vitest';
import { isDoePlaceholder, stripDoePlaceholders, matchTerms, isUsableToken, oocFromParsedName } from './doePlaceholders';

describe('isDoePlaceholder', () => {
    it.each([
        ['DOE', true],
        ['J. DOE', true],
        ['J DOE', true],
        ['John Doe', true],
        ['Jane Doe', true],
        ['DOE and DOE', true],
        ['DOE & DOE', true],
        ['', true],
    ])('%s -> %s', (v, want) => expect(isDoePlaceholder(v)).toBe(want));

    it.each([
        ['Mark Smith', false],
        ['Trinity Dalton', false],
        ['Doey McDoeface', false],
    ])('%s -> %s', (v, want) => expect(isDoePlaceholder(v)).toBe(want));
});

describe('stripDoePlaceholders', () => {
    it('strips parenthesised markers, keeps the name', () => {
        expect(stripDoePlaceholders('Trinity Dalton (J. DOE)')).toBe('Trinity Dalton');
        expect(stripDoePlaceholders('Alfonso Murphy (JOHN DOE)')).toBe('Alfonso Murphy');
    });
    it('strips bare glued markers from pre-fix stored names', () => {
        expect(stripDoePlaceholders('Trinity Dalton J. DOE')).toBe('Trinity Dalton');
    });
    it('leaves real parentheticals alone', () => {
        expect(stripDoePlaceholders('John Doe ((Mark Smith))')).toBe('Mark Smith');
    });
});

describe('matchTerms', () => {
    it('drops DOE-ish OOC terms (substring false-positives)', () => {
        expect(matchTerms('Trinity Dalton J. DOE', 'DOE and DOE')).toEqual(['trinity dalton']);
    });
    it('keeps real OOC, drops placeholder name term', () => {
        expect(matchTerms('John Doe', 'Mark Smith')).toEqual(['mark smith']);
    });
    it('returns [] when nothing usable remains', () => {
        expect(matchTerms('(J. DOE)', '')).toEqual([]);
        expect(matchTerms('', '')).toEqual([]);
    });
});

describe('isUsableToken', () => {
    it('rejects placeholders and short tokens', () => {
        expect(isUsableToken('john')).toBe(false);
        expect(isUsableToken('jane')).toBe(false);
        expect(isUsableToken('doe')).toBe(false);
        expect(isUsableToken('unknown')).toBe(false);
        expect(isUsableToken('abc')).toBe(false);
    });
    it('accepts real name tokens', () => {
        expect(isUsableToken('trinity')).toBe(true);
        expect(isUsableToken('dalton')).toBe(true);
    });
});

// t=10364 / Case 538 regression: a hand-written title omitted the ((OOC))
// ("Autopsy Request - John Doe - LSPD"), so autopsy-requested/<id>.oocName was
// blank while the body's Section 2 still held "John Doe ((Ilya Baranov))".
// The Load-Case fill and Assigned Autopsies modal recover the identity from the
// parsed decedent name instead of dropping it (and losing the morgue match).
describe('oocFromParsedName', () => {
    it('recovers the ((OOC)) from a parsed decedent name', () => {
        expect(oocFromParsedName('John Doe ((Ilya Baranov))')).toBe('Ilya Baranov');
    });
    it('tolerates inner spacing and the morgue "Unknown" wrapper', () => {
        expect(oocFromParsedName('John Doe ((  Ilya Baranov  ))')).toBe('Ilya Baranov');
        expect(oocFromParsedName('Unknown (( Naaif Gilyard ))')).toBe('Naaif Gilyard');
    });
    it('returns empty when there is no ((OOC)) or no value', () => {
        expect(oocFromParsedName('John Doe')).toBe('');
        expect(oocFromParsedName('Joe Russo (())')).toBe('');
        expect(oocFromParsedName('')).toBe('');
        expect(oocFromParsedName(undefined)).toBe('');
    });
    it('feeds matchTerms the recovered OOC while dropping the DOE IC name', () => {
        expect(matchTerms('John Doe', oocFromParsedName('John Doe ((Ilya Baranov))')))
            .toEqual(['ilya baranov']);
    });
});
