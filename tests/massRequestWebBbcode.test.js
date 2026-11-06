/**
 * Web batch ("mass") autopsy request -> bot parser contract.
 *
 * The web modal does not talk to the bot directly: it writes a topicTitle +
 * requestBBCode to `autopsy-requests/pending`, the bot posts that verbatim to
 * f=265, and autopsyRequestMonitor parses the posted text. These tests build a
 * request from morgue records and feed it through the REAL parser, so a change
 * to the builder or the parser that breaks compatibility fails here.
 */
import { describe, it, expect } from 'vitest';
import {
    parseMassRequestBbcode,
    isMassRequest,
    parseMassTitle,
} from '../discord-bot/services/autopsyRequestMonitor.js';
import {
    buildMassAutopsyRequestPayload,
    toMassRequestBodies,
    validateMassRequest,
} from '../src/utils/autopsyRequest.js';
import {
    buildSubmittedNotification,
    buildPostedNotification,
} from '../discord-bot/services/webAutopsyRequestEmbed.js';

// Shapes match morgue-records (DataContext adds firebaseKey).
const RECORDS = [
    {
        firebaseKey: 'rec-101', caseId: '101', name: 'Luis Angel ((Angel_L))', sex: 'Male',
        ethnicity: 'Hispanic', timeOfDeath: 'Wednesday, 14 October 2026 22:25:00', location: 'SASP, LSC',
    },
    {
        firebaseKey: 'rec-102', caseId: '102', name: 'Ryan Kennedy ((RKennedy))', sex: 'male',
        ethnicity: 'Caucasian', timeOfDeath: '', timeOfDeathISO: '2026-10-14T21:56:00', location: 'SASP, LSC',
    },
    {
        firebaseKey: 'rec-103', caseId: '103', name: 'Thiago Ferguson ((TFerguson))', sex: 'Male',
        ethnicity: 'Hispanic', timeOfDeath: 'Wednesday, 14 October 2026 21:56:00', location: 'SASP, LSC',
    },
];

const REQUESTER = {
    name: 'Officer J. Baker', rank: 'Officer I', dept: 'LSPD - Homicide', badge: '4412',
    agencyForum: 'LSPD', forumAccountUrl: 'https://lspd.gta.world/memberlist.php?mode=viewprofile&u=42',
    guidelinesRead: true, cell: '555-0123', discord: 'jbaker',
};

const DETAILS = {
    synopsis: 'Four bodies recovered after a shooting on Forum Drive.',
    causeDetail: 'Homicide investigation — cause and manner of death required.',
};

const build = (records = RECORDS, overrides = {}) => {
    const bodies = toMassRequestBodies(records);
    if (overrides.ckIndexes) overrides.ckIndexes.forEach((i) => { bodies[i] = { ...bodies[i], deathType: 'CK' }; });
    return buildMassAutopsyRequestPayload({
        requester: REQUESTER,
        details: DETAILS,
        bodies,
        incidentLabel: 'Davis Shooting',
        characterName: 'J. Baker',
    });
};

describe('morgue records -> batch request body prefills', () => {
    it('prefills one body per record from the morgue intake fields', () => {
        const bodies = toMassRequestBodies(RECORDS);
        expect(bodies).toHaveLength(3);
        expect(bodies.map(b => [b.caseId, b.decedentName, b.oocName])).toEqual([
            ['101', 'Luis Angel', 'Angel_L'],
            ['102', 'Ryan Kennedy', 'RKennedy'],
            ['103', 'Thiago Ferguson', 'TFerguson'],
        ]);
        // "Wednesday, 14 October 2026 22:25:00" -> 14/OCT/2026 + 10:25 PM
        expect(bodies[0]).toMatchObject({
            gender: 'Male', ethnicity: 'Hispanic', dateOfDeath: '14/OCT/2026', timeOfDeath: '10:25 PM',
        });
        // Falls back to timeOfDeathISO when the human-readable value is absent.
        expect(bodies[1]).toMatchObject({ dateOfDeath: '14/OCT/2026', timeOfDeath: '09:56 PM' });
    });

    it('deduplicates by record key and defaults every body to PK', () => {
        const bodies = toMassRequestBodies([...RECORDS, RECORDS[0]]);
        expect(bodies).toHaveLength(3);
        expect(bodies.every(b => b.deathType === 'PK')).toBe(true);
    });
});

