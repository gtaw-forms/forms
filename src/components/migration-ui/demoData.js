// Migration UI — SAMPLE DATA for local preview only.
//
// These records are entirely fictional and exist so the Morgue Records and
// LEO Reports views can be reviewed without OAuth or a deployed backend.
// They are only used on a localhost/dev build (see `isLocalPreview` in
// viewModel.js) and are always labelled "Sample" in the UI. They are never
// written to the real IndexedDB cache and never sent to the audit log.

const at = (day, hour, minute) => Date.UTC(2026, 9, day, hour, minute);

// Inline SVG placeholders so the sample gallery actually renders (no network).
const demoPhoto = (label, fill) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420"><rect width="100%" height="100%" fill="${fill}"/><text x="28" y="52" fill="#f2f2f4" font-family="Segoe UI, Arial" font-size="24">${label}</text><text x="28" y="90" fill="#9aa0a6" font-family="Segoe UI, Arial" font-size="16">Sample image — local preview</text></svg>`,
)}`;

const coronerValues = (over) => ({
  dateTime: '', pronouncedTimeOfDeath: '', additionalstaff: [],
  ReportRequested: true, requestingOfficer: '', department: 'lspd',
  decedentName: '', decedentOOC: '', typeOfDeath: 'PK', mannerOfDeath: 'Homicide',
  probableCauseOfDeath: '', synopsis: '', evidenceLocker: false, evidenceLockerItems: '',
  scenePhotosBBCode: [], additionalPhotos: [], additionalPhotos_narrative: '',
  coronerEmployee: 'Coroner Investigator John Doe (SN: 5573)',
  coronerRank: 'Coroner Investigator', coronerBadge: '5573', date: '', ...over,
});

function demoReport({ title, timestamp, values, formId = 'coroner-report', formName = 'Coroner Report' }) {
  return {
    success: true,
    report: {
      authorName: values.coronerEmployee,
      formId,
      formName,
      originalKey: title,
      timestamp,
      data: values,
    },
    bbCode: '',
  };
}

const row = ({ key, title, timestamp, department, requestingOfficer, decedentName, authorName, formId = 'coroner-report', formName = 'Coroner Report' }) => ({
  key,
  author: 'Demo_Author',
  authorName,
  formId,
  formName,
  title,
  timestamp,
  updatedAt: timestamp,
  department,
  requestingOfficer,
  decedentName,
  forwarded: true,
  demo: true,
  hasBbCode: false,
});

const LEO_1 = coronerValues({
  dateTime: '2026-10-17T21:40:00',
  pronouncedTimeOfDeath: '2026-10-17T22:05:00',
  decedentName: 'John Doe',
  decedentOOC: 'JohnDoe_1999',
  typeOfDeath: 'PK',
  mannerOfDeath: 'Homicide',
  placeOfDeath: '123 Grove Street, Davis',
  probableCauseOfDeath: 'Gunshot wound to the chest',
  synopsis: 'Decedent was found unresponsive inside a parked sedan. A single casing was recovered near the driver-side door.',
  department: 'lspd',
  requestingOfficer: 'Sergeant Maria Reyes',
  additionalstaff: ['Jane Rider'],
  evidenceLocker: true,
  evidenceLockerItems: 'EL#2026-104',
  scenePhotosBBCode: [demoPhoto('Scene photo 1 — 123 Grove Street', '#243244')],
  additionalPhotos: [demoPhoto('Morgue screen — John Doe', '#3a2b2b')],
  date: '10/17/2026',
});

const LEO_2 = coronerValues({
  dateTime: '2026-10-16T09:10:00',
  pronouncedTimeOfDeath: '2026-10-16T09:35:00',
  decedentName: 'Elena Vasquez',
  decedentOOC: 'ElenaV_9',
  typeOfDeath: 'CK',
  mannerOfDeath: 'Accidental',
  placeOfDeath: 'Route 68, Harmony',
  probableCauseOfDeath: 'Blunt force trauma — single-vehicle collision',
  synopsis: 'Vehicle left the roadway and struck a rock face. No other occupants. Next of kin notified through LSSD.',
  department: 'lssd',
  requestingOfficer: 'Deputy Ana Ruiz',
  date: '10/16/2026',
});

const LEO_3 = coronerValues({
  dateTime: '2026-10-15T16:25:00',
  pronouncedTimeOfDeath: '2026-10-15T16:50:00',
  decedentName: 'Marcus Webb',
  decedentOOC: 'MarcusW_04',
  typeOfDeath: 'PK',
  mannerOfDeath: 'Homicide',
  placeOfDeath: 'Bolingbroke Penitentiary — Yard B',
  probableCauseOfDeath: 'Multiple stab wounds',
  synopsis: 'Decedent located in the yard during lockdown. Incident captured on CCTV; SADCR internal affairs notified.',
  department: 'sadcr',
  requestingOfficer: 'Lieutenant Harold Briggs',
  date: '10/15/2026',
});

const LEO_4 = coronerValues({
  dateTime: '2026-10-14T11:05:00',
  pronouncedTimeOfDeath: '2026-10-14T11:30:00',
  decedentName: 'Robert Hale',
  decedentOOC: 'RobHale77',
  typeOfDeath: 'CK',
  mannerOfDeath: 'Undetermined',
  placeOfDeath: 'Mount Chiliad trail',
  probableCauseOfDeath: 'Pending toxicology',
  synopsis: 'Hiking party found the decedent off-trail. A note was recovered and logged into evidence for DA review.',
  department: 'dao',
  requestingOfficer: "ADA Laura Chen",
  evidenceLocker: true,
  evidenceLockerItems: 'EL#2026-098',
  date: '10/14/2026',
});

// Generic LSPD mass-fatality sample (two decedents, one incident). Keeps the
// LEO-sample invariants: ReportRequested true, originalKey === row title.
const MASS_1 = {
  ReportRequested: true,
  placeOfDeath: 'Grove Street, Davis',
  dateTime: '2026-10-13T20:15:00',
  date: '10/13/2026',
  department: 'lspd',
  requestingOfficer: 'Sergeant Maria Reyes',
  coronerEmployee: 'Alyson Frost',
  coronerRank: 'Chief Deputy Medical Examiner',
  coronerBadge: '5573',
  synopsis: 'Two decedents from a single drive-by shooting outside a corner store. Scene secured by LSPD patrol; both pronounced at the scene.',
  decedents: [
    {
      decedentName: 'John Doe',
      decedentOOC: 'JohnDoe_1999',
      typeOfDeath: 'PK',
      mannerOfDeath: 'Homicide',
      probableCauseOfDeath: 'Gunshot wounds to the torso',
      pronouncedTimeOfDeath: '2026-10-13T20:40:00',
      synopsis: 'Multiple entry wounds, no exits. Three casings recovered nearby.',
      scenePhotos: [demoPhoto('Scene photo 1 — Grove Street storefront', '#243244')],
    },
    {
      decedentName: 'Jane Doe',
      decedentOOC: 'JaneDoe_2001',
      typeOfDeath: 'PK',
      mannerOfDeath: 'Homicide',
      probableCauseOfDeath: 'Gunshot wound to the head',
      pronouncedTimeOfDeath: '2026-10-13T20:42:00',
      synopsis: 'Single wound. No casings beside the body; likely moved post-incident.',
      scenePhotos: [],
    },
  ],
};

export const DEMO_LEO_ROWS = [
  row({
    key: 'demo-leo-1', title: '[PK] John Doe ((JohnDoe_1999)) - 10/17/2026', timestamp: at(17, 21, 40),
    department: 'lspd', requestingOfficer: 'Sergeant Maria Reyes', decedentName: 'John Doe',
    authorName: 'Coroner Investigator John Doe (SN: 5573)',
  }),
  row({
    key: 'demo-leo-2', title: '[CK] Elena Vasquez ((ElenaV_9)) - 10/16/2026', timestamp: at(16, 9, 10),
    department: 'lssd', requestingOfficer: 'Deputy Ana Ruiz', decedentName: 'Elena Vasquez',
    authorName: 'Medical Examiner Alyson Frost (SN: 1102)',
  }),
  row({
    key: 'demo-leo-3', title: '[PK] Marcus Webb ((MarcusW_04)) - 10/15/2026', timestamp: at(15, 16, 25),
    department: 'sadcr', requestingOfficer: 'Lieutenant Harold Briggs', decedentName: 'Marcus Webb',
    authorName: 'Coroner Investigator John Doe (SN: 5573)',
  }),
  row({
    key: 'demo-leo-4', title: '[CK] Robert Hale ((RobHale77)) - 10/14/2026', timestamp: at(14, 11, 5),
    department: 'dao', requestingOfficer: 'ADA Laura Chen', decedentName: 'Robert Hale',
    authorName: 'Medical Examiner Alyson Frost (SN: 1102)',
  }),
  row({
    key: 'demo-mass-1', title: '[Mass Fatality Report] John Doe, Jane Doe - 10/13/2026', timestamp: at(13, 20, 15),
    department: 'lspd', requestingOfficer: 'Sergeant Maria Reyes', decedentName: 'John Doe, Jane Doe',
    authorName: 'Alyson Frost',
    formId: 'mass-ftality-test', formName: 'Mass Fatality',
  }),
];

export const DEMO_LEO_PAYLOADS = {
  'demo-leo-1': demoReport({ key: 'demo-leo-1', title: DEMO_LEO_ROWS[0].title, timestamp: at(17, 21, 40), values: LEO_1 }),
  'demo-leo-2': demoReport({ key: 'demo-leo-2', title: DEMO_LEO_ROWS[1].title, timestamp: at(16, 9, 10), values: LEO_2 }),
  'demo-leo-3': demoReport({ key: 'demo-leo-3', title: DEMO_LEO_ROWS[2].title, timestamp: at(15, 16, 25), values: LEO_3 }),
  'demo-leo-4': demoReport({ key: 'demo-leo-4', title: DEMO_LEO_ROWS[3].title, timestamp: at(14, 11, 5), values: LEO_4 }),
  'demo-mass-1': demoReport({
    key: 'demo-mass-1', title: DEMO_LEO_ROWS[4].title, timestamp: at(13, 20, 15), values: MASS_1,
    formId: 'mass-ftality-test', formName: 'Mass Fatality',
  }),
};

export const DEMO_MORGUE_RECORDS = [
  {
    caseId: '90412',
    name: 'Dana Whitfield',
    sex: 'Female',
    identified: 'Yes',
    location: 'Vinewood Hills',
    timeOfDeath: 'Friday, 16 October 2026 03:12:44',
    causeOfDeath: 'Fall from height',
    dnaProfile: 'DNA-7F21AC',
    estimatedAge: '34 years',
    tattoos: 'Small rose, left wrist',
    bac: '0.04%',
    narcotics: 'None',
    bullets: [],
    findings: [
      { time: '03:12:44', type: 'Blunt force trauma', part: 'Head', dist: '—' },
      { time: '03:12:44', type: 'Fracture', part: 'Ribs L2-L5', dist: '—' },
    ],
    physicalDescription: 'Well-nourished adult female, 172 cm. Abrasions consistent with a witnessed fall from the hiking trail.',
    adminNote: '',
    lastUpdated: at(16, 3, 30),
  },
  {
    caseId: '90398',
    name: 'Tom Beckett',
    sex: 'Male',
    identified: 'Yes',
    location: 'Strawberry Ave',
    timeOfDeath: 'Thursday, 15 October 2026 22:47:10',
    causeOfDeath: 'Drive-by shooting',
    dnaProfile: 'DNA-3A88E1',
    estimatedAge: '29 years',
    tattoos: 'None recorded',
    bac: '0.00%',
    narcotics: 'Negative',
    bullets: [
      { type: 'Pistol (9mm)', id: '1' },
      { type: 'Pistol (9mm)', id: '2' },
    ],
    findings: [
      { time: '22:47:10', type: 'Gunshot wound', part: 'Chest', dist: '12m' },
      { time: '22:47:10', type: 'Hemothorax', part: 'Bilateral', dist: '—' },
    ],
    physicalDescription: 'Adult male, 181 cm. Two entry wounds, no exit wounds; projectiles recovered during autopsy.',
    adminNote: 'Bodies released to funeral home 17 Oct 2026.',
    lastUpdated: at(15, 23, 5),
  },
  {
    caseId: '90377',
    name: 'Unknown (( Priya Nair ))',
    sex: 'Female',
    identified: 'No',
    location: 'Palomino Highlands',
    timeOfDeath: 'Wednesday, 14 October 2026 18:05:33',
    causeOfDeath: 'Single-vehicle collision',
    dnaProfile: 'DNA-90C4B2',
    estimatedAge: '40-45 years',
    tattoos: 'Tribal band, right forearm',
    bac: '0.11%',
    narcotics: 'Traces of cannabis',
    bullets: [],
    findings: [
      { time: '18:05:33', type: 'Blunt force trauma', part: 'Torso', dist: '—' },
      { time: '18:05:33', type: 'Laceration', part: 'Scalp', dist: '—' },
    ],
    physicalDescription: 'Adult female, 165 cm. Vehicle vs. rock face; positive identification pending a dental record comparison.',
    adminNote: 'Awaiting next of kin confirmation before release.',
    lastUpdated: at(14, 18, 40),
  },
  {
    caseId: '90351',
    name: 'Unknown',
    sex: 'Male',
    identified: 'No',
    location: 'Sandy Shores outskirts',
    timeOfDeath: 'Tuesday, 13 October 2026 07:20:02',
    causeOfDeath: 'Decomposition — cause pending',
    dnaProfile: 'DNA-1B7E44',
    estimatedAge: 'Unknown',
    tattoos: 'None recorded',
    bac: 'N/A',
    narcotics: 'Pending toxicology',
    bullets: [],
    findings: [],
    physicalDescription: 'Advanced decomposition. No identifying documents recovered at the scene. Dental charting requested.',
    adminNote: 'John/Jane Doe pending. No autopsy findings recorded yet.',
    lastUpdated: at(13, 7, 45),
  },
];

export function findDemoLeoPayload(key) {
  return DEMO_LEO_PAYLOADS[key] || null;
}

// ── Records-feed samples (local preview) ──
// The coroner LEO rows double as the records feed: same row shape the feed
// renders (author/key/title/timestamp/formId) and openable through the same
// payloads. Localhost-only, labelled "Sample", never cached, never audited.

/** Filter the sample rows like the feed would (formId + free-text query). */
export function filterDemoRecords({ formId = '', q = '' } = {}) {
  const needle = String(q || '').trim().toLowerCase();
  return DEMO_LEO_ROWS.filter((row) => {
    if (formId && row.formId !== formId) return false;
    if (!needle) return true;
    const hay = [row.title, row.decedentName, row.requestingOfficer, row.authorName, row.department]
      .filter(Boolean).join(' ').toLowerCase();
    return hay.includes(needle);
  });
}

/** Sample payload for a records-feed open (null unless it is a sample). */
export function findDemoRecordPayload(author, key) {
  if (author !== 'Demo_Author') return null;
  return DEMO_LEO_PAYLOADS[key] || null;
}
