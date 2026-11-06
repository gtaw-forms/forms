import { describe, it, expect } from 'vitest';
import {
  lspdFormsDryRun,
  PORTAL_FORMS,
  FIELD_ANCHORS,
  ROW_ANCHORS,
  mapManner,
  mapDeathType,
  mapEvidenceLocker,
  pickSingleRecipient,
  extractRecipientOptions,
  splitDateTime,
  extractTime,
  normalizeTextList,
  normalizeUrlList,
  buildCoronerFormPayload,
  buildMedicalExaminerPayload,
  detectReceipt,
} from '../discord-bot/services/lspdPortalForms.js';

const coronerData = (over = {}) => ({
  dateTime: '2026-10-17T22:05:00',
  pronouncedTimeOfDeath: '2026-10-17T22:35:00',
  placeOfDeath: '123 Grove Street, Davis',
  coronerEmployee: 'Alyson Frost',
  coronerRank: 'Chief Deputy Medical Examiner',
  coronerBadge: '5573',
  requestingOfficer: 'Sergeant Maria Reyes',
  decedentName: 'John Doe',
  decedentOOC: 'JohnDoe_1999',
  typeOfDeath: 'PK',
  mannerOfDeath: 'Homicide',
  probableCauseOfDeath: 'Gunshot wound to the chest',
  synopsis: 'Decedent found unresponsive inside a parked sedan.',
  evidenceLocker: true,
  evidenceLockerItems: 'EL#2026-104',
  scenePhotosBBCode: ['https://example.test/scene-1.jpg', 'https://example.test/scene-2.jpg'],
  additionalPhotos: ['https://example.test/morgue-1.jpg'],
  ...over,
});

const autopsyData = (over = {}) => ({
  decedentName: 'Tom Beckett',
  decedentOOC: 'TomB_22',
  autopsyStartTime: '2026-10-15T14:30:00',
  dnaProfile: 'DNA-3A88E1',
  placeOfDeath: 'Strawberry Ave',
  deathCausesListItems: ['Gunshot wound to Chest', 'Hemothorax, Bilateral'],
  deathType: 'Homicide',
  causeOfDeath: 'Drive-by shooting on Strawberry Ave',
  anatomicSummaryListItems: ['Gunshot wound to Chest', 'Hemothorax, Bilateral'],
  externalExamination: 'Adult male, 181 cm. Two entry wounds, no exit wounds.',
  bacLevel: '0.00%',
  narcoticTraces: 'Negative',
  RadiologyResult: '2 projectiles/slugs were identified via fluoroscopy and recovered.',
  casings: ['Bullet found with striation marks (9mm) #1'],
  synopsis: 'Death by gunshot wounds; manner homicide.',
  ...over,
});

const meCtx = (over = {}) => ({
  caseNum: '26-010',
  requestLink: 'https://lspd.gta.world/viewtopic.php?t=4242',
  requesterName: 'Alexander Ryland',
  meName: 'Alyson Frost',
  approvedBy: 'Eleanor Vance',
  ...over,
});

describe('lspdPortalForms — env + registry', () => {
  it('dry-run defaults true, both forms registered with recipient endpoints', () => {
    delete process.env.LSPD_FORMS_DRY_RUN;
    expect(lspdFormsDryRun()).toBe(true);
    process.env.LSPD_FORMS_DRY_RUN = 'false';
    expect(lspdFormsDryRun()).toBe(false);
    delete process.env.LSPD_FORMS_DRY_RUN;
    expect(PORTAL_FORMS['medical-examiner'].path).toBe('/portal/records/medical-examiner-case-submission');
    expect(PORTAL_FORMS['medical-examiner'].recipientsPath).toContain('/recipients');
    expect(PORTAL_FORMS['coroner-report'].path).toBe('/portal/records/coroner-report');
    expect(PORTAL_FORMS['coroner-report'].recipientsPath).toContain('/recipients');
  });
});

