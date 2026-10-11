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
};

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