describe('generated request survives the bot mass parser', () => {
    it('produces a title the bot classifies as mass (never singular)', () => {
        const payload = build();
        expect(payload.topicTitle).toBe('[Mass Autopsy Request] Davis Shooting [LSPD]');
        // The leading [Mass ...] tag is what keeps the singular TITLE_REGEX
        // from claiming the topic — reordering the title breaks the flow.
        expect(payload.topicTitle.trim().startsWith('[Mass Autopsy Request]')).toBe(true);
        expect(isMassRequest(payload.topicTitle, payload.requestBBCode)).toBe(true);
        expect(parseMassTitle(payload.topicTitle)).toEqual({ label: 'Davis Shooting', agency: 'LSPD' });
    });

    it('parses every body, its fields and per-body PK/CK', () => {
        const payload = build(RECORDS, { ckIndexes: [2] });
        const mass = parseMassRequestBbcode(payload.requestBBCode);
        expect(mass.error).toBeUndefined();
        expect(mass.decedentCount).toBe(3);
        expect(mass.skippedBodies).toEqual([]);
        expect(mass.bodies.map(b => b.name)).toEqual(['Luis Angel', 'Ryan Kennedy', 'Thiago Ferguson']);
        expect(mass.bodies.map(b => b.oocName)).toEqual(['Angel_L', 'RKennedy', 'TFerguson']);
        expect(mass.bodies.map(b => b.deathType)).toEqual(['PK', 'PK', 'CK']);
        expect(mass.bodies.map(b => b.sex)).toEqual(['Male', 'Male', 'Male']);
        expect(mass.bodies[0]).toMatchObject({
            ethnicity: 'Hispanic', dateOfDeath: '14/OCT/2026', timeOfDeath: '10:25 PM', placeOfDeath: 'SASP, LSC',
        });
        // Complete records produce no "incomplete" warnings.
        expect(mass.bodies.every(b => b.incomplete.length === 0)).toBe(true);
        expect(mass.warnings.filter(w => /incomplete/.test(w))).toEqual([]);
    });

    it('shares Section 1/3 across bodies and drops a mixed Section-4 type', () => {
        const payload = build(RECORDS, { ckIndexes: [2] });
        const mass = parseMassRequestBbcode(payload.requestBBCode);
        expect(mass.shared).toMatchObject({
            requesterName: 'Officer J. Baker',
            requesterRank: 'Officer I',
            requesterDept: 'LSPD - Homicide',
            requesterBadge: '4412',
            requesterCell: '555-0123',
            requesterDiscord: 'jbaker',
            synopsis: DETAILS.synopsis,
            causeDetail: DETAILS.causeDetail,
        });
        // "MIXED - SEE EACH BODY IN SECTION 2" carries no PK/CK token, so the
        // bot clears the shared value instead of mislabelling every body.
        expect(mass.shared.deathType).toBe('');
        // Section 2 leftovers must never leak as a shared decedent.
        expect(mass.shared.decedentName).toBeUndefined();
    });

    it('writes a uniform type into Section 4', () => {
        const payload = build();
        const mass = parseMassRequestBbcode(payload.requestBBCode);
        expect(mass.shared.deathType).toBe('PK');
        expect(mass.bodies.map(b => b.deathType)).toEqual(['PK', 'PK', 'PK']);
    });

    it('files blank body fields blank so the bot flags them incomplete', () => {
        const records = [{ ...RECORDS[0], sex: '', ethnicity: '', location: '' }, RECORDS[1]];
        const payload = build(records);
        const mass = parseMassRequestBbcode(payload.requestBBCode);
        expect(mass.bodies[0].incomplete).toEqual(expect.arrayContaining(['Gender', 'Ethnicity', 'Location']));
        expect(mass.bodies[0].sex).toBe('');
    });

    it('keeps a real IC name with no ((OOC)) (bot files it rather than skipping)', () => {
        const records = [RECORDS[0], { ...RECORDS[1], name: 'Ryan Kennedy' }];
        const payload = build(records);
        const mass = parseMassRequestBbcode(payload.requestBBCode);
        expect(mass.bodies).toHaveLength(2);
        expect(mass.skippedBodies).toEqual([]);
        expect(mass.warnings.some(w => /filed on IC name/.test(w))).toBe(true);
    });
});

describe('client-side validation mirrors the parser skip rules', () => {
    it('accepts a complete batch and blocks a bodyless or unlabelled one', () => {
        const bodies = toMassRequestBodies(RECORDS);
        expect(validateMassRequest({ incidentLabel: 'Davis Shooting', requester: REQUESTER, bodies })).toEqual([]);
        expect(validateMassRequest({ incidentLabel: '', requester: REQUESTER, bodies })).toContain('Incident / operation name');
        expect(validateMassRequest({ incidentLabel: 'X', requester: REQUESTER, bodies: bodies.slice(0, 1) }))
            .toContain('At least 2 bodies selected');
    });

    it('requires an ((OOC)) for a John/Jane Doe body only', () => {
        const bodies = toMassRequestBodies(RECORDS);
        const doe = { ...bodies[0], decedentName: 'John Doe', oocName: '' };
        const named = { ...bodies[1], decedentName: 'Ryan Kennedy', oocName: '' };
        const problems = validateMassRequest({ incidentLabel: 'X', requester: REQUESTER, bodies: [doe, named] });
        expect(problems.some(p => /John\/Jane|unidentified/.test(p))).toBe(true);
        expect(problems.filter(p => /Body 2/.test(p))).toEqual([]);
    });
});

