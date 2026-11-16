/**
 * Private ("confidential") autopsy requests — web payload + bot intake contract.
 *
 * Covers:
 *   - src/utils/autopsyRequest.js  (modal payload, validators, case preview)
 *   - discord-bot/services/privateWebAutopsyIntake.js (validation, BBCode)
 *   - discord-bot/services/privateCaseCreation.js (case creation wiring)
 *
 * The web app never builds the f=266 post for a private request — it writes
 * structured fields and the bot builds/creates the confidential case.
 */
import { describe, it, expect, vi } from 'vitest';

import {
    LE_AGENCIES,
    LSPD_MASS_BLOCK_MESSAGE,
    buildPrivateAutopsyCaseBBCode,
    buildPrivateAutopsyRequestPayload,
    isLeAgency,
    isLspdMassBlocked,
    validatePrivateAutopsyRequest,
} from '../src/utils/autopsyRequest.js';

import {
    detectLeAgency,
    validatePrivateWebEntry,
    buildPrivateWebCaseBbcode,
    privateDedupeKey,
} from '../discord-bot/services/privateWebAutopsyIntake.js';

// ── Mocked rotation/notify so createPrivateCase runs without a forum/Discord ──
vi.mock('../discord-bot/services/autopsyRotation.js', () => ({
    selectME: vi.fn(async () => 'Avery Stone'),
    recordAssignment: vi.fn(async () => {}),
}));
vi.mock('../discord-bot/services/meDiscordNotify.js', () => ({
    notifyAssignment: vi.fn(async () => {}),
}));

const { createPrivateCase, buildPrivateCaseTitle } = await import('../discord-bot/services/privateCaseCreation.js');

const BASE = {
    caseId: '4242',
    decedentName: 'Marcus Vale',
    oocName: 'MVale',
    gender: 'Male',
    ethnicity: 'Caucasian',
    dateOfDeath: '14/NOV/2026',
    timeOfDeath: '09:15 PM',
    placeOfDeath: 'Little Seoul, LS',
    requesterName: 'Officer J. Baker',
    requesterRank: 'Officer II',
    requesterDept: 'LSPD - Homicide',
    requesterBadge: '1177',
    guidelinesRead: true,
    requesterCell: '555-0123',
    requesterDiscord: 'jbaker',
    agencyForum: 'LSPD',
    forumAccountUrl: '',
    deathType: 'CK',
    synopsis: 'Two gunshot wounds observed at the scene.',
    causeDetail: 'Active homicide investigation.',
    privateJustification: 'CF-2026-114 active investigation — authorised by Lt. Reyes',
    cexamineImg: 'https://i.imgur.com/cex.png',
    cinjuriesImg: '',
};

