// Tests for the pure telemetry bucket-mutation core (extracted from the
// useWebhooks accumulator). Covers counters, union/dedupe + caps, error-sample
// cap, and kb totals. Each test starts from a genuinely fresh bucket so mutable
// sub-objects (byTrigger/routes/users/errorSamples) are never shared.
import { describe, it, expect } from 'vitest';
import { accumulateTelemetryEntry, TELEMETRY_MAX_USERS } from './telemetry';

const EMPTY_TELEMETRY_BUCKET = {
    bucketStart: 0, events: 0, cacheHits: 0, network: 0, errors: 0, inactive: 0,
    authed: false, totalKb: 0, netKb: 0, byTrigger: {}, routes: [], users: [], errorSamples: [],
};

const freshBucket = () => ({
    ...EMPTY_TELEMETRY_BUCKET,
    byTrigger: {},
    routes: [],
    users: [],
    errorSamples: [],
});

describe('accumulateTelemetryEntry', () => {
    describe('counts', () => {
        it('cached entry -> events 1, cacheHits 1, network 0', () => {
            const b = freshBucket();
            const result = accumulateTelemetryEntry(b, { cached: true });
            expect(result).toBe(b);
            expect(b.events).toBe(1);
            expect(b.cacheHits).toBe(1);
            expect(b.network).toBe(0);
        });

        it('uncached entry -> network 1, cacheHits 0', () => {
            const b = freshBucket();
            accumulateTelemetryEntry(b, { cached: false });
            expect(b.events).toBe(1);
            expect(b.network).toBe(1);
            expect(b.cacheHits).toBe(0);
        });

        it('error entry -> errors 1 + one errorSample', () => {
            const b = freshBucket();
            accumulateTelemetryEntry(b, { cached: true, error: 'boom' });
            expect(b.errors).toBe(1);
            expect(b.errorSamples).toEqual(['boom']);
        });

        it('inactivity flag on -> inactive 1; off -> 0', () => {
            const on = freshBucket();
            accumulateTelemetryEntry(on, { cached: true }, { getInactivityFlag: () => true });
            expect(on.inactive).toBe(1);

            const off = freshBucket();
            accumulateTelemetryEntry(off, { cached: true }, { getInactivityFlag: () => false });
            expect(off.inactive).toBe(0);
        });

        it('byTrigger increments for entry.trigger / entry.file / unknown fallback', () => {
            const b = freshBucket();
            accumulateTelemetryEntry(b, { cached: true, trigger: 'forms' });
            accumulateTelemetryEntry(b, { cached: true, file: 'morgue.json' });
            accumulateTelemetryEntry(b, { cached: true });
            expect(b.byTrigger).toEqual({ forms: 1, 'morgue.json': 1, unknown: 1 });
        });
    });

    describe('union (routes + users)', () => {
        it('same route twice -> routes length stays 1', () => {
            const b = freshBucket();
            accumulateTelemetryEntry(b, { cached: true, route: '#/report' });
            accumulateTelemetryEntry(b, { cached: true, route: '#/report' });
            expect(b.routes).toEqual(['#/report']);
        });

        it('distinct routes accumulate', () => {
            const b = freshBucket();
            accumulateTelemetryEntry(b, { cached: true, route: '#/a' });
            accumulateTelemetryEntry(b, { cached: true, route: '#/b' });
            expect(b.routes).toEqual(['#/a', '#/b']);
        });

        it('routes cap at 20 (21st distinct route ignored)', () => {
            const b = freshBucket();
            for (let i = 0; i < 25; i += 1) {
                accumulateTelemetryEntry(b, { cached: true, route: `#/r${i}` });
            }
            expect(b.routes).toHaveLength(20);
            expect(b.routes[19]).toBe('#/r19');
            expect(b.routes).not.toContain('#/r20');
        });

        it('same user label twice -> users length stays 1', () => {
            const b = freshBucket();
            accumulateTelemetryEntry(b, { cached: true, loggedIn: true, user: 'john_doe' });
            accumulateTelemetryEntry(b, { cached: true, loggedIn: true, user: 'john_doe' });
            expect(b.users).toEqual(['john_doe']);
        });

        it('authed set true when a logged-in user is recorded', () => {
            const b = freshBucket();
            expect(b.authed).toBe(false);
            accumulateTelemetryEntry(b, { cached: true, loggedIn: true, user: 'john_doe' });
            expect(b.authed).toBe(true);
        });

        it('users cap at TELEMETRY_MAX_USERS', () => {
            const b = freshBucket();
            for (let i = 0; i < TELEMETRY_MAX_USERS + 5; i += 1) {
                accumulateTelemetryEntry(b, { cached: true, loggedIn: true, user: `user${i}` });
            }
            expect(b.users).toHaveLength(TELEMETRY_MAX_USERS);
            expect(b.users[TELEMETRY_MAX_USERS - 1]).toBe(`user${TELEMETRY_MAX_USERS - 1}`);
            expect(b.users).not.toContain(`user${TELEMETRY_MAX_USERS}`);
        });

        it('user label truncated to 80 chars', () => {
            const b = freshBucket();
            const long = 'x'.repeat(120);
            accumulateTelemetryEntry(b, { cached: true, loggedIn: true, user: long });
            expect(b.users).toEqual([long.slice(0, 80)]);
            expect(b.users[0]).toHaveLength(80);
        });
    });

    describe('caps', () => {
        it('errorSamples capped at 10 while errors keeps growing', () => {
            const b = freshBucket();
            for (let i = 0; i < 15; i += 1) {
                accumulateTelemetryEntry(b, { cached: true, error: `err${i}` });
            }
            expect(b.errors).toBe(15);
            expect(b.errorSamples).toHaveLength(10);
            expect(b.errorSamples[0]).toBe('err0');
            expect(b.errorSamples[9]).toBe('err9');
            expect(b.errorSamples).not.toContain('err10');
        });
    });

    describe('totals', () => {
        it('totalKb/netKb summed', () => {
            const b = freshBucket();
            accumulateTelemetryEntry(b, { cached: false, totalKb: 10.5, netKb: 5.5 });
            accumulateTelemetryEntry(b, { cached: false, totalKb: 2, netKb: 2 });
            expect(b.totalKb).toBe(12.5);
            expect(b.netKb).toBe(7.5);
        });

        it('non-numeric kb values treated as 0', () => {
            const b = freshBucket();
            accumulateTelemetryEntry(b, { cached: true, totalKb: 'nope', netKb: null });
            accumulateTelemetryEntry(b, { cached: true, totalKb: 1, netKb: undefined });
            expect(b.totalKb).toBe(1);
            expect(b.netKb).toBe(0);
        });
    });
});