describe('web submission Discord embeds', () => {
    const fieldsOf = (notification) => Object.fromEntries(notification.embeds[0].fields.map((f) => [f.name, f.value]));

    it('renders a batch-aware submitted embed (no singular "Decedent" field)', () => {
        const payload = build(RECORDS, { ckIndexes: [2] });
        const notification = buildSubmittedNotification(payload);
        const embed = notification.embeds[0];

        expect(notification.content).toBe('**New mass autopsy request submitted — 3 bodies**');
        expect(embed.title).toBe('[Mass Autopsy Request] Davis Shooting [LSPD]');
        expect(embed.color).toBe(0xe8a33d);
        expect(embed.description).toBe([
            '**1.** Luis Angel ((Angel_L)) — PK · #101',
            '**2.** Ryan Kennedy ((RKennedy)) — PK · #102',
            '**3.** Thiago Ferguson ((TFerguson)) — CK · #103',
        ].join('\n'));

        expect(fieldsOf(notification)).toMatchObject({
            'Bodies': '3',
            'Morgue Cases': '#101, #102, #103',
            'Requester': 'Officer J. Baker',
            'Department': 'LSPD - Homicide',
            'PK / CK': '2 PK · 1 CK',
        });
        expect(fieldsOf(notification).Decedent).toBeUndefined();
    });

    it('keeps the singular submitted embed unchanged', () => {
        const notification = buildSubmittedNotification({
            topicTitle: 'Autopsy Request - Unknown ((Repo Scaletta)) [LSSD]',
            decedentName: 'Unknown',
            oocName: 'Repo Scaletta',
            caseId: '85230',
            requesterName: 'E. Quinones',
            requesterDept: 'LSSD - Internal Affairs Bureau',
        });
        const embed = notification.embeds[0];

        expect(notification.content).toBe('**New autopsy request submitted**');
        expect(embed.color).toBe(0x00bcd4);
        expect(embed.title).toBe('Autopsy Request - Unknown ((Repo Scaletta)) [LSSD]');
        expect(embed.fields).toEqual([
            { name: 'Decedent', value: 'Unknown ((Repo Scaletta))', inline: true },
            { name: 'Morgue Case #', value: '85230', inline: true },
            { name: 'Requester', value: 'E. Quinones', inline: true },
            { name: 'Department', value: 'LSSD - Internal Affairs Bureau', inline: true },
        ]);
    });

    it('caps the body list and summarises the remainder', () => {
        const many = Array.from({ length: 20 }, (_, i) => ({
            firebaseKey: `r${i}`,
            caseId: String(900 + i),
            name: `Body ${i + 1} Person`,
            sex: 'Male',
            ethnicity: 'Caucasian',
            timeOfDeath: 'Wednesday, 14 October 2026 21:56:00',
            location: 'SASP, LSC',
        }));
        const notification = buildSubmittedNotification(build(many));
        const embed = notification.embeds[0];
        expect(embed.description).toContain('**12.** Body 12 Person');
        expect(embed.description).toContain('…and 8 more');
        expect(embed.description).not.toContain('**13.**');
        expect(fieldsOf(notification).Bodies).toBe('20');
        expect(fieldsOf(notification)['Morgue Cases']).toBe('#900, #901, #902, #903, #904, #905, #906, #907 +12 more');
    });

    it('labels the posted notification with the batch size', () => {
        const payload = build();
        const notification = buildPostedNotification(payload, 'https://phmc.gta.world/viewtopic.php?t=12345');
        expect(notification.content).toBe('**Mass autopsy request posted to the forum — 3 bodies** — <https://phmc.gta.world/viewtopic.php?t=12345>');
        expect(notification.embeds[0].title).toBe('[Mass Autopsy Request] Davis Shooting [LSPD]');
        expect(notification.embeds[0].color).toBe(0x28a745);

        const singular = buildPostedNotification({
            topicTitle: 'Autopsy Request - Unknown ((Repo Scaletta)) [LSSD]',
        }, 'https://phmc.gta.world/viewtopic.php?t=1');
        expect(singular.content).toBe('**Autopsy request posted to the forum** — <https://phmc.gta.world/viewtopic.php?t=1>');
    });
});
