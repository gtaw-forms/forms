import { useCallback, useMemo } from 'react';
import * as Sentry from "@sentry/react";
import { database } from '../firebase';
import { ref, set, push } from 'firebase/database';
import { triggerWebhookProxy } from '../services/firebaseFunctions';

// Client telemetry (hourly appendTelemetry beacon → VPS JSONL → bot rollup)
// was retired 2026-10-08. This hook now only owns the manual webhook
// test-submit actions + the Firebase webhook-log writer.

export const useWebhooks = (formData, commitInfo, showNotification) => {
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
        handlePhmcWebhookSubmit,
        handleWebhookSubmit,
    }), [logWebhookToFirebase, handlePhmcWebhookSubmit, handleWebhookSubmit]);
};