describe('lspdPortalForms — manner / type / evidence maps', () => {
  it('maps the PHMC manner vocab, Accidental->Accident exactly', () => {
    expect(mapManner('Natural')).toEqual({ ok: true, value: 'Natural' });
    expect(mapManner('Accidental')).toEqual({ ok: true, value: 'Accident' });
    expect(mapManner('accident')).toEqual({ ok: true, value: 'Accident' });
    expect(mapManner('  HOMICIDE ')).toEqual({ ok: true, value: 'Homicide' });
    expect(mapManner('Suicide')).toEqual({ ok: true, value: 'Suicide' });
    expect(mapManner('Undetermined')).toEqual({ ok: true, value: 'Undetermined' });
  });

  it('aborts anything outside the known manner set (never defaults)', () => {
    for (const bad of ['', 'Unknown', 'Pending', 'Homicide/Suicide', null, undefined]) {
      const r = mapManner(bad);
      expect(r.ok).toBe(false);
      expect(r.reason).toMatch(/abort/i);
    }
  });

  it('maps PK->Non-CK, CK->CK, aborts the rest', () => {
    expect(mapDeathType('CK')).toEqual({ ok: true, value: 'CK' });
    expect(mapDeathType('pk')).toEqual({ ok: true, value: 'Non-CK' });
    expect(mapDeathType('PK')).toEqual({ ok: true, value: 'Non-CK' });
    expect(mapDeathType('Unknown').ok).toBe(false);
    expect(mapDeathType('').ok).toBe(false);
  });

  it('evidence locker is Used iff explicitly true', () => {
    expect(mapEvidenceLocker(true)).toBe('Used');
    for (const v of [false, undefined, null, 0, 1, 'true', 'yes', 'EL#1']) {
      expect(mapEvidenceLocker(v)).toBe('Not used');
    }
  });
});

describe('lspdPortalForms — recipient pick', () => {
  it('passes exactly one match through', () => {
    expect(pickSingleRecipient(['Kelly Rhodes', 'Maria Reyes'], 'Kelly Rhodes'))
      .toEqual({ ok: true, match: 'Kelly Rhodes' });
    expect(pickSingleRecipient(['Kelly Rhodes'], 'kelly')).toEqual({ ok: true, match: 'Kelly Rhodes' });
  });

  it('aborts on zero or ambiguous matches, never guesses', () => {
    expect(pickSingleRecipient(['Maria Reyes'], 'Kelly Rhodes').ok).toBe(false);
    const amb = pickSingleRecipient(['Kelly Rhodes', 'Kelly Rhodes-Smith'], 'Kelly');
    expect(amb.ok).toBe(false);
    expect(amb.reason).toMatch(/mbiguous/i);
    expect(pickSingleRecipient(['Kelly Rhodes'], '').ok).toBe(false);
  });
});

describe('lspdPortalForms — recipients payload shapes', () => {
  it('unwraps arrays and common envelope keys, null on junk', () => {
    expect(extractRecipientOptions(['A', 'B'])).toEqual(['A', 'B']);
    expect(extractRecipientOptions({ results: [{ name: 'A' }, { label: 'B' }] })).toEqual(['A', 'B']);
    expect(extractRecipientOptions({ data: [{ characterName: 'C' }] })).toEqual(['C']);
    expect(extractRecipientOptions({ suggestions: ['D'] })).toEqual(['D']);
    expect(extractRecipientOptions(null)).toBeNull();
    expect(extractRecipientOptions({ nope: 1 })).toBeNull();
  });
});

describe('lspdPortalForms — dates', () => {
  it('splits ISO, D/M/Y and natural-language dates (25 Dec 2026)', () => {
    expect(splitDateTime('2026-10-17T22:05:00')).toEqual({ ok: true, date: '17/10/2026', time: '22:05' });
    expect(splitDateTime('17/10/2026 09:35')).toEqual({ ok: true, date: '17/10/2026', time: '09:35' });
    const nat = splitDateTime('25 Dec 2026');
    expect(nat.ok).toBe(true);
    expect(nat.date).toBe('25/12/2026');
    expect(splitDateTime('garbage!!').ok).toBe(false);
    expect(splitDateTime('').ok).toBe(false);
  });

  it('extracts time of death from datetimes and bare times', () => {
    expect(extractTime('16:12')).toEqual({ ok: true, time: '16:12' });
    expect(extractTime('2026-10-17T22:35:00')).toEqual({ ok: true, time: '22:35' });
    expect(extractTime('').ok).toBe(false);
  });
});

