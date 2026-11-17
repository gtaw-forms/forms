/**
 * Shared reassignment core (`performReassign`, commands/reassign-autopsy.js).
 *
 * The V2 panels import this function; it was missing from the module (only the
 * slash command had the inline logic), so every panel Reassign press threw
 * before acknowledging — Discord then showed "application didn't respond in
 * time". These tests pin the contract the panels rely on.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../discord-bot/services/autopsyRotation.js', () => ({
    reassignME: vi.fn(async () => {}),
}));
vi.mock('../discord-bot/services/meDiscordNotify.js', () => ({
    notifyAssignment: vi.fn(async () => {}),
}));
// The shared forum client is the fallback when a caller passes a non-forum
// client (the V2 panels pass interaction.client, which is discord.js).
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

function makeClient() {
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
});

describe('performReassign', () => {
    it('retitles, replies, updates Firebase and pings the new ME', async () => {
        const entry = {
            assignedTo: 'Old ME',
            caseTopicId: 555,
            caseTitle: 'Case 12 - John Doe ((JD)) [LSPD] - Old ME',
        };
        const { db, writes } = makeDb(entry);
        const client = makeClient();

        const res = await performReassign({ db, client, topicId: 'T1', newME: 'New ME' });

        expect(res.ok).toBe(true);
        expect(res.already).toBe(false);
        expect(res.currentAssigned).toBe('Old ME');
        expect(res.caseUrl).toBe('https://phmc.test/viewtopic.php?t=555');
        expect(client.calls.edit[0][2]).toBe('Case 12 - John Doe ((JD)) [LSPD] - New ME');
        expect(client.calls.reply[0][2]).toContain('Reassigned');
        expect(writes).toContainEqual({ path: 'autopsy-requested/T1/assignedTo', v: 'New ME' });
        expect(writes).toContainEqual({ path: 'autopsy-requested/T1/caseTitle', v: 'Case 12 - John Doe ((JD)) [LSPD] - New ME' });
        expect(reassignME).toHaveBeenCalledWith(db, 'Old ME', 'New ME', 'T1');
        expect(notifyAssignment).toHaveBeenCalled();
    });

    it('reports already-assigned without writing anything', async () => {
        const { db, writes } = makeDb({ assignedTo: 'New ME', caseTopicId: 1, caseTitle: 'Case 1 - X - New ME' });
        const client = makeClient();
        const res = await performReassign({ db, client, topicId: 'T1', newME: 'new me' });
        expect(res).toMatchObject({ ok: true, already: true });
        expect(writes).toHaveLength(0);
        expect(client.calls.edit).toHaveLength(0);
    });

    it('updates the per-body record for a case index', async () => {
        const entry = {
            assignedTo: 'Old ME',
            cases: {
                0: { assignedTo: 'Old ME', name: 'Body One', caseTopicId: 777, caseTitle: 'Case 9 - Body One - Old ME' },
            },
        };
        const { db, writes } = makeDb(entry);
        const client = makeClient();
        const res = await performReassign({ db, client, topicId: 'T1', caseIdx: '0', newME: 'New ME' });
        expect(res.ok).toBe(true);
        expect(writes).toContainEqual({ path: 'autopsy-requested/T1/cases/0/assignedTo', v: 'New ME' });
        expect(writes).toContainEqual({ path: 'autopsy-requested/T1/cases/0/caseTitle', v: 'Case 9 - Body One - New ME' });
        expect(writes.some((w) => w.path === 'autopsy-requested/T1/assignedTo')).toBe(false);
    });

    it('dry run skips forum and Discord writes but keeps Firebase in sync', async () => {
        const entry = { assignedTo: 'Old ME', caseTopicId: 5, caseTitle: 'Case 3 - Y - Old ME' };
        const { db, writes } = makeDb(entry);
        const client = makeClient();
        const res = await performReassign({ db, client, topicId: 'T1', newME: 'New ME', dryRun: true });
        expect(res).toMatchObject({ ok: true, dryRun: true });
        expect(client.calls.edit).toHaveLength(0);
        expect(client.calls.reply).toHaveLength(0);
        expect(notifyAssignment).not.toHaveBeenCalled();
        expect(writes).toContainEqual({ path: 'autopsy-requested/T1/assignedTo', v: 'New ME' });
    });

    it('ignores a non-forum client (interaction.client) and uses the shared forum client', async () => {
        const entry = { assignedTo: 'Old ME', caseTopicId: 900, caseTitle: 'Case 4 - Z - Old ME' };
        const { db } = makeDb(entry);
        const discordClient = { user: { tag: 'Supervisor#0001' }, channels: {} };
        sharedForum.calls.edit.length = 0;

        const res = await performReassign({ db, client: discordClient, topicId: 'T1', newME: 'New ME' });

        expect(res.ok).toBe(true);
        expect(sharedForum.calls.edit[0][2]).toBe('Case 4 - Z - New ME');
    });

    it('returns an error instead of throwing when the topic cannot be resolved', async () => {
        const { db } = makeDb({ assignedTo: 'Old ME' });
        const client = makeClient();
        const res = await performReassign({ db, client, topicId: 'T1', newME: 'New ME' });
        expect(res.ok).toBe(false);
        expect(String(res.error)).toMatch(/case topic/i);
    });
});
