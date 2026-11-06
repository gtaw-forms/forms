import { describe, it, expect } from 'vitest';
import { shortCodeForReport, portalReportUrl } from '../discord-bot/services/reportLink.js';

// Minimal admin-Database stand-in: ref(path).once('value') -> { exists, val }.
const fakeDb = (store) => ({
  ref: (path) => ({
    once: async () => ({
      exists: () => store[path] !== undefined,
      val: () => store[path] ?? null,
    }),
  }),
});

describe('reportLink — short links with long fallback', () => {
  it('uses the indexed code when present', async () => {
    const db = fakeDb({ 'shortLinksByReport/Alyson_Frost/k1': 'Ab3k9Q' });
    expect(await shortCodeForReport(db, 'Alyson_Frost', 'k1')).toBe('Ab3k9Q');
    expect(await portalReportUrl(db, { author: 'Alyson_Frost', key: 'k1' }))
      .toBe('https://gtaw-forms.github.io/forms/#/r/Ab3k9Q');
  });

  it('falls back to the long link when the index misses or fails', async () => {
    const db = fakeDb({});
    expect(await shortCodeForReport(db, 'A', 'k')).toBeNull();
    expect(await portalReportUrl(db, { author: 'Alyson_Frost', key: 'k1' }))
      .toBe('https://gtaw-forms.github.io/forms/#/report/Alyson_Frost/k1');
    expect(await portalReportUrl(null, { author: 'A', key: 'k' }))
      .toBe('https://gtaw-forms.github.io/forms/#/report/A/k');
    const boom = { ref: () => { throw new Error('down'); } };
    expect(await portalReportUrl(boom, { author: 'A', key: 'k' }))
      .toBe('https://gtaw-forms.github.io/forms/#/report/A/k');
  });

  it('fails closed on missing identity (never a dead link)', async () => {
    const db = fakeDb({});
    expect(await portalReportUrl(db, { author: '', key: 'k' })).toBe('');
    expect(await portalReportUrl(db, { author: 'A', key: '' })).toBe('');
  });
});
