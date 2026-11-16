import { describe, it, expect, vi } from 'vitest';
import { searchLssdRequestTopic } from '../discord-bot/services/deployLssd.js';

// Regression test for LSSD #84490 (Sep-30 Marchetti/Bates thread) collecting
// eight unrelated bot replies for four later "Unknown" cases (Oct 24 – Nov 7).
// The bare-name fallback term + substring title check matched ANY thread with
// "unknown" in the title. Placeholder names must now never seed or verify a term.

const STRANGER_THREAD = { topicId: 84490, title: 'Autopsy Request - Unknown ((Stefano Marchetti)), John Doe ((Jamarion Bates)) [LSSD]' };
const OWN_THREAD = { topicId: 84501, title: 'Autopsy Request - Unknown ((David Fuentas)) [LSSD]' };

const clientReturning = (byTerm) => ({
  searchForum: vi.fn(async (term) => byTerm(term) || []),
});

describe('searchLssdRequestTopic placeholder guard', () => {
  it('ignores a stranger "Unknown" thread when the OOC has no thread', async () => {
    // OOC terms find nothing; the bare "Unknown" term must not even be tried.
    const client = clientReturning(() => []);
    const hit = await searchLssdRequestTopic(client, { oocName: 'David Fuentas', name: 'Unknown' }, {});
    expect(hit).toBeNull();
    const tried = client.searchForum.mock.calls.map((c) => c[0]);
    expect(tried).not.toContain('Unknown');
  });

  it('never returns a stranger thread whose title merely contains "unknown"', async () => {
    // Even if the forum search surfaces the stranger thread for the OOC term,
    // title verification must reject it (neither OOC nor usable name matches).
    const client = clientReturning(() => [STRANGER_THREAD]);
    const hit = await searchLssdRequestTopic(client, { oocName: 'David Fuentas', name: 'Unknown' }, {});
    expect(hit).toBeNull();
  });

  it('still finds the case\u2019s own thread via the OOC term', async () => {
    const client = clientReturning((term) => (term.includes('David Fuentas') ? [OWN_THREAD, STRANGER_THREAD] : []));
    const hit = await searchLssdRequestTopic(client, { oocName: 'David Fuentas', name: 'Unknown' }, {});
    expect(hit).not.toBeNull();
    expect(hit.topicId).toBe(84501);
  });

  it('still matches on a usable decedent name (no regression)', async () => {
    const own = { topicId: 84502, title: 'Autopsy Request - John Smith ((John Smitherson)) [LSSD]' };
    const client = clientReturning(() => [own]);
    const hit = await searchLssdRequestTopic(client, { oocName: 'John Smitherson', name: 'John Smith' }, {});
    expect(hit).not.toBeNull();
    expect(hit.topicId).toBe(84502);
  });

  it('treats John Doe like Unknown (prior isGeneric behaviour preserved)', async () => {
    const client = clientReturning(() => []);
    const hit = await searchLssdRequestTopic(client, { oocName: 'Nobody Here', name: 'John Doe' }, {});
    expect(hit).toBeNull();
    const tried = client.searchForum.mock.calls.map((c) => c[0]);
    expect(tried).not.toContain('John Doe');
  });

  it('returns null without searching when nothing usable is given', async () => {
    const client = clientReturning(() => [STRANGER_THREAD]);
    expect(await searchLssdRequestTopic(client, { oocName: '', name: 'Unknown' }, {})).toBeNull();
    expect(await searchLssdRequestTopic(client, {}, {})).toBeNull();
    expect(client.searchForum).not.toHaveBeenCalled();
  });
});
