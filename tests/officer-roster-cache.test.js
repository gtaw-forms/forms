import { describe, it, expect, vi } from 'vitest';
import {
  OFFICER_ROSTER_TTL_MS, countRosterNames, isRosterStale, rosterAgeMs,
  normalizeRosterDepartments, searchOfficerRoster, refreshOfficerRoster,
} from '../src/utils/officerRosterCache';

const snapshot = (departments, fetchedAt = Date.now()) => ({ fetchedAt, departments });

describe('officer roster snapshot cache', () => {
  it('normalises names: trims, collapses spaces, de-dupes case-insensitively, sorts', () => {
    const out = normalizeRosterDepartments({
      lspd: ['  Roger   Callaghan ', 'roger callaghan', 'Alexandra Goes', '', null, 'Brandon Markham'],
    });
    expect(out.lspd).toEqual(['Alexandra Goes', 'Brandon Markham', 'Roger Callaghan']);
    expect(out.lssd).toEqual([]);
    expect(out.sadcr).toEqual([]);
    expect(out.dao).toEqual([]);
  });

  it('counts total names across the four departments', () => {
    expect(countRosterNames({ lspd: ['a', 'b'], lssd: ['c'], sadcr: [], dao: ['d'] })).toBe(4);
    expect(countRosterNames(null)).toBe(0);
  });

  it('treats a missing, empty or expired snapshot as stale', () => {
    const now = 1_700_000_000_000;
    expect(isRosterStale(null, now)).toBe(true);
    expect(isRosterStale(snapshot({ lspd: [] }, now), now)).toBe(true);
    expect(isRosterStale(snapshot({ lspd: ['A B'] }, now), now)).toBe(false);
    expect(isRosterStale(snapshot({ lspd: ['A B'] }, now - OFFICER_ROSTER_TTL_MS + 1000), now)).toBe(false);
    expect(isRosterStale(snapshot({ lspd: ['A B'] }, now - OFFICER_ROSTER_TTL_MS), now)).toBe(true);
  });

  it('reports snapshot age', () => {
    const now = 1_700_000_000_000;
    expect(rosterAgeMs(null, now)).toBe(Infinity);
    expect(rosterAgeMs(snapshot({ lspd: ['A B'] }, now - 5000), now)).toBe(5000);
  });

  it('matches case-insensitively by substring inside the requested department', () => {
    const snap = snapshot({ lspd: ['Roger Callaghan', 'Brandon Markham'], lssd: ['Alexandra Goes'] });
    expect(searchOfficerRoster(snap, 'roger', 'lspd')).toEqual([{ name: 'Roger Callaghan', department: 'lspd' }]);
    expect(searchOfficerRoster(snap, 'CALLAG', 'lspd')).toEqual([{ name: 'Roger Callaghan', department: 'lspd' }]);
  });

  it('falls back to the other rosters when the department misses (alt account)', () => {
    const snap = snapshot({ lspd: ['Roger Callaghan'], lssd: ['Alexandra Goes'] });
    expect(searchOfficerRoster(snap, 'alexandra', 'lspd')).toEqual([
      { name: 'Alexandra Goes', department: 'lssd' },
    ]);
  });

  it('searches every roster when no department is chosen (auto-detect)', () => {
    const snap = snapshot({ lspd: ['Roger Callaghan'], lssd: ['Roger Callaghan'], sadcr: ['Esther Cohen'], dao: [] });
    const matches = searchOfficerRoster(snap, 'roger', '');
    expect(matches).toHaveLength(2);
    expect(matches.map(m => m.department).sort()).toEqual(['lspd', 'lssd']);
  });

  it('ignores queries shorter than two characters and empty snapshots', () => {
    const snap = snapshot({ lspd: ['Roger Callaghan'] });
    expect(searchOfficerRoster(snap, 'r', 'lspd')).toEqual([]);
    expect(searchOfficerRoster(null, 'roger', 'lspd')).toEqual([]);
  });

  it('refreshes when nothing is cached, and stays quiet when the refresh fails', async () => {
    const fetchDepartments = vi.fn();
    const fresh = await refreshOfficerRoster(fetchDepartments, { force: false });
    // No snapshot is stored in this environment, so the fetcher must be called.
    expect(fetchDepartments).toHaveBeenCalledTimes(1);
    expect(fresh).toBeNull();
  });

  it('returns the freshly fetched snapshot and never throws on refresh failure', async () => {
    const ok = await refreshOfficerRoster(async () => ({ lspd: ['Roger Callaghan'] }));
    expect(ok?.departments.lspd).toEqual(['Roger Callaghan']);
    expect(countRosterNames(ok.departments)).toBe(1);

    const failed = await refreshOfficerRoster(async () => { throw new Error('callable down'); }, { force: true });
    expect(failed).toBeNull();
  });
});
