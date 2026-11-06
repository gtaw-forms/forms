import { describe, it, expect } from 'vitest';
import {
  agencyLabel, agencyShort, formatTimestampShortUTC, isForwardedReport, isTruthyFlag,
  kindFromFormId, normalizeDepartment, nowLocalDateTime, nowLocalTime,
} from '../src/components/migration-ui/viewModel';
import {
  filterLeoRows, leoAgencyBadge, leoRowMeta, sortLeoRows,
} from '../src/components/migration-ui/leoModel';
import { pruneLeoEntries, trimLeoEntries, leoCacheId } from '../src/utils/leoReportCache';
import {
  DEMO_LEO_PAYLOADS, DEMO_LEO_ROWS, DEMO_MORGUE_RECORDS,
} from '../src/components/migration-ui/demoData';

const row = (over = {}) => ({
  author: 'Alyson_Frost',
  key: 'k1',
  title: '[PK] John Doe ((JohnDoe_1999)) - 09/29/2026',
  authorName: 'Alyson Frost',
  formId: 'coroner-report',
  formName: 'Coroner Report',
  timestamp: Date.UTC(2026, 9, 3, 14, 22),
  department: 'lspd',
  requestingOfficer: 'Sergeant Maria Reyes',
  decedentName: 'John Doe',
  forwarded: true,
  ...over,
});

describe('LEO report model', () => {
  it('maps formIds and departments to platform labels', () => {
    expect(kindFromFormId('mass-ftality-test')).toBe('mass');
    expect(kindFromFormId('mass-fatality')).toBe('mass');
    expect(kindFromFormId('autopsy')).toBe('autopsy');
    expect(kindFromFormId('coroner-report')).toBe('coroner');
    expect(normalizeDepartment(' LSPD ')).toBe('lspd');
    expect(normalizeDepartment('Los Santos Police Department')).toBe('lspd');
    expect(normalizeDepartment('Los Santos County Sheriffs Department')).toBe('lssd');
    expect(normalizeDepartment('District Attorney’s Office')).toBe('dao');
    expect(agencyLabel('lspd')).toBe('Los Santos Police Department');
    expect(agencyShort('lspd')).toBe('LSPD');
    expect(agencyLabel('unknown')).toBe('Unassigned agency');
    expect(agencyShort('')).toBe('—');
  });

  it('only treats ReportRequested true/string-true as forwarded', () => {
    expect(isForwardedReport({ ReportRequested: true })).toBe(true);
    expect(isForwardedReport({ ReportRequested: 'true' })).toBe(true);
    expect(isForwardedReport({ ReportRequested: false })).toBe(false);
    expect(isForwardedReport({})).toBe(false);
  });

  it('treats a mass report with the Requested checkbox as forwarded', () => {
    expect(isForwardedReport({ requestingOfficer: 'Officer Smith' }, 'mass-ftality-test')).toBe(true);
    expect(isForwardedReport({ requestingOfficer: ' ' }, 'mass-ftality-test')).toBe(true);
    expect(isForwardedReport({ requestingOfficer: '' }, 'mass-ftality-test')).toBe(false);
    expect(isForwardedReport({ department: 'lssd' }, 'mass-ftality-test')).toBe(false);
    expect(isForwardedReport({ requestingOfficer: 'Officer Smith' }, 'coroner-report')).toBe(false);
  });

  it('filters cached rows by agency and free text', () => {
    const rows = [
      row(),
      row({ key: 'k2', department: 'lssd', decedentName: 'Jane Doe', title: '[PK] Jane Doe' }),
      row({ key: 'k3', department: 'dao', decedentName: 'Robert Hale', title: '[CK] Robert Hale' }),
    ];
    expect(filterLeoRows(rows, { agency: 'lssd' }).map((r) => r.key)).toEqual(['k2']);
    expect(filterLeoRows(rows, { query: 'maria' })).toHaveLength(3);
    expect(filterLeoRows(rows, { query: 'robert' }).map((r) => r.key)).toEqual(['k3']);
    expect(filterLeoRows(rows, { agency: 'dao', query: 'jane' })).toHaveLength(0);
  });

  it('sorts newest first and renders agency-labelled metadata', () => {
    const rows = [row({ key: 'old', timestamp: 1 }), row({ key: 'new', timestamp: 2 })];
    expect(sortLeoRows(rows).map((r) => r.key)).toEqual(['new', 'old']);
    expect(leoAgencyBadge(row())).toBe('LSPD');
    expect(leoRowMeta(row())).toContain('Los Santos Police Department');
    expect(leoRowMeta(row())).toContain('03 Oct 2026, 14:22 UTC');
  });

  it('formats compact timestamps safely', () => {
    expect(formatTimestampShortUTC(Date.UTC(2026, 9, 3, 14, 22))).toBe('03 Oct 2026, 14:22 UTC');
    expect(formatTimestampShortUTC(null)).toBe('—');
  });

  it('builds local timestamp strings for the Now buttons', () => {
    const date = new Date(2026, 9, 18, 7, 5, 30); // local time
    expect(nowLocalDateTime(date)).toBe('2026-10-18T07:05');
    expect(nowLocalTime(date)).toBe('07:05');
  });

  it('treats legacy string flags as truthy', () => {
    expect(isTruthyFlag(true)).toBe(true);
    expect(isTruthyFlag('true')).toBe(true);
    expect(isTruthyFlag('false')).toBe(false);
    expect(isTruthyFlag(undefined)).toBe(false);
  });
});

describe('local sample data', () => {
  it('ships a forwarded payload for every sample LEO row', () => {
    expect(DEMO_LEO_ROWS.length).toBeGreaterThan(0);
    for (const row of DEMO_LEO_ROWS) {
      expect(row.demo).toBe(true);
      expect(normalizeDepartment(row.department)).toBe(row.department);
      const payload = DEMO_LEO_PAYLOADS[row.key];
      expect(payload?.report?.data?.ReportRequested).toBe(true);
      expect(payload?.report?.originalKey).toBe(row.title);
    }
  });

  it('ships morgue samples with the fields the viewer renders', () => {
    expect(DEMO_MORGUE_RECORDS.length).toBeGreaterThan(0);
    for (const record of DEMO_MORGUE_RECORDS) {
      expect(record.caseId).toBeTruthy();
      expect(record.name).toBeTruthy();
      expect(record.lastUpdated).toBeGreaterThan(0);
      expect(Array.isArray(record.findings)).toBe(true);
    }
  });
});

describe('LEO IndexedDB cache trimming', () => {
  it('keeps at most 50 payloads, newest viewed first', () => {
    const entries = {};
    for (let i = 0; i < 60; i++) {
      entries[`r${i}`] = { payload: { success: true }, cachedAt: i, lastViewedAt: i };
    }
    const trimmed = trimLeoEntries(entries, 50);
    expect(Object.keys(trimmed)).toHaveLength(50);
    expect(trimmed.r59).toBeTruthy();
    expect(trimmed.r10).toBeTruthy();
    expect(trimmed.r9).toBeUndefined();
  });

  it('drops payloads that left the forwarded feed before trimming', () => {
    const entries = {
      keep: { payload: { ok: true }, cachedAt: 1 },
      stale: { payload: { ok: true }, cachedAt: 2 },
    };
    const pruned = pruneLeoEntries(entries, ['keep'], 50);
    expect(Object.keys(pruned)).toEqual(['keep']);
  });

  it('builds a stable cache id', () => {
    expect(leoCacheId('Alyson_Frost', 'k1')).toBe('Alyson_Frost::k1');
  });
});
