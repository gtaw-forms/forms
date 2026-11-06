import { describe, it, expect } from 'vitest';
import {
  isLspdCondensedTarget,
  bareName,
  buildLspdCondensedEmail,
  parseAttachedIdentity,
} from '../src/utils/lspdCondensedNotice';
import { isLspdEmailReport } from '../discord-bot/services/lspdReportRoute.js';

describe('lspd condensed email override', () => {
  it('targets only the coroner_email form with an LSPD department', () => {
    expect(isLspdCondensedTarget('coroner_email', 'lspd')).toBe(true);
    expect(isLspdCondensedTarget('coroner_email', { value: 'LSPD' })).toBe(true);
    expect(isLspdCondensedTarget('coroner_email', 'Los Santos Police Department')).toBe(true);
    expect(isLspdCondensedTarget('coroner_email', 'lssd')).toBe(false);
    expect(isLspdCondensedTarget('coroner_email', '')).toBe(false);
    expect(isLspdCondensedTarget('coroner-report', 'lspd')).toBe(false);
    expect(isLspdCondensedTarget('autopsy', 'lspd')).toBe(false);
  });

  it('reads bare names from raw inputs or selects', () => {
    expect(bareName('Alexander Ryland')).toBe('Alexander Ryland');
    expect(bareName({ value: 'Alexander Ryland', label: 'Ryland' })).toBe('Alexander Ryland');
    expect(bareName(null)).toBe('');
  });

  it('builds the condensed notice with a link placeholder pre-save', () => {
    const { bbcode, finalTitle } = buildLspdCondensedEmail(
      {
        requestingOfficer: 'Alexander Ryland',
        coronerEmployee: 'Alyson Frost',
        coronerRank: 'Chief Deputy Medical Examiner',
        coronerBadge: '5573',
        decedentName: 'John Doe',
        decedentOOC: 'Benji Clemons',
        typeOfDeath: 'PK',
      },
      { departmentFullName: 'Los Santos Police Department' },
    );
    expect(bbcode).toContain('For the attention of: **Los Santos Police Department** - **Alexander Ryland**');
    expect(bbcode).toContain('A Coroner Report has been finalized');
    expect(bbcode).toContain('- Decedent: **John Doe** (( Benji Clemons ))');
    expect(bbcode).toContain('Chief Deputy Medical Examiner Alyson Frost (SN: 5573)');
    expect(bbcode).toContain('**View the report:** (link is generated when the report is filed)');
    expect(bbcode).not.toMatch(/\[[a-z/][^\n]*\]/i);
    expect(finalTitle).toBe('Coroner Report - John Doe (( Benji Clemons ))');
  });

  it('uses a real link when one is supplied and degrades without a decedent', () => {
    const withLink = buildLspdCondensedEmail(
      { requestingOfficer: 'R', coronerEmployee: 'C' },
      { departmentFullName: 'D', reportUrl: 'https://example.test/#/report/a/k' },
    );
    expect(withLink.bbcode).toContain('**View the report:** https://example.test/#/report/a/k');
    expect(withLink.finalTitle).toBe('Coroner Report');
  });

  it('links the attached report when its identity was captured at attach', () => {
    const { bbcode } = buildLspdCondensedEmail(
      {
        requestingOfficer: 'Ellie Park',
        coronerEmployee: 'Sadie Voss',
        additionalReports: [{
          originalKey: '[PK] John Doe ((JohnDoe_1999)) - 10/17/2026',
          formId: 'coroner-report',
          attachedAuthor: 'Sadie_Voss',
          attachedKey: '_PK_John_Doe_10_17_2026_123',
        }],
      },
      { departmentFullName: 'Los Santos Police Department' },
    );
    expect(bbcode).toContain('**View the report:** https://gtaw-forms.github.io/forms/#/report/Sadie_Voss/_PK_John_Doe_10_17_2026_123');
    expect(bbcode).not.toContain('link is generated');
  });

  it('lists every attached report when several are attached', () => {
    const two = [
      { originalKey: '[PK] John Doe ((JohnDoe_1999)) - 10/17/2026', formId: 'coroner-report', attachedAuthor: 'A', attachedKey: 'k1' },
      { originalKey: '[CK] Jane Doe ((JaneDoe_2001)) - 10/18/2026', formId: 'coroner-report', attachedAuthor: 'A', attachedKey: 'k2' },
    ];
    const { bbcode } = buildLspdCondensedEmail(
      { requestingOfficer: 'R', coronerEmployee: 'C', additionalReports: two },
      { departmentFullName: 'D' },
    );
    expect(bbcode).toContain('- Attached reports: **2**');
    expect(bbcode).toContain('PK John Doe ((JohnDoe_1999)) - 10/17/2026');
    expect(bbcode).toContain('CK Jane Doe ((JaneDoe_2001)) - 10/18/2026');
    // First attachment still drives the link.
    expect(bbcode).toContain('**View the report:** https://gtaw-forms.github.io/forms/#/report/A/k1');
    const single = buildLspdCondensedEmail(
      { requestingOfficer: 'R', coronerEmployee: 'C', additionalReports: two.slice(0, 1) },
      { departmentFullName: 'D' },
    );
    expect(single.bbcode).not.toContain('Attached reports:');
  });

  it('keeps the honest placeholder without attach identity', () => {
    const { bbcode } = buildLspdCondensedEmail(
      { requestingOfficer: 'R', coronerEmployee: 'C' },
      { departmentFullName: 'D' },
    );
    expect(bbcode).toContain('**View the report:** (link is generated when the report is filed)');
  });

  it('never stacks prefixes on chained titles (the reported bug)', () => {
    const chained = 'Coroner Report - Coroner Report - Tyler Prochorov ((Tyler Prochorov)) 10/31/2026';
    const { bbcode, finalTitle } = buildLspdCondensedEmail(
      { requestingOfficer: 'R', coronerEmployee: 'C', decedentName: chained },
      { departmentFullName: 'D' },
    );
    expect(finalTitle).toBe('Coroner Report - Tyler Prochorov (( Tyler Prochorov ))');
    expect(bbcode).toContain('- Decedent: **Tyler Prochorov** (( Tyler Prochorov ))');
    expect(finalTitle).not.toContain('10/31/2026');
  });

  it('routes manually filed LSPD emails to the portal (bot predicate)', () => {
    expect(isLspdEmailReport({ formId: 'coroner_email', data: { department: 'lspd' } })).toBe(true);
    expect(isLspdEmailReport({ formId: 'coroner_email', data: { department: { value: 'LSPD' } } })).toBe(true);
    expect(isLspdEmailReport({ formId: 'coroner_email', data: { department: 'lssd' } })).toBe(false);
    expect(isLspdEmailReport({ formId: 'coroner-report', data: { department: 'lspd' } })).toBe(false);
  });

  it('parses attached-report titles when the email fields are empty', () => {
    expect(parseAttachedIdentity([{ originalKey: '[PK] John Doe ((JohnDoe_1999)) - 10/17/2026' }]))
      .toMatchObject({ decedentName: 'John Doe', decedentOOC: 'JohnDoe_1999', typeOfDeath: 'PK' });
    expect(parseAttachedIdentity([{ originalKey: '[Mass Fatality Report] John Doe, Jane Doe - 10/13/2026' }]).decedentName)
      .toBe('John Doe, Jane Doe');
    expect(parseAttachedIdentity([])).toEqual({});
    expect(parseAttachedIdentity(null)).toEqual({});
  });

  it('fills the decedent block from the attachment (the reported bug)', () => {
    const { bbcode, finalTitle } = buildLspdCondensedEmail(
      {
        requestingOfficer: 'Sergeant Maria Reyes',
        coronerEmployee: 'Alyson Frost',
        coronerRank: 'Chief Deputy Medical Examiner',
        coronerBadge: '5573',
        additionalReports: [{ originalKey: '[PK] John Doe ((JohnDoe_1999)) - 10/17/2026' }],
      },
      { departmentFullName: 'Los Santos Police Department' },
    );
    expect(bbcode).toContain('- Decedent: **John Doe** (( JohnDoe_1999 ))');
    expect(bbcode).toContain('- Report: **Coroner Report**');
    expect(finalTitle).toBe('Coroner Report - John Doe (( JohnDoe_1999 ))');
  });

  it('labels the report line from the attached report kind', () => {
    const kinds = {
      'coroner-report': 'Coroner Report',
      autopsy: 'Autopsy Report',
      'mass-ftality-test': 'Mass Fatality Report',
    };
    for (const [formId, label] of Object.entries(kinds)) {
      const { bbcode } = buildLspdCondensedEmail(
        { requestingOfficer: 'R', coronerEmployee: 'C', additionalReports: [{ originalKey: 'X', formId }] },
        { departmentFullName: 'D' },
      );
      expect(bbcode).toContain(`- Report: **${label}**`);
    }
    expect(parseAttachedIdentity([{ originalKey: '[PK] John Doe ((JohnDoe_1999)) - 10/17/2026', formId: 'coroner-report' }]).reportKind)
      .toBe('Coroner Report');
  });
});

