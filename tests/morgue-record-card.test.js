import { describe, it, expect } from 'vitest';
import { morgueRecordCardFilename } from '../src/utils/morgueRecordCard.jsx';

describe('morgueRecordCardFilename', () => {
  it('prefers the ((OOC)) name: "Morgue Record - OOC - CaseID.png"', () => {
    expect(morgueRecordCardFilename({ name: 'Unknown (( Anthony Sorrentino ))', caseId: '86847' }))
      .toBe('Morgue Record - Anthony Sorrentino - 86847.png');
  });

  it('falls back to the IC name when there is no OOC', () => {
    expect(morgueRecordCardFilename({ name: 'Marcus Johnson', caseId: '121' }))
      .toBe('Morgue Record - Marcus Johnson - 121.png');
  });

  it('strips filename-illegal characters', () => {
    expect(morgueRecordCardFilename({ name: 'Unknown (( A/B: C* ))', caseId: '1/2' }))
      .toBe('Morgue Record - AB C - 12.png');
  });
});
