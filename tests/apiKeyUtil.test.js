import { describe, it, expect } from 'vitest';
import { stripKeyLabel, firstApiKey } from '../discord-bot/services/apiKeyUtil.js';

describe('stripKeyLabel', () => {
    it('strips a valid label prefix', () => {
        expect(stripKeyLabel('bot:pmc_morgue_abc')).toBe('pmc_morgue_abc');
    });

    it('leaves bare keys untouched', () => {
        expect(stripKeyLabel('pmc_morgue_abc')).toBe('pmc_morgue_abc');
    });

    it('strips surrounding quotes (naive .env loaders keep them)', () => {
        expect(stripKeyLabel('"bot:pmc_morgue_abc"')).toBe('pmc_morgue_abc');
        expect(stripKeyLabel('"pmc_morgue_abc"')).toBe('pmc_morgue_abc');
        expect(stripKeyLabel("'bot:pmc_morgue_abc'")).toBe('pmc_morgue_abc');
    });

    it('handles empty input', () => {
        expect(stripKeyLabel('')).toBe('');
        expect(stripKeyLabel(null)).toBe('');
    });
});

describe('firstApiKey', () => {
    it('returns the first key without its label', () => {
        expect(firstApiKey('bot:pmc_a,other:pmc_b')).toBe('pmc_a');
    });

    it('handles a quoted whole value (leading + trailing quotes)', () => {
        expect(firstApiKey('"bot:pmc_a,other:pmc_b"')).toBe('pmc_a');
        expect(firstApiKey('"pmc_a"')).toBe('pmc_a');
    });

    it('returns empty for empty input', () => {
        expect(firstApiKey('')).toBe('');
        expect(firstApiKey(null)).toBe('');
    });
});
