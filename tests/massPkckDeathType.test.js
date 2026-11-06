/**
 * Per-body PK/CK resolution for mass autopsy requests (2026-10-13 fix).
 *
 * Section 4's "1.) PK/CK" is ONE shared field, but mass requesters routinely mix
 * types ("CK FOR ISABELA SALAZAR, PK FOR THE OTHER TWO"). Storing that sentence
 * as every body's deathType mislabelled the PK bodies on the ME panel AND gave
 * them the CK 72h wait window (limitHoursFor keys off the first "ck").
 *
 * t=… Hawick, Oct 2026 — 3 bodies, one CK (Isabela Salazar), two PK. The
 * expectations below are that request.
 */
import { describe, it, expect } from 'vitest';
import { parseMassRequestBbcode, deriveBodyDeathTypes, isMassRequest } from '../discord-bot/services/autopsyRequestMonitor.js';
import { normalizeDeathType, limitHoursFor } from '../discord-bot/services/outstandingAutopsies.js';
import { normalizePanelAssignment, groupAssignmentsByMe } from '../discord-bot/services/massAssignmentPanel.js';

const HAWICK_BBCODE = `[divbox=lightgrey][b]SECTION 1: REQUESTER'S INFORMATION[/b][/divbox]
[divbox=white][b]1.) Name:[/b] JOYCE PAWIRONADI
[b]2.) Rank:[/b] DETECTIVE I
[b]3.) Department / Assignment:[/b] LOS SANTOS POLICE DEPARTMENT - GANG ENFORCEMENT DETAIL - INVESTIGATIVE SECTION
[b]4.) Badge/Serial Number:[/b] 133061
[/divbox]
[divbox=lightgrey][b]SECTION 2: DECEDENT'S INFORMATION[/b][/divbox]
[divbox=white]
--- BODY 1 ---
[b]1.) Decedent Name:[/b] John Doe ((Tyler Barrett))
[b]2.) Gender:[/b] Male
[b]3.) Ethnicity:[/b] Caucasian
[b]4.) Date of Death:[/b] 06/OCT/2026
[b]5.) Time of Death:[/b] 15:39
[b]6.) Location:[/b] HAWICK AVENUE, HAWICK
--- BODY 2 ---
[b]1.) Decedent Name:[/b] John Doe ((Braylon Pharell))
[b]2.) Gender:[/b] Male
[b]3.) Ethnicity:[/b] Caucasian
[b]4.) Date of Death:[/b] 06/OCT/2026
[b]5.) Time of Death:[/b] 15:39
[b]6.) Location:[/b] HAWICK AVENUE, HAWICK
--- BODY 3 ---
[b]1.) Decedent Name:[/b] Isabela Salazar ((CK))
[b]2.) Gender:[/b] Female
[b]3.) Ethnicity:[/b] Hispanic
[b]4.) Date of Death:[/b] 06/OCT/2026
[b]5.) Time of Death:[/b] 15:39
[b]6.) Location:[/b] HAWICK AVENUE, HAWICK
[/divbox]
[divbox=lightgrey][b]SECTION 3: DETAILS[/b][/divbox]
[divbox=white][b]1.) Synopsis:[/b] Firefight with another group.
[b]2.) Reason for Autopsy:[/b] INVESTIGATION
[/divbox]
[divbox=lightgrey][b][ooc]SECTION 4: OOC INFORMATION[/ooc][/b][/divbox]
[divbox=white][b]1.) PK/CK[/b]: CK FOR ISABELA SALAZAR, PK FOR THE OTHER TWO[/divbox]`;

describe('normalizeDeathType', () => {
    it('collapses a single code and rejects mixed free text', () => {
        expect(normalizeDeathType('CK')).toBe('CK');
        expect(normalizeDeathType('pk for all')).toBe('PK');
        expect(normalizeDeathType(' CK ')).toBe('CK');
        expect(normalizeDeathType('CK FOR X, PK FOR Y')).toBe('');
        expect(normalizeDeathType('')).toBe('');
        expect(normalizeDeathType(undefined)).toBe('');
    });

    it('does not match CK/PK inside unrelated words', () => {
        expect(normalizeDeathType('picked up')).toBe('');
        expect(normalizeDeathType('packed')).toBe('');
    });
});

