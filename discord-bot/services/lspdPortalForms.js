/**
 * lspdPortalForms.js — Playwright driver + pure field maps for the three LSPD
 * Community Portal liaison forms:
 *
 *   medical-examiner : /portal/records/medical-examiner-case-submission
 *                      recipients: GET /portal/liaison/medical-examiner-case-submission/recipients?q=
 *   coroner-report   : /portal/records/coroner-report
 *                      recipients: GET /portal/liaison/coroner-report/recipients?q=
 *   mass-fatality    : /portal/records/mass-fatality-report
 *                      recipients: GET /portal/liaison/mass-fatality-report/recipients?q=
 *
 * Provenance: recon 2026-11 (25 inputs / 0 selects / 0 CSRF on the ME form;
 * 17 inputs / 3 selects / 2 URL-row spawners on the coroner form; both
 * server-rendered, no shadow DOM, plain React-controlled inputs, dates
 * normalise, dynamic rows verified, no CAPTCHA/OTP in the fill path).
 *
 * Safety mirrors the mail path (lspdPortal.js): LSPD_FORMS_DRY_RUN defaults
 * to true (fill + screenshot + DOM dump, NEVER submit); a live submit
 * additionally requires the portal kill-switch to be lifted
 * (LSPD_PORTAL_ENABLED=true) AND an explicit live call. Fail closed
 * everywhere: unmapped manner aborts the send (never defaults), the
 * recipient must resolve to exactly one match (never guess), any required
 * field that does not read back aborts.
 *
 * Structure mirrors lspdReportRoute.js / lspdAutopsyNotice.js: dependency-free
 * pure builders at the top (unit-tested in tests/lspd-portal-forms.test.js,
 * safe for the static bot-import checker) and the Playwright driver below,
 * which lazy-imports playwright-adjacent modules inside the function body so
 * importing this file never needs a browser, discord.js or env.
 */

const TAG = 'LSPD-FORMS';
const PORTAL = 'https://lspd.gta.world';

/** Live-submit gate: dry-run unless explicitly disabled (mirrors the mail path default-true). */
export function lspdFormsDryRun() {
  return process.env.LSPD_FORMS_DRY_RUN !== 'false';
}

/**
 * Mass Fatality reports use their own portal form
 * (/portal/records/mass-fatality-report), built by
 * buildMassFatalityPayload below. Callers must not feed a mass report into
 * the single-decedent coroner-report builder — it aborts on the missing
 * single-decedent fields. Note the legacy typo formId is real.
 */
export const MASS_FATALITY_FORM_IDS = ['mass-fatality', 'mass-ftality-test'];

export function isMassFatalityFormId(formId) {
  return MASS_FATALITY_FORM_IDS.includes(String(formId ?? '').trim());
}

export const PORTAL_FORMS = {
  'medical-examiner': {
    path: '/portal/records/medical-examiner-case-submission',
    recipientsPath: '/portal/liaison/medical-examiner-case-submission/recipients',
    label: 'Medical Examiner Case Submission',
  },
  'coroner-report': {
    path: '/portal/records/coroner-report',
    recipientsPath: '/portal/liaison/coroner-report/recipients',
    label: 'Coroner Report',
  },
  'mass-fatality': {
    path: '/portal/records/mass-fatality-report',
    recipientsPath: '/portal/liaison/mass-fatality-report/recipients',
    label: 'Mass Fatality Report',
  },
};

// ── Pure maps ────────────────────────────────────────────────────────────────

/**
 * PHMC manner vocab (MANNER_OF_DEATH_OPTIONS) → portal manner vocab.
 * The ME form takes free text, the coroner form a 5-option select
 * (Homicide/Suicide/Accident/Natural/Undetermined) — both consume this.
 * Anything outside the known set ABORTS the send (never defaults).
 * @returns {{ok:boolean, value?:string, reason?:string}}
 */
export function mapManner(raw) {
  const s = String(raw ?? '').trim().toLowerCase();
  const table = {
    natural: 'Natural',
    accidental: 'Accident',
    accident: 'Accident',
    suicide: 'Suicide',
    homicide: 'Homicide',
    undetermined: 'Undetermined',
  };
  if (table[s]) return { ok: true, value: table[s] };
  return {
    ok: false,
    reason: `Unmapped manner of death "${String(raw ?? '').slice(0, 60)}" — aborting, refusing to default`,
  };
}

/**
 * PHMC typeOfDeath (PK/CK) → coroner-form "Type of death" (CK/Non-CK).
 * @returns {{ok:boolean, value?:string, reason?:string}}
 */
export function mapDeathType(raw) {
  const s = String(raw ?? '').trim().toUpperCase();
  if (s === 'CK') return { ok: true, value: 'CK' };
  if (s === 'PK') return { ok: true, value: 'Non-CK' };
  return {
    ok: false,
    reason: `Unmapped type of death "${String(raw ?? '').slice(0, 60)}" (want PK/CK) — aborting`,
  };
}

/**
 * Evidence locker flag: "Used" if and only if the PHMC checkbox is
 * explicitly true — never inferred from items text or anything else.
 */
export function mapEvidenceLocker(raw) {
  return raw === true ? 'Used' : 'Not used';
}

/**
 * Mass-fatality evidence locker derivation. PHMC mass reports carry no
 * boolean — only evidenceLockerID (a string like 'EV-20261115-850', empty
 * when the locker was not used). A non-empty string means the locker was
 * used; anything else means it was not. Stated explicitly because it is a
 * derivation, not a recorded fact (plan/lspd-mass-fatality-portal-plan.md
 * B3/contract row). Deliberately string-only (unlike the coroner's boolean
 * mapEvidenceLocker): the ID column never holds a boolean.
 */
export function mapMassEvidenceLocker(raw) {
  return typeof raw === 'string' && str(raw) ? 'Used' : 'Not used';
}

/**
 * Unwrap a PHMC place-of-death value to plain text for the portal's Incident
 * location. Historical reports store '[url=…]Name[/url]' (108/160); the
 * display name is preferred by callers, this is the fallback when it is
 * missing (47/160) — mandatory, the portal field is required.
 */
export function stripBbCode(raw) {
  return String(raw ?? '')
    .replace(/\[url=[^\]]*\]/gi, '')
    .replace(/\[\/url\]/gi, '')
    .replace(/\[[^\]]+\]/g, '')
    .trim();
}

/**
 * Exact-single-match-or-abort recipient predicate (pure half of the pick).
 * @returns {{ok:boolean, match?:string, matches?:string[], reason?:string}}
 */
export function pickSingleRecipient(candidates, want) {
  const w = String(want ?? '').trim().toLowerCase();
  if (!w) return { ok: false, reason: 'Empty recipient — refusing to guess' };
  const hits = [...new Set(
    (Array.isArray(candidates) ? candidates : [])
      .map((s) => String(s ?? '').trim())
      .filter((s) => s && s.toLowerCase().includes(w)),
  )];
  if (hits.length === 1) return { ok: true, match: hits[0] };
  if (hits.length === 0) {
    return {
      ok: false,
      reason: `No recipient match for "${String(want).trim()}" (${Array.isArray(candidates) ? candidates.length : 0} suggestion(s)) — aborting`,
    };
  }
  return {
    ok: false,
    matches: hits,
    reason: `Ambiguous recipient "${String(want).trim()}" (${hits.length} matches) — refusing to guess`,
  };
}

/**
 * Pull suggestion strings out of a recipients-endpoint JSON body.
 * Shape-agnostic (array, or {results|data|recipients|suggestions|users});
 * items may be strings or {name|label|characterName|value|username} objects.
 * Returns null when the shape is unrecognised (caller falls back to DOM).
 */
export function extractRecipientOptions(payload) {
  if (!payload) return null;
  const arr = Array.isArray(payload)
    ? payload
    : payload.results ?? payload.data ?? payload.recipients ?? payload.suggestions ?? payload.users ?? null;
  if (!Array.isArray(arr)) return null;
  const out = arr
    .map((it) => (typeof it === 'string'
      ? it
      : it?.name ?? it?.label ?? it?.characterName ?? it?.value ?? it?.username ?? ''))
    .map((s) => String(s ?? '').trim())
    .filter(Boolean);
  return out;
}

/**
 * Split a PHMC datetime into portal date + time strings.
 * Accepts ISO ('YYYY-MM-DDTHH:mm'), 'DD/MM/YYYY [HH:mm]' and anything
 * Date.parse handles ('25 Dec 2026' normalises per recon).
 * @returns {{ok:boolean, date?:string, time?:string, reason?:string}}
 */
export function splitDateTime(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return { ok: false, reason: 'Empty datetime — aborting' };
  // A bare 4-digit token is never a datetime: `new Date('2134')` parses it as
  // the YEAR 2134 and silently yields 00:00, which mis-filed times of death.
  // Refuse instead of guessing (callers that accept a bare time use extractTime).
  if (/^\d{4}$/.test(s)) return { ok: false, reason: `"${s}" is a bare time, not a datetime — aborting` };
  let y; let m; let d; let hh; let mm;
  let iso = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (iso) {
    [, y, m, d, hh = '', mm = ''] = iso;
  } else {
    const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ ,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (dmy) {
      [, d, m, y, hh = '', mm = ''] = dmy;
    } else {
      const t = new Date(s);
      if (Number.isNaN(t.getTime())) return { ok: false, reason: `Unparseable datetime "${s.slice(0, 60)}" — aborting` };
      y = String(t.getFullYear());
      m = String(t.getMonth() + 1);
      d = String(t.getDate());
      hh = String(t.getHours());
      mm = String(t.getMinutes());
    }
  }
  const pad = (v, n = 2) => String(v).padStart(n, '0');
  const date = `${pad(d)}/${pad(m)}/${y}`;
  const time = hh === '' ? '' : `${pad(hh)}:${pad(mm)}`;
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(date)) return { ok: false, reason: `Unparseable datetime "${s.slice(0, 60)}" — aborting` };
  return { ok: true, date, time };
}

