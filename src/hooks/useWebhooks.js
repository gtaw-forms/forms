import { useCallback, useMemo } from 'react';
import * as Sentry from "@sentry/react";
import { database } from '../firebase';
import { ref, set, push } from 'firebase/database';
import { triggerWebhookProxy } from '../services/firebaseFunctions';

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

    const sendDataRequestLog = useCallback(async (file, cached, source, cachedDataSize, networkTransferSize, loggedIn, user, requestedPortions, missingPortions, segmentSizes = {}, error = null, metadata = {}) => {
        const fields = [
            {
                name: 'URL',
                value: window.location.href,
                inline: false,
            },
            {
                name: 'User Agent',
                value: navigator.userAgent.substring(0, 250),
                inline: false,
            },
            {
                name: 'Cached',
                value: cached ? 'Yes' : 'No',
                inline: true,
            },
            {
                name: 'Source',
                value: source,
                inline: true,
            },
            {
                name: 'Approximate Size',
                value: `${(networkTransferSize / 1024).toFixed(2)} KB`,
                inline: true,
            },
            {
                name: 'Logged In',
                value: loggedIn ? 'Yes' : 'No',
                inline: true,
            },
            {
                name: 'Inactivity Check (30min+)',
                value: getIsInactivityWarningTriggered() ? 'True' : 'False',
                inline: true,
            },
        ];

        if (loggedIn && user) {
            fields.push({
                name: 'User',
                value: user,
                inline: true,
            });
        }

        // Enhanced metadata fields
        if (metadata.route) {
            fields.push({
                name: 'Route',
                value: metadata.route,
                inline: true,
            });
        }

        if (metadata.trigger) {
            fields.push({
                name: 'Trigger',
                value: metadata.trigger,
                inline: true,
            });
        }

        if (metadata.segmentSources) {
            const loadingModeLines = Object.entries(metadata.segmentSources).map(([segment, source]) => {
                const size = segmentSizes[segment] ? ` (${segmentSizes[segment].toFixed(2)} KB)` : '';
                const badge = source === 'cache' ? '[CACHE]' : source === 'network' ? '[NETWORK]' : '[NOT LOADED]';
                return `${segment}${size} - ${badge}`;
            });
            fields.push({
                name: 'Loading Mode',
                value: loadingModeLines.join('\n'),
                inline: false,
            });
        }

        if (metadata.detail) {
            fields.push({
                name: 'Detail',
                value: metadata.detail,
                inline: false,
            });
        }

        if (missingPortions && missingPortions.length > 0) {
            fields.push({
                name: 'Missing Portions',
                value: missingPortions.join(', '),
                inline: false,
            });
        }

        if (requestedPortions) {
            let requestedValue = requestedPortions;
            if (typeof requestedPortions === 'string') {
                requestedValue = requestedPortions.split(', ').map(p => p.trim());
            }

            const formattedPortions = requestedValue.map(portion => {
                if (segmentSizes[portion]) {
                    return `${portion} (${segmentSizes[portion].toFixed(2)} KB)`;
                }
                return portion;
            }).join(', ');

            fields.push({
                name: 'Requested Portions',
                value: formattedPortions,
                inline: false,
            });
        }

        if (error) {
            fields.push({
                name: 'Error Details',
                value: String(error),
                inline: false,
            });
        }

        const embed = {
            title: 'Firebase Data Request',
            description: `A data request was made from \`${file}\`.`,
            fields,
            color: cached ? 0x00FF00 : 0xFFA500,
            timestamp: new Date().toISOString(),
            footer: {
                text: `PHMC Tools | Data Request Log | `
            }
        };

        try {
            await triggerWebhookProxy('admin', { embeds: [embed] });
            console.log(`Data request log sent successfully.`);
        } catch (error) {
            console.error(`Failed to send data request log webhook:`, error);
            Sentry.captureException(error, { extra: { context: `sendDataRequestLog` } });
        }
    }, [getIsInactivityWarningTriggered]);

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