describe('deriveBodyDeathTypes', () => {
    const bodies = [
        { name: 'John Doe', oocName: 'Tyler Barrett' },
        { name: 'John Doe', oocName: 'Braylon Pharell' },
        { name: 'Isabela Salazar', oocName: 'CK' },
    ];

    it('attributes the named body, then the catch-all, then the leading default', () => {
        expect(deriveBodyDeathTypes('CK FOR ISABELA SALAZAR, PK FOR THE OTHER TWO', bodies))
            .toEqual(['PK', 'PK', 'CK']);
    });

    it('handles whole-batch declarations', () => {
        expect(deriveBodyDeathTypes('ALL PK', bodies)).toEqual(['PK', 'PK', 'PK']);
        expect(deriveBodyDeathTypes('PK FOR ALL', bodies)).toEqual(['PK', 'PK', 'PK']);
        expect(deriveBodyDeathTypes('CK', bodies)).toEqual(['CK', 'CK', 'CK']);
        expect(deriveBodyDeathTypes('', bodies)).toEqual(['', '', '']);
        expect(deriveBodyDeathTypes('SEE NOTES', bodies)).toEqual(['', '', '']);
    });

    it('handles name-keyed clauses in either order and by OOC name', () => {
        expect(deriveBodyDeathTypes('PK FOR THE REST, CK FOR ISABELA SALAZAR', bodies))
            .toEqual(['PK', 'PK', 'CK']);
        expect(deriveBodyDeathTypes('John Doe - PK, Isabela Salazar - CK', bodies))
            .toEqual(['PK', 'PK', 'CK']); // both John Doe bodies answer to that name
        expect(deriveBodyDeathTypes('CK FOR TYLER BARRETT, PK FOR THE OTHERS', bodies))
            .toEqual(['CK', 'PK', 'PK']);
    });
});

describe('mass request with a mixed Section 4 PK/CK line', () => {
    it('parses the request and resolves one type per body', () => {
        expect(isMassRequest('', HAWICK_BBCODE)).toBe(true);
        const mass = parseMassRequestBbcode(HAWICK_BBCODE);
        expect(mass.decedentCount).toBe(3);
        expect(mass.skippedBodies).toEqual([]);
        expect(mass.bodies.map((b) => b.deathType)).toEqual(['PK', 'PK', 'CK']);
        expect(mass.bodies[2].name).toBe('Isabela Salazar');
    });

    it('gives each body its own wait window (CK 72h / PK 120h)', () => {
        const mass = parseMassRequestBbcode(HAWICK_BBCODE);
        const shared = mass.shared.deathType; // "CK FOR ISABELA SALAZAR, PK FOR THE OTHER TWO"
        expect(limitHoursFor(shared)).toBe(72); // legacy collection-level value…
        expect(mass.bodies.map((b) => limitHoursFor(b.deathType))).toEqual([120, 120, 72]); // …per body now
    });

    it('renders the per-body type on the ME panel rows', () => {
        const mass = parseMassRequestBbcode(HAWICK_BBCODE);
        const assignments = mass.bodies.map((b, i) => normalizePanelAssignment({
            me: i === 2 ? 'Nora Vance' : 'Arthur Blackwood',
            name: b.name, ooc: b.oocName, sex: b.sex,
            dateOfDeath: b.dateOfDeath, timeOfDeath: b.timeOfDeath,
            deathType: b.deathType || mass.shared.deathType,
            placeOfDeath: b.placeOfDeath,
        }));
        const groups = groupAssignmentsByMe(assignments);
        expect(groups.map((g) => [g.me, g.bodies.map((b) => b.deathType)]))
            .toEqual([['Arthur Blackwood', ['PK', 'PK']], ['Nora Vance', ['CK']]]);
    });

    it('falls back to the shared sentence for a body the resolver cannot attribute', () => {
        const mass = parseMassRequestBbcode(HAWICK_BBCODE.replace('Tyler Barrett', 'Unlisted Person'));
        const types = deriveBodyDeathTypes('CK FOR NOBODY HERE, PK FOR THE OTHER TWO', mass.bodies);
        expect(types).toEqual(['PK', 'PK', 'PK']);
    });
});
