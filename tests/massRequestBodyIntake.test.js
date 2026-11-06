/**
 * Mass autopsy request body intake — missing ((OOC)) + per-body "Type of Death".
 *
 * t=10392 "[Mass autopsy Request] HUA3 Brawl [SADCR]" (Oct 2026, 4 bodies) was
 * detected but parked whole because every body omitted the ((OOC)) brackets:
 * the mass parser treated a missing OOC as a hard skip per body, so 0 bodies
 * parsed → the request went to caseState "skipped" and (until now) nobody was
 * told. The legacy multi-decedent path already tolerated this (file + warn), so
 * the mass path now matches it: a real IC name is an identity on its own.
 *
 * The template also gains a per-body "Type of Death: PK/CK" line so a body's
 * type no longer depends on the shared Section-4 sentence (or the OOC slot).
 */
import { describe, it, expect } from 'vitest';
import { parseMassRequestBbcode, isMassRequest } from '../discord-bot/services/autopsyRequestMonitor.js';

// The HUA3 Brawl request, mirroring t=10392: four real IC names, no ((OOC)),
// Section 4's PK/CK left as the template placeholder "ANSWER".
const HUA3_BBCODE = `[divbox=lightgrey][b]SECTION 1: REQUESTER'S INFORMATION[/b][/divbox]
[divbox=white][b]1.) Name:[/b] Stefan Maroto
[b]2.) Rank:[/b] Correctional Officer
[b]3.) Department / Assignment:[/b] SADCR - ISU
[b]4.) Badge/Serial Number:[/b] 217630
[/divbox]
[divbox=lightgrey][b]SECTION 2: DECEDENT'S INFORMATION[/b][/divbox]
[divbox=white]
--- BODY 1 ---
[b]1.) Decedent Name:[/b] Luis Angel
[b]2.) Gender:[/b] Male
[b]3.) Ethnicity:[/b] Hispanic
[b]4.) Date of Death:[/b] 14/OCT/2026
[b]5.) Time of Death:[/b] 22:25PM
[b]6.) Location:[/b] SASP, LSC
--- BODY 2 ---
[b]1.) Decedent Name:[/b] Ryan Kennedy
[b]2.) Gender:[/b] Male
[b]3.) Ethnicity:[/b] Caucasian
[b]4.) Date of Death:[/b] 14/OCT/2026
[b]5.) Time of Death:[/b] 21:56 PM
[b]6.) Location:[/b] SASP, LSC
--- BODY 3 ---
[b]1.) Decedent Name:[/b] Thiago Ferguson
[b]2.) Gender:[/b] Male
[b]3.) Ethnicity:[/b] Hispanic
[b]4.) Date of Death:[/b] 14/OCT/2026
[b]5.) Time of Death:[/b] 21:56 PM
[b]6.) Location:[/b] SASP, LSC
--- BODY 4 ---
[b]1.) Decedent Name:[/b] Hector Angel
[b]2.) Gender:[/b] Male
[b]3.) Ethnicity:[/b] Hispanic
[b]4.) Date of Death:[/b] 14/OCT/2026
[b]5.) Time of Death:[/b] 21:56 PM
[b]6.) Location:[/b] SASP, LSC
[/divbox]
[divbox=lightgrey][b]SECTION 3: DETAILS[/b][/divbox]
[divbox=white][b]1.) Synopsis:[/b] Mass brawl in housing unit A3.
[b]2.) Reason for Autopsy:[/b] ISU Investigation
[/divbox]
[divbox=lightgrey][b][ooc]SECTION 4: OOC INFORMATION[/ooc][/b][/divbox]
[divbox=white][b]1.) PK/CK[/b]: ANSWER[/divbox]`;