describe('lspdPortalForms — anchor coverage (driver tables match builders)', () => {
  it('every emitted static label has a data-record-field anchor', () => {
    const coroner = buildCoronerFormPayload(coronerData());
    expect(coroner.ok).toBe(true);
    for (const f of coroner.fields) {
      if (f.kind === 'rows') continue;
      expect(FIELD_ANCHORS['coroner-report'][f.label], `anchor for "${f.label}"`).toBeTruthy();
    }
    const me = buildMedicalExaminerPayload(autopsyData(), meCtx());
    expect(me.ok).toBe(true);
    for (const f of me.fields) {
      if (f.kind === 'rows') continue;
      expect(FIELD_ANCHORS['medical-examiner'][f.label], `anchor for "${f.label}"`).toBeTruthy();
    }
  });

  it('every emitted row list has a scope (field anchor or rows list)', () => {
    const coroner = buildCoronerFormPayload(coronerData());
    for (const f of coroner.fields) {
      if (f.kind !== 'rows') continue;
      expect(ROW_ANCHORS['coroner-report'][f.rowLabel], `row scope for "${f.rowLabel}"`).toBeTruthy();
    }
    const me = buildMedicalExaminerPayload(autopsyData(), meCtx());
    const rows = me.fields.filter((f) => f.kind === 'rows');
    expect(rows.length).toBe(1); // findings live in div[data-record-rows], no per-group anchor
  });
});

describe('lspdPortalForms — text vs URL lists', () => {
  it('keeps plain-text lines verbatim (causes, findings, casings)', () => {
    expect(normalizeTextList(['Gunshot wound to Chest', ' Hemothorax, Bilateral ', 'Gunshot wound to Chest']))
      .toEqual(['Gunshot wound to Chest', 'Hemothorax, Bilateral']);
    expect(normalizeTextList('a\n\nb')).toEqual(['a', 'b']);
  });
  it('accepts arrays, newline strings, objects and [img] BBCode; dedupes', () => {
    expect(normalizeUrlList(['https://a.test/1.jpg', 'https://a.test/2.jpg']))
      .toEqual(['https://a.test/1.jpg', 'https://a.test/2.jpg']);
    expect(normalizeUrlList('https://a.test/1.jpg\nhttps://a.test/1.jpg'))
      .toEqual(['https://a.test/1.jpg']);
    expect(normalizeUrlList(['[img]https://a.test/1.jpg[/img]'])).toEqual(['https://a.test/1.jpg']);
    expect(normalizeUrlList([{ url: 'https://a.test/1.jpg' }])).toEqual(['https://a.test/1.jpg']);
    expect(normalizeUrlList([])).toEqual([]);
  });
});

describe('lspdPortalForms — coroner payload', () => {
  it('builds a complete field list with mapped selects', () => {
    const r = buildCoronerFormPayload(coronerData({ mannerOfDeath: 'Accidental', typeOfDeath: 'PK' }));
    expect(r.ok).toBe(true);
    const byLabel = (l) => r.fields.filter((f) => f.label === l);
    expect(byLabel('Manner of death')[0]).toMatchObject({ kind: 'select', value: 'Accident' });
    expect(byLabel('Type of death')[0]).toMatchObject({ kind: 'select', value: 'Non-CK' });
    expect(byLabel('Evidence locker')[0]).toMatchObject({ value: 'Used' });
    expect(byLabel('Dispatched')).toHaveLength(2); // date + time
    const scene = r.fields.find((f) => f.rowLabel === 'Scene photos');
    expect(scene.values).toEqual(['https://example.test/scene-1.jpg', 'https://example.test/scene-2.jpg']);
    expect(byLabel('Player OOC name')[0].value).toBe('JohnDoe_1999');
    expect(byLabel('Rank / badge')[0].value).toBe('Chief Deputy Medical Examiner (SN: 5573)');
  });

  it('flags evidence as Not used unless explicitly true', () => {
    const r = buildCoronerFormPayload(coronerData({ evidenceLocker: false }));
    expect(r.ok).toBe(true);
    expect(r.fields.find((f) => f.label === 'Evidence locker').value).toBe('Not used');
  });

  it('aborts on unmapped manner, bad type, missing OOC or missing officer', () => {
    expect(buildCoronerFormPayload(coronerData({ mannerOfDeath: 'Pending' })).ok).toBe(false);
    expect(buildCoronerFormPayload(coronerData({ typeOfDeath: '??' })).ok).toBe(false);
    expect(buildCoronerFormPayload(coronerData({ decedentOOC: '' })).ok).toBe(false);
    expect(buildCoronerFormPayload(coronerData({ requestingOfficer: '' })).ok).toBe(false);
    const errs = buildCoronerFormPayload(coronerData({ mannerOfDeath: 'Pending' })).errors;
    expect(errs.join(' ')).toMatch(/abort/i);
  });
});