/**
 * Time-of-death extractor: full datetime → HH:mm, bare times pass through.
 *
 * Deliberately never falls through to `new Date(...)` for a bare 4-digit token:
 * `new Date('2134')` is the YEAR 2134 and used to yield a silent '00:00'
 * (15 of 21 historical bare values would have filed as midnight). '2134' is
 * read as HHmm → 21:34.
 */
export function extractTime(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return { ok: false, reason: 'Empty time of death — aborting' };

  const to24 = (hRaw, mRaw, ap) => {
    let h = Number(hRaw);
    const m = Number(mRaw);
    if (!Number.isFinite(h) || !Number.isFinite(m) || m < 0 || m > 59) return null;
    if (ap) {
      const p = String(ap).toLowerCase();
      if (h < 1 || h > 12) return null;
      if (p === 'pm' && h !== 12) h += 12;
      if (p === 'am' && h === 12) h = 0;
    } else if (h < 0 || h > 23) {
      return null;
    }
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  // Bare HH:mm / HH.mm, optional am/pm — '16:12', '8.20pm', '7:41 PM'.
  let m = s.match(/^(\d{1,2})[:.](\d{2})(?::\d{2})?\s*(am|pm)?$/i);
  if (m) {
    const t = to24(m[1], m[2], m[3]);
    if (t) return { ok: true, time: t };
    return { ok: false, reason: `Time of death out of range "${s.slice(0, 40)}" — aborting` };
  }

  // Bare hour with meridiem — '8pm'.
  m = s.match(/^(\d{1,2})\s*(am|pm)$/i);
  if (m) {
    const t = to24(m[1], '00', m[2]);
    if (t) return { ok: true, time: t };
    return { ok: false, reason: `Time of death out of range "${s.slice(0, 40)}" — aborting` };
  }

  // Bare 4 digits = HHmm ('2134' → 21:34). Never a year.
  m = s.match(/^(\d{2})(\d{2})$/);
  if (m) {
    const t = to24(m[1], m[2], null);
    if (t) return { ok: true, time: t };
    return { ok: false, reason: `Time of death out of range "${s.slice(0, 40)}" — aborting` };
  }

  // A time embedded in a longer datetime — ISO, '23/JAN/2026 - 19:41',
  // '15 Nov 2026 20:27'. Take the LAST time-like token; placeholders like
  // 'DD/MM/YYYY - HH:mm' simply match nothing and abort.
  const embedded = [...s.matchAll(/(\d{1,2})[:.](\d{2})(?::\d{2})?\s*(am|pm)?/gi)];
  if (embedded.length) {
    const last = embedded[embedded.length - 1];
    const t = to24(last[1], last[2], last[3]);
    if (t) return { ok: true, time: t };
  }

  return { ok: false, reason: `Unparseable time of death "${s.slice(0, 60)}" — aborting` };
}

/**
 * Plain-text list normaliser: array or newline-separated string → trimmed,
 * non-empty lines (causes, findings, casings — NOT URLs).
 *
 * Dedupe is the default because form fields often repeat the same line; pass
 * `{ dedupe: false }` for lists where each entry is a distinct physical item —
 * e.g. Metal Objects Extracted, where 9 recovered projectiles can legitimately
 * carry only two distinct descriptions/serials and must stay 9.
 */
export function normalizeTextList(value, { dedupe = true } = {}) {
  const items = Array.isArray(value) ? value : String(value ?? '').split('\n');
  const out = [];
  for (const it of items) {
    const line = String(typeof it === 'string' ? it : it?.text ?? it?.value ?? '').trim();
    if (!line) continue;
    if (dedupe && out.includes(line)) continue;
    out.push(line);
  }
  return out;
}

/**
 * URL-list normaliser: array of strings / {url|src|image} objects, or a
 * newline-separated string; also unwraps [img]…[/img] BBCode (coroner
 * scenePhotosBBCode carries BBCode, the portal wants raw URLs).
 */
export function normalizeUrlList(value) {
  const items = Array.isArray(value) ? value : String(value ?? '').split('\n');
  const urls = [];
  for (const it of items) {
    const raw = typeof it === 'string' ? it : it?.url ?? it?.src ?? it?.image ?? '';
    for (const chunk of String(raw ?? '').split('\n')) {
      const found = chunk.match(/https?:\/\/[^\s[\]]+/g) || [];
      for (const u of found) {
        const clean = u.replace(/[),.]*$/, '').trim();
        if (clean && !urls.includes(clean)) urls.push(clean);
      }
    }
  }
  return urls;
}

/** Trim helper: '' for missing, never null. */
function str(v) {
  return String(v ?? '').trim();
}

// Field descriptor kinds: text | textarea | select | date | time | rows.
// rows = dynamic list under a section heading, grown via an add-button:
//   { kind:'rows', section, addButton, rowLabel, values[] }
function req(label, kind, value, extra = {}) {
  return { label, kind, value, required: true, ...extra };
}
function opt(label, kind, value, extra = {}) {
  return { label, kind, value: value ?? '', required: false, ...extra };
}

/**
 * Coroner-report form payload from a coroner-report record's data.
 * Decedent is optional (portal: leave blank if unknown); everything else
 * starred on the portal aborts when unmappable.
 * @returns {{ok:boolean, fields?:object[], errors?:string[]}}
 */
export function buildCoronerFormPayload(data = {}) {
  const errors = [];
  const fields = [];

  fields.push(opt('Decedent', 'text', data.decedentName));

  const dispatched = splitDateTime(data.dateTime);
  if (!dispatched.ok || !dispatched.time) errors.push(`Dispatched: ${dispatched.reason || 'needs date + time'}`);
  else {
    fields.push(req('Dispatched', 'date', dispatched.date));
    fields.push(req('Dispatched', 'time', dispatched.time));
  }

  const tod = extractTime(data.pronouncedTimeOfDeath);
  if (!tod.ok) errors.push(`Time of death: ${tod.reason}`);
  else fields.push(req('Time of death', 'time', tod.time));

  if (!str(data.placeOfDeath)) errors.push('Place of death is empty — aborting');
  else fields.push(req('Place of death', 'text', data.placeOfDeath));

  if (!str(data.coronerEmployee)) errors.push('Reporting officer (coronerEmployee) is empty — aborting');
  else fields.push(req('Reporting officer', 'text', data.coronerEmployee));

  const rankBadge = [str(data.coronerRank), str(data.coronerBadge) ? `(SN: ${str(data.coronerBadge)})` : '']
    .filter(Boolean).join(' ');
  if (!rankBadge) errors.push('Rank / badge is empty — aborting');
  else fields.push(req('Rank / badge', 'text', rankBadge));

  if (!str(data.requestingOfficer)) errors.push('Requesting officer is empty — refusing to file officer-less');
  else fields.push(req('Requesting officer', 'text', data.requestingOfficer));

  const manner = mapManner(data.mannerOfDeath);
  if (!manner.ok) errors.push(manner.reason);
  else fields.push(req('Manner of death', 'select', manner.value));

  if (!str(data.probableCauseOfDeath)) errors.push('Probable cause is empty — aborting');
  else fields.push(req('Probable cause', 'text', data.probableCauseOfDeath));

  if (!str(data.synopsis)) errors.push('Case synopsis is empty — aborting');
  else fields.push(req('Case synopsis', 'textarea', data.synopsis));

  fields.push(opt('Evidence locker', 'select', mapEvidenceLocker(data.evidenceLocker)));

  fields.push({
    kind: 'rows', section: 'Evidence & Photos', addButton: '+ Add another',
    rowLabel: 'Scene photos', values: normalizeUrlList(data.scenePhotosBBCode), required: false,
  });
  fields.push({
    kind: 'rows', section: 'Evidence & Photos', addButton: '+ Add another',
    rowLabel: 'Morgue screenshots', values: normalizeUrlList(data.additionalPhotos), required: false,
  });

  const dtype = mapDeathType(data.typeOfDeath);
  if (!dtype.ok) errors.push(dtype.reason);
  else fields.push(req('Type of death', 'select', dtype.value));

  if (!str(data.decedentOOC)) errors.push('Player OOC name is empty (portal requires it even for unknown IC identity) — aborting');
  else fields.push(req('Player OOC name', 'text', data.decedentOOC));

  if (errors.length) return { ok: false, errors };
  return { ok: true, fields };
}

// Fixed procedure lines, mirroring the PHMC autopsy BBCode template verbatim
// (the ME attests standard procedure; there is no per-report source for these).
const FIXED_CLOTHING = 'The body was not clothed and the clothing was not available at the time of autopsy.';
const FIXED_INCISION = 'The body cavities are entered through the standard coronal and the standard Y-shaped incisions.';
const FIXED_INTERNAL = 'Consistent with the stated cause of death, nothing out of the ordinary was observed.';
const FIXED_HISTOLOGY = 'Representative sections from various organs are preserved in one storage jar in %10 formalin.';
const FIXED_TOXICOLOGY = 'Femoral blood, EDTA blood, urine, stomach contents and vitreous have been submitted to the lab. A comprehensive screen was requested.';

/**
 * Fillable columns of the mass-fatality form's "Additional decedents" row
 * component (div[data-record-rows="additional_decedents"] →
 * div[data-record-row-entry] → div[data-record-row-cell="<key>"]). 14 of the
 * 15 schema columns take input; `ooc_heading` is a read-only heading with no
 * control and is never filled (verified in the 2026-11-17 probe).
 */
export const MASS_FATALITY_ROW_COLUMNS = [
  { key: 'decedent', kind: 'text', label: 'Decedent' },
  { key: 'time_of_death', kind: 'text', label: 'Pronounced time of death' },
  { key: 'manner_of_death', kind: 'select', label: 'Manner of death' },
  { key: 'probable_cause', kind: 'text', label: 'Probable cause' },
  { key: 'evidence_locker', kind: 'select', label: 'Evidence locker' },
  { key: 'injuries_notes', kind: 'textarea', label: 'Injuries / notes' },
  { key: 'scene_photo_1', kind: 'text', label: 'Scene photo 1' },
  { key: 'scene_photo_2', kind: 'text', label: 'Scene photo 2' },
  { key: 'scene_photo_3', kind: 'text', label: 'Scene photo 3' },
  { key: 'type_of_death', kind: 'select', label: 'Type of death' },
  { key: 'player_ooc_name', kind: 'text', label: 'Player OOC name' },
  { key: 'ooc_image_1', kind: 'text', label: 'OOC image 1' },
  { key: 'ooc_image_2', kind: 'text', label: 'OOC image 2' },
  { key: 'ooc_image_3', kind: 'text', label: 'OOC image 3' },
];