describe('mass bodies without an ((OOC)) name', () => {
    it('files a real IC name and warns instead of skipping the body', () => {
        expect(isMassRequest('[Mass autopsy Request] HUA3 Brawl [SADCR]', HUA3_BBCODE)).toBe(true);
        const mass = parseMassRequestBbcode(HUA3_BBCODE);
        expect(mass.error).toBeUndefined();
        expect(mass.decedentCount).toBe(4);
        expect(mass.bodies.map((b) => b.name)).toEqual(['Luis Angel', 'Ryan Kennedy', 'Thiago Ferguson', 'Hector Angel']);
        expect(mass.bodies.every((b) => b.oocName === '')).toBe(true);
        expect(mass.skippedBodies).toEqual([]);
        expect(mass.warnings.filter((w) => /filed on IC name/.test(w))).toHaveLength(4);
    });

    it('keeps skipping a body whose name is not an identity (DOE/UNKNOWN)', () => {
        const bbcode = HUA3_BBCODE.replace('Luis Angel', 'John Doe');
        const mass = parseMassRequestBbcode(bbcode);
        expect(mass.decedentCount).toBe(3);
        expect(mass.skippedBodies).toEqual([
            { label: '1', name: 'John Doe', oocName: '', reason: 'missing ((OOC)) name' },
        ]);
    });

    it('keeps skipping an "Unknown" body without ((OOC))', () => {
        const bbcode = HUA3_BBCODE.replace('Hector Angel', 'Unknown');
        const mass = parseMassRequestBbcode(bbcode);
        expect(mass.decedentCount).toBe(3);
        expect(mass.skippedBodies.map((s) => s.reason)).toEqual(['missing ((OOC)) name']);
    });

    it('skips a block with no name line at all', () => {
        const bbcode = HUA3_BBCODE.replace('[b]1.) Decedent Name:[/b] Hector Angel', '[b]1.) Decedent Name:[/b]');
        const mass = parseMassRequestBbcode(bbcode);
        expect(mass.decedentCount).toBe(3);
        expect(mass.skippedBodies[0].reason).toBe('missing decedent name');
    });

    it('still parks a post whose every body is unidentifiable', () => {
        let bbcode = HUA3_BBCODE;
        for (const n of ['Luis Angel', 'Ryan Kennedy', 'Thiago Ferguson', 'Hector Angel']) {
            bbcode = bbcode.replace(n, 'John Doe');
        }
        const mass = parseMassRequestBbcode(bbcode);
        expect(mass.error).toContain('No parseable bodies found');
    });
});

describe('per-body "Type of Death" line', () => {
    // Inject the line right after each body's Location line.
    const inject = (bbcode, perBody) => {
        const names = ['Luis Angel', 'Ryan Kennedy', 'Thiago Ferguson', 'Hector Angel'];
        let out = bbcode;
        names.forEach((n, i) => {
            if (!perBody[i]) return;
            const anchor = out.indexOf(`[b]1.) Decedent Name:[/b] ${n}`);
            const locIdx = out.indexOf('[b]6.) Location:[/b] SASP, LSC', anchor);
            const insertAt = locIdx + '[b]6.) Location:[/b] SASP, LSC'.length;
            out = `${out.slice(0, insertAt)}\n[b]7.) Type of Death:[/b] ${perBody[i]}${out.slice(insertAt)}`;
        });
        return out;
    };

    it('wins over the shared Section-4 sentence', () => {
        let bbcode = inject(HUA3_BBCODE, ['PK', '', 'CK', 'PK']);
        bbcode = bbcode.replace('1.) PK/CK[/b]: ANSWER', '1.) PK/CK[/b]: CK FOR THIAGO FERGUSON, PK FOR THE OTHER TWO');
        const mass = parseMassRequestBbcode(bbcode);
        expect(mass.bodies.map((b) => b.deathType)).toEqual(['PK', 'PK', 'CK', 'PK']);
    });

    it('treats the ambiguous hint value "PK/CK" as unresolved', () => {
        const bbcode = inject(HUA3_BBCODE.replace('1.) PK/CK[/b]: ANSWER', '1.) PK/CK[/b]: ALL PK'), ['PK/CK', '', '', '']);
        const mass = parseMassRequestBbcode(bbcode);
        expect(mass.bodies.map((b) => b.deathType)).toEqual(['PK', 'PK', 'PK', 'PK']);
    });

    it('never reads a Section-3 type line for the last body', () => {
        let bbcode = inject(HUA3_BBCODE, ['PK', 'PK', 'PK', '']);
        bbcode = bbcode.replace('2.) Reason for Autopsy:[/b] ISU Investigation', '2.) Reason for Autopsy:[/b] ISU Investigation\nType of Death: CK');
        bbcode = bbcode.replace('1.) PK/CK[/b]: ANSWER', '1.) PK/CK[/b]: PK');
        const mass = parseMassRequestBbcode(bbcode);
        expect(mass.bodies.map((b) => b.deathType)).toEqual(['PK', 'PK', 'PK', 'PK']);
    });

    it('drops a placeholder Section-4 PK/CK ("ANSWER")', () => {
        const mass = parseMassRequestBbcode(HUA3_BBCODE);
        expect(mass.shared.deathType).toBe('');
        expect(mass.bodies.every((b) => b.deathType === '')).toBe(true);
    });
});

