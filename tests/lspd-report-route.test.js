import { describe, it, expect } from 'vitest';
import {
  PORTAL_FORM_IDS,
  normalizeDepartment,
  departmentFullName,
  isLspdPortalReport,
  buildReportUrl,
} from '../discord-bot/services/lspdReportRoute.js';

const coroner = (department) => ({ formId: 'coroner-report', data: { department } });

describe('lspdReportRoute — portal routing predicate', () => {
  it('routes coroner + mass-fatality LSPD reports to the portal', () => {
    expect(isLspdPortalReport(coroner('lspd'))).toBe(true);
    expect(isLspdPortalReport({ formId: 'mass-ftality-test', data: { department: 'lspd' } })).toBe(true);
    expect(PORTAL_FORM_IDS).toEqual(['coroner-report', 'mass-ftality-test']);
  });

  it('keeps every other department on the forum path', () => {
    for (const dept of ['lssd', 'sadcr', 'dao', 'LSSD', '']) {
      expect(isLspdPortalReport(coroner(dept))).toBe(false);
    }
  });

  it('keeps non-coroner forms out even for LSPD', () => {
    expect(isLspdPortalReport({ formId: 'autopsy', data: { department: 'lspd' } })).toBe(false);
    expect(isLspdPortalReport({ formId: 'coroner_email', data: { department: 'lspd' } })).toBe(false);
    expect(isLspdPortalReport({})).toBe(false);
  });

  it('normalises object departments and legacy full names', () => {
    expect(normalizeDepartment({ value: 'lspd' })).toBe('lspd');
    expect(normalizeDepartment({ label: 'Los Santos Police Department' })).toBe('lspd');
    expect(normalizeDepartment('Los Santos Police Department')).toBe('lspd');
    expect(isLspdPortalReport(coroner({ value: 'LSPD' }))).toBe(true);
    expect(departmentFullName('lspd')).toBe('Los Santos Police Department');
  });
});

describe('lspdReportRoute — link builders', () => {
  it('builds encoded deep links and fails closed on missing segments', () => {
    expect(buildReportUrl('Alyson_Frost', '_PK_abc_123')).toBe(
      'https://gtaw-forms.github.io/forms/#/report/Alyson_Frost/_PK_abc_123',
    );
    expect(buildReportUrl('A B', 'a#b')).toContain('A%20B/a%23b');
    expect(buildReportUrl('', 'k')).toBe('');
    expect(buildReportUrl('a', '')).toBe('');
  });
});

