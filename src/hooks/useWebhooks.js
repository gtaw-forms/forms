import { useCallback, useEffect, useMemo, useRef } from 'react';
import * as Sentry from "@sentry/react";
import { database } from '../firebase';
import { ref, set, push } from 'firebase/database';
import { triggerWebhookProxy, triggerAppendTelemetry } from '../services/firebaseFunctions';

// P0 (b) cost plan: hourly telemetry batching constants.
const TELEMETRY_BUCKET_KEY = 'phmc_telemetry_hour_v2';
const TELEMETRY_FLUSH_MS = 3600000; // 1 hour
const TELEMETRY_MAX_USERS = 20;
const EMPTY_TELEMETRY_BUCKET = {
    bucketStart: 0, events: 0, cacheHits: 0, network: 0, errors: 0, inactive: 0,
    authed: false, totalKb: 0, netKb: 0, byTrigger: {}, routes: [], users: [], errorSamples: [],
};

export const useWebhooks = (formData, commitInfo, showNotification, getIsInactivityWarningTriggered) => {
    const logWebhookToFirebase = useCallback(async (type, payload) => {
        const db = database;
        const logsRef = ref(db, 'webhook_logs');
        const newLogRef = push(logsRef);
        await set(newLogRef, {
            type,
            payload,
            userAgent: navigator.userAgent.substring(0, 500),
            timestamp: Date.now(),
        });
    }, []);

    // P0 (b) cost plan: data-request telemetry previously fired one
    // `sendWebhookProxy` Cloud Function invocation PER event (page load, morgue
    // open, every report open/delete). Now events accumulate locally and flush as
    // ONE aggregate embed per hourly timer tick. Flush failures drop silently
    // — telemetry must never emit telemetry.
    const telemetryRef = useRef(null);
    const telemetryTimerRef = useRef(null);

    const loadTelemetryBucket = () => {
        try {
            const raw = localStorage.getItem(TELEMETRY_BUCKET_KEY);
            if (!raw) return null;
            const bucket = JSON.parse(raw);
            if (!bucket || typeof bucket !== 'object' || typeof bucket.bucketStart !== 'number') return null;
            return bucket;
        } catch {
            return null;
        }
    };

    const flushTelemetry = useCallback(async (_reason) => {
        const bucket = telemetryRef.current;
        if (!bucket || !bucket.events) return;
        // Guests produce no beacon (callable requires auth) — drop silently.
        if (!bucket.authed) {
            telemetryRef.current = { ...EMPTY_TELEMETRY_BUCKET, bucketStart: Date.now() };
            try {
                localStorage.setItem(TELEMETRY_BUCKET_KEY, JSON.stringify(telemetryRef.current));
            } catch { /* best effort */ }
            return;
        }
        telemetryRef.current = { ...EMPTY_TELEMETRY_BUCKET, bucketStart: Date.now() };
        try {
            localStorage.setItem(TELEMETRY_BUCKET_KEY, JSON.stringify(telemetryRef.current));
        } catch { /* best effort */ }

        // Beacon → VPS JSONL store via the appendTelemetry callable (Function →
        // VPS over HTTP; browsers never touch the VPS). The bot's hourly tick
        // reads the file and posts ONE V2 rollup. At-most-once: already reset.
        try {
            await triggerAppendTelemetry({
                events: bucket.events,
                cacheHits: bucket.cacheHits,
                network: bucket.network,
                errors: bucket.errors,
                inactive: bucket.inactive || 0,
                totalKb: Math.round((Number(bucket.totalKb) || 0) * 10) / 10,
                netKb: Math.round((Number(bucket.netKb) || 0) * 10) / 10,
                byTrigger: bucket.byTrigger || {},
                routes: bucket.routes || [],
                users: bucket.users || [],
                errorSamples: bucket.errorSamples || [],
            });
        } catch { /* drop silently — never retry telemetry */ }
    }, []);

    // Hourly timer ONLY. Tab-hide/unload flushes were removed: they fired a
    // 1-event embed on every tab switch, defeating the batching (each visit =
    // one "hourly" post). Unsent events persist in localStorage and are
    // backfilled on the next load via the expiry path in sendDataRequestLog.
    useEffect(() => {
        if (telemetryTimerRef.current) return;
        telemetryTimerRef.current = setInterval(() => { flushTelemetry('hourly'); }, TELEMETRY_FLUSH_MS);
        return () => {
            clearInterval(telemetryTimerRef.current);
            telemetryTimerRef.current = null;
        };
    }, [flushTelemetry]);

    // Shared accumulator: normalized entry shape used by sendDataRequestLog
    // AND the 'phmc-telemetry' window event (identity refresh, future hooks).
    // Keeps one bucket-init/backfill path so no caller can fork the format.
    const accumulateTelemetry = useCallback((entry = {}) => {
        const asKb = (value) => {
            const number = Number(value);
            return Number.isFinite(number) ? number : 0;
        };
        // Init bucket from spillover (survives reloads). An expired bucket with
        // pending events is backfilled immediately, then a fresh bucket starts.
        if (!telemetryRef.current) {
            const stored = loadTelemetryBucket();
            if (stored?.events && (Date.now() - stored.bucketStart) > TELEMETRY_FLUSH_MS) {
                telemetryRef.current = stored;
                flushTelemetry('backfill');
                telemetryRef.current = { ...EMPTY_TELEMETRY_BUCKET, bucketStart: Date.now() };
            } else {
                telemetryRef.current = (stored && typeof stored.events === 'number')
                    ? stored
                    : { ...EMPTY_TELEMETRY_BUCKET, bucketStart: Date.now() };
            }
        }
        const bucket = telemetryRef.current;
        bucket.events += 1;
        if (entry.cached) bucket.cacheHits += 1; else bucket.network += 1;
        if (entry.error) {
            bucket.errors += 1;
            if ((bucket.errorSamples || []).length < 10) {
                bucket.errorSamples = [...(bucket.errorSamples || []), String(entry.error).slice(0, 200)];
            }
        }
        bucket.totalKb = asKb(bucket.totalKb) + asKb(entry.totalKb);
        bucket.netKb = asKb(bucket.netKb) + asKb(entry.netKb);
        // Preserve the old inactivity flag signal as an aggregate counter.
        try {
            if (typeof getIsInactivityWarningTriggered === 'function' && getIsInactivityWarningTriggered()) {
                bucket.inactive = (bucket.inactive || 0) + 1;
            }
        } catch { /* flag must never break logging */ }
        const trigger = entry.trigger || entry.file || 'unknown';
        bucket.byTrigger = bucket.byTrigger || {};
        bucket.byTrigger[trigger] = (bucket.byTrigger[trigger] || 0) + 1;
        const route = entry.route || (typeof window !== 'undefined' ? window.location.hash || '/' : '/');
        bucket.routes = bucket.routes || [];
        if (!bucket.routes.includes(route) && bucket.routes.length < 20) bucket.routes.push(route);
        // Visited identity set for the V2 rollup ("username (character)").
        // Contributes to the hourly union; capped, never sent per-event.
        if (entry.loggedIn && entry.user) {
            bucket.authed = true;
            const label = String(entry.user).slice(0, 80);
            bucket.users = bucket.users || [];
            if (label && !bucket.users.includes(label) && bucket.users.length < TELEMETRY_MAX_USERS) {
                bucket.users.push(label);
            }
        }
        try {
            localStorage.setItem(TELEMETRY_BUCKET_KEY, JSON.stringify(bucket));
        } catch { /* best effort */ }
    }, [flushTelemetry, getIsInactivityWarningTriggered]);

    // 'phmc-telemetry' window events (identity refresh today): hook-free
    // producers (logging.js) feed the same bucket — no direct webhook calls.
    useEffect(() => {
        const onTelemetryEvent = (event) => {
            const detail = (event && event.detail) || {};
            try {
                accumulateTelemetry({
                    cached: false,
                    totalKb: 0,
                    netKb: 0,
                    error: null,
                    trigger: detail.trigger || 'custom',
                    route: '#/',
                    loggedIn: detail.loggedIn !== false,
                    user: detail.user || null,
                    file: detail.file || 'window-event',
                });
            } catch { /* telemetry must never break the app */ }
        };
        window.addEventListener('phmc-telemetry', onTelemetryEvent);
        return () => window.removeEventListener('phmc-telemetry', onTelemetryEvent);
    }, [accumulateTelemetry]);

    const sendDataRequestLog = useCallback(async (file, cached, source, cachedDataSize, networkTransferSize, loggedIn, user, requestedPortions, missingPortions, _segmentSizes = {}, error = null, metadata = {}) => {
        const asKb = (value) => {
            const number = Number(value);
            return Number.isFinite(number) ? number : 0;
        };
        accumulateTelemetry({
            cached,
            totalKb: asKb(cachedDataSize) + asKb(networkTransferSize),
            netKb: asKb(networkTransferSize),
            error,
            trigger: metadata.trigger || file || 'unknown',
            route: metadata.route,
            loggedIn,
            user,
            file,
        });
    }, [accumulateTelemetry]);

    const handlePhmcWebhookSubmit = useCallback(async (payload) => {
        if (!payload) return;
        try {
            await triggerWebhookProxy('phmc', payload);
            showNotification('PHMC webhook embed sent successfully!', 'check-circle');
        } catch (error) {
            showNotification('Failed to send PHMC webhook.', 'exclamation-triangle');
            Sentry.captureException(error, { extra: { context: 'PHMC Webhook Submit' } });
        }
    }, [showNotification]);

    const handleWebhookSubmit = useCallback(async (payload) => {
        if (!payload) return;
        try {
            await triggerWebhookProxy('admin', payload);
            showNotification('Dev webhook embed sent successfully!', 'check-circle');
        } catch (error) {
            showNotification('Failed to send dev webhook.', 'exclamation-triangle');
            Sentry.captureException(error, { extra: { context: 'Dev Webhook Submit' } });
        }
    }, [showNotification]);

    return useMemo(() => ({
        logWebhookToFirebase,
        sendDataRequestLog,
        handlePhmcWebhookSubmit,
        handleWebhookSubmit,
    }), [logWebhookToFirebase, sendDataRequestLog, handlePhmcWebhookSubmit, handleWebhookSubmit]);
};
