import { describe, it, expect } from 'vitest';
import {
  REPORT_ROUTE_PREFIX,
  PORTAL_BASE_URL,
  buildReportPath,
  buildReportUrl,
  parseReportHash,
  isReportHash,
  isValidReportRef,
  generateShareCode,
  isValidShareCode,
  buildShortReportPath,
  buildShortReportUrl,
  parseShortHash,
} from '../src/components/report-share/shareLink';

describe('report share link', () => {
  it('builds the canonical hash path with encoded segments', () => {
    expect(buildReportPath('Alyson_Frost', '_PK_John_Doe_10_24_2026_123')).toBe(
      '#/report/Alyson_Frost/_PK_John_Doe_10_24_2026_123',
    );
    // A space, hash or query char inside a slug must not break the URL.
    expect(buildReportPath('A B', 'a#b?c')).toBe('#/report/A%20B/a%23b%3Fc');
    expect(REPORT_ROUTE_PREFIX).toBe('#/report/');
  });

  it('builds absolute URLs with a trailing-slash-tolerant base', () => {
    const author = 'Alyson_Frost';
    const key = '_PK_John_Doe_10_24_2026_123';
    expect(buildReportUrl(author, key)).toBe(`${PORTAL_BASE_URL}#/report/${author}/${key}`);
    expect(buildReportUrl(author, key, 'https://example.test/forms')).toBe(
      `https://example.test/forms/#/report/${author}/${key}`,
    );
  });

  it('parses only report hashes, decoding segments', () => {
    expect(parseReportHash('#/report/Alyson_Frost/_PK_abc_123')).toEqual({
      author: 'Alyson_Frost',
      key: '_PK_abc_123',
    });
    expect(parseReportHash('#/report/A%20B/a%23b')).toEqual({ author: 'A B', key: 'a#b' });
    expect(parseReportHash('#/migration-ui')).toBeNull();
    expect(parseReportHash('#/report/only-author')).toBeNull();
    expect(parseReportHash('')).toBeNull();
    expect(isReportHash('#/report/a/b')).toBe(true);
    expect(isReportHash('#/leo')).toBe(false);
  });

  it('rejects empty or malformed refs before any API call', () => {
    expect(isValidReportRef('Alyson_Frost', '_PK_abc')).toBe(true);
    expect(isValidReportRef('', '_PK_abc')).toBe(false);
    expect(isValidReportRef('Alyson_Frost', '')).toBe(false);
    expect(isValidReportRef('Alyson_Frost', 'a\nb')).toBe(false);
    expect(isValidReportRef('Alyson_Frost', 'x'.repeat(301))).toBe(false);
  });
});

describe('report short codes', () => {
  it('generates 6-char unambiguous codes', () => {
    const seen = new Set();
    for (let i = 0; i < 200; i++) {
      const code = generateShareCode();
      expect(code).toMatch(/^[A-HJKMNP-Za-kmnp-z2-9]{6}$/);
      seen.add(code);
    }
    expect(seen.size).toBeGreaterThan(190);
  });

  it('validates code shape strictly', () => {
    expect(isValidShareCode('Ab3k9Q')).toBe(true);
    expect(isValidShareCode('Ab3k9')).toBe(false);
    expect(isValidShareCode('Ab3k9Q0')).toBe(false);
    expect(isValidShareCode('Ab3k9!')).toBe(false);
    expect(isValidShareCode('Ab3k9O')).toBe(false);
    expect(isValidShareCode('Ab3k9l')).toBe(false);
    expect(isValidShareCode('Ab3k91')).toBe(false);
    expect(isValidShareCode('')).toBe(false);
    expect(isValidShareCode(null)).toBe(false);
  });

  it('builds and parses short links', () => {
    expect(buildShortReportPath('Ab3k9Q')).toBe('#/r/Ab3k9Q');
    expect(buildShortReportUrl('Ab3k9Q')).toBe(`${PORTAL_BASE_URL}#/r/Ab3k9Q`);
    expect(parseShortHash('#/r/Ab3k9Q')).toEqual({ code: 'Ab3k9Q' });
    expect(parseShortHash('#/r/short')).toBeNull();
    expect(parseShortHash('#/report/a/b')).toBeNull();
    expect(isReportHash('#/r/Ab3k9Q')).toBe(true);
  });
});