describe('web private payload', () => {
    it('writes the private-pending shape and never a public topic payload', () => {
        const payload = buildPrivateAutopsyRequestPayload({
            record: { caseId: '4242' },
            requester: {
                name: BASE.requesterName, rank: BASE.requesterRank, dept: BASE.requesterDept,
                badge: BASE.requesterBadge, guidelinesRead: true,
                cell: BASE.requesterCell, discord: BASE.requesterDiscord,
            },
            details: { synopsis: BASE.synopsis, causeDetail: BASE.causeDetail, cexamineImg: BASE.cexamineImg, cinjuriesImg: '' },
            justification: BASE.privateJustification,
            characterName: 'Jane Baker',
            agencyForum: 'lspd',
            forumAccountUrl: '',
            deathType: 'CK',
            decedentName: BASE.decedentName,
            oocName: BASE.oocName,
            gender: BASE.gender,
            ethnicity: BASE.ethnicity,
            dateOfDeath: BASE.dateOfDeath,
            timeOfDeath: BASE.timeOfDeath,
            placeOfDeath: BASE.placeOfDeath,
        });

        expect(payload.isPrivate).toBe(true);
        expect(payload.requestType).toBe('private');
        expect(payload.status).toBe('pending');
        expect(payload.agencyForum).toBe('LSPD'); // normalised upper-case
        expect(payload.deathType).toBe('CK');
        expect(payload.privateJustification).toContain('CF-2026-114');
        expect(payload.source).toBe('web-morgue-private');
        expect(payload.createdBy).toBe('Jane Baker');
        // No public forum payload is ever written for a private request.
        expect(payload.topicTitle).toBeUndefined();
        expect(payload.requestBBCode).toBeUndefined();
    });

    it('coerces an unknown death type to PK', () => {
        const payload = buildPrivateAutopsyRequestPayload({ deathType: 'XX' });
        expect(payload.deathType).toBe('PK');
    });

    it('validates law-enforcement only + required justification', () => {
        const requester = { name: 'A', rank: 'B', dept: 'LSPD - Homicide', agencyForum: 'LSPD' };
        expect(validatePrivateAutopsyRequest({ requester, justification: 'CF-2026-114 authorised', decedentName: 'X', forumAccountUrl: '' })).toEqual([]);

        const noJustification = validatePrivateAutopsyRequest({ requester, justification: 'short', decedentName: 'X' });
        expect(noJustification.join(' ')).toMatch(/Private justification/);

        const noLe = validatePrivateAutopsyRequest({ requester: { ...requester, agencyForum: 'PHMC' }, justification: 'CF-2026-114 authorised', decedentName: 'X' });
        expect(noLe.join(' ')).toMatch(/law enforcement only/);
    });

    it('exempts LSPD from the forum account URL but requires it for other agencies', () => {
        const lssd = { name: 'A', rank: 'B', dept: 'LSSD - Detective', agencyForum: 'LSSD' };
        expect(validatePrivateAutopsyRequest({ requester: lssd, justification: 'authorised by command', decedentName: 'X', forumAccountUrl: '' }))
            .toContain('Forum Account URL');
        expect(validatePrivateAutopsyRequest({ requester: lssd, justification: 'authorised by command', decedentName: 'X', forumAccountUrl: 'https://lssd.gta.world/member' }))
            .toEqual([]);
    });

    it('knows the LE agency set and blocks LSPD batch requests', () => {
        expect(LE_AGENCIES).toEqual(['LSPD', 'LSSD', 'SADCR', 'DAO']);
        expect(isLeAgency('lssd')).toBe(true);
        expect(isLeAgency('PHMC')).toBe(false);
        expect(isLspdMassBlocked({ agencyForum: 'LSPD' })).toBe(true);
        expect(isLspdMassBlocked({ requesterDept: 'Los Santos Police Department' })).toBe(true);
        expect(isLspdMassBlocked({ requesterDept: 'LSSD - Detective' })).toBe(false);
        expect(LSPD_MASS_BLOCK_MESSAGE).toBe('This is currently not supported on LSPD DRDB, please try again later.');
    });

    it('previews a confidential case file', () => {
        const bb = buildPrivateAutopsyCaseBBCode({ ...BASE });
        expect(bb).toContain('CONFIDENTIAL AUTOPSY REQUEST');
        expect(bb).toContain('NOT FOR PUBLIC RELEASE');
        expect(bb).toContain('PRIVATE REQUEST - JUSTIFICATION / AUTHORITY');
        expect(bb).toContain('CF-2026-114');
        expect(bb).toContain('Marcus Vale ((MVale))');
    });
});

describe('bot private intake validation', () => {
    it('derives the agency from the department and rejects mismatches', () => {
        expect(detectLeAgency({ agencyForum: 'LSPD', requesterDept: 'LSPD - Homicide' })).toEqual({ ok: true, agency: 'LSPD' });
        expect(detectLeAgency({ agencyForum: '', requesterDept: 'LSSD - Detective' })).toEqual({ ok: true, agency: 'LSSD' });
        const mismatch = detectLeAgency({ agencyForum: 'LSPD', requesterDept: 'LSSD - Detective' });
        expect(mismatch.ok).toBe(false);
        expect(detectLeAgency({ agencyForum: 'PHMC', requesterDept: 'Medical Examiner' }).ok).toBe(false);
    });

    it('fails closed on missing fields, justification and non-LE requests', () => {
        expect(validatePrivateWebEntry({ ...BASE })).toEqual([]);
        expect(validatePrivateWebEntry({ ...BASE, privateJustification: 'no' }).join(' ')).toMatch(/justification/);
        expect(validatePrivateWebEntry({ ...BASE, agencyForum: 'PHMC', requesterDept: 'PHMC' }).join(' ')).toMatch(/law enforcement/);
        expect(validatePrivateWebEntry({ ...BASE, requesterName: '' }).join(' ')).toMatch(/requester name/);
    });

    it('builds the authoritative confidential case post', () => {
        const bb = buildPrivateWebCaseBbcode(BASE);
        expect(bb).toContain('CONFIDENTIAL AUTOPSY REQUEST');
        expect(bb).toContain('NOT FOR PUBLIC RELEASE');
        expect(bb).toContain('CF-2026-114');
        expect(bb).toContain('[b]1.) PK/CK:[/b] CK');
        // Same section labels the web preview shows, so the requester recognises it.
        expect(bb).toContain("SECTION 1: REQUESTER'S INFORMATION");
        expect(bb).toContain("SECTION 2: DECEDENT'S INFORMATION");
    });

    it('keys duplicates on case + decedent + agency', () => {
        expect(privateDedupeKey({ caseId: '9', decedentName: 'John Doe', agencyForum: 'lspd' }))
            .toBe(privateDedupeKey({ caseId: '9', decedentName: 'john doe ', agencyForum: 'LSPD' }));
        expect(privateDedupeKey({ caseId: '9', decedentName: 'A', agencyForum: 'LSPD' }))
            .not.toBe(privateDedupeKey({ caseId: '9', decedentName: 'B', agencyForum: 'LSPD' }));
    });
});

