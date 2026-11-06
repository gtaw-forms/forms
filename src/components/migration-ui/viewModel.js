// Migration UI — pure view-model helpers (port of
// plan/coroner-report-handoff/coroner-report.viewmodel.mjs, extended to
// mass + autopsy listing/display). No dependencies, unit-tested.

export const TYPE_OF_DEATH_OPTIONS = ['PK', 'CK'];
export const MANNER_OF_DEATH_OPTIONS = ['Natural', 'Accidental', 'Suicide', 'Homicide', 'Undetermined'];
export const DEPARTMENT_OPTIONS = [
  { value: 'lspd', label: 'Los Santos Police Department' },
  { value: 'lssd', label: 'Los Santos County Sheriffs Department' },
  { value: 'sadcr', label: 'San Andreas Department of Corrections and Rehabilitation' },
  { value: 'dao', label: "District Attorney's Office" },
  { value: 'lsfd', label: 'Los Santos Fire Department' },
  { value: 'saaa', label: 'San Andreas Aviation Administration' },
];
export const DEPARTMENT_NAMES = Object.fromEntries(DEPARTMENT_OPTIONS.map((o) => [o.value, o.label]));

export const MIGRATION_FORM_IDS = {
  coroner: 'coroner-report',
  mass: 'mass-ftality-test',
  autopsy: 'autopsy',
  email: 'coroner_email',
};

/** Short agency codes used by the LEO feed (badges + filters). */
export const AGENCY_SHORT = {
  lspd: 'LSPD',
  lssd: 'LSSD',
  sadcr: 'SADCR',
  dao: 'DAO',
  lsfd: 'LSFD',
  saaa: 'SAAA',
};

/** Map a saved-report formId back to the platform report kind. */
export function kindFromFormId(formId) {
  if (formId === MIGRATION_FORM_IDS.mass || formId === 'mass-fatality') return 'mass';
  if (formId === MIGRATION_FORM_IDS.autopsy) return 'autopsy';
  if (formId === MIGRATION_FORM_IDS.email) return 'email';
  return 'coroner';
}

const DEPARTMENT_BY_NAME = {
  ...Object.fromEntries(Object.entries(DEPARTMENT_NAMES).map(([key, label]) => [label.toLowerCase(), key])),
  'los santos county sheriffs department': 'lssd',
  "los santos county sheriff's department": 'lssd',
  'district attorney’s office': 'dao',
};

/** Normalise a department key ("LSPD", " lspd "), object ({value}/{label}) or legacy full name. */
export function normalizeDepartment(value) {
  const raw = (typeof value === 'object' && value !== null
    ? (value.value || value.label || '')
    : value);
  const key = String(raw || '').trim().toLowerCase();
  if (DEPARTMENT_NAMES[key]) return key;
  return DEPARTMENT_BY_NAME[key] || '';
}

/** Full agency name for a department key — the LEO designation label. */
export function agencyLabel(value) {
  const key = normalizeDepartment(value);
  return key ? DEPARTMENT_NAMES[key] : 'Unassigned agency';
}

/** Short agency code for a department key ("LSPD"), or '—'. */
export function agencyShort(value) {
  const key = normalizeDepartment(value);
  return key ? AGENCY_SHORT[key] : '—';
}

/** True when the app is running on a local preview (dev server or localhost). */
export function isLocalPreview() {
  if (typeof window === 'undefined') return false;
  try {
    if (import.meta.env?.DEV) return true;
    return ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
  } catch {
    return false;
  }
}

/** True when a checkbox-like value is set (handles legacy "true" strings). */
export function isTruthyFlag(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

/** Local `YYYY-MM-DDTHH:mm` for datetime-local "Now" buttons. */
export function nowLocalDateTime(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}`;
}

/** Local `HH:mm` for time inputs ("Now"). */
export function nowLocalTime(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${p(date.getHours())}:${p(date.getMinutes())}`;
}

/** True when a report was forwarded to a law-enforcement agency. */
export function isForwardedReport(values = {}, formId = '') {
  if (isTruthyFlag(values?.ReportRequested)) return true;
  if (formId === 'mass-ftality-test' || formId === 'mass-fatality') {
    // Mass uses the `requesting_officer` field's "Requested" checkbox, which
    // writes a non-empty requestingOfficer (a single space when unnamed).
    if (Object.prototype.hasOwnProperty.call(values || {}, 'ReportRequested')) {
      return isTruthyFlag(values.ReportRequested);
    }
    return String(values?.requestingOfficer || '').length > 0;
  }
  return false;
}

/** UTC label for an epoch-milliseconds timestamp (cache/saved metadata). */
export function formatTimestampUTC(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return '—';
  const d = new Date(n);
  const p = (v) => String(v).padStart(2, '0');
  return `${DAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} UTC`;
}

/** Compact UTC label used by list metadata: "03 Oct 2026, 14:22 UTC". */
export function formatTimestampShortUTC(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return '—';
  const d = new Date(n);
  const p = (v) => String(v).padStart(2, '0');
  return `${p(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} UTC`;
}


const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function formatDateTimeUTC(iso) {
  if (!iso) return '—';
  const d = new Date(`${iso}Z`);
  if (Number.isNaN(d.getTime())) return String(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${DAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} UTC`;
}

export function formatDateMMDDYYYY(iso) {
  if (!iso) return '';
  const d = new Date(`${iso}Z`);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getUTCMonth() + 1)}/${p(d.getUTCDate())}/${d.getUTCFullYear()}`;
}

/** Mass report date: explicit `date` wins, else derive from dispatch time. */
export function massDate(m = {}) {
  return m.date || formatDateMMDDYYYY(m.dateTime) || '?';
}

export function coronerTitle(v = {}) {
  return `[${v.typeOfDeath || '?'}] ${v.decedentName || '?'} ((${v.decedentOOC || '?'})) - ${v.date || formatDateMMDDYYYY(v.dateTime) || '?'}`;
}

export function massTitle(m = {}) {
  const names = (m.decedents || []).map((d) => d.decedentName || '?').join(', ');
  return `[Mass Fatality Report] ${names} - ${massDate(m)}`;
}

export function autopsyTitle(a = {}) {
  return `Case #${a.caseNumber || '?'} ${a.decedentName || '?'} ((${a.decedentOOC || '?'})) | ${a.caseStatusOptions || '?'}`;
}

export function recordTitle(kind, values = {}) {
  if (kind === 'mass') return massTitle(values);
  if (kind === 'autopsy') return autopsyTitle(values);
  return coronerTitle(values);
}
