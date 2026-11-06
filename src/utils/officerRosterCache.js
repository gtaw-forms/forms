/**
 * Officer roster snapshot cache — IndexedDB-backed, 24 h TTL.
 *
 * Why this exists:
 *   Every officer-name lookup went through `checkOfficerName` (callable ->
 *   Firebase Functions -> VPS morgue-api). That made a cosmetic autocomplete
 *   depend on two hops, and when the callables went down (2026-10-22 Cloud Run
 *   incident: every function in every region returning 500) officer search
 *   failed with it — while the roster itself is static, tiny data.
 *
 * What this does:
 *   The four faction rosters (lspd/lssd/sadcr/dao) hold ~554 names / ~9 KB, so
 *   the whole name set is snapshotted into IndexedDB and refreshed at most once
 *   per 24 h. Search then runs locally: instant, no callable traffic per
 *   keystroke, and it keeps working through a callable outage.
 *
 * Semantics mirror the VPS `/api/roster/check` route (morgue-api.js): case
 * insensitive, exact-or-substring match, and a department miss falls back to
 * the other rosters so the UI can still offer the alternative-account match.
 */

import { idbGet, idbSet, idbRemove } from './idbCache';

export const OFFICER_ROSTER_KEY = 'officer-roster:snapshot';
export const OFFICER_ROSTER_TTL_MS = 24 * 60 * 60 * 1000;
export const OFFICER_ROSTER_DEPARTMENTS = ['lspd', 'lssd', 'sadcr', 'dao'];
export const OFFICER_ROSTER_VERSION = 1;

// Guards against a runaway/abusive payload being written to the browser cache.
const MAX_NAMES_PER_DEPARTMENT = 5000;
const MAX_NAME_LENGTH = 120;

/**
 * Normalise the callable payload into the stored snapshot shape: one array of
 * plain, de-duplicated, sorted name strings per department.
 * Pure — exported for tests.
 */
export function normalizeRosterDepartments(departments) {
  const out = {};
  for (const dept of OFFICER_ROSTER_DEPARTMENTS) {
    const list = Array.isArray(departments?.[dept]) ? departments[dept] : [];
    const seen = new Set();
    const names = [];
    for (const raw of list) {
      const name = String(raw ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH);
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      names.push(name);
      if (names.length >= MAX_NAMES_PER_DEPARTMENT) break;
    }
    names.sort((a, b) => a.localeCompare(b));
    out[dept] = names;
  }
  return out;
}

/** Total name count across all departments. Pure. */
export function countRosterNames(departments) {
  if (!departments) return 0;
  let total = 0;
  for (const dept of OFFICER_ROSTER_DEPARTMENTS) {
    total += Array.isArray(departments[dept]) ? departments[dept].length : 0;
  }
  return total;
}

/** True when the snapshot is missing or older than the TTL. Pure. */
export function isRosterStale(snapshot, now = Date.now(), ttlMs = OFFICER_ROSTER_TTL_MS) {
  if (!snapshot || !snapshot.fetchedAt) return true;
  if (countRosterNames(snapshot.departments) === 0) return true;
  return (now - Number(snapshot.fetchedAt)) >= ttlMs;
}

/** Snapshot age in ms (Infinity when there is no snapshot). Pure. */
export function rosterAgeMs(snapshot, now = Date.now()) {
  if (!snapshot || !snapshot.fetchedAt) return Infinity;
  return Math.max(0, now - Number(snapshot.fetchedAt));
}

/**
 * Search the cached rosters. Returns `[{ name, department }]`, matching the
 * shape the callable returns so the UI needs no special-casing.
 *
 * - `department` given  -> that roster first, then the others (alt account).
 * - `department` blank  -> every roster (auto-detect), as the API does.
 * Pure — exported for tests.
 */
export function searchOfficerRoster(snapshot, rawName, department) {
  const departments = snapshot?.departments || null;
  const needle = String(rawName ?? '').trim().toLowerCase();
  if (!departments || needle.length < 2) return [];

  const matchesIn = (dept) => {
    const list = Array.isArray(departments[dept]) ? departments[dept] : [];
    return list
      .filter((name) => {
        const lower = name.toLowerCase();
        return lower === needle || lower.includes(needle);
      })
      .map((name) => ({ name, department: dept }));
  };

  const wanted = String(department ?? '').trim().toLowerCase();
  const hasDept = OFFICER_ROSTER_DEPARTMENTS.includes(wanted);

  if (!hasDept) {
    const all = [];
    for (const dept of OFFICER_ROSTER_DEPARTMENTS) all.push(...matchesIn(dept));
    return all;
  }

  const primary = matchesIn(wanted);
  if (primary.length > 0) return primary;

  // Department miss -> cross-reference the others so the dropdown can still
  // offer the right match (mirrors the API's `altMatch`).
  const alternatives = [];
  for (const dept of OFFICER_ROSTER_DEPARTMENTS) {
    if (dept === wanted) continue;
    alternatives.push(...matchesIn(dept));
  }
  return alternatives;
}

/** Read the stored snapshot, or null. Never throws. */
export async function readOfficerRoster() {
  const snapshot = await idbGet(OFFICER_ROSTER_KEY);
  if (!snapshot || typeof snapshot !== 'object') return null;
  if (!snapshot.departments || countRosterNames(snapshot.departments) === 0) return null;
  return snapshot;
}

/** Persist one snapshot. Returns it, or null if the write was a no-op. */
export async function writeOfficerRoster(departments, source = 'callable') {
  const normalized = normalizeRosterDepartments(departments);
  if (countRosterNames(normalized) === 0) return null;
  const snapshot = {
    v: OFFICER_ROSTER_VERSION,
    fetchedAt: Date.now(),
    source,
    departments: normalized,
  };
  await idbSet(OFFICER_ROSTER_KEY, snapshot);
  return snapshot;
}

let inflightRefresh = null;

/**
 * Single-flight refresh. Resolves to the snapshot to use:
 *   - a fresh cached snapshot (no network), or
 *   - the newly fetched snapshot, or
 *   - the previous snapshot when the refresh fails (stale beats nothing), or
 *   - null when there is nothing cached and the fetch failed.
 * `fetchDepartments` is injected so the caller owns the transport (and tests
 * can run without Firebase).
 */
export async function refreshOfficerRoster(fetchDepartments, { force = false, now = Date.now() } = {}) {
  const cached = await readOfficerRoster();
  if (!force && !isRosterStale(cached, now)) return cached;
  if (inflightRefresh) return inflightRefresh;

  inflightRefresh = (async () => {
    try {
      const departments = await fetchDepartments();
      const written = await writeOfficerRoster(departments);
      if (written) return written;
      console.warn('[OfficerRoster] Refresh returned no names — keeping the previous snapshot.');
      return cached;
    } catch (err) {
      // A failed refresh must never break the field: keep serving the old copy.
      console.warn('[OfficerRoster] Refresh failed, using cached snapshot:', err?.message || err);
      return cached;
    } finally {
      inflightRefresh = null;
    }
  })();

  return inflightRefresh;
}

/** Drop the stored snapshot (used when the roster shape changes). */
export async function clearOfficerRoster() {
  await idbRemove(OFFICER_ROSTER_KEY);
}
