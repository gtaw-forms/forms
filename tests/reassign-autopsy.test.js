/**
 * Shared reassignment core (`performReassign`, commands/reassign-autopsy.js).
 *
 * Contract the V2 panels rely on:
 *  - the original assignment panel is EDITED in place after a reassign (full
 *    context kept), falling back to a complete assignment card only when no
 *    panel exists;
 *  - a discord.js client is accepted as `client` (the panels pass
 *    interaction.client) — the forum client is separate;
 *  - errors come back as {ok:false} instead of throwing (deferred interactions
 *    must always be able to answer).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../discord-bot/services/autopsyRotation.js', () => ({
    reassignME: vi.fn(async () => {}),
}));
vi.mock('../discord-bot/services/meDiscordNotify.js', () => ({
    notifyAssignment: vi.fn(async () => {}),
}));
vi.mock('../discord-bot/services/singlePanelV2.js', () => ({
    refreshSinglePanelAssignment: vi.fn(async () => ({ refreshed: true })),
}));
// The shared forum client is used when no forumClient override is supplied.
vi.mock('../discord-bot/services/forumClient.js', () => {
    const calls = { edit: [], reply: [] };
    const client = {
        calls,
        ensureBrowser: async () => {},
        login: async () => {},
        editTopicTitle: async (...args) => { calls.edit.push(args); },
        replyToTopic: async (...args) => { calls.reply.push(args); return { ok: true }; },
        getGroupMembers: async () => [{ name: 'New ME', userId: '42' }],
        searchForum: async () => [],
    };
    return { getForumClient: () => client, __client: client };
});

const { performReassign } = await import('../discord-bot/commands/reassign-autopsy.js');
const { notifyAssignment } = await import('../discord-bot/services/meDiscordNotify.js');
const { reassignME } = await import('../discord-bot/services/autopsyRotation.js');
const { refreshSinglePanelAssignment } = await import('../discord-bot/services/singlePanelV2.js');
const sharedForum = (await import('../discord-bot/services/forumClient.js')).__client;

process.env.FORUM_BASE_URL = 'https://phmc.test';
process.env.FORUM_USERNAME = 'bot';
process.env.FORUM_PASSWORD = 'not-a-real-password';

function makeDb(entry) {
    const writes = [];
    const node = (path) => ({
        once: async () => ({ exists: () => true, val: () => (path === 'autopsy-requested/T1' ? entry : null) }),
        set: async (v) => { writes.push({ path, v }); },
        update: async (v) => { writes.push({ path, v }); },
        child: (p) => node(`${path}/${p}`),
    });
    return { db: { ref: (p) => node(p) }, writes };
}

function makeForumClient() {
    const calls = { edit: [], reply: [] };
    return {
        calls,
        ensureBrowser: async () => {},
        login: async () => {},
        editTopicTitle: async (...args) => { calls.edit.push(args); },
        replyToTopic: async (...args) => { calls.reply.push(args); return { ok: true }; },
        getGroupMembers: async () => [{ name: 'New ME', userId: '42' }],
        searchForum: async () => [],
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    refreshSinglePanelAssignment.mockResolvedValue({ refreshed: true });
});

describe('performReassign', () => {
    it('retitles, replies, updates Firebase and edits the existing panel', async () => {
        const entry = {
            assignedTo: 'Old ME',
            caseTopicId: 555,
            caseTitle: 'Case 12 - John Doe ((JD)) [LSPD] - Old ME',
        };
        const { db, writes } = makeDb(entry);
        const forum = makeForumClient();

        const res = await performReassign({ db, forumClient: forum, topicId: 'T1', newME: 'New ME' });

        expect(res.ok).toBe(true);
        expect(res.already).toBe(false);
        expect(res.currentAssigned).toBe('Old ME');
        expect(res.caseUrl).toBe('https://phmc.test/viewtopic.php?t=555');
        expect(forum.calls.edit[0][2]).toBe('Case 12 - John Doe ((JD)) [LSPD] - New ME');
        expect(forum.calls.reply[0][2]).toContain('Reassigned');
        expect(writes).toContainEqual({ path: 'autopsy-requested/T1/assignedTo', v: 'New ME' });
        expect(writes).toContainEqual({ path: 'autopsy-requested/T1/caseTitle', v: 'Case 12 - John Doe ((JD)) [LSPD] - New ME' });
        expect(reassignME).toHaveBeenCalledWith(db, 'Old ME', 'New ME', 'T1');
        // Full-context panel is edited in place; no second (minimal) card.
        expect(refreshSinglePanelAssignment).toHaveBeenCalledWith(db, null, { requestTopicId: 'T1', caseIdx: null });
        expect(notifyAssignment).not.toHaveBeenCalled();
    });

    it('posts a complete assignment card only when no panel exists', async () => {
        refreshSinglePanelAssignment.mockResolvedValue({ refreshed: false, reason: 'no-panel-ref' });
        const entry = {
            assignedTo: 'Old ME',
            caseTopicId: 556,
            caseTitle: 'Case 5 - Unknown ((Charles Brigante)) - Old ME',
            caseNum: '560',
            name: 'Unknown',
            oocName: 'Charles Brigante',
            parsed: { deathType: 'CK' },
        };
        const { db } = makeDb(entry);
        const forum = makeForumClient();

        const res = await performReassign({ db, forumClient: forum, topicId: 'T1', newME: 'New ME' });

        expect(res.ok).toBe(true);
        expect(notifyAssignment).toHaveBeenCalledTimes(1);
        expect(notifyAssignment.mock.calls[0][4]).toMatchObject({
            decedent: 'Unknown',
            ooc: 'Charles Brigante',
            caseNumber: '560',
            deathType: 'CK',
            requestTopicId: 'T1',
        });
    });

    it('reports already-assigned without writing anything', async () => {
        const { db, writes } = makeDb({ assignedTo: 'New ME', caseTopicId: 1, caseTitle: 'Case 1 - X - New ME' });
        const forum = makeForumClient();
        const res = await performReassign({ db, forumClient: forum, topicId: 'T1', newME: 'new me' });
        expect(res).toMatchObject({ ok: true, already: true });
        expect(writes).toHaveLength(0);
        expect(forum.calls.edit).toHaveLength(0);
        expect(notifyAssignment).not.toHaveBeenCalled();
    });

    it('updates the per-body record for a case index', async () => {
        const entry = {
            assignedTo: 'Old ME',
            cases: {
                0: { assignedTo: 'Old ME', name: 'Body One', caseTopicId: 777, caseTitle: 'Case 9 - Body One - Old ME' },
            },
        };
        const { db, writes } = makeDb(entry);
        const forum = makeForumClient();
        const res = await performReassign({ db, forumClient: forum, topicId: 'T1', caseIdx: '0', newME: 'New ME' });
        expect(res.ok).toBe(true);
        expect(writes).toContainEqual({ path: 'autopsy-requested/T1/cases/0/assignedTo', v: 'New ME' });
        expect(writes).toContainEqual({ path: 'autopsy-requested/T1/cases/0/caseTitle', v: 'Case 9 - Body One - New ME' });
        expect(writes.some((w) => w.path === 'autopsy-requested/T1/assignedTo')).toBe(false);
        expect(refreshSinglePanelAssignment).toHaveBeenCalledWith(db, null, { requestTopicId: 'T1', caseIdx: '0' });
    });

    it('dry run skips forum, panel and Discord writes but keeps Firebase in sync', async () => {
        const entry = { assignedTo: 'Old ME', caseTopicId: 5, caseTitle: 'Case 3 - Y - Old ME' };
        const { db, writes } = makeDb(entry);
        const forum = makeForumClient();
        const res = await performReassign({ db, forumClient: forum, topicId: 'T1', newME: 'New ME', dryRun: true });
        expect(res).toMatchObject({ ok: true, dryRun: true });
        expect(forum.calls.edit).toHaveLength(0);
        expect(forum.calls.reply).toHaveLength(0);
        expect(refreshSinglePanelAssignment).not.toHaveBeenCalled();
        expect(notifyAssignment).not.toHaveBeenCalled();
        expect(writes).toContainEqual({ path: 'autopsy-requested/T1/assignedTo', v: 'New ME' });
    });

    it('passes a discord.js client through to the panel refresh and uses the shared forum client', async () => {
        const entry = { assignedTo: 'Old ME', caseTopicId: 900, caseTitle: 'Case 4 - Z - Old ME' };
        const { db } = makeDb(entry);
        const discordClient = { user: { tag: 'Supervisor#0001' }, channels: {} };
        sharedForum.calls.edit.length = 0;

        const res = await performReassign({ db, client: discordClient, topicId: 'T1', newME: 'New ME' });

        expect(res.ok).toBe(true);
        expect(sharedForum.calls.edit[0][2]).toBe('Case 4 - Z - New ME');
        expect(refreshSinglePanelAssignment).toHaveBeenCalledWith(db, discordClient, { requestTopicId: 'T1', caseIdx: null });
    });

    it('returns an error instead of throwing when the topic cannot be resolved', async () => {
        const { db } = makeDb({ assignedTo: 'Old ME' });
        const forum = makeForumClient();
        const res = await performReassign({ db, forumClient: forum, topicId: 'T1', newME: 'New ME' });
        expect(res.ok).toBe(false);
        expect(String(res.error)).toMatch(/case topic/i);
    });
});
