/**
 * launchdarkly.js — LaunchDarkly Observability (session replay + logs/traces).
 *
 * Complements Sentry (which stays authoritative for errors/breadcrumbs): LD
 * provides session replays, application logs, and traces on its free tier.
 *
 * Conventions:
 * - Prod-only. Localhost/dev sessions never record (preserves the 5k/mo
 *   replay quota and keeps the dashboard free of dev noise).
 * - privacySetting 'none' — the forms hold fictional GTA World RP data only,
 *   no real PII, so recordings capture inputs verbatim for debugging.
 * - Never throws — observability must not break the app. Missing client-side
 *   ID => silent no-op with a console note.
 * - Client-side ID is public by design (like the Sentry DSN); set via
 *   VITE_LAUNCHDARKLY_CLIENT_ID and rebuild.
 */

import { initialize } from 'launchdarkly-js-client-sdk';
import Observability from '@launchdarkly/observability';
import SessionReplay, { LDRecord } from '@launchdarkly/session-replay';

let ldClient = null;
let initialized = false;

const isLocalhost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export function initLaunchDarkly() {
    if (initialized) return ldClient;
    const clientSideId = (import.meta.env.VITE_LAUNCHDARKLY_CLIENT_ID || '').trim();
    if (!clientSideId) {
        console.log('[LaunchDarkly] No VITE_LAUNCHDARKLY_CLIENT_ID — observability disabled.');
        return null;
    }
    if (isLocalhost) {
        console.log('[LaunchDarkly] Localhost detected — session recording disabled (prod only).');
        return null;
    }
    try {
        ldClient = initialize(
            clientSideId,
            { kind: 'user', key: 'anonymous', anonymous: true },
            {
                plugins: [
                    new Observability(),
                    new SessionReplay({
                        serviceName: 'phmc-forms',
                        privacySetting: 'none',
                    }),
                ],
            }
        );
        initialized = true;
        // Begin recording; failures are non-fatal by design.
        try {
            LDRecord.start({ silent: true });
        } catch (e) {
            console.warn('[LaunchDarkly] Session replay start failed:', e?.message || e);
        }
        console.log('[LaunchDarkly] Observability + session replay initialized.');
    } catch (e) {
        console.warn('[LaunchDarkly] Initialization failed (non-fatal):', e?.message || e);
        ldClient = null;
    }
    return ldClient;
}

export function getLaunchDarklyClient() {
    return ldClient;
}

let lastIdentityKey = null;
let lastIdentityName = null;

/**
 * Attribute the session to the signed-in user so replays list a name instead
 * of "anonymous". Safe no-op when unconfigured; never throws. Repeated calls
 * with the same identity are skipped.
 */
export async function identifyLaunchDarkly({ key, name } = {}) {
    if (!ldClient) return false;
    const finalKey = (key || '').trim() || 'unknown user';
    const finalName = (name || '').trim() || finalKey;
    if (finalKey === lastIdentityKey && finalName === lastIdentityName) return true;
    try {
        await ldClient.identify({ kind: 'user', key: finalKey, name: finalName });
        lastIdentityKey = finalKey;
        lastIdentityName = finalName;
        console.log(`[LaunchDarkly] Session identified as "${finalName}"`);
        return true;
    } catch (e) {
        console.warn('[LaunchDarkly] Identify failed (non-fatal):', e?.message || e);
        return false;
    }
}

/** Back to anonymous (e.g. on logout). Safe no-op when unconfigured. */
export async function resetLaunchDarklyIdentity() {
    lastIdentityKey = null;
    lastIdentityName = null;
    if (!ldClient) return false;
    try {
        await ldClient.identify({ kind: 'user', key: 'anonymous', anonymous: true });
        return true;
    } catch (e) {
        console.warn('[LaunchDarkly] Reset identity failed (non-fatal):', e?.message || e);
        return false;
    }
}
