import { describe, it, expect } from 'vitest';
import {
  MAX_TOTAL_RECIPIENTS,
  normalizeRecipients,
  normalizeRecipientRow,
  validateRecipients,
} from '../src/utils/recipients.js';

describe('normalizeRecipientRow', () => {
  it('trims and keeps department strings', () => {
    expect(normalizeRecipientRow({ officer: '  Jane Doe ', department: 'lspd' }))
      .toEqual({ officer: 'Jane Doe', department: 'lspd' });
  });
  it('accepts department objects ({value}/{label})', () => {
    expect(normalizeRecipientRow({ officer: 'Jane', department: { value: 'lssd', label: 'Sheriff' } }))
      .toEqual({ officer: 'Jane', department: 'lssd' });
  });
  it('returns null for empty/garbage rows', () => {
    expect(normalizeRecipientRow(null)).toBeNull();
    expect(normalizeRecipientRow({ officer: '   ' })).toBeNull();
    expect(normalizeRecipientRow('Jane')).toBeNull();
  });
});

describe('normalizeRecipients', () => {
  it('returns just the primary when no extras', () => {
    expect(normalizeRecipients({ requestingOfficer: 'Jane Doe', department: 'lspd' }))
      .toEqual([{ officer: 'Jane Doe', department: 'lspd' }]);
  });
  it('appends extras after the primary', () => {
    const out = normalizeRecipients({
      requestingOfficer: 'Jane', department: 'lspd',
      additionalRecipients: [{ officer: 'Bob', department: 'lssd' }],
    });
    expect(out).toEqual([
      { officer: 'Jane', department: 'lspd' },
      { officer: 'Bob', department: 'lssd' },
    ]);
  });
  it('dedupes extras matching the primary (case-insensitive)', () => {
    const out = normalizeRecipients({
      requestingOfficer: 'Jane Doe', department: 'lspd',
      additionalRecipients: [{ officer: 'jane doe', department: 'lssd' }, { officer: 'Bob', department: 'dao' }],
    });
    expect(out.map((r) => r.officer)).toEqual(['Jane Doe', 'Bob']);
  });
  it('caps at 5 total (primary + 4)', () => {
    const extras = Array.from({ length: 10 }, (_, i) => ({ officer: `Officer ${i}`, department: 'lspd' }));
    expect(normalizeRecipients({ requestingOfficer: 'Primary', additionalRecipients: extras })).toHaveLength(5);
    expect(MAX_TOTAL_RECIPIENTS).toBe(5);
  });
  it('drops empty extra rows', () => {
    const out = normalizeRecipients({
      requestingOfficer: 'Jane',
      additionalRecipients: [{ officer: '' }, { officer: 'Bob', department: '' }],
    });
    expect(out).toEqual([
      { officer: 'Jane', department: '' },
      { officer: 'Bob', department: '' },
    ]);
  });
});

describe('validateRecipients', () => {
  it('passes a good list', () => {
    expect(validateRecipients([{ officer: 'Jane Doe', department: 'lspd' }])).toEqual([]);
  });
  it('fails an empty list', () => {
    expect(validateRecipients([]).length).toBeGreaterThan(0);
  });
  it('flags short names', () => {
    const problems = validateRecipients([{ officer: 'Al', department: 'lspd' }]);
    expect(problems.length).toBeGreaterThan(0);
  });
});
