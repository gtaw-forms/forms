/**
 * Shared-thread mass collection: report → body matching (2026-10-19 fix).
 *
 * t=10392 (HUA3 Brawl) filed four bodies from a request that omitted ((OOC)):
 * `name` carried the identity, `oocName` was empty. The MEs then submitted the
 * reports the normal way — `John Doe ((Luis Angel))`, `Unknown ((Ryan Kennedy))` —
 * so the report's OOC held what the body stored as its NAME. The matcher only
 * compared OOC→OOC and name→name, found nothing, and quarantined every report
 * (so no body was ever marked completed and the overdue monitor kept firing).
 */
import { describe, it, expect } from 'vitest';
import { matchCollectionCase } from '../discord-bot/services/deployAutopsyReply.js';

const collection = (cases) => ({ '10392': { cases } });

describe('matchCollectionCase — report OOC vs body identity', () => {
    const hua3 = collection({
        0: { name: 'Luis Angel', oocName: '', assignedTo: 'Arthur Blackwood' },
        1: { name: 'Ryan Kennedy', oocName: '', assignedTo: 'Alyson Frost' },
        2: { name: 'Thiago Ferguson', oocName: '', assignedTo: 'Anne Carter' },
        3: { name: 'Hector Angel', oocName: '', assignedTo: 'Sarah Bell' },
    });

    it('matches a report filed as "John Doe ((IC name))" to the IC-name body', () => {
        expect(matchCollectionCase(hua3, 'Luis Angel', 'John Doe')?.ci).toBe(0);
        expect(matchCollectionCase(hua3, 'Thiago Ferguson', 'John Doe')?.ci).toBe(2);
        expect(matchCollectionCase(hua3, 'Hector Angel', 'John Doe')?.ci).toBe(3);
    });

    it('matches "Unknown ((IC name))" too (case-insensitive)', () => {
        expect(matchCollectionCase(hua3, 'ryan kennedy', 'Unknown')?.ci).toBe(1);
    });

    it('still matches a normal body by its OOC', () => {
        const legacy = collection({
            0: { name: 'John Doe', oocName: 'Alice Smith' },
            1: { name: 'John Doe', oocName: 'Bob Jones' },
        });
        expect(matchCollectionCase(legacy, 'Bob Jones', 'John Doe')?.ci).toBe(1);
    });

    it('still matches a normal body by its IC name', () => {
        const legacy = collection({
            0: { name: 'Jordan Reyes', oocName: 'Alice Smith' },
            1: { name: 'Casey Doyle', oocName: 'Bob Jones' },
        });
        expect(matchCollectionCase(legacy, '', 'Casey Doyle')?.ci).toBe(1);
    });

    it('never matches a placeholder identity', () => {
        const noOoc = collection({ 0: { name: 'John Doe', oocName: '' } });
        expect(matchCollectionCase(noOoc, 'John Doe', 'John Doe')).toBeNull();
        expect(matchCollectionCase(noOoc, 'Unknown', 'Unknown')).toBeNull();
    });

    it('uses the body OOC as a name when the body name is a placeholder', () => {
        const unknownName = collection({ 0: { name: 'Unknown', oocName: 'Cara Vale' } });
        expect(matchCollectionCase(unknownName, '', 'Cara Vale')?.ci).toBe(0);
    });

    it('treats a PK/CK marker in the body OOC slot as "no OOC", not an identity', () => {
        // Request template style "Jane Doe ((PK))" parses to oocName:"PK".
        // Live: mass #10493 body Genevieve Kennedy never completed because the
        // report's OOC held the name while the body's OOC held "PK".
        const typed = collection({
            0: { name: 'Cristian Ricci', oocName: 'PK' },
            1: { name: 'Genevieve Kennedy', oocName: 'PK' },
            2: { name: 'Maya Zapata', oocName: 'CK' },
        });
        expect(matchCollectionCase(typed, 'Genevieve Kennedy', 'Jane Doe')?.ci).toBe(1);
        expect(matchCollectionCase(typed, 'Maya Zapata', 'Unknown')?.ci).toBe(2);
        // A report whose OOC is literally "PK" must not match a PK body by type.
        expect(matchCollectionCase(typed, 'PK', 'Jane Doe')).toBeNull();
    });

    it('prefers an uncompleted body over a completed twin', () => {
        const dup = collection({
            0: { name: 'Zed', oocName: '', completedAt: '2026-10-01T00:00:00Z' },
            1: { name: 'Zed', oocName: '', completedAt: null },
        });
        expect(matchCollectionCase(dup, 'Zed', '')?.ci).toBe(1);
    });

    it('finds the collection among other entries', () => {
        const all = {
            1: { cases: { 0: { name: 'Someone Else', oocName: 'Other' } } },
            10392: hua3['10392'],
        };
        expect(matchCollectionCase(all, 'Ryan Kennedy', 'Unknown')).toMatchObject({ rkey: '10392', ci: 1 });
    });
});
