// LEO Reports — pure model helpers (list filtering, agency labels, row meta).
// Server-side filtering lives in morgue-api.js; these keep the client honest
// when it renders the IndexedDB cache before the live feed arrives.
import {
  AGENCY_SHORT, DEPARTMENT_NAMES, agencyLabel, agencyShort,
  formatTimestampShortUTC, normalizeDepartment,
} from './viewModel';

export const LEO_CACHE_LIMIT = 50;

export const LEO_AGENCY_FILTERS = [
  { id: 'all', label: 'All agencies' },
  ...Object.entries(DEPARTMENT_NAMES).map(([value, label]) => ({ id: value, label, short: AGENCY_SHORT[value] })),
];

/** Filter forwarded rows by agency key and free-text query (client cache path). */
export function filterLeoRows(rows, { agency = 'all', query = '' } = {}) {
  const needle = String(query || '').trim().toLowerCase();
  return (rows || []).filter((row) => {
    if (agency !== 'all' && normalizeDepartment(row?.department) !== agency) return false;
    if (!needle) return true;
    const hay = [
      row?.title, row?.authorName, row?.author, row?.formName,
      row?.agencyLabel, row?.agencyShort, agencyLabel(row?.department),
      row?.requestingOfficer, row?.decedentName,
    ].join(' ').toLowerCase();
    return hay.includes(needle);
  });
}

/** Stable newest-first sort for cached rows. */
export function sortLeoRows(rows) {
  return [...(rows || [])].sort((a, b) => (Number(b?.timestamp) || 0) - (Number(a?.timestamp) || 0));
}

/** "Los Santos Police Department · 03 Oct 2026, 14:22 UTC". */
export function leoRowMeta(row) {
  const dept = row?.agencyLabel || agencyLabel(row?.department);
  const when = formatTimestampShortUTC(row?.timestamp);
  return `${dept} · ${when}`;
}

/** Agency badge text for a row ("LSPD") — always falls back to "—". */
export function leoAgencyBadge(row) {
  return row?.agencyShort || agencyShort(row?.department) || '—';
}

export { agencyLabel, agencyShort, normalizeDepartment };