describe('private case creation', () => {
    const makeDb = () => {
        const sets = [];
        const node = (path) => ({
            set: async (v) => { sets.push({ path, v }); },
            update: async (v) => { sets.push({ path, v }); },
            child: (p) => node(`${path}/${p}`),
            once: async () => ({ exists: () => false, val: () => null }),
        });
        return { db: { ref: (p) => node(p) }, sets };
    };

    const makeClient = () => {
        const calls = { postTopic: [], editTopicTitle: [], replyToTopic: [] };
        return {
            calls,
            postTopic: async (forumId, title, bbCode) => {
                calls.postTopic.push({ forumId, title, bbCode });
                return { ok: true, url: 'https://phmc.gta.world/viewtopic.php?t=9001' };
            },
            editTopicTitle: async (topicId, forumId, title) => { calls.editTopicTitle.push({ topicId, forumId, title }); },
            getGroupMembers: async () => [{ name: 'Avery Stone', userId: '42' }],
            replyToTopic: async (topicId, forumId, body) => { calls.replyToTopic.push({ topicId, forumId, body }); return { ok: true }; },
        };
    };

    it('posts to f=266, assigns the ME and writes the private entry', async () => {
        const { db, sets } = makeDb();
        const client = makeClient();
        const posted = [];
        const res = await createPrivateCase({
            db, client, caseNum: 777,
            name: 'Marcus Vale', oocName: 'MVale',
            bbCode: buildPrivateWebCaseBbcode(BASE),
            source: 'web-private',
            onPosted: async (info) => { posted.push(info); },
            entryExtras: {
                agencyForum: 'LSPD', faction: 'lspd', isPrivate: true,
                formsAutopsy: true, deliveryDRDB: true, pmForum: 'lspd',
                parsed: { requesterName: 'Officer J. Baker', requesterDept: 'LSPD - Homicide' },
            },
        });

        expect(res.topicId).toBe('9001');
        expect(res.assignedTo).toBe('Avery Stone');
        expect(res.notified).toBe(true);
        // The caller persists the topic id immediately — before the rest of the
        // wiring — so a crash can never let a retry create a second case.
        expect(posted).toEqual([{ topicId: '9001', url: 'https://phmc.gta.world/viewtopic.php?t=9001', caseTitle: 'Case 777 - Marcus Vale ((MVale)) [PRIVATE] - UNASSIGNED' }]);
        expect(client.calls.postTopic[0].forumId).toBe(266);
        expect(client.calls.postTopic[0].title).toBe('Case 777 - Marcus Vale ((MVale)) [PRIVATE] - UNASSIGNED');
        // Retitled with the assignee + assignment reply posted.
        expect(client.calls.editTopicTitle[0].title).toBe('Case 777 - Marcus Vale ((MVale)) [PRIVATE] - Avery Stone');
        expect(client.calls.replyToTopic[0].forumId).toBe(266);

        const entryWrite = sets.find((s) => s.path === 'autopsy-requested/9001');
        expect(entryWrite).toBeTruthy();
        expect(entryWrite.v).toMatchObject({
            isPrivate: true, faction: 'lspd', agencyForum: 'LSPD',
            deliveryDRDB: true, source: 'web-private', caseNum: '777',
            caseTopicId: '9001', assignedTo: 'Avery Stone',
        });
        expect(entryWrite.v.parsed.requesterName).toBe('Officer J. Baker');
    });

    it('builds the conventional private case title', () => {
        expect(buildPrivateCaseTitle({ caseNum: 12, name: 'Jane Doe', oocName: '' }))
            .toBe('Case 12 - Jane Doe [PRIVATE] - UNASSIGNED');
        expect(buildPrivateCaseTitle({ caseNum: 12, name: 'Jane Doe', oocName: 'JD', assignedTo: 'ME One' }))
            .toBe('Case 12 - Jane Doe ((JD)) [PRIVATE] - ME One');
    });
});