/**
 * Validate + normalise one mass-fatality decedent row. Shared by the two
 * fixed sections (Decedent 1/2) and the dynamic rows (Decedent 3..N) so both
 * layouts abort on exactly the same gaps. `n` is the 1-based decedent index
 * used in every error so the queue log names the row.
 * @returns {{ok:boolean, values?:object, errors:string[], warnings:string[]}}
 */
function massDecedentValues(d = {}, n = 0) {
  const errors = [];
  const warnings = [];
  const tag = `Decedent ${n}`;

  const tod = extractTime(d.pronouncedTimeOfDeath);
  if (!tod.ok) errors.push(`${tag}: time of death — ${tod.reason}`);
  const manner = mapManner(d.mannerOfDeath);
  if (!manner.ok) errors.push(`${tag}: manner of death — ${manner.reason}`);
  if (!str(d.probableCauseOfDeath)) errors.push(`${tag}: probable cause is empty — aborting`);
  if (!str(d.synopsis)) errors.push(`${tag}: injuries / notes (decedent synopsis) is empty — aborting`);
  const dtype = mapDeathType(d.typeOfDeath);
  if (!dtype.ok) errors.push(`${tag}: type of death — ${dtype.reason}`);

  const photos = normalizeUrlList(d.scenePhotos);
  const oocImages = normalizeUrlList(d.additionalImages);
  // Dynamic rows cap each URL list at 3 fixed columns (fixed sections grow
  // unbounded via "Add another"). Never mix evidence into prose — warn only.
  if (n > 2) {
    if (photos.length > 3) warnings.push(`${tag}: ${photos.length} scene photos, row cap is 3 — filing first 3`);
    if (oocImages.length > 3) warnings.push(`${tag}: ${oocImages.length} OOC images, row cap is 3 — filing first 3`);
  }

  if (errors.length) return { ok: false, errors, warnings };
  return {
    ok: true,
    errors,
    warnings,
    values: {
      name: str(d.decedentName),
      time: tod.time,
      manner: manner.value,
      cause: str(d.probableCauseOfDeath),
      locker: mapMassEvidenceLocker(d.evidenceLockerID),
      injuries: str(d.synopsis),
      photos,
      dtype: dtype.value,
      ooc: str(d.decedentOOC),
      oocImages,
    },
  };
}

/**
 * Mass-fatality form payload from a mass-fatality report's data.
 *
 * Layout contract (plan/lspd-mass-fatality-portal-plan.md): the portal fixes
 * exactly two required decedent sections; decedents 3..N go in the dynamic
 * "Additional decedents" rows (15 columns, 3+3 URL cap). Anything the portal
 * requires but the report lacks aborts with the decedent index — never
 * invented, never defaulted. Decedent name and Player OOC name stay optional
 * (the form's oocDetailsRequired is false; blank name = unknown).
 *
 * Field labels are unique per section ("Decedent 1 — …") because the portal
 * labels repeat ("Decedent", "Pronounced time of death" appear twice) — the
 * label fallback alone cannot disambiguate, so FIELD_ANCHORS carries one
 * anchor per unique label.
 *
 * @returns {{ok:boolean, fields?:object[], warnings?:string[], errors?:string[]}}
 */
export function buildMassFatalityPayload(data = {}) {
  const errors = [];
  const warnings = [];
  const fields = [];
  const decs = Array.isArray(data.decedents) ? data.decedents : [];

  if (!str(data.requestingOfficer)) errors.push('Requesting officer is empty — refusing to file officer-less');
  else fields.push(req('Requesting officer', 'text', data.requestingOfficer));

  const incidentLocation = str(data.placeOfDeath_display) || stripBbCode(data.placeOfDeath);
  if (!incidentLocation) errors.push('Incident location is empty (no placeOfDeath_display; placeOfDeath unwraps to nothing) — aborting');
  else fields.push(req('Incident location', 'text', incidentLocation));

  const dispatched = splitDateTime(data.dateTime);
  if (!dispatched.ok || !dispatched.time) errors.push(`Dispatched: ${dispatched.reason || 'needs date + time'}`);
  else {
    fields.push(req('Dispatched', 'date', dispatched.date));
    fields.push(req('Dispatched', 'time', dispatched.time));
  }

  if (!str(data.coronerEmployee)) errors.push('Reporting officer (coronerEmployee) is empty — aborting');
  else fields.push(req('Reporting officer', 'text', data.coronerEmployee));

  const rankBadge = [str(data.coronerRank), str(data.coronerBadge) ? `(SN: ${str(data.coronerBadge)})` : '']
    .filter(Boolean).join(' ');
  if (!rankBadge) errors.push('Rank / badge is empty — aborting');
  else fields.push(req('Rank / badge', 'text', rankBadge));

  if (!str(data.synopsis)) errors.push('Scene overview (synopsis) is empty — aborting');
  else fields.push(req('Scene overview', 'textarea', data.synopsis));

  // B1: the portal always renders Decedent 1 AND Decedent 2 with required
  // fields. A single-decedent report cannot fill Decedent 2 — refusing to
  // duplicate a person to satisfy the layout.
  if (decs.length < 2) {
    errors.push(`Report has ${decs.length} decedent(s); the LSPD form fixes two required decedent sections — refusing to duplicate (Decedent 2 has no source)`);
  }

  const fixed = [];
  for (let n = 1; n <= 2; n++) {
    const parsed = massDecedentValues(decs[n - 1] || {}, n);
    errors.push(...parsed.errors);
    warnings.push(...parsed.warnings);
    if (parsed.ok) fixed.push({ n, v: parsed.values });
  }

  for (const { n, v } of fixed) {
    const p = `Decedent ${n} —`;
    fields.push(opt(`${p} Decedent`, 'text', v.name));
    fields.push(req(`${p} Pronounced time of death`, 'text', v.time));
    fields.push(req(`${p} Manner of death`, 'select', v.manner));
    fields.push(req(`${p} Probable cause`, 'text', v.cause));
    fields.push(opt(`${p} Evidence locker`, 'select', v.locker));
    fields.push(req(`${p} Injuries / notes`, 'textarea', v.injuries));
    if (v.photos.length) {
      fields.push({
        kind: 'rows', section: `Decedent ${n}`, addButton: 'Add another',
        rowLabel: `Decedent ${n} scene photos`, values: v.photos,
      });
    }
    fields.push(req(`${p} Type of death`, 'select', v.dtype));
    fields.push(opt(`${p} Player OOC name`, 'text', v.ooc));
    if (v.oocImages.length) {
      fields.push({
        kind: 'rows', section: `Decedent ${n}`, addButton: 'Add another',
        rowLabel: `Decedent ${n} OOC images`, values: v.oocImages,
      });
    }
  }

  if (decs.length > 2) {
    const items = [];
    for (let n = 3; n <= decs.length; n++) {
      const parsed = massDecedentValues(decs[n - 1] || {}, n);
      errors.push(...parsed.errors);
      warnings.push(...parsed.warnings);
      if (!parsed.ok) continue;
      const v = parsed.values;
      const item = {
        decedent: v.name,
        time_of_death: v.time,
        manner_of_death: v.manner,
        probable_cause: v.cause,
        evidence_locker: v.locker,
        injuries_notes: v.injuries,
        type_of_death: v.dtype,
        player_ooc_name: v.ooc,
      };
      v.photos.slice(0, 3).forEach((u, i) => { item[`scene_photo_${i + 1}`] = u; });
      v.oocImages.slice(0, 3).forEach((u, i) => { item[`ooc_image_${i + 1}`] = u; });
      items.push(item);
    }
    if (items.length) {
      fields.push({
        kind: 'keyedRows', section: 'Additional decedents',
        rowsKey: 'additional_decedents', addText: 'Add another decedent',
        columns: MASS_FATALITY_ROW_COLUMNS, items,
      });
    }
  }

  if (errors.length) return { ok: false, errors, warnings };
  return { ok: true, fields, warnings };
}

/**
 * Standing approver for ME liaison filings (Nov 2026 policy): every Medical
 * Examiner case submission is approved by the Chief Medical Examiner.
 */
export const ME_APPROVED_BY = 'Chief Medical Examiner Anne Carter';

/**
 * Medical-examiner form payload from an autopsy record's data.
 * Manner lives in data.deathType on autopsy records (NOT mannerOfDeath).
 * @param {object} data — autopsy report data
 * @param {object} ctx — { caseNum, requestLink, requesterName, meName, approvedBy? }
 * @returns {{ok:boolean, fields?:object[], errors?:string[]}}
 */
