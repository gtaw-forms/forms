// Tests for getDepartmentFullName — pure BBCode helper that resolves a
// department short code to a full agency name from the RTDB /agencies store,
// falling back to the static STATIC_AGENCY_NAMES map and finally the raw code.
import { describe, it, expect } from 'vitest';
import { getDepartmentFullName } from './bbcodeHelpers';

const STORE = {
    LSPD: { fullName: 'Los Santos Police Department' },
    LSSD: { fullName: 'Los Santos County Sheriffs Department' },
    SADCR: { fullName: 'San Andreas Department of Corrections and Rehabilitation' },
    DAO: { fullName: "District Attorney's Office" },
};

describe('getDepartmentFullName', () => {
    it('resolves an UPPERCASE code via the store to fullName', () => {
        expect(getDepartmentFullName('LSPD', STORE)).toBe('Los Santos Police Department');
        expect(getDepartmentFullName('LSSD', STORE)).toBe('Los Santos County Sheriffs Department');
        expect(getDepartmentFullName('DAO', STORE)).toBe("District Attorney's Office");
    });

    it('resolves a lowercase code case-insensitively to fullName', () => {
        expect(getDepartmentFullName('lspd', STORE)).toBe('Los Santos Police Department');
        expect(getDepartmentFullName('sadcr', STORE)).toBe('San Andreas Department of Corrections and Rehabilitation');
    });

    it('passes a full name through unchanged', () => {
        const fullName = 'Los Santos Police Department';
        expect(getDepartmentFullName(fullName, STORE)).toBe(fullName);
    });

    it('falls back to the static agency name when the store has no entry', () => {
        expect(getDepartmentFullName('LSFD', {})).toBe('Los Santos Fire Department');
        expect(getDepartmentFullName('LSGOV', {})).toBe('Los Santos City Government');
    });

    it('falls back to the static agency name when the store is undefined', () => {
        expect(getDepartmentFullName('PHMC', undefined)).toBe('Pillbox Hill Medical Center');
        expect(getDepartmentFullName('SANFIRE', null)).toBe('State Fire Marshal');
    });

    it('returns the raw code when it is known nowhere', () => {
        expect(getDepartmentFullName('XYZ', STORE)).toBe('XYZ');
        expect(getDepartmentFullName('NOPE', {})).toBe('NOPE');
    });

    it('returns empty string / null departmentShortCode as-is', () => {
        expect(getDepartmentFullName('', STORE)).toBe('');
        expect(getDepartmentFullName(null, STORE)).toBe(null);
    });
});