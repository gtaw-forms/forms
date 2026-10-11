import { describe, it, expect } from 'vitest';
import {
  coronerTitle, massTitle, autopsyTitle, massDate, formatDateTimeUTC,
  DEPARTMENT_NAMES, TYPE_OF_DEATH_OPTIONS, MANNER_OF_DEATH_OPTIONS,
} from '../src/components/migration-ui/viewModel';

describe('migration-ui viewModel', () => {
  it('builds the coroner title by the same rule as the handoff', () => {
    expect(coronerTitle({
      typeOfDeath: 'PK', decedentName: 'John Doe', decedentOOC: 'JohnDoe_1999', date: '09/29/2026',
    })).toBe('[PK] John Doe ((JohnDoe_1999)) - 09/29/2026');
  });

  it('derives mass dates from dispatch time when no explicit date', () => {
    expect(massDate({ dateTime: '2026-09-29T14:30:00' })).toBe('09/29/2026');
    expect(massTitle({
      placeOfDeath: 'Legion Square', dateTime: '2026-09-29T14:30:00',
      decedents: [{ decedentName: 'John Doe' }, { decedentName: 'Jane Doe' }],
    })).toBe('[Mass Fatality Report] John Doe, Jane Doe - 09/29/2026');
  });

  it('builds autopsy titles as Case #… | status', () => {
    expect(autopsyTitle({
      caseNumber: '2026-118', decedentName: 'Marcus Webb',
      decedentOOC: 'MarcusW_04', caseStatusOptions: 'COMPLETED',
    })).toBe('Case #2026-118 Marcus Webb ((MarcusW_04)) | COMPLETED');
  });

  it('formats UTC datetimes and freezes the hardcoded vocabs', () => {
    expect(formatDateTimeUTC('2026-09-29T14:30:00')).toContain('2026');
    expect(formatDateTimeUTC('')).toBe('—');
    expect(TYPE_OF_DEATH_OPTIONS).toEqual(['PK', 'CK']);
    expect(MANNER_OF_DEATH_OPTIONS).toContain('Homicide');
    expect(DEPARTMENT_NAMES.lspd).toBe('Los Santos Police Department');
  });
});