// The template body block as staff will publish it (2026-10-15), with the new
// "7.) Type of Death:" line. The pinned template post must never file, and a
// filled-in copy must read the type from the body block.
const NEW_TEMPLATE_BLOCK = `[b]1.) Decedent Name:[/b] ANSWER ((OOC NAME))
[b]2.) Gender:[/b] ANSWER
[b]3.) Ethnicity:[/b] ANSWER
[b]4.) Date of Death:[/b] DD/MMM/YYYY (DATE YOU FOUND THE BODY)
[b]5.) Time of Death:[/b] 00:00 AM/PM (TIME LSFD/PHMC DECEASED DECEASED, YOU CAN USE /CDAMAGES TO FIND TIMES)
[b]6.) Location:[/b] STREET NAME, AREA
[b]7.) Type of Death: [/b] PK/CK`;

const wrapMassPost = (bodyBlocks) => `[divbox=lightgrey][b]SECTION 1: REQUESTER'S INFORMATION[/b][/divbox]
[divbox=white][b]1.) Name:[/b] Stefan Maroto
[b]2.) Rank:[/b] Correctional Officer
[b]3.) Department / Assignment:[/b] SADCR - ISU
[b]4.) Badge/Serial Number:[/b] 217630
[/divbox]
[divbox=lightgrey][b]SECTION 2: DECEDENT'S INFORMATION[/b][/divbox]
[divbox=white]
--- BODY 1 ---
${bodyBlocks[0]}
${bodyBlocks[1] ? `--- BODY 2 ---\n${bodyBlocks[1]}\n` : ''}[/divbox]
[divbox=lightgrey][b]SECTION 3: DETAILS[/b][/divbox]
[divbox=white][b]1.) Synopsis:[/b] Mass brawl.
[b]2.) Reason for Autopsy:[/b] ISU Investigation
[/divbox]
[divbox=lightgrey][b][ooc]SECTION 4: OOC INFORMATION[/ooc][/b][/divbox]
[divbox=white][b]1.) PK/CK[/b]: ANSWER[/divbox]`;

describe('the new template body block (7. Type of Death)', () => {
    it('never files the placeholder template itself', () => {
        const mass = parseMassRequestBbcode(wrapMassPost([NEW_TEMPLATE_BLOCK, NEW_TEMPLATE_BLOCK]));
        // Every body is ANSWER ((OOC NAME)) → all skipped, so the post parks
        // rather than filing (or adopting "PK/CK" from the hint line).
        expect(mass.error).toContain('No parseable bodies found');
        expect(mass.bodies ?? []).toEqual([]);
    });

    it('reads the per-body type from a filled-in block', () => {
        const filled = NEW_TEMPLATE_BLOCK
            .replace('ANSWER ((OOC NAME))', 'Luis Angel ((Angel_L))')
            .replace('DD/MMM/YYYY (DATE YOU FOUND THE BODY)', '14/OCT/2026')
            .replace('00:00 AM/PM (TIME LSFD/PHMC DECEASED DECEASED, YOU CAN USE /CDAMAGES TO FIND TIMES)', '22:25PM')
            .replace('STREET NAME, AREA', 'SASP, LSC')
            .replace(/\[b\]7\.\) Type of Death: \[\/b\] PK\/CK/, '[b]7.) Type of Death: [/b] CK');
        const mass = parseMassRequestBbcode(wrapMassPost([filled]));
        expect(mass.error).toBeUndefined();
        expect(mass.bodies).toHaveLength(1);
        expect(mass.bodies[0]).toMatchObject({ name: 'Luis Angel', oocName: 'Angel_L', deathType: 'CK' });
    });

    it('reads a per-body type even when the ((OOC)) is omitted', () => {
        const filled = NEW_TEMPLATE_BLOCK
            .replace('ANSWER ((OOC NAME))', 'Thiago Ferguson')
            .replace(/\[b\]7\.\) Type of Death: \[\/b\] PK\/CK/, '[b]7.) Type of Death: [/b] PK');
        const mass = parseMassRequestBbcode(wrapMassPost([filled]));
        expect(mass.bodies).toHaveLength(1);
        expect(mass.bodies[0]).toMatchObject({ name: 'Thiago Ferguson', oocName: '', deathType: 'PK' });
        expect(mass.warnings.some((w) => /filed on IC name/.test(w))).toBe(true);
    });
});