export function buildMedicalExaminerPayload(data = {}, ctx = {}) {
  const errors = [];
  const fields = [];

  if (!str(ctx.caseNum)) errors.push('Case number is empty — aborting');
  else fields.push(req('Case', 'text', ctx.caseNum));

  if (!str(data.decedentName)) errors.push('Decedent is empty — aborting');
  else fields.push(req('Decedent', 'text', data.decedentName));

  if (!str(ctx.requestLink)) errors.push('Autopsy & Death Certificate Request link is empty — aborting');
  else fields.push(req('Autopsy & Death Certificate Request (PHMC link)', 'text', ctx.requestLink));

  const adt = splitDateTime(data.autopsyStartTime);
  if (!adt.ok || !adt.time) errors.push(`Date and Time of Autopsy: ${adt.reason || 'needs date + time'}`);
  else {
    fields.push(req('Date and Time of Autopsy', 'date', adt.date));
    fields.push(req('Date and Time of Autopsy', 'time', adt.time));
  }

  if (!str(ctx.requesterName)) errors.push('Requested By is empty — refusing to file officer-less');
  else fields.push(req('Requested By', 'text', ctx.requesterName));

  if (!str(data.dnaProfile)) errors.push('DNA Profile is empty — aborting');
  else fields.push(req('DNA Profile', 'text', data.dnaProfile));

  if (!str(data.placeOfDeath)) errors.push('Place of Death is empty — aborting');
  else fields.push(req('Place of Death', 'text', data.placeOfDeath));

  // Cause of Death: the findings list first; older-era reports leave it
  // empty and carry the examiner's own cause narrative in causeOfDeath
  // instead (e.g. #10461) — falling back to those exact words is faithful,
  // not invented. Abort only when both are empty.
  const causes = normalizeTextList(data.deathCausesListItems);
  if (causes.length) {
    fields.push(req('Cause of Death', 'textarea', causes.join('\n')));
  } else if (str(data.causeOfDeath)) {
    console.warn(`[${TAG}] Cause of Death: deathCausesListItems empty — filing examiner causeOfDeath narrative verbatim`);
    fields.push(req('Cause of Death', 'textarea', String(data.causeOfDeath)));
  } else {
    errors.push('Cause of Death is empty (no deathCausesListItems, no causeOfDeath) — aborting');
  }

  const manner = mapManner(data.deathType);
  if (!manner.ok) errors.push(`Manner of Death: ${manner.reason}`);
  else fields.push(req('Manner of Death', 'text', manner.value));

  if (!str(data.causeOfDeath)) errors.push('How Injury Occurred is empty — aborting');
  else fields.push(req('How Injury Occurred', 'textarea', data.causeOfDeath));

  const findingLines = normalizeTextList(data.anatomicSummaryListItems);
  fields.push({
    kind: 'rows', section: 'Anatomic Summary', addButton: '+ Add finding',
    rowLabel: 'Finding', values: findingLines,
    required: true,
  });
  if (!findingLines.length) {
    errors.push('Anatomic Summary has no findings — aborting');
  }

  if (!str(data.externalExamination)) errors.push('Physical Description (externalExamination) is empty — aborting');
  else {
    // LSPD raised the portal's Physical Description cap (it was 400). No limit is
    // declared now: the driver still honours a maxlength attribute if the portal
    // exposes one, and accepts a shorter read-back as a portal truncation. Pin a
    // number here (or via LSPD_ME_PHYS_DESC_LIMIT) only if LSPD publishes one.
    const physDesc = req('Physical Description', 'textarea', data.externalExamination);
    const configuredLimit = Number(process.env.LSPD_ME_PHYS_DESC_LIMIT);
    if (Number.isFinite(configuredLimit) && configuredLimit > 0) physDesc.limit = configuredLimit;
    fields.push(physDesc);
  }

  fields.push(opt('Clothing', 'textarea', str(data.clothing) || FIXED_CLOTHING));
  fields.push(opt('Initial Incision', 'textarea', str(data.initialIncision) || FIXED_INCISION));
  fields.push(opt('Internal Examination', 'textarea', str(data.internalExamination) || FIXED_INTERNAL));
  fields.push(opt('Histologic Sections', 'textarea', str(data.histologicSections) || FIXED_HISTOLOGY));
  fields.push(opt('Toxicology', 'textarea', str(data.toxicology) || FIXED_TOXICOLOGY));

  if (!str(data.bacLevel)) errors.push('BAC is empty — aborting');
  else fields.push(req('BAC', 'text', data.bacLevel));

  if (!str(data.narcoticTraces)) errors.push('Narcotics is empty — aborting');
  else fields.push(req('Narcotics', 'text', data.narcoticTraces));

  if (!str(data.RadiologyResult)) errors.push('Radiology is empty — aborting');
  else fields.push(req('Radiology', 'textarea', data.RadiologyResult));

  // Metal objects are distinct physical items: keep repeated descriptions
  // (a 9-projectile recovery can carry only 2 distinct serials).
  const metals = normalizeTextList(data.casings, { dedupe: false });
  fields.push(opt('Metal Objects Extracted', 'textarea', metals.length ? metals.join('\n') : 'None recovered.'));

  if (!str(data.synopsis)) errors.push('Opinion is empty — aborting');
  else fields.push(req('Opinion', 'textarea', data.synopsis));

  if (!str(ctx.meName)) errors.push('Performed By is empty — aborting');
  else fields.push(req('Performed By', 'text', ctx.meName));

  // Approver: the standing ME_APPROVED_BY policy supplies this at the call
  // sites below — the builder still refuses to invent one when missing.
  if (!str(ctx.approvedBy)) errors.push('Approved By has no source (no approver field on autopsy records) — supply ctx.approvedBy, refusing to invent one');
  else fields.push(req('Approved By', 'text', ctx.approvedBy));

  if (errors.length) return { ok: false, errors };
  return { ok: true, fields };
}

