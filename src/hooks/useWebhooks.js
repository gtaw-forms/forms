import { useCallback, useMemo } from 'react';
import * as Sentry from "@sentry/react";
import { analytics } from '../firebase';
import { logEvent } from 'firebase/analytics';
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
            timestamp: Date.now(),
        });
    }, []);


    const sendWebhookPayload = useCallback(async (webhookURL, payload, successMessage, context, notifyFunc) => {
        if (!webhookURL) {
            console.error(`Discord webhook URL not configured for ${context}.`);
            Sentry.captureMessage(`Discord webhook URL is missing for ${context} submission.`, 'error');
            notifyFunc('Configuration error: Unable to send message.', 'exclamation-triangle');
            return false;
        }

        try {
            const response = await fetch(webhookURL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Failed to send ${context} webhook embed. Status: ${response.status} ${response.statusText}`, errorText);
                Sentry.captureMessage(`Discord webhook embed failed for ${context}: ${response.status}`, {
                    level: 'error',
                    extra: { statusText: response.statusText, responseBody: errorText }
                });
                notifyFunc(`Failed to send embed to ${context}. Status: ${response.status}`, 'exclamation-triangle');
                return false;
            } else {
                notifyFunc(successMessage, 'check-circle');
                return true;
            }
        } catch (error) {
            console.error(`Error sending ${context} webhook embed:`, error);
            Sentry.captureException(error, { extra: { context: `${context} Webhook Embed Submission Fetch` } });
            notifyFunc(`A network error occurred sending to ${context}. Please try again.`, 'exclamation-triangle');
            return false;
        }
    }, []);

    const sendDataRequestLog = useCallback(async (file, cached, source, cachedDataSize, networkTransferSize, loggedIn, user, requestedPortions, missingPortions, segmentSizes = {}, error = null) => {
        const fields = [
            {
                name: 'URL',
                value: window.location.href,
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
        const webhookURL = import.meta.env.VITE_PHMC_DISCORD;
        await sendWebhookPayload(webhookURL, payload, 'PHMC webhook embed sent successfully!', 'PHMC', showNotification);
    }, [sendWebhookPayload, showNotification]);

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
