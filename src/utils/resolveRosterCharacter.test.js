// Tests for functions/src/auth/index.js resolveRosterCharacter — the pure
// roster resolver that maps an OAuth character to a faction roster record.
//
// This file imports the REAL Cloud Functions module, so every top-level
// dependency of that module is vi.mock'd (hoisted) to keep importing it free of
// firebase-admin init and env reads. The function under test is pure; none of
// the mocked symbols are exercised by these tests.
import { describe, it, expect, vi } from 'vitest';

vi.mock('firebase-functions/v2/https', () => ({
    onCall: () => () => ({}),
}));

vi.mock('firebase-functions', () => ({
    https: { HttpsError: class extends Error {} },
}));

vi.mock('../../functions/src/utils/firebase.js', () => ({
    db: {},
    auth: {},
    timestamp: null,
    admin: {},
}));

vi.mock('../../functions/src/utils/config.js', () => ({
    getConfig: () => ({}),
    getConfigValue: () => null,
}));

vi.mock('../../functions/src/utils/helpers.js', () => ({
    sendWebhook: async () => false,
}));

vi.mock('../../functions/src/auth/ucpClient.js', () => ({
    fetchUcpUserProfile: async () => ({}),
}));

import { resolveRosterCharacter } from '../../functions/src/auth/index.js';

const FROST_ROSTER = { '5573': { characterName: 'Alyson Frost' } };

describe('resolveRosterCharacter', () => {
    describe('id lookup', () => {
        it('exact hit on String(character.id) as the roster record key (number id coerced)', () => {
            const character = { id: 5573, firstname: 'Alyson', lastname: 'Frost' };
            const result = resolveRosterCharacter(character, FROST_ROSTER);
            expect(result).toEqual({ key: '5573', memberData: { characterName: 'Alyson Frost' } });
        });

        it('string id hits the same roster key', () => {
            const character = { id: '5573', firstname: 'Alyson', lastname: 'Frost' };
            const result = resolveRosterCharacter(character, FROST_ROSTER);
            expect(result).toEqual({ key: '5573', memberData: { characterName: 'Alyson Frost' } });
        });

        it('id wins even when the name matches nobody', () => {
            const character = { id: 5573, firstname: 'Totally', lastname: 'Different' };
            const result = resolveRosterCharacter(character, FROST_ROSTER);
            expect(result).toEqual({ key: '5573', memberData: { characterName: 'Alyson Frost' } });
        });
    });

    describe('name fallback', () => {
        it('account-id miss falls back to an exact name match (THE regression)', () => {
            const character = { id: 43132, firstname: 'Alyson', lastname: 'Frost' };
            const result = resolveRosterCharacter(character, FROST_ROSTER);
            expect(result).toEqual({ key: '5573', memberData: { characterName: 'Alyson Frost' } });
        });

        it('name fallback is case-insensitive and whitespace-normalized', () => {
            const character = { id: 43132, firstname: 'alyson', lastname: 'frost' };
            const roster = { '5573': { characterName: '  Alyson   Frost  ' } };
            const result = resolveRosterCharacter(character, roster);
            expect(result).toEqual({ key: '5573', memberData: { characterName: '  Alyson   Frost  ' } });
        });

        it('firstname only (no lastname) matches a single-word characterName', () => {
            const character = { firstname: 'Medic' };
            const roster = { '123': { characterName: 'Medic' } };
            const result = resolveRosterCharacter(character, roster);
            expect(result).toEqual({ key: '123', memberData: { characterName: 'Medic' } });
        });

        it('account-id miss with no matching name returns null', () => {
            const character = { id: 99999, firstname: 'Nobody', lastname: 'Here' };
            expect(resolveRosterCharacter(character, FROST_ROSTER)).toBeNull();
        });
    });

    describe('edge inputs', () => {
        it('null/undefined character returns null', () => {
            expect(resolveRosterCharacter(null, FROST_ROSTER)).toBeNull();
            expect(resolveRosterCharacter(undefined, FROST_ROSTER)).toBeNull();
        });

        it('null/undefined allMembers returns null', () => {
            const character = { id: 5573, firstname: 'Alyson', lastname: 'Frost' };
            expect(resolveRosterCharacter(character, null)).toBeNull();
            expect(resolveRosterCharacter(character, undefined)).toBeNull();
        });

        it('no id and blank/absent names returns null (oauthName trims to empty)', () => {
            expect(resolveRosterCharacter({ firstname: '', lastname: '' }, FROST_ROSTER)).toBeNull();
            expect(resolveRosterCharacter({}, FROST_ROSTER)).toBeNull();
            expect(resolveRosterCharacter({ firstname: '   ', lastname: '   ' }, FROST_ROSTER)).toBeNull();
        });
    });
});