// ── Submit-receipt detection ───────────────────────────────────────────────
// LSPD renders the filing receipt AT the form path (ME: same URL + request
// ID suffix; coroner: same base path), so "navigated away" can never be the
// success signal — a prefix URL match reads every success as "still on the
// form" (shipped false-negatives, Nov 2026; a retrying queue would then file
// DUPLICATES). The receipt carries its own markers instead:
//   STATUS Received · FILED <date> · reference (CR-26-0001 style, else the
//   trailing request-ID URL segment) · "Delivered to the LSPD…"
// Pure: unit-tested in tests/lspd-portal-forms.test.js.
export function detectReceipt(dom = {}) {
  const url = String(dom.url || '');
  const text = String(dom.bodyText ?? dom.bodyHead ?? '');
  const received = /STATUS\s+Received/i.test(text) && /FILED/i.test(text);
  let reference = null;
  const cr = text.match(/\b([A-Z]{2,}-\d+-\d+)\b/);
  if (cr) {
    reference = cr[1];
  } else {
    const seg = url.split(/[?#]/)[0].replace(/\/+$/, '').split('/').pop() || '';
    if (/^[0-9a-zA-Z]{20,}$/.test(seg)) reference = seg;
  }
  return { received, reference };
}

// ── Driver ───────────────────────────────────────────────────────────────────

/** Stable portal anchors: div[data-record-field="…"] per control group. */
export const FIELD_ANCHORS = {
  'medical-examiner': {
    'Case': 'case',
    'Decedent': 'decedent',
    'Autopsy & Death Certificate Request (PHMC link)': 'autopsy_death_certificate_request_phmc_link',
    'Date and Time of Autopsy': 'date_and_time_of_autopsy',
    'Requested By': 'requested_by',
    'DNA Profile': 'dna_profile',
    'Place of Death': 'place_of_death',
    'Cause of Death': 'cause_of_death',
    'Manner of Death': 'manner_of_death',
    'How Injury Occurred': 'how_injury_occurred',
    'Physical Description': 'physical_description',
    'Clothing': 'clothing',
    'Initial Incision': 'initial_incision',
    'Internal Examination': 'internal_examination',
    'Histologic Sections': 'histologic_sections',
    'Toxicology': 'toxicology',
    'BAC': 'bac',
    'Narcotics': 'narcotics',
    'Radiology': 'radiology',
    'Metal Objects Extracted': 'metal_objects_extracted',
    'Opinion': 'opinion',
    'Performed By': 'performed_by',
    'Approved By': 'approved_by',
  },
  'coroner-report': {
    'Decedent': 'decedent',
    'Dispatched': 'dispatched',
    'Time of death': 'time_of_death',
    'Place of death': 'place_of_death',
    'Reporting officer': 'reporting_officer',
    'Rank / badge': 'rank_badge',
    'Requesting officer': 'requesting_officer',
    'Manner of death': 'manner_of_death',
    'Probable cause': 'probable_cause',
    'Case synopsis': 'case_synopsis',
    'Evidence locker': 'evidence_locker',
    'Type of death': 'type_of_death',
    'Player OOC name': 'player_ooc_name',
  },
  // Mass-fatality labels are unique per section ("Decedent 1 — …") because
  // the portal labels repeat ("Decedent", "Pronounced time of death" appear
  // under both fixed sections) — the label fallback alone cannot
  // disambiguate, so every field resolves through its anchor here.
  'mass-fatality': {
    'Incident location': 'incident_location',
    'Dispatched': 'dispatched',
    'Reporting officer': 'reporting_officer',
    'Rank / badge': 'rank_badge',
    'Requesting officer': 'requesting_officer',
    'Scene overview': 'scene_overview',
    'Decedent 1 — Decedent': 'd1_name',
    'Decedent 1 — Pronounced time of death': 'd1_time_of_death',
    'Decedent 1 — Manner of death': 'd1_manner_of_death',
    'Decedent 1 — Probable cause': 'd1_probable_cause',
    'Decedent 1 — Evidence locker': 'd1_evidence_locker',
    'Decedent 1 — Injuries / notes': 'd1_injuries_notes',
    'Decedent 1 — Type of death': 'd1_type_of_death',
    'Decedent 1 — Player OOC name': 'd1_player_ooc_name',
    'Decedent 2 — Decedent': 'd2_name',
    'Decedent 2 — Pronounced time of death': 'd2_time_of_death',
    'Decedent 2 — Manner of death': 'd2_manner_of_death',
    'Decedent 2 — Probable cause': 'd2_probable_cause',
    'Decedent 2 — Evidence locker': 'd2_evidence_locker',
    'Decedent 2 — Injuries / notes': 'd2_injuries_notes',
    'Decedent 2 — Type of death': 'd2_type_of_death',
    'Decedent 2 — Player OOC name': 'd2_player_ooc_name',
  },
};

/** Row-list anchors: div[data-record-field="…"] per URL group; the ME
 *  findings list has no field anchor — it lives in div[data-record-rows],
 *  as do the mass-fatality "Additional decedents" rows (filled by the
 *  keyedRows driver, not by this table). */
export const ROW_ANCHORS = {
  'coroner-report': {
    'Scene photos': 'scene_photos',
    'Morgue screenshots': 'morgue_screenshots',
  },
  'medical-examiner': {},
  'mass-fatality': {
    'Decedent 1 scene photos': 'd1_scene_photos',
    'Decedent 1 OOC images': 'd1_ooc_images',
    'Decedent 2 scene photos': 'd2_scene_photos',
    'Decedent 2 OOC images': 'd2_ooc_images',
  },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Resolve the control for a portal field.
 * Primary: the stable div[data-record-field="…"] anchor (inspected live on
 * both forms — immune to label/helper-copy drift). Label-anchored fallback
 * kept for unmapped fields; kind breaks same-label ties (Dispatched owns a
 * DD/MM/YYYY input AND an HH:mm input).
 */
async function resolveControl(page, form, label, kind) {
  const anchor = FIELD_ANCHORS[form]?.[label];
  const anchored = await page.evaluateHandle(([a, wantKind]) => {
    try {
      const root = document.querySelector(`[data-record-field="${CSS.escape(a)}"]`);
      if (!root) return null;
      const vis = (n) => n.getAttribute('type') !== 'hidden' && n.type !== 'hidden' && n.getClientRects().length > 0;
      const ctrls = Array.from(root.querySelectorAll('input, textarea, select')).filter(vis);
      if (!ctrls.length) return null;
      if (wantKind === 'select') return ctrls.find((c) => c.tagName === 'SELECT') || null;
      if (wantKind === 'date') {
        // Portal quirk: [data-date-input] is the wrapper div, not the input.
        const wrap = root.querySelector('[data-date-input]');
        const inner = wrap ? wrap.querySelector('input, textarea') : null;
        const visIn = (n) => n && n.getAttribute('type') !== 'hidden' && n.type !== 'hidden' && n.getClientRects().length > 0;
        return (visIn(inner) && inner) || ctrls[0];
      }
      if (wantKind === 'time') {
        const t = root.querySelector('[data-time-input]');
        const inner = t && t.tagName !== 'INPUT' ? t.querySelector('input') : t;
        const visIn = (n) => n && n.getAttribute('type') !== 'hidden' && n.type !== 'hidden' && n.getClientRects().length > 0;
        if (visIn(inner)) return inner;
        return ctrls[1] || ctrls[0];
      }
      return ctrls[0];
    } catch {
      return null;
    }
  }, [anchor || '__none__', kind]).catch(() => null);
  const anchoredEl = anchored ? await anchored.asElement() : null;
  if (anchoredEl) return anchoredEl;
  const handle = await page.evaluateHandle(([wantLabel, wantKind]) => {
    const norm = (s) => String(s || '').replace(/\*/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
    const want = norm(wantLabel);
    // Every short text that could label this control: proper <label>s,
    // accessible names, and ALL short preceding texts up the tree (the
    // portal puts helper copy between the label and the input, so the
    // first nearby text is usually NOT the label).
    const labelsOf = (n) => {
      const out = new Map(); // text -> closest depth found
      const push = (s, depth) => {
        const t = norm(s);
        if (t && t.length < 80 && !/submit|feedback|sign out/i.test(t) && !out.has(t)) out.set(t, depth);
      };
      const id = n.getAttribute('id');
      if (id) {
        const lb = document.querySelector(`label[for="${CSS.escape(id)}"]`);
        if (lb) push(lb.innerText, 0);
      }
      const wrap = n.closest('label');
      if (wrap) push(wrap.innerText, 0);
      push(n.getAttribute('aria-label'), 0);
      push(n.getAttribute('placeholder'), 0);
      push(n.getAttribute('name'), 0);
      let scope = n;
      for (let depth = 1; depth <= 5 && scope; depth++) {
        let sib = scope.previousElementSibling;
        while (sib) {
          push(sib.innerText || sib.textContent, depth);
          sib = sib.previousElementSibling;
        }
        scope = scope.parentElement;
      }
      return out;
    };
    const ctrls = Array.from(document.querySelectorAll('input, textarea, select'))
      .filter((n) => n.getAttribute('type') !== 'hidden' && n.type !== 'hidden' && n.getClientRects().length > 0)
      .map((n) => {
        const labels = labelsOf(n);
        let depth = 99;
        let matched = false;
        for (const [text, d] of labels) {
          // Exact label, or the label element carrying extra helper copy
          // ("Autopsy & Death Certificate Request (PHMC link)" + sub-line).
          if (text === want || text.startsWith(`${want} `) || text.startsWith(`${want} —`) || text.startsWith(`${want} -`)) {
            matched = true;
            depth = Math.min(depth, d);
          }
        }
        return {
          el: n,
          tag: n.tagName.toLowerCase(),
          type: (n.getAttribute('type') || '').toLowerCase(),
          ph: norm(n.getAttribute('placeholder') || ''),
          depth,
          matched,
        };
      })
      .filter((c) => c.matched)
      .sort((a, b) => a.depth - b.depth);
    if (!ctrls.length) return null;
    const byKind = {
      select: ctrls.filter((c) => c.tag === 'select'),
      date: ctrls.filter((c) => c.type === 'date' || /dd|yyyy/.test(c.ph)),
      time: ctrls.filter((c) => c.type === 'time' || /hh/.test(c.ph) || (c.ph.includes(':') && c.ph.includes('mm'))),
      rows: ctrls.filter((c) => c.type === 'url' || /https?|url|photo|screenshot/.test(c.ph)),
    };
    const pool = byKind[wantKind] || [];
    // Label match is the strong signal, kind only a tiebreak: fall back to
    // the closest label-matched control rather than failing. (e.g. the
    // Time-of-death input's "16:12" placeholder matches neither pool, but
    // it is the only control under its label.)
    if (pool.length) return pool[0].el;
    if (ctrls.length) return ctrls[0].el;
    return null;
  }, [label, kind]).catch(() => null);
  const el = handle ? await handle.asElement() : null;
  return el;
}

/**
 * Textareas store LF only — browsers normalise CRLF/CR to LF when a value is
 * assigned, so a report written on Windows (CRLF) reads back shorter than it
 * was written and used to fail the read-back guard. Normalise before filling
 * so the comparison uses the text the portal will actually hold.
 */
export function normalizePortalText(value) {
  return String(value ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * Honest truncation to a portal field's own limit.
 *
 * The DRDB forms cap textareas/list fields at fixed lengths (Physical
 * Description is 400). Writing more is silently truncated by the portal, which
 * used to trip the read-back guard and abort the whole filing — a permanent
 * retry loop. Truncating to the portal's own limit is the faithful submission
 * (it is exactly what the field would store), and the caller warns so the
 * shortening is visible in the logs.
 *
 * @param {string} value
 * @param {number} maxLen — 0/unknown means unlimited
 * @returns {{value:string, truncated:boolean, limit:number}}
 */
export function applyPortalFieldLimit(value, maxLen) {
  const s = String(value ?? '');
  const n = Number(maxLen);
  if (!Number.isFinite(n) || n <= 0 || s.length <= n) {
    return { value: s, truncated: false, limit: Number.isFinite(n) && n > 0 ? n : 0 };
  }
  return { value: s.slice(0, n), truncated: true, limit: n };
}

/**
 * Fill one already-resolved control + read back. Shared by the
 * label-anchored fillField and the keyedRows row-cell filler (whose controls
 * are located per row-entry, not by label).
 * Date/time kinds use real keystrokes (the portal's text inputs wear
 * DD/MM/YYYY and HH:mm masks); everything else uses the native value
 * setter + input/change events (plain React-controlled inputs).
 * @returns {Promise<{ok:boolean, reason?:string, readback?:string}>}
 */
async function fillControl(page, el, field) {
  const value = String(field.value ?? '');

  const tag = await el.evaluate((n) => n.tagName.toLowerCase()).catch(() => '');
  if (field.kind === 'select' || tag === 'select') {
    const picked = await el.evaluate((sel, val) => {
      const opts = Array.from(sel.options || []).map((o) => o.text);
      let idx = opts.findIndex((t) => t.trim() === val.trim());
      if (idx < 0) idx = opts.findIndex((t) => t.trim().toLowerCase() === val.trim().toLowerCase());
      if (idx < 0) return { ok: false, options: opts };
      sel.selectedIndex = idx;
      sel.dispatchEvent(new Event('input', { bubbles: true }));
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      return { ok: true };
    }, value).catch((e) => ({ ok: false, options: [], error: e.message }));
    if (!picked?.ok) {
      return {
        ok: false,
        reason: `Select "${field.label}" has no option "${value}" (options: ${(picked?.options || []).join(' | ').slice(0, 200)})`,
      };
    }
    const readback = await el.evaluate((sel) => sel.options[sel.selectedIndex]?.text || '').catch(() => '');
    if (readback.trim().toLowerCase() !== value.trim().toLowerCase()) {
      return { ok: false, reason: `Select "${field.label}" did not stick (read back "${readback}")` };
    }
    return { ok: true, readback };
  }

  // Date/time inputs: native pickers want ISO/time shapes; masked text inputs
  // take display strings via real keystrokes so the mask can track them.
  const inputType = await el.evaluate((n) => (n.getAttribute('type') || '').toLowerCase()).catch(() => '');
  let fillValue = value;
  if (field.kind === 'date' && inputType === 'date') {
    const m = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) fillValue = `${m[3]}-${m[2]}-${m[1]}`;
  }
  // Textareas hold LF only (the browser normalises CRLF/CR on assignment).
  if (tag === 'textarea' || field.kind === 'textarea') fillValue = normalizePortalText(fillValue);
  // Respect the control's own length cap before typing: the portal truncates
  // silently, and a read-back mismatch here aborted the whole filing.
  // Prefer a declared field limit; otherwise read the DOM, but ignore the
  // HTMLTextAreaElement default (524288) — it does not mean "unlimited by the
  // portal", the page slices in JS long before that.
  const domLimits = await el.evaluate((n) => {
    if (!n) return { attr: 0, prop: 0 };
    const attr = n.getAttribute('maxlength');
    return {
      attr: attr != null ? Number(attr) : 0,
      prop: typeof n.maxLength === 'number' ? n.maxLength : 0,
    };
  }).catch(() => ({ attr: 0, prop: 0 }));
  const declared = Number(field.limit) > 0 ? Number(field.limit) : 0;
  const domLimit = domLimits.attr > 0
    ? domLimits.attr
    : (domLimits.prop > 0 && domLimits.prop < 10000 ? domLimits.prop : 0);
  const maxLen = [declared, domLimit].filter((n) => n > 0).sort((a, b) => a - b)[0] || 0;
  const limited = applyPortalFieldLimit(fillValue, maxLen);
  if (limited.truncated) {
    console.warn(`[${TAG}] "${field.label}" truncated to the portal limit (${limited.limit} chars, was ${fillValue.length})`);
  }
  fillValue = limited.value;
  const expectedValue = limited.value;
  if ((field.kind === 'date' || field.kind === 'time') && tag === 'input' && inputType !== 'date' && inputType !== 'time') {
    await el.click({ timeout: 15000 }).catch(() => {});
    await el.fill('').catch(() => {});
    await page.keyboard.type(fillValue, { delay: 30 }).catch(() => {});
    await el.evaluate((n) => n.dispatchEvent(new Event('change', { bubbles: true }))).catch(() => {});
    // Dismiss any datepicker popup the keystrokes opened.
    await page.keyboard.press('Escape').catch(() => {});
    await sleep(500);
  } else if (tag === 'input' || tag === 'textarea') {
    await el.evaluate((node, val) => {
      const proto = node.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      node.focus();
      if (setter) setter.call(node, val);
      else node.value = val;
      node.dispatchEvent(new Event('input', { bubbles: true }));
      node.dispatchEvent(new Event('change', { bubbles: true }));
    }, fillValue).catch(() => {});
  } else {
    return { ok: false, reason: `Control for "${field.label}" is <${tag}> — don't know how to fill` };
  }
  await sleep(250);
  const readback = await el.evaluate((n) => n.value ?? '').catch(() => '');
  const same = field.kind === 'date' && inputType === 'date'
    ? readback === fillValue
    : readback.trim() === expectedValue.trim();
  if (!same) {
    // Tolerant fallback for portal inputs that slice in JS instead of exposing
    // a maxlength attribute: an exact prefix means the control truncated the
    // value to its own cap — that IS the submission the portal accepts, so pass
    // with a loud warning instead of aborting the filing forever.
    const textKind = tag === 'input' || tag === 'textarea';
    const isTruncation = textKind && field.kind !== 'date' && field.kind !== 'time'
      && readback.length > 0 && readback.length < expectedValue.length
      && expectedValue.startsWith(readback);
    if (isTruncation) {
      console.warn(`[${TAG}] "${field.label}" truncated by the portal (wrote ${expectedValue.length} chars, read ${readback.length}) — accepted`);
    } else {
      // Diagnostics for a genuine mismatch: where do they diverge, and does the
      // control expose a maxlength the driver did not see?
      let at = 0;
      while (at < expectedValue.length && at < readback.length && expectedValue[at] === readback[at]) at++;
      console.warn(`[${TAG}] "${field.label}" mismatch at char ${at}: wrote ${JSON.stringify(expectedValue.slice(at, at + 24))} read ${JSON.stringify(String(readback).slice(at, at + 24))} (attr maxlength=${domLimits.attr}, prop=${domLimits.prop})`);
      return { ok: false, reason: `Field "${field.label}" did not stick (wrote ${expectedValue.length} chars, read ${String(readback).length})` };
    }
  }
  return { ok: true, readback: String(readback).slice(0, 120) };
}

/**
 * Fill one control via the label-anchored strategy, then read back.
 * Resolves the control, then delegates to fillControl.
 * @returns {Promise<{ok:boolean, reason?:string, readback?:string}>}
 */
async function fillField(page, form, field) {
  const el = await resolveControl(page, form, field.label, field.kind);
  if (!el) {
    // Name the failure precisely: a field that exists but renders read-only is
    // a portal change (not a driver bug), and the alert should say so.
    let extra = '';
    const anchorKey = FIELD_ANCHORS[form]?.[field.label];
    if (anchorKey) {
      const state = await page.evaluate((key) => {
        const wrap = document.querySelector(`[data-record-field="${key}"]`);
        if (!wrap) return 'missing';
        if (wrap.querySelector('input, textarea, select')) return 'control';
        if (wrap.querySelector('[data-record-paragraph]')) return 'readonly';
        return 'empty';
      }, anchorKey).catch(() => 'unknown');
      if (state === 'readonly') {
        extra = ` — the portal renders this field read-only (no input); the LSPD form has changed (anchor ${anchorKey})`;
      } else if (state === 'missing') {
        extra = ` — the portal no longer exposes this field (anchor ${anchorKey} missing)`;
      } else if (state === 'empty') {
        extra = ` — the portal field ${anchorKey} rendered with no control`;
      }
    }
    return { ok: false, reason: `Control not found for label "${field.label}" (kind ${field.kind})${extra}` };
  }

  return fillControl(page, el, field);
}

/**
 * Grow + fill a dynamic row list (findings, photo URLs).
 * Row inputs are matched by EXACT nearby-label equality (never substring on
 * a container blob — the coroner form nests both URL groups under one
 * section, and the ME form's request-link input sits above the findings).
 * The spawner is scoped to the row group's own column, and a final
 * whole-list readback guards against cross-group contamination.
 */
/**
 * Scope selector for a row list: the URL group's own data-record-field div,
 * or the ME findings' div[data-record-rows].
 */
function rowScopeSelector(form, rowsField) {
  const anchor = ROW_ANCHORS[form]?.[rowsField.rowLabel];
  if (anchor) return `div[data-record-field="${anchor}"]`;
  return 'div[data-record-rows]';
}

async function rowInputValues(page, form, rowsField) {
  return page.evaluate(([scopeSel]) => {
    const scope = document.querySelector(scopeSel);
    if (!scope) return null;
    return Array.from(scope.querySelectorAll('input[type="text"], input[type="url"], input:not([type]), textarea'))
      .filter((n) => n.getAttribute('type') !== 'hidden' && n.type !== 'hidden' && n.getClientRects().length > 0)
      .map((n) => String(n.value ?? ''));
  }, [rowScopeSelector(form, rowsField)]).catch(() => null);
}

async function clickRowSpawner(page, form, rowsField) {
  return page.evaluate(([scopeSel, btnText]) => {
    const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
    // The visible "+" is an SVG icon on some buttons ("Add finding") and
    // literal text on others ("+ Add another") — accept either.
    const wants = [norm(btnText), norm(btnText).replace(/^\+\s*/, '')];
    const scope = document.querySelector(scopeSel) || document;
    const hit = Array.from(scope.querySelectorAll('button, a'))
      .filter((b) => wants.includes(norm(b.innerText || ''))
        && b.getBoundingClientRect().width > 0 && b.getBoundingClientRect().height > 0)[0];
    if (hit) { hit.click(); return true; }
    return false;
  }, [rowScopeSelector(form, rowsField), rowsField.addButton]).catch(() => false);
}

async function fillRows(page, form, rowsField) {
  const results = [];
  const values = Array.isArray(rowsField.values) ? rowsField.values : [];
  if (!values.length && rowsField.required) {
    return { ok: false, reason: `Section "${rowsField.section}" needs at least one ${rowsField.rowLabel}` };
  }
  for (let i = 0; i < values.length; i++) {
    const before = (await rowInputValues(page, form, rowsField)) || [];
    if (before.length <= i) {
      // The row doesn't exist yet — grow the list, then re-check.
      const spawned = await clickRowSpawner(page, form, rowsField);
      if (!spawned) {
        return { ok: false, reason: `Row ${i} (${rowsField.rowLabel}): no input and no "${rowsField.addButton}" button`, results };
      }
      await sleep(1500);
      const after = (await rowInputValues(page, form, rowsField)) || [];
      if (after.length <= i) {
        return { ok: false, reason: `Row ${i} (${rowsField.rowLabel}): spawner clicked but no new row appeared`, results };
      }
    }
    const filled = await page.evaluate(([scopeSel, val, idx]) => {
      const scope = document.querySelector(scopeSel);
      if (!scope) return { ok: false, found: -1 };
      const inputs = Array.from(scope.querySelectorAll('input[type="text"], input[type="url"], input:not([type]), textarea'))
        .filter((n) => n.getAttribute('type') !== 'hidden' && n.type !== 'hidden' && n.getClientRects().length > 0);
      const target = inputs[idx];
      if (!target) return { ok: false, found: inputs.length };
      const proto = target.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      target.focus();
      if (setter) setter.call(target, val);
      else target.value = val;
      target.dispatchEvent(new Event('input', { bubbles: true }));
      target.dispatchEvent(new Event('change', { bubbles: true }));
      return { ok: true, value: target.value };
    }, [rowScopeSelector(form, rowsField), values[i], i]).catch((e) => ({ ok: false, error: e.message }));
    if (!filled?.ok || String(filled.value ?? '').trim() !== String(values[i]).trim()) {
      return {
        ok: false,
        reason: filled?.ok
          ? `Row ${i} (${rowsField.rowLabel}) did not stick`
          : `Row ${i} (${rowsField.rowLabel}) vanished before fill (found ${filled?.found ?? '?'})`,
        results,
      };
    }
    results.push({ index: i, readback: String(values[i]).slice(0, 80) });
  }
  // Final whole-list consistency: every row must hold exactly its value, in
  // order — catches cross-group contamination the per-row check can miss.
  const final = (await rowInputValues(page, form, rowsField)) || [];
  const want = values.map((v) => String(v).trim());
  const got = final.map((v) => String(v).trim());
  if (want.length !== got.length || want.some((v, i) => v !== got[i])) {
    return {
      ok: false,
      reason: `Row list mismatch for "${rowsField.rowLabel}" (want ${want.length}, got ${got.length}) — refusing a contaminated submit`,
      results,
    };
  }
  return { ok: true, results };
}

/**
 * Grow + fill the mass-fatality "Additional decedents" 15-column row
 * component (div[data-record-rows="<rowsKey>"] →
 * div[data-record-row-entry] → div[data-record-row-cell="<key>"] →
 * input/textarea/select; new rows via button[data-record-rows-add]).
 *
 * Descriptor: { kind:'keyedRows', section, rowsKey, addText, columns, items }
 * where columns is MASS_FATALITY_ROW_COLUMNS and items is one object per
 * row keyed by column key. Empty cells stay blank (required cells are never
 * empty — the builder aborts first); a non-empty cell that does not read
 * back aborts, and a final whole-table readback guards against shifted or
 * extra rows.
 */
async function fillKeyedRows(page, form, field) {
  const rowsKey = String(field.rowsKey || '');
  const columns = Array.isArray(field.columns) ? field.columns : [];
  const items = Array.isArray(field.items) ? field.items : [];
  const results = [];
  if (!rowsKey) return { ok: false, reason: 'keyedRows field has no rowsKey — aborting', results };
  if (!columns.length) return { ok: false, reason: `keyedRows "${rowsKey}" has no columns — aborting`, results };
  if (!items.length) return { ok: true, results };

  const scopeSel = `div[data-record-rows="${rowsKey}"]`;
  const scopeOk = await page.evaluate((sel) => !!document.querySelector(sel), scopeSel).catch(() => false);
  if (!scopeOk) {
    return { ok: false, reason: `Row group "${rowsKey}" not found — the LSPD form may have changed`, results };
  }

  const rowCount = () => page.evaluate(
    (sel) => document.querySelector(sel)?.querySelectorAll('[data-record-row-entry]').length ?? 0,
    scopeSel,
  ).catch(() => 0);

  for (let i = 0; i < items.length; i++) {
    if ((await rowCount()) <= i) {
      const spawned = await page.evaluate(([sel, btnText]) => {
        const scope = document.querySelector(sel);
        if (!scope) return false;
        const add = scope.querySelector('button[data-record-rows-add]');
        if (add && add.getBoundingClientRect().width > 0) { add.click(); return true; }
        const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
        const hit = Array.from(scope.querySelectorAll('button, a'))
          .filter((b) => norm(b.innerText || '') === norm(btnText)
            && b.getBoundingClientRect().width > 0 && b.getBoundingClientRect().height > 0)[0];
        if (hit) { hit.click(); return true; }
        return false;
      }, [scopeSel, field.addText || '']).catch(() => false);
      if (!spawned) {
        return { ok: false, reason: `Row ${i + 1}: no entry and no "${field.addText || 'add'}" button`, results };
      }
      await sleep(1200);
      if ((await rowCount()) <= i) {
        return { ok: false, reason: `Row ${i + 1}: spawner clicked but no new row appeared`, results };
      }
    }

    const entryHandle = await page.evaluateHandle(([sel, idx]) => {
      const scope = document.querySelector(sel);
      const entries = scope ? Array.from(scope.querySelectorAll('[data-record-row-entry]')) : [];
      return entries[idx] || null;
    }, [scopeSel, i]).catch(() => null);
    const entry = entryHandle ? await entryHandle.asElement() : null;
    if (!entry) {
      return { ok: false, reason: `Row ${i + 1} vanished before fill`, results };
    }

    for (const col of columns) {
      const val = items[i]?.[col.key] ?? '';
      if (!str(val)) continue; // blank cells stay blank (builder aborted any missing required cell)
      const ctl = await entry.$(`[data-record-row-cell="${col.key}"] input, [data-record-row-cell="${col.key}"] textarea, [data-record-row-cell="${col.key}"] select`).catch(() => null);
      if (!ctl) {
        return { ok: false, reason: `Row ${i + 1} cell "${col.key}": no control — the LSPD form may have changed`, results };
      }
      const r = await fillControl(page, ctl, { label: `Row ${i + 1} ${col.label}`, kind: col.kind, value: val });
      if (!r.ok) return { ok: false, reason: r.reason, results };
      results.push({ index: i, cell: col.key, readback: r.readback });
    }
  }

  // Whole-table readback: every non-empty expectation must hold exactly, and
  // the row count must match (an extra or shifted row fails closed).
  const got = await page.evaluate(([sel, keys]) => {
    const scope = document.querySelector(sel);
    if (!scope) return null;
    return Array.from(scope.querySelectorAll('[data-record-row-entry]')).map((entry) => {
      const row = {};
      for (const k of keys) {
        const c = entry.querySelector(`[data-record-row-cell="${k}"] input, [data-record-row-cell="${k}"] textarea, [data-record-row-cell="${k}"] select`);
        if (!c) { row[k] = null; continue; }
        row[k] = c.tagName === 'SELECT' ? (c.options[c.selectedIndex]?.text || '') : (c.value ?? '');
      }
      return row;
    });
  }, [scopeSel, columns.map((c) => c.key)]).catch(() => null);
  if (!got || got.length !== items.length) {
    return {
      ok: false,
      reason: `Row table mismatch for "${rowsKey}" (want ${items.length} rows, got ${got?.length ?? '?'}) — refusing a contaminated submit`,
      results,
    };
  }
  for (let i = 0; i < items.length; i++) {
    for (const col of columns) {
      const want = String(items[i]?.[col.key] ?? '').trim();
      if (!want) continue;
      if (String(got[i]?.[col.key] ?? '').trim() !== want) {
        return {
          ok: false,
          reason: `Row ${i + 1} cell "${col.key}" did not stick (want "${want.slice(0, 60)}") — refusing a contaminated submit`,
          results,
        };
      }
    }
  }
  return { ok: true, results };
}

/** Inventory the live form: every control with its resolved label + options. */
async function collectDomState(page) {
  return page.evaluate(() => {
    const norm = (s) => String(s || '').replace(/\*/g, '').replace(/\s+/g, ' ').trim();
    const out = [];
    for (const n of document.querySelectorAll('input, textarea, select, button')) {
      if (n.tagName === 'BUTTON') {
        const t = norm(n.innerText);
        if (t && t.length < 60) out.push({ control: 'button', label: t });
        continue;
      }
      const id = n.getAttribute('id') || '';
      let label = '';
      if (id) {
        const lb = document.querySelector(`label[for="${CSS.escape(id)}"]`);
        if (lb) label = norm(lb.innerText);
      }
      if (!label) {
        const wrap = n.closest('label');
        if (wrap) label = norm(wrap.innerText);
      }
      if (!label) {
        const box = n.closest('div');
        const prev = box?.previousElementSibling;
        if (prev && norm(prev.innerText).length < 80) label = norm(prev.innerText);
      }
      if (!label) label = norm(n.getAttribute('placeholder') || n.getAttribute('aria-label') || n.getAttribute('name') || '');
      const row = {
        control: n.tagName.toLowerCase(),
        type: n.getAttribute('type') || '',
        label: label.slice(0, 80),
        value: String(n.value ?? '').slice(0, 80),
      };
      if (n.tagName === 'SELECT') {
        row.options = Array.from(n.options || []).map((o) => o.text).slice(0, 12);
        row.selected = n.options?.[n.selectedIndex]?.text || '';
      }
      out.push(row);
    }
    return {
      url: location.href,
      title: document.title,
      bodyHead: norm(document.body?.innerText).slice(0, 600),
      controls: out,
    };
  }).catch((e) => ({ error: e.message }));
}

/**
 * Shared engine: resolve recipient → fill → (verify | submit).
 * @returns {Promise<{ok:boolean, dryRun?, formUrl?, screenshot?, dump?, reason?, sessionInvalid?, fields?:object[]}>}
 */
export async function runPortalForm({ form, recipient, fields, submit = false, screenshotPath = null }) {
  const cfg = PORTAL_FORMS[form];
  if (!cfg) return { ok: false, reason: `Unknown form "${form}"` };
  const want = str(recipient);
  if (!want) return { ok: false, reason: 'Empty recipient — refusing to guess' };
  if (!Array.isArray(fields) || !fields.length) return { ok: false, reason: 'No fields to fill — aborting' };

  if (submit) {
    const portal = await import('./lspdPortal.js');
    if (!portal.LSPD_PORTAL_ENABLED) {
      console.log(`[${TAG}] Live submit paused by operator — holding "${want}" for retry (nothing sent)`);
      return { ok: false, reason: 'LSPD portal delivery paused by operator — held for retry', retryable: true };
    }
    if (lspdFormsDryRun()) {
      return { ok: false, reason: 'LSPD_FORMS_DRY_RUN is on — refusing live submit (verify only)' };
    }
  }

  const portal = await import('./lspdPortal.js');
  if (typeof portal.checkPortalSession === 'function') {
    try {
      const pre = await portal.checkPortalSession();
      if (!pre.ok) {
        console.log(`[${TAG}] Portal session dead — attempting silent re-auth before alerting`);
        const re = await portal.trySilentReauth();
        if (!re.ok) {
          await portal.alertPortalSessionNeeded('portal session no longer signed in (silent re-auth needs interaction)');
          return { ok: false, sessionInvalid: true, reason: 'Portal session expired — re-login required' };
        }
      }
    } catch (e) {
      console.warn(`[${TAG}] Session preflight failed (${e.message}) — proceeding to normal checks`);
    }
  }

    // The daemon browser occasionally races an extension service-worker
    // attach during newContext (playwright-core _onAttachedToTarget
    // assertion) — retry the open a few times before giving up.
    const { openSessionContext } = portal;
    if (typeof openSessionContext !== 'function') {
      return { ok: false, reason: 'lspdPortal.openSessionContext is not exported — driver cannot open a session' };
    }
    let ctx = null;
    let browser = null;
    let opened = false;
    let openError = null;
    for (let attempt = 1; attempt <= 3 && !opened; attempt++) {
      try {
        ({ browser, ctx } = await openSessionContext());
        opened = true;
      } catch (err) {
        openError = err;
        console.warn(`[${TAG}] Session open attempt ${attempt}/3 failed (${String(err.message).slice(0, 120)}) — retrying`);
        try { await ctx?.close(); } catch { /* ignore */ }
        try { await browser?.close(); } catch { /* ignore disconnect */ }
        ctx = null;
        browser = null;
        await sleep(8000);
      }
    }
    if (!opened) {
      return { ok: false, reason: `Could not open portal session: ${String(openError?.message || 'unknown').slice(0, 160)}` };
    }
    try {
    const page = await ctx.newPage();
    const seenRecipients = [];
    page.on('response', (r) => {
      if (r.request().method() === 'GET' && r.url().includes('/recipients')) {
        seenRecipients.push(r.url().slice(0, 200));
      }
    });

    await page.goto(`${PORTAL}${cfg.path}`, { waitUntil: 'networkidle', timeout: 120000 }).catch(() => {});
    await sleep(3500);
    const signedIn = await page.evaluate(() => (document.body?.innerText || '').includes('Signed in as')).catch(() => false);
    if (!signedIn || /\/login/.test(page.url())) {
      await portal.alertPortalSessionNeeded('portal session no longer signed in');
      return { ok: false, sessionInvalid: true, reason: 'Portal session expired — re-login required' };
    }

    // ── Recipient: type, demand exactly one suggestion, click it ──
    const searchHandle = await page.evaluateHandle(() => {
      const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
      const inputs = Array.from(document.querySelectorAll('input[type="text"], input:not([type]), input[type="search"]'));
      for (const n of inputs) {
        const hay = `${norm(n.getAttribute('placeholder') || '')} ${norm(n.getAttribute('aria-label') || '')}`;
        if (hay.includes('employee') || hay.includes('unit')) return n;
      }
      return inputs[0] || null;
    }).catch(() => null);
    let searchEl = searchHandle ? await searchHandle.asElement() : null;
    if (!searchEl) {
      const fallback = await page.$('input[placeholder*="employee" i], input[placeholder*="unit" i], input[type="search"]');
      searchEl = fallback;
    }
    if (!searchEl) return { ok: false, reason: 'Recipient search input not found — aborting' };
    await searchEl.click({ timeout: 15000 }).catch(() => {});
    await searchEl.fill('').catch(() => {});
    await searchEl.type(want, { delay: 60, timeout: 15000 }).catch(() => {});
    // Wait for the form's own recipients endpoint to answer.
    await page.waitForResponse(
      (r) => r.request().method() === 'GET' && r.url().includes(cfg.recipientsPath),
      { timeout: 15000 },
    ).catch(() => {});
    await sleep(2000);

    const suggestions = await page.evaluate((wantName) => {
      const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
      const cands = new Set();
      for (const sel of ['[role="listbox"] [role="option"]', '[role="option"]', 'ul li button', 'li button', 'button']) {
        for (const b of document.querySelectorAll(sel)) {
          const t = (b.innerText || '').replace(/\s+/g, ' ').trim();
          if (t && t.length < 120 && norm(t).includes(norm(wantName))) cands.add(t);
        }
      }
      return [...cands];
    }, want).catch(() => []);
    const pick = pickSingleRecipient(suggestions, want);
    if (!pick.ok) {
      return { ok: false, reason: `Recipient pick aborted: ${pick.reason}`, suggestions };
    }
    const clicked = await page.evaluate((match) => {
      const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
      for (const b of document.querySelectorAll('[role="option"], ul li button, li button, button')) {
        if (norm(b.innerText || '') === norm(match)) { b.click(); return true; }
      }
      // Fallback: first button containing the match.
      for (const b of document.querySelectorAll('button')) {
        if (norm(b.innerText || '').includes(norm(match))) { b.click(); return true; }
      }
      return false;
    }, pick.match).catch(() => false);
    if (!clicked) return { ok: false, reason: `Recipient "${pick.match}" matched but the suggestion was not clickable — aborting` };
    await sleep(2000);

    // ── Fill every field; required fields must read back ──
    const fieldResults = [];
    for (const f of fields) {
      if (f.kind === 'rows') {
        const r = await fillRows(page, form, f);
        fieldResults.push({ label: `${f.section} / ${f.rowLabel}`, ok: r.ok, reason: r.reason || `${(r.results || []).length} row(s)` });
        if (!r.ok && f.required !== false) {
          const dump = await collectDomState(page);
          return { ok: false, reason: r.reason, fieldResults, dump, suggestions };
        }
        continue;
      }
      if (f.kind === 'keyedRows') {
        const r = await fillKeyedRows(page, form, f);
        fieldResults.push({ label: `${f.section} / ${f.rowsKey}`, ok: r.ok, reason: r.reason || `${(r.results || []).length} cell(s)` });
        if (!r.ok && f.required !== false) {
          const dump = await collectDomState(page);
          return { ok: false, reason: r.reason, fieldResults, dump, suggestions };
        }
        continue;
      }
      if (!str(f.value) && f.required) {
        return { ok: false, reason: `Required field "${f.label}" has no value — aborting` };
      }
      if (!str(f.value)) {
        fieldResults.push({ label: f.label, ok: true, reason: 'skipped (optional, empty)' });
        continue;
      }
      const r = await fillField(page, form, f);
      fieldResults.push({ label: f.label, ok: r.ok, reason: r.reason || r.readback || 'filled' });
      if (!r.ok) {
        const dump = await collectDomState(page);
        return { ok: false, reason: r.reason, fieldResults, dump, suggestions };
      }
    }

    const dump = await collectDomState(page);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const shotPath = screenshotPath || `/tmp/lspd-form-${form}-${stamp}.png`;
    await page.screenshot({ path: shotPath, fullPage: true }).catch(() => {});
    console.log(`[${TAG}] Filled ${cfg.label} for "${want}" (${fieldResults.length} fields) → ${shotPath}`);

    if (!submit) {
      console.log(`[${TAG}] DRY RUN — ${cfg.label} filled for "${want}", not submitted`);
      return { ok: true, dryRun: true, screenshot: shotPath, beforeScreenshot: shotPath, dump, fieldResults, suggestions, seenRecipients };
    }

    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button'))
        .find((b) => (b.innerText || '').trim().toLowerCase() === 'submit');
      if (btn) btn.click();
    });
    await sleep(8000);
    const after = await collectDomState(page);
    const shot2 = shotPath.replace(/\.png$/, '-after.png');
    await page.screenshot({ path: shot2, fullPage: true }).catch(() => {});
    // Success = receipt markers present, or fully navigated away from the
    // form. Never URL-prefix alone: receipts render at the form path.
    const receipt = detectReceipt(after);
    const stillForm = String(after.url || '').includes(cfg.path) && !receipt.received;
    if (stillForm) {
      return {
        ok: false, reason: `Submit unconfirmed — still on the form (errors: ${(after.bodyHead || '').slice(0, 200)})`,
        fieldResults, dump: after, screenshot: shot2,
      };
    }
    console.log(`[${TAG}] ✅ ${cfg.label} submitted for "${want}" → ${after.url}${receipt.reference ? ` (ref ${receipt.reference})` : ''}`);
    return { ok: true, formUrl: after.url, reference: receipt.reference, screenshot: shot2, beforeScreenshot: shotPath, dump: after, fieldResults };
  } catch (err) {
    console.error(`[${TAG}] ${cfg.label} failed:`, err.message);
    return { ok: false, reason: String(err.message || 'Unknown').slice(0, 200) };
  } finally {
    // Close OUR context, then disconnect OUR CDP pipe. The daemon browser
    // and its parked tabs are untouched; disconnecting (not killing) stops
    // this process accumulating browser-level event listeners, which is
    // what turns the extension service-worker attach race fatal.
    try { await ctx?.close(); } catch { /* our context only — daemon untouched */ }
    try { await browser?.close(); } catch { /* disconnect only */ }
  }
}

/**
 * Coroner-report form end to end (build → verify/submit).
 * submit=false (default) verifies only; submit=true requires
 * LSPD_FORMS_DRY_RUN=false + the operator kill-switch lifted.
 */
export async function deliverCoronerReportForm({ recipient, data, submit = false, screenshotPath = null }) {
  const built = buildCoronerFormPayload(data || {});
  if (!built.ok) {
    console.error(`[${TAG}] Coroner form ABORT for "${str(recipient)}": ${built.errors.join(' | ').slice(0, 300)}`);
    return { ok: false, reason: built.errors[0], errors: built.errors, aborted: true };
  }
  return runPortalForm({ form: 'coroner-report', recipient, fields: built.fields, submit, screenshotPath });
}

/**
 * Mass-fatality form end to end (build → verify/submit).
 * submit=false (default) verifies only; submit=true requires
 * LSPD_FORMS_DRY_RUN=false + the operator kill-switch lifted.
 * Builder warnings (row URL-cap overflows) ride along on the result so the
 * queue can log what the portal could not take.
 */
export async function deliverMassFatalityForm({ recipient, data, submit = false, screenshotPath = null }) {
  const built = buildMassFatalityPayload(data || {});
  if (!built.ok) {
    console.error(`[${TAG}] Mass-fatality form ABORT for "${str(recipient)}": ${built.errors.join(' | ').slice(0, 300)}`);
    return { ok: false, reason: built.errors[0], errors: built.errors, aborted: true };
  }
  for (const w of (built.warnings || [])) console.warn(`[${TAG}] Mass-fatality warn for "${str(recipient)}": ${w}`);
  const result = await runPortalForm({ form: 'mass-fatality', recipient, fields: built.fields, submit, screenshotPath });
  if (result.ok && (built.warnings || []).length) result.warnings = built.warnings;
  return result;
}

/**
 * Medical-examiner form end to end (build → verify/submit).
 */
export async function deliverMedicalExaminerForm({
  recipient, data, context = {}, submit = false, screenshotPath = null,
}) {
  const built = buildMedicalExaminerPayload(data || {}, context);
  if (!built.ok) {
    console.error(`[${TAG}] ME form ABORT for "${str(recipient)}": ${built.errors.join(' | ').slice(0, 300)}`);
    return { ok: false, reason: built.errors[0], errors: built.errors, aborted: true };
  }
  return runPortalForm({ form: 'medical-examiner', recipient, fields: built.fields, submit, screenshotPath });
}
