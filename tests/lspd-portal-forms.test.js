import { describe, it, expect } from 'vitest';
import {
  lspdFormsDryRun,
  PORTAL_FORMS,
  FIELD_ANCHORS,
  ROW_ANCHORS,
  MASS_FATALITY_FORM_IDS,
  MASS_FATALITY_ROW_COLUMNS,
  mapManner,
  mapDeathType,
  mapEvidenceLocker,
  mapMassEvidenceLocker,
  stripBbCode,
  pickSingleRecipient,
  extractRecipientOptions,
  splitDateTime,
  extractTime,
  normalizeTextList,
  normalizeUrlList,
  buildCoronerFormPayload,
  buildMedicalExaminerPayload,
  buildMassFatalityPayload,
  detectReceipt,
  applyPortalFieldLimit,
  normalizePortalText,
  isMassFatalityFormId,
  ME_APPROVED_BY,
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
    // Physical-item lists keep repeats: 9 projectiles can share 2 serials.
    expect(normalizeTextList(['a', 'a', 'b'], { dedupe: false })).toEqual(['a', 'a', 'b']);
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

  it('keeps every recovered metal object, including repeated descriptions (#10492: 9 projectiles, 2 serials)', () => {
    const casings = [
      'Bullet found with striation marks - 9mm #290284483',
      'Bullet found with striation marks - 9mm #290284483',
      'Bullet found with striation marks - 5.56mm #290684439',
      'Bullet found with striation marks - 5.56mm #290684439',
      'Bullet found with striation marks - 9mm #290284483',
      'Bullet found with striation marks - 5.56mm #290684439',
      'Bullet found with striation marks - 9mm #290284483',
      'Bullet found with striation marks - 5.56mm #290684439',
      'Bullet found with striation marks - 5.56mm #290684439',
    ];
    const r = buildMedicalExaminerPayload(autopsyData({ casings }), meCtx());
    const field = r.fields.find((f) => f.label === 'Metal Objects Extracted');
    expect(field.value.split('\n')).toHaveLength(9);
    expect(field.value.split('\n').filter((l) => l.includes('9mm'))).toHaveLength(4);
  });

  it('falls back to the examiner causeOfDeath narrative when the causes list is empty (#10461)', () => {
    const r = buildMedicalExaminerPayload(
      autopsyData({ deathCausesListItems: '', causeOfDeath: 'Multiple gunshot wounds to torso and head' }),
      meCtx(),
    );
    expect(r.ok).toBe(true);
    expect(r.fields.filter((f) => f.label === 'Cause of Death')[0].value)
      .toBe('Multiple gunshot wounds to torso and head');
  });

  it('still aborts when both the causes list and the narrative are empty', () => {
    const r = buildMedicalExaminerPayload(
      autopsyData({ deathCausesListItems: '', causeOfDeath: '' }),
      meCtx(),
    );
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/Cause of Death is empty/);
  });

  it('pins the standing approver policy (Chief Medical Examiner)', () => {
    expect(ME_APPROVED_BY).toBe('Chief Medical Examiner Anne Carter');
    // Builder-level fail-closed stays: callers supply the constant.
    const r = buildMedicalExaminerPayload(autopsyData(), { ...meCtx(), approvedBy: ME_APPROVED_BY });
    expect(r.ok).toBe(true);
    expect(r.fields.filter((f) => f.label === 'Approved By')[0].value).toBe(ME_APPROVED_BY);
  });

  it('maps Accidental manner and empty-metal honestly', () => {    const r = buildMedicalExaminerPayload(
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

describe('lspdPortalForms field limits', () => {
  it('normalises CRLF/CR to LF like a textarea does', () => {
    expect(normalizePortalText('a\r\nb\rc\nd')).toBe('a\nb\nc\nd');
    expect(normalizePortalText(null)).toBe('');
  });

  it('passes short values through untouched', () => {
    expect(applyPortalFieldLimit('short', 400)).toEqual({ value: 'short', truncated: false, limit: 400 });
  });

  it('truncates to the portal cap (Physical Description is 400)', () => {
    const text = 'x'.repeat(403);
    const r = applyPortalFieldLimit(text, 400);
    expect(r.truncated).toBe(true);
    expect(r.value).toHaveLength(400);
    expect(r.value).toBe(text.slice(0, 400));
  });

  it('treats 0 / unknown limits as unlimited', () => {
    expect(applyPortalFieldLimit('abc', 0)).toEqual({ value: 'abc', truncated: false, limit: 0 });
    expect(applyPortalFieldLimit('abc', NaN).value).toBe('abc');
    expect(applyPortalFieldLimit(null, 100).value).toBe('');
  });
});

describe('lspdPortalForms time parsing', () => {
  it('never reads a bare 4-digit time as a year (was 00:00)', () => {
    expect(extractTime('2134')).toEqual({ ok: true, time: '21:34' });
    expect(extractTime('0800')).toEqual({ ok: true, time: '08:00' });
    expect(splitDateTime('2134').ok).toBe(false);
  });

  it('accepts the formats found in historical reports', () => {
    expect(extractTime('16:12')).toEqual({ ok: true, time: '16:12' });
    expect(extractTime('2026-10-17T22:35:00')).toEqual({ ok: true, time: '22:35' });
    expect(extractTime('8.20pm')).toEqual({ ok: true, time: '20:20' });
    expect(extractTime('7:41 PM')).toEqual({ ok: true, time: '19:41' });
    expect(extractTime('8pm')).toEqual({ ok: true, time: '20:00' });
    expect(extractTime('12am')).toEqual({ ok: true, time: '00:00' });
    expect(extractTime('23/JAN/2026 - 19:41')).toEqual({ ok: true, time: '19:41' });
    expect(extractTime('15 Nov 2026 20:27')).toEqual({ ok: true, time: '20:27' });
  });

  it('refuses placeholders and out-of-range values instead of guessing', () => {
    expect(extractTime('DD/MM/YYYY - HH:mm').ok).toBe(false);
    expect(extractTime('2400').ok).toBe(false);
    expect(extractTime('13:99pm').ok).toBe(false);
    expect(extractTime('').ok).toBe(false);
  });

  it('routes the mass-fatality form ids away from the coroner builder', () => {
    expect(isMassFatalityFormId('mass-fatality')).toBe(true);
    expect(isMassFatalityFormId('mass-ftality-test')).toBe(true);
    expect(isMassFatalityFormId('coroner-report')).toBe(false);
    expect(isMassFatalityFormId(undefined)).toBe(false);
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

const massDec = (over = {}) => ({
  decedentName: 'Charles Gaeta',
  decedentOOC: 'Charles Gaeta',
  evidenceLockerID: 'EV-20261115-850',
  typeOfDeath: 'CK',
  synopsis: 'Eleven 9mm wounds to the chest, stomach, arm, hand and head.',
  pronouncedTimeOfDeath: '15/11/2026 20:05',
  probableCauseOfDeath: 'Gunshot Wounds',
  mannerOfDeath: 'Homicide',
  scenePhotos: ['https://example.test/scene-1.jpg', 'https://example.test/scene-2.jpg'],
  additionalImages: ['https://example.test/ooc-1.jpg'],
  additionalImages_narrative: '',
  ...over,
});

const massData = (over = {}) => ({
  coronerEmployee: 'Alyson Frost',
  coronerRank: 'Chief Deputy Medical Examiner',
  coronerBadge: '5573',
  dateTime: '2026-11-15T20:27',
  department: 'lspd',
  requestingOfficer: 'Joyce Pawironadi',
  placeOfDeath_display: 'Legion Square',
  placeOfDeath: '[url=https://maps.example.test/1]Legion Square[/url]',
  decedents: [massDec(), massDec({
    decedentName: 'Anthony Sorrentino',
    decedentOOC: 'Tony_S',
    evidenceLockerID: '',
    typeOfDeath: 'PK',
    mannerOfDeath: 'Accidental',
    pronouncedTimeOfDeath: '23/JAN/2026 - 19:41',
    scenePhotos: [],
    additionalImages: [],
  })],
  synopsis: 'Two decedents found unresponsive in a parked sedan on Legion Square.',
  ...over,
});

describe('lspdPortalForms — mass-fatality registry', () => {
  it('registers the form path + recipients endpoint', () => {
    expect(PORTAL_FORMS['mass-fatality'].path).toBe('/portal/records/mass-fatality-report');
    expect(PORTAL_FORMS['mass-fatality'].recipientsPath).toBe('/portal/liaison/mass-fatality-report/recipients');
    expect(MASS_FATALITY_FORM_IDS).toEqual(['mass-fatality', 'mass-ftality-test']);
  });

  it('defines the 14 fillable row columns (ooc_heading is read-only)', () => {
    const keys = MASS_FATALITY_ROW_COLUMNS.map((c) => c.key);
    expect(keys).toEqual([
      'decedent', 'time_of_death', 'manner_of_death', 'probable_cause',
      'evidence_locker', 'injuries_notes',
      'scene_photo_1', 'scene_photo_2', 'scene_photo_3',
      'type_of_death', 'player_ooc_name',
      'ooc_image_1', 'ooc_image_2', 'ooc_image_3',
    ]);
    expect(keys).not.toContain('ooc_heading');
  });
});

describe('lspdPortalForms — mass-fatality helpers', () => {
  it('unwraps [url] BBCode place names, strips the rest', () => {
    expect(stripBbCode('[url=https://maps.example.test/1]Legion Square[/url]')).toBe('Legion Square');
    expect(stripBbCode('Legion Square')).toBe('Legion Square');
    expect(stripBbCode('[b]Bold[/b] alley')).toBe('Bold alley');
    expect(stripBbCode('')).toBe('');
    expect(stripBbCode(null)).toBe('');
  });

  it('derives the locker from the evidence ID (non-empty means used)', () => {
    expect(mapMassEvidenceLocker('EV-20261115-850')).toBe('Used');
    for (const v of ['', '   ', undefined, null, false]) {
      expect(mapMassEvidenceLocker(v)).toBe('Not used');
    }
  });
});

describe('lspdPortalForms — mass-fatality payload', () => {
  it('builds a complete 2-decedent field list with unique anchored labels', () => {
    const r = buildMassFatalityPayload(massData());
    expect(r.ok).toBe(true);
    expect(r.warnings).toEqual([]);
    const byLabel = (l) => r.fields.filter((f) => f.label === l);
    expect(byLabel('Incident location')[0]).toMatchObject({ kind: 'text', value: 'Legion Square' });
    expect(byLabel('Dispatched')).toHaveLength(2);
    expect(byLabel('Dispatched').map((f) => f.kind).sort()).toEqual(['date', 'time']);
    expect(byLabel('Rank / badge')[0].value).toBe('Chief Deputy Medical Examiner (SN: 5573)');
    expect(byLabel('Scene overview')[0]).toMatchObject({ kind: 'textarea' });
    // Fixed decedent 1: mapped selects + derived locker + real time parse.
    expect(byLabel('Decedent 1 — Pronounced time of death')[0].value).toBe('20:05');
    expect(byLabel('Decedent 1 — Manner of death')[0]).toMatchObject({ kind: 'select', value: 'Homicide' });
    expect(byLabel('Decedent 1 — Evidence locker')[0].value).toBe('Used');
    expect(byLabel('Decedent 1 — Type of death')[0]).toMatchObject({ value: 'CK' });
    // Fixed decedent 2: accident maps, PK maps, empty locker ID means Not used.
    expect(byLabel('Decedent 2 — Pronounced time of death')[0].value).toBe('19:41');
    expect(byLabel('Decedent 2 — Manner of death')[0].value).toBe('Accident');
    expect(byLabel('Decedent 2 — Evidence locker')[0].value).toBe('Not used');
    expect(byLabel('Decedent 2 — Type of death')[0].value).toBe('Non-CK');
    // Fixed URL lists grow unbounded via the rows kind (no cap).
    const d1scene = r.fields.find((f) => f.rowLabel === 'Decedent 1 scene photos');
    expect(d1scene.values).toHaveLength(2);
    // Labels are unique per section (portal labels repeat, anchors do not) —
    // the only shared label is Dispatched (date + time share one anchor).
    const labels = r.fields.map((f) => f.label || `${f.section}/${f.rowLabel || f.rowsKey}`);
    const dupes = labels.filter((l, i) => labels.indexOf(l) !== i);
    expect(dupes).toEqual(['Dispatched']);
    // Empty URL lists are omitted (nothing to fill); OOC name stays optional.
    expect(r.fields.find((f) => f.rowLabel === 'Decedent 2 scene photos')).toBe(undefined);
    expect(r.fields.find((f) => f.rowLabel === 'Decedent 2 OOC images')).toBe(undefined);
    expect(byLabel('Decedent 2 — Player OOC name')[0].value).toBe('Tony_S');
    // No keyedRows for exactly two decedents.
    expect(r.fields.filter((f) => f.kind === 'keyedRows')).toHaveLength(0);
  });

  it('every emitted static label has a data-record-field anchor; every fixed list has a scope', () => {
    const r = buildMassFatalityPayload(massData());
    expect(r.ok).toBe(true);
    for (const f of r.fields) {
      if (f.kind === 'rows') {
        expect(ROW_ANCHORS['mass-fatality'][f.rowLabel], `row scope for "${f.rowLabel}"`).toBeTruthy();
        continue;
      }
      if (f.kind === 'keyedRows') continue;
      expect(FIELD_ANCHORS['mass-fatality'][f.label], `anchor for "${f.label}"`).toBeTruthy();
    }
  });

  it('prefers the display name but falls back to stripped BBCode; aborts when both are empty', () => {
    const noDisplay = buildMassFatalityPayload(massData({ placeOfDeath_display: '' }));
    expect(noDisplay.ok).toBe(true);
    expect(noDisplay.fields.find((f) => f.label === 'Incident location').value).toBe('Legion Square');
    const neither = buildMassFatalityPayload(massData({ placeOfDeath_display: '', placeOfDeath: '' }));
    expect(neither.ok).toBe(false);
    expect(neither.errors.join(' ')).toMatch(/Incident location/);
  });

  it('drops the badge suffix when no badge is recorded', () => {
    const r = buildMassFatalityPayload(massData({ coronerBadge: '' }));
    expect(r.ok).toBe(true);
    expect(r.fields.find((f) => f.label === 'Rank / badge').value).toBe('Chief Deputy Medical Examiner');
  });

  it('allows a blank decedent name (unknown) and blank OOC name (form takes unknowns)', () => {
    const r = buildMassFatalityPayload(massData({
      decedents: [massDec({ decedentName: '', decedentOOC: '' }), massDec({ decedentName: 'Jane Doe' })],
    }));
    expect(r.ok).toBe(true);
    expect(r.fields.find((f) => f.label === 'Decedent 1 — Decedent').value).toBe('');
  });

  it('puts decedents 3..N in keyedRows with the 3+3 URL cap as warnings', () => {
    const photos = ['https://example.test/1.jpg', 'https://example.test/2.jpg', 'https://example.test/3.jpg', 'https://example.test/4.jpg'];
    const r = buildMassFatalityPayload(massData({
      decedents: [massDec(), massDec(), massDec({ decedentName: 'Third Person', scenePhotos: photos, additionalImages: photos })],
    }));
    expect(r.ok).toBe(true);
    const keyed = r.fields.filter((f) => f.kind === 'keyedRows');
    expect(keyed).toHaveLength(1);
    expect(keyed[0].rowsKey).toBe('additional_decedents');
    expect(keyed[0].addText).toBe('Add another decedent');
    expect(keyed[0].items).toHaveLength(1);
    expect(keyed[0].items[0].scene_photo_3).toBe('https://example.test/3.jpg');
    expect(keyed[0].items[0].scene_photo_4).toBe(undefined);
    expect(keyed[0].items[0].ooc_image_3).toBe('https://example.test/3.jpg');
    expect(r.warnings).toHaveLength(2);
    expect(r.warnings.join(' ')).toMatch(/Decedent 3.*scene photos.*cap is 3/);
  });

  it('aborts a single-decedent report instead of duplicating a person (B1)', () => {
    const one = buildMassFatalityPayload(massData({ decedents: [massDec()] }));
    expect(one.ok).toBe(false);
    expect(one.errors.join(' ')).toMatch(/refusing to duplicate/);
    const none = buildMassFatalityPayload(massData({ decedents: [] }));
    expect(none.ok).toBe(false);
    expect(none.errors.join(' ')).toMatch(/refusing to duplicate/);
  });

  it('aborts with the decedent index on missing required decedent data (B3)', () => {
    const cause = buildMassFatalityPayload(massData({ decedents: [massDec(), massDec({ probableCauseOfDeath: '' })] }));
    expect(cause.ok).toBe(false);
    expect(cause.errors.join(' ')).toMatch(/Decedent 2.*probable cause/i);
    const injuries = buildMassFatalityPayload(massData({ decedents: [massDec({ synopsis: '' }), massDec()] }));
    expect(injuries.ok).toBe(false);
    expect(injuries.errors.join(' ')).toMatch(/Decedent 1.*injuries/i);
    const manner = buildMassFatalityPayload(massData({ decedents: [massDec({ mannerOfDeath: 'Pending' }), massDec()] }));
    expect(manner.ok).toBe(false);
    expect(manner.errors.join(' ')).toMatch(/Decedent 1.*manner/i);
    const type = buildMassFatalityPayload(massData({ decedents: [massDec(), massDec({ typeOfDeath: '??' })] }));
    expect(type.ok).toBe(false);
    expect(type.errors.join(' ')).toMatch(/Decedent 2.*type of death/i);
    const tod = buildMassFatalityPayload(massData({ decedents: [massDec({ pronouncedTimeOfDeath: 'sometime' }), massDec()] }));
    expect(tod.ok).toBe(false);
    expect(tod.errors.join(' ')).toMatch(/Decedent 1.*time of death/i);
  });

  it('aborts on missing report-level required fields', () => {
    expect(buildMassFatalityPayload(massData({ requestingOfficer: '' })).ok).toBe(false);
    expect(buildMassFatalityPayload(massData({ synopsis: '' })).errors.join(' ')).toMatch(/Scene overview/);
    expect(buildMassFatalityPayload(massData({ dateTime: '' })).errors.join(' ')).toMatch(/Dispatched/);
    expect(buildMassFatalityPayload(massData({ coronerEmployee: '' })).errors.join(' ')).toMatch(/Reporting officer/);
  });
});
