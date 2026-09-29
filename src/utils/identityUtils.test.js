// Tests for telemetryUserLabel — pure identity label used for the hourly
// telemetry Visited list. "username (character)" when both identities are
// known and differ; graceful fallbacks otherwise.
import { describe, it, expect } from 'vitest';
import { telemetryUserLabel } from './identityUtils';

describe('telemetryUserLabel', () => {
    it('username + characterName differ -> "uname (cname)"', () => {
        expect(telemetryUserLabel({ username: 'john_doe', faction: { characterName: 'John Doe' } }))
            .toBe('john_doe (John Doe)');
    });

    it('identical username and characterName -> uname only', () => {
        expect(telemetryUserLabel({ username: 'John Doe', faction: { characterName: 'John Doe' } }))
            .toBe('John Doe');
    });

    it('no faction -> uname only', () => {
        expect(telemetryUserLabel({ username: 'john_doe' })).toBe('john_doe');
    });

    it('no user -> Unknown', () => {
        expect(telemetryUserLabel(undefined)).toBe('Unknown');
        expect(telemetryUserLabel(null)).toBe('Unknown');
    });

    it('gtawUsername fallback used when username is missing', () => {
        expect(telemetryUserLabel({ gtawUsername: 'gtaw_name' })).toBe('gtaw_name');
        expect(telemetryUserLabel({ gtawUsername: 'gtaw_name', faction: { characterName: 'Other Name' } }))
            .toBe('gtaw_name (Other Name)');
    });
});