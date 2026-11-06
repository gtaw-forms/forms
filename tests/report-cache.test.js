import { describe, it, expect } from 'vitest';
import {
  REPORT_FEEDS_LIMIT, REPORT_PAYLOADS_LIMIT, reportFeedKey, reportPayloadId,
  trimFeedEntries, trimReportPayloads,
} from '../src/utils/reportCache';

describe('saved-reports IndexedDB cache', () => {
  it('builds stable feed keys and normalises the query', () => {
    expect(reportFeedKey({ filter: 'coroner', query: '  John Doe ', offset: 25 }))
      .toBe('coroner|john doe|25');
    expect(reportFeedKey()).toBe('all||0');
  });

  it('keeps only the newest feed pages (working set, not a mirror)', () => {
    const feeds = {};
    for (let i = 0; i < 12; i++) {
      feeds[`feed-${i}`] = { rows: [{ key: i }], total: 1, cachedAt: i };
    }
    const trimmed = trimFeedEntries(feeds);
    expect(Object.keys(trimmed)).toHaveLength(REPORT_FEEDS_LIMIT);
    expect(trimmed['feed-11']).toBeTruthy();
    expect(trimmed['feed-4']).toBeTruthy();
    expect(trimmed['feed-3']).toBeUndefined();
  });

  it('caps detail payloads at 50 by most recent access', () => {
    const entries = {};
    for (let i = 0; i < 60; i++) {
      entries[`r${i}`] = { payload: { report: { key: i } }, cachedAt: i, lastAccessedAt: i };
    }
    const trimmed = trimReportPayloads(entries);
    expect(Object.keys(trimmed)).toHaveLength(REPORT_PAYLOADS_LIMIT);
    expect(trimmed.r59).toBeTruthy();
    expect(trimmed.r10).toBeTruthy();
    expect(trimmed.r9).toBeUndefined();
  });

  it('uses a stable payload id', () => {
    expect(reportPayloadId('Alyson_Frost', 'k1')).toBe('Alyson_Frost::k1');
  });
});
