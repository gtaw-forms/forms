/**
 * Autopsy completion guards (Hawick incident, 2026-10-14).
 *
 * A report filed as `decedentName: "Unknown"` fell through to the completion
 * flow's last-resort NAME match, which accepted the placeholder and completed
 * EVERY open entry answering to it — one decedent's report written onto two
 * unrelated stale duplicates (t=10076/t=10083) plus two junk LSPD crossposts.
 * The DM step then failed forever because the CASELINK fallback literal
 * ('CASELINK [BOT]') never matched its own guard ('CASELINK [Bot]').
 *
 * These are the pure predicates the flow now uses; keep them behaviour-locked.
 */
import { describe, it, expect } from 'vitest';
import { isDoePlaceholder, isNonIdentityPlaceholder } from '../discord-bot/services/doePlaceholders.js';
import {
    CASELINK_ACCOUNT, isCaselinkAccount, isUnusableDmTarget, nameFallbackVerdict,
} from '../discord-bot/services/autopsyCompletionGuards.js';

describe('isNonIdentityPlaceholder', () => {
    it('rejects unidentified-body placeholders, not just DOE markers', () => {
        for (const v of ['Unknown', 'unknown', '  Unknown  ', 'Unknown ()', 'UNKNOWN', 'Unidentified', 'Unidentified Male', 'N/A', '']) {
            expect(isNonIdentityPlaceholder(v), JSON.stringify(v)).toBe(true);
        }
    });

    it('still rejects DOE markers', () => {
        for (const v of ['John Doe', 'Jane Doe', 'J. DOE', 'DOE', 'DOE and DOE']) {
            expect(isNonIdentityPlaceholder(v), v).toBe(true);
        }
    });

    it('accepts real decedent names', () => {
        for (const v of ['Tyreese Greene', 'Isabela Salazar', 'Akil Yazz', 'Keantay Greer', 'Martín Fernández']) {
            expect(isNonIdentityPlaceholder(v), v).toBe(false);
        }
    });

    it('leaves isDoePlaceholder untouched for existing callers', () => {
        expect(isDoePlaceholder('John Doe')).toBe(true);
        expect(isDoePlaceholder('Unknown')).toBe(false); // the hole this incident exposed
        expect(isNonIdentityPlaceholder('Unknown')).toBe(true);
    });
});

describe('isCaselinkAccount / isUnusableDmTarget', () => {
    it('matches every CASELINK casing the forum returns', () => {
        for (const v of ['CASELINK [Bot]', 'CASELINK [BOT]', 'caselink [bot]', 'CASELINK']) {
            expect(isCaselinkAccount(v), v).toBe(true);
        }
        expect(isCaselinkAccount('Sarah Bell')).toBe(false);
        expect(isCaselinkAccount('')).toBe(false);
    });

    it('never lets a placeholder or CASELINK target reach sendPM', () => {
        for (const v of ['', '   ', 'Requesting Party', 'requesting party', 'PHMC Forms Bot', 'CASELINK [BOT]', CASELINK_ACCOUNT]) {
            expect(isUnusableDmTarget(v), JSON.stringify(v)).toBe(true);
        }
        for (const v of ['Raizy Faulkner', 'ISU-IGI', 'Jacob Hall']) {
            expect(isUnusableDmTarget(v), v).toBe(false);
        }
    });
});

describe('nameFallbackVerdict', () => {
    const open = {};
    const done = { completedAt: '2026-09-08T18:19:35.748Z' };

    it('quarantines the placeholder name (the Hawick regression)', () => {
        const v = nameFallbackVerdict('Unknown', [open, open]);
        expect(v.accept).toBe(false);
        expect(v.reason).toContain('placeholder');
        expect(v.openCount).toBe(0);
    });

    it('quarantines an ambiguous name — it must not complete every open request', () => {
        const v = nameFallbackVerdict('Tyreese Greene', [open, done, open]);
        expect(v.accept).toBe(false);
        expect(v.openCount).toBe(2);
        expect(v.reason).toContain('2 OPEN');
    });

    it('quarantines when nothing open answers to the name', () => {
        expect(nameFallbackVerdict('Tyreese Greene', [done]).accept).toBe(false);
        expect(nameFallbackVerdict('Tyreese Greene', []).accept).toBe(false);
        expect(nameFallbackVerdict('', [open]).accept).toBe(false);
    });

    it('accepts exactly one open match — including alongside completed duplicates', () => {
        const v = nameFallbackVerdict('Tyreese Greene', [done, open]);
        expect(v.accept).toBe(true);
        expect(v.openCount).toBe(1);
    });
});