describe('lspdPortalForms — medical-examiner payload', () => {
  it('builds a complete field list from an autopsy record', () => {
    const r = buildMedicalExaminerPayload(autopsyData(), meCtx());
    expect(r.ok).toBe(true);
    const byLabel = (l) => r.fields.filter((f) => f.label === l);
    expect(byLabel('Manner of Death')[0]).toMatchObject({ kind: 'text', value: 'Homicide' });
    expect(byLabel('Autopsy & Death Certificate Request (PHMC link)')[0].value)
      .toBe('https://lspd.gta.world/viewtopic.php?t=4242');
    expect(byLabel('Cause of Death')[0].value).toContain('Gunshot wound to Chest');
    expect(r.fields.find((f) => f.rowLabel === 'Finding').values).toHaveLength(2);
    // Fixed procedure lines stand in where the report has no source field.
    expect(byLabel('Clothing')[0].value).toMatch(/not clothed/);
    expect(byLabel('Metal Objects Extracted')[0].value).toContain('striation marks');
  });

  it('maps Accidental manner and empty-metal honestly', () => {
    const r = buildMedicalExaminerPayload(
      autopsyData({ deathType: 'Accidental', casings: [] }), meCtx(),
    );
    expect(r.ok).toBe(true);
    expect(r.fields.find((f) => f.label === 'Manner of Death').value).toBe('Accident');
    expect(r.fields.find((f) => f.label === 'Metal Objects Extracted').value).toBe('None recovered.');
  });

  it('aborts on unmapped manner, missing link, or missing approver (never invents)', () => {
    const badManner = buildMedicalExaminerPayload(autopsyData({ deathType: 'Suspicious' }), meCtx());
    expect(badManner.ok).toBe(false);
    expect(badManner.errors.join(' ')).toMatch(/abort/i);
    const noLink = buildMedicalExaminerPayload(autopsyData(), meCtx({ requestLink: '' }));
    expect(noLink.ok).toBe(false);
    const noApprover = buildMedicalExaminerPayload(autopsyData(), meCtx({ approvedBy: '' }));
    expect(noApprover.ok).toBe(false);
    expect(noApprover.errors.join(' ')).toMatch(/Approved By/);
  });
});

describe('lspdPortalForms receipt detection', () => {
  const ME_RECEIPT_URL = 'https://lspd.gta.world/portal/records/medical-examiner-case-submission/01m6q2y5hjwa67e33krpp5j1qx';
  const meReceipt = (over = {}) => ({
    url: ME_RECEIPT_URL,
    bodyHead: 'STATUS Received FILED 6 Nov 2026, 00:08 UTC Delivered to the LSPD. Nothing more is needed from you. ' + (over.extra || ''),
    ...over,
  });

  it('recognises the ME receipt at the form path (the shipped false-negative)', () => {
    const r = detectReceipt(meReceipt());
    expect(r.received).toBe(true);
    expect(r.reference).toBe('01m6q2y5hjwa67e33krpp5j1qx');
  });

  it('prefers the CR-style reference when present', () => {
    const r = detectReceipt({
      url: 'https://lspd.gta.world/portal/records/coroner-report',
      bodyHead: 'STATUS Received FILED 6 Nov 2026, 00:16 UTC Delivered to the LSPD under the reference CR-26-0001.',
    });
    expect(r.received).toBe(true);
    expect(r.reference).toBe('CR-26-0001');
  });

  it('rejects the blank form and validation-error states', () => {
    expect(detectReceipt({
      url: 'https://lspd.gta.world/portal/records/coroner-report',
      bodyHead: 'Send to One employee Medical Examiner Case Submission',
    }).received).toBe(false);
    expect(detectReceipt({
      url: 'https://lspd.gta.world/portal/records/coroner-report',
      bodyHead: 'This field is required Decedent STATUS Draft',
    }).received).toBe(false);
    expect(detectReceipt({}).received).toBe(false);
  });
});
