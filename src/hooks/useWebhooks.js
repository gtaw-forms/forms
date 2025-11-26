import { useCallback } from 'react';
import * as Sentry from "@sentry/react";
import { analytics } from '../firebase';
import { logEvent } from 'firebase/analytics';
import { database } from '../firebase';
import { ref, set, push } from 'firebase/database';

export const useWebhooks = (formData, commitInfo, showNotification) => {
    const logWebhookToFirebase = async (type, payload) => {
        const db = database;
        const logsRef = ref(db, 'webhook_logs');
        const newLogRef = push(logsRef);
        await set(newLogRef, {
            type,
            payload,
            timestamp: Date.now(),
        });
    };

    const sendEasterEggNotification = async (type = 'normal') => {
        const webhookUrl = import.meta.env.VITE_DEV_WEBHOOK;
        if (!webhookUrl) {
            console.error("Discord webhook URL is not configured.");
            return;
        }

        const userIdentifier = formData.coronerEmployee || formData.phmcEmployee || formData.patientName || formData.decedentName || 'Someone';

        let embedTitle = "🎉 Easter Egg Found! 🎉";
        let embedDescription = `Hey! **${userIdentifier}** just found the normal easter egg! 🥚`;
        let embedColor = 0x7289DA;
        let triggerSource = "Triggered during report save";

        if (type === 'rare') {
            embedTitle = "✨ Rare Easter Egg Found! ✨";
            embedDescription = `Wow! **${userIdentifier}** just triggered the 1% rare easter egg! 🥚🎉`;
            embedColor = 0xFFD700;
        }

        const isManualTrigger = window.location.hostname === 'localhost' && type === 'rare';
        if (isManualTrigger) {
            embedTitle += " (Manual Trigger)";
            embedDescription = `Debug: **${userIdentifier}** just triggered the rare easter egg manually! 🥚🎉`;
            triggerSource = "Triggered via Debug Button";
        }

        const embed = {
            title: embedTitle,
            description: embedDescription,
            color: embedColor,
            timestamp: new Date().toISOString(),
            footer: {
                text: `PHMC Tools Tool | ${triggerSource}`
            }
        };

        try {
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ embeds: [embed] }),
            });

            if (!response.ok) {
                console.error(`Error sending ${type} easter egg webhook: ${response.status} ${response.statusText}`);
            } else {
                console.log(`${type} easter egg notification sent successfully.`);
                await logWebhookToFirebase(type, { embeds: [embed] });
            }
        } catch (error) {
            console.error(`Failed to send ${type} easter egg webhook:`, error);
            Sentry.captureException(error, { extra: { context: `sendEasterEggNotification (${type})` } });
        }
    };



    const sendWebhookPayload = async (webhookURL, payload, successMessage, context, notifyFunc) => {
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
    };

    const sendDataRequestLog = async (file, cached, source, size, loggedIn, user, portions) => {
        const webhookUrl = import.meta.env.VITE_DEV_WEBHOOK;
        if (!webhookUrl) {
            console.error("Discord webhook URL is not configured.");
            return;
        }

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
                value: `${(size / 1024).toFixed(2)} KB`,
                inline: true,
            },
            {
                name: 'Logged In',
                value: loggedIn ? 'Yes' : 'No',
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

        if (portions) {
            fields.push({
                name: 'Requested Portions',
                value: portions,
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
                text: `PHMC Tools | Data Request Log`
            }
        };

        try {
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ embeds: [embed] }),
            });

            if (!response.ok) {
                console.error(`Error sending data request log webhook: ${response.status} ${response.statusText}`);
            } else {
                console.log(`Data request log sent successfully.`);
            }
        } catch (error) {
            console.error(`Failed to send data request log webhook:`, error);
            Sentry.captureException(error, { extra: { context: `sendDataRequestLog` } });
        }
    };

    const handlePhmcWebhookSubmit = async (payload) => {
        if (!payload) return;
        const webhookURL = import.meta.env.VITE_PHMC_DISCORD;
        await sendWebhookPayload(webhookURL, payload, 'PHMC webhook embed sent successfully!', 'PHMC', showNotification);
    };

    const handleWebhookSubmit = async (payload) => {
        if (!payload) return;
        const webhookURL = import.meta.env.VITE_DEV_WEBHOOK;
        await sendWebhookPayload(webhookURL, payload, 'Dev webhook embed sent successfully!', 'Dev', showNotification);
    };

    return {
        logWebhookToFirebase,
        sendEasterEggNotification,
        sendDataRequestLog,
        handlePhmcWebhookSubmit,
        handleWebhookSubmit,
    };
};
