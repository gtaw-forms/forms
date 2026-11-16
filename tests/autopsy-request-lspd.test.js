import { describe, it, expect } from 'vitest';
import { isLspdRequester, validateMassRequest } from '../src/utils/autopsyRequest.js';

// LSPD runs its own portal and has no phpBB forum profiles: the Forum Account
// URL field is hidden and not required for LSPD requesters (single + mass
// request modals). The backend needs nothing — an empty URL parses to D.N.A
// and the forum-profile DM step skips gracefully.

describe('isLspdRequester', () => {
  it('matches the agency-forum dropdown pick (any casing)', () => {
    expect(isLspdRequester({ agencyForum: 'LSPD', requesterDept: '' })).toBe(true);
    expect(isLspdRequester({ agencyForum: 'lspd', requesterDept: 'LSSD - Patrol' })).toBe(true);
  });

  it('matches the department code prefix (any casing)', () => {
    expect(isLspdRequester({ agencyForum: '', requesterDept: 'LSPD - Homicide' })).toBe(true);
    expect(isLspdRequester({ agencyForum: '', requesterDept: 'lspd' })).toBe(true);
  });

  it('matches the full department name', () => {
    expect(isLspdRequester({ agencyForum: '', requesterDept: 'Los Santos Police Department' })).toBe(true);
  });

  it('rejects other agencies, blanks and lookalikes', () => {
    expect(isLspdRequester({ agencyForum: 'LSSD', requesterDept: '' })).toBe(false);
    expect(isLspdRequester({ agencyForum: '', requesterDept: 'LSSD - Patrol' })).toBe(false);
    expect(isLspdRequester({ agencyForum: '', requesterDept: 'Los Santos County Sheriffs Department' })).toBe(false);
    expect(isLspdRequester({ agencyForum: '', requesterDept: '' })).toBe(false);
    expect(isLspdRequester({})).toBe(false);
    expect(isLspdRequester({ agencyForum: 'PHMC', requesterDept: 'PHMC' })).toBe(false);
  });
});

describe('validateMassRequest LSPD exemption', () => {
  const base = {
    incidentLabel: 'Davis Shooting',
    bodies: [
      { decedentName: 'John Doe', oocName: 'Jane Smith' },
      { decedentName: 'Jane Doe', oocName: 'John Smith' },
    ],
  };
  const requester = (over) => ({
    name: 'Officer J. Baker', rank: 'Officer I', dept: 'LSPD - Homicide',
    badge: '123', agencyForum: '', forumAccountUrl: '', guidelinesRead: true,
    cell: '', discord: '', ...over,
  });

  it('LSPD via dropdown needs no forum URL', () => {
    const missing = validateMassRequest({ ...base, requester: requester({ agencyForum: 'LSPD', dept: '' }) });
    expect(missing).not.toContain('Forum account URL');
  });

  it('LSPD via department text needs no forum URL', () => {
    const missing = validateMassRequest({ ...base, requester: requester({}) });
    expect(missing).not.toContain('Forum account URL');
  });

  it('non-LSPD without a URL still fails', () => {
    const missing = validateMassRequest({ ...base, requester: requester({ agencyForum: 'LSSD', dept: 'LSSD - Patrol' }) });
    expect(missing).toContain('Forum account URL');
  });

  it('blank agency still requires the URL', () => {
    const missing = validateMassRequest({ ...base, requester: requester({ agencyForum: '', dept: '' }) });
    expect(missing).toContain('Forum account URL');
    expect(missing).toContain('Requester department');
  });
});
