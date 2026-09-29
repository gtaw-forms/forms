// Tests for mapAgencyOptions — RTDB /agencies records have fullName/logo/url
// but NO shortCode field. Regression: the original inline mapper used
// `value: a.shortCode`, which was undefined for EVERY record, so options were
// never code-valued. The extracted core falls back to the record KEY.
import { describe, it, expect } from 'vitest';
import { mapAgencyOptions } from './agencyOptions';

// RTDB-shaped fixture: keys are UPPERCASE agency codes, values carry no shortCode.
const RTDB_SHAPED_STORE = {
    LSPD: { fullName: 'Los Santos Police Department', logo: 'lspd.png', url: 'https://example.test/lspd' },
    LSSD: { fullName: 'Los Santos County Sheriffs Department', logo: 'lssd.png', url: 'https://example.test/lssd' },
    SADCR: { fullName: 'San Andreas Department of Corrections and Rehabilitation', logo: 'sadcr.png', url: 'https://example.test/sadcr' },
    DAO: { fullName: "District Attorney's Office", logo: 'dao.png', url: 'https://example.test/dao' },
    LSFD: { fullName: 'Los Santos Fire Department', logo: 'lsfd.png', url: 'https://example.test/lsfd' },
    PHMC: { fullName: 'Pillbox Hill Medical Center', logo: 'phmc.png', url: 'https://example.test/phmc' },
};

describe('mapAgencyOptions', () => {
    it('every returned option has a DEFINED value (the regression)', () => {
        const options = mapAgencyOptions(RTDB_SHAPED_STORE);
        expect(options.length).toBe(6);
        for (const opt of options) {
            expect(opt.value).toBeDefined();
            expect(typeof opt.value).toBe('string');
        }
    });

    it('value === lowercase record key when shortCode is missing', () => {
        const options = mapAgencyOptions(RTDB_SHAPED_STORE);
        expect(options.map(o => o.value)).toEqual(['lspd', 'lssd', 'sadcr', 'dao', 'lsfd', 'phmc']);
    });

    it('value === lowercase shortCode when present', () => {
        const store = { LSPD: { fullName: 'Los Santos Police Department', shortCode: 'LSPD' } };
        expect(mapAgencyOptions(store)).toEqual([{ value: 'lspd', label: 'Los Santos Police Department' }]);
    });

    it('label === fullName', () => {
        const options = mapAgencyOptions(RTDB_SHAPED_STORE);
        for (const opt of options) {
            expect(opt.label).toBe(RTDB_SHAPED_STORE[opt.value.toUpperCase()].fullName);
        }
    });

    it('empty store -> []', () => {
        expect(mapAgencyOptions({})).toEqual([]);
    });

    it('null/undefined store -> []', () => {
        expect(mapAgencyOptions(null)).toEqual([]);
        expect(mapAgencyOptions(undefined)).toEqual([]);
    });

    it('entry missing fullName still yields a defined value', () => {
        const options = mapAgencyOptions({ LSFD: { logo: 'lsfd.png', url: 'https://example.test/lsfd' } });
        expect(options).toHaveLength(1);
        expect(options[0].value).toBe('lsfd');
        expect(options[0].value).toBeDefined();
    });
});