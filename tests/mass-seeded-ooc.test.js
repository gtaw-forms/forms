import { describe, it, expect } from 'vitest';
import {
  splitDecedentName,
  toMassRequestBody,
  toMassRequestBodies,
  validateMassRequestBody,
  validateMassRequest,
  buildMassAutopsyRequestPayload,
} from '../src/utils/autopsyRequest.js';

// t=10507 regression: morgue-seeded bodies ("Unknown (( Anthony Sorrentino ))")
// were submitted as bare IC names with no ((OOC)), so the bot filed bodies it
// couldn't match back to morgue cases. The seed now snapshots the intake OOC
// and validation blocks submit when it goes missing.

const morgueRecord = (over = {}) => ({
  firebaseKey: '86847',
  caseId: '86847',
  name: 'Unknown (( Anthony Sorrentino ))',
  sex: 'Male',
  timeOfDeath: 'Sunday, 15 November 2026 20:17:49',
  location: 'Mission Row - Vespucci Blvd',
  ...over,
});

const baseRequester = { name: 'Julia Miura', rank: 'Detective', dept: 'LSSD - Major Crimes Bureau', agencyForum: 'LSSD', forumAccountUrl: 'https://x.test/u/1' };

describe('toMassRequestBody keeps the intake OOC snapshot', () => {
  it('splits Unknown (( OOC )) into name + ooc and snapshots the seed', () => {
    const b = toMassRequestBody(morgueRecord());
    expect(b.decedentName).toBe('Unknown');
    expect(b.oocName).toBe('Anthony Sorrentino');
    expect(b.seededOocName).toBe('Anthony Sorrentino');
    expect(b.caseId).toBe('86847');
  });

  it('leaves manually-added bodies without a seed snapshot', () => {
    const b = toMassRequestBody({ decedentName: 'John Smith' });
    expect(b.seededOocName).toBe('');
  });
});

describe('validateMassRequestBody guards the seeded OOC', () => {
  it('passes a correctly seeded body', () => {
    expect(validateMassRequestBody(toMassRequestBody(morgueRecord()))).toEqual([]);
  });

  it('blocks when the seeded OOC was moved into Decedent Name (t=10507)', () => {
    const b = {
      ...toMassRequestBody(morgueRecord()),
      decedentName: 'Anthony Sorrentino',
      oocName: '',
    };
    const problems = validateMassRequestBody(b);
    expect(problems.length).toBe(1);
    expect(problems[0]).toMatch(/86847/);
    expect(problems[0]).toMatch(/Decedent Name/);
  });

  it('blocks when the seeded OOC was cleared outright', () => {
    const b = { ...toMassRequestBody(morgueRecord()), oocName: '  ' };
    const problems = validateMassRequestBody(b);
    expect(problems.length).toBe(1);
    expect(problems[0]).toMatch(/Anthony Sorrentino/);
  });

  it('still allows real IC names without OOC on unseeded bodies', () => {
    expect(validateMassRequestBody({ decedentName: 'John Smith', oocName: '' })).toEqual([]);
  });

  it('still requires OOC for unidentified names without a seed', () => {
    expect(validateMassRequestBody({ decedentName: 'Unknown', oocName: '' }))
      .toEqual(['unidentified decedent needs an ((OOC)) name']);
  });

  it('surfaces per body in the batch validator (submit stays disabled)', () => {
    const bodies = [
      { ...toMassRequestBody(morgueRecord()), decedentName: 'Anthony Sorrentino', oocName: '' },
      toMassRequestBody(morgueRecord({ firebaseKey: '86846', caseId: '86846', name: 'Unknown (( Charles Gaeta ))' })),
    ];
    const missing = validateMassRequest({ incidentLabel: 'Test', requester: baseRequester, bodies });
    expect(missing.some((m) => m.startsWith('Body 1:') && /OOC identity/.test(m))).toBe(true);
    expect(missing.some((m) => m.startsWith('Body 2:'))).toBe(false);
  });
});

describe('seeded snapshot never leaks into the filed payload', () => {
  it('payload bodies carry only caseId/name/oocName/deathType', () => {
    const bodies = toMassRequestBodies([morgueRecord()]);
    const payload = buildMassAutopsyRequestPayload({ requester: baseRequester, bodies, incidentLabel: 'Test' });
    expect(payload.bodies).toEqual([
      { caseId: '86847', name: 'Unknown', oocName: 'Anthony Sorrentino', deathType: 'PK' },
    ]);
    expect(payload.requestBBCode).toMatch(/\(\(\s*Anthony Sorrentino\s*\)\)/);
  });
});
