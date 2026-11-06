import { describe, it, expect } from 'vitest';
import { findStaticAgency, getDepartmentFullName, isPortalAgency, portalLoginUrl } from '../src/utils/bbcodeHelpers';

describe('findStaticAgency (offline agency mirror)', () => {
  it('resolves short codes case-insensitively with forum URLs', () => {
    const lspd = findStaticAgency('LSPD');
    expect(lspd?.fullName).toBe('Los Santos Police Department');
    expect(lspd?.url).toContain('lspd.gta.world');
    expect(findStaticAgency('lspd')?.shortCode).toBe('LSPD');
    expect(findStaticAgency('dao')?.fullName).toBe("District Attorney's Office");
  });

  it('resolves full names (the localhost department-select case)', () => {
    expect(findStaticAgency('Los Santos Police Department')?.shortCode).toBe('LSPD');
    expect(findStaticAgency('los santos police department')?.shortCode).toBe('LSPD');
  });

  it('returns null for unknown or too-short inputs', () => {
    expect(findStaticAgency('')).toBeNull();
    expect(findStaticAgency(null)).toBeNull();
    expect(findStaticAgency('No Such Agency')).toBeNull();
    expect(findStaticAgency('da')).toBeNull();
  });

  it('leaves the existing full-name helper untouched', () => {
    expect(getDepartmentFullName('LSPD')).toBe('Los Santos Police Department');
  });

  it('flags portal-stack agencies (OAuth, no forum credentials)', () => {
    expect(isPortalAgency('LSPD')).toBe(true);
    expect(isPortalAgency('lspd')).toBe(true);
    expect(isPortalAgency('Los Santos Police Department')).toBe(true);
    expect(isPortalAgency('LSSD')).toBe(false);
    expect(isPortalAgency('SADCR')).toBe(false);
    expect(isPortalAgency('DAO')).toBe(false);
    expect(isPortalAgency('')).toBe(false);
    expect(portalLoginUrl('LSPD')).toBe('https://lspd.gta.world/portal/login');
    expect(portalLoginUrl('LSSD')).toBe('');
  });
});
