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

    const handleCctvWebhookSubmit = async (cctvData) => {
        Sentry.captureMessage('CCTV Request Submitted', {
            level: 'info',
            extra: {
                officer: cctvData.officer,
                department: cctvData.department,
                location: cctvData.location,
                reason: cctvData.requestReason,
                submitter: formData.coronerEmployee || formData.phmcEmployee || 'Unknown App User'
            },
            tags: {
                webhook_type: 'cctv_request',
                environment: import.meta.env.NODE_ENV
            }
        });
        logEvent(analytics, 'cctv_request', {
            officer: cctvData.officer,
            department: cctvData.department,
            location: cctvData.location,
            reason: cctvData.requestReason,
            submitter: formData.coronerEmployee || formData.phmcEmployee || 'Unknown App User',
            environment: import.meta.env.NODE_ENV
        });

        const devWebhookURL = import.meta.env.VITE_DEV_WEBHOOK;
        const leoWebhookURL = import.meta.env.VITE_LEO_WEBHOOK_URL;

        if (!devWebhookURL) {
            showNotification('No CCTV webhook URLs are configured.', 'error');
            Sentry.captureMessage('Neither DEV nor LEO webhook URLs are configured for CCTV.', 'error');
            return false;
        }

        const embed = {
            title: "📹 CCTV Footage Request",
            color: 0x007bff,
            fields: [
                { name: "Requesting Officer Rank", value: cctvData.rank || "N/A", inline: true },
                { name: "Requesting Officer", value: cctvData.officer || "N/A", inline: true },
                { name: "Officer Phone Number", value: cctvData.officerPH || "N/A", inline: true },
                { name: "Requesting Department", value: cctvData.department || "N/A", inline: true },
                ...(cctvData.discordUsername ? [{ name: "Discord Username", value: cctvData.discordUsername, inline: true }] : []),
                { name: "Date/Time of Incident", value: cctvData.incidentDateTime || "N/A", inline: true },
                { name: "Reason for Request", value: cctvData.requestReason || "N/A", inline: false },
                { name: "CCTV Location", value: cctvData.location || "N/A", inline: false },
                { name: "Description of Events", value: `\`\`\`${cctvData.description || "N/A"}\`\`\``, inline: false },
                ...(cctvData.oocNotes ? [{ name: "OOC Notes", value: `\`\`\`${cctvData.oocNotes}\`\`\``, inline: false }] : []),
            ],
            timestamp: new Date().toISOString(),
            footer: { text: `PHMC Tools - v${commitInfo.sha || 'N/A'}` }
        };

        const payload = JSON.stringify({
            username: "CCTV Bot",
            content: "New CCTV Request! Supervisor Alert: <@&860257102324301864> | Leadership Alert: <@&860257063182925874>",
            embeds: [embed]
        });
        const webhookTargets = [];
        if (devWebhookURL) webhookTargets.push({ name: 'Dev', url: devWebhookURL });
        if (leoWebhookURL) webhookTargets.push({ name: 'LEO', url: leoWebhookURL });

        const sendPromises = webhookTargets.map(target =>
            fetch(target.url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: payload
            }).then(async response => {
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Request to ${target.name} failed with status ${response.status}: ${errorText}`);
                }
                return { name: target.name, status: 'fulfilled' };
            })
        );

        const results = await Promise.allSettled(sendPromises);
        let successfulSends = 0;

        results.forEach((result, index) => {
            const targetName = webhookTargets[index].name;
            if (result.status === 'fulfilled') {
                console.log(`Successfully sent CCTV webhook to ${targetName}.`);
                successfulSends++;
            } else {
                console.error(`Failed to send CCTV webhook to ${targetName}:`, result.reason.message);
                Sentry.captureMessage(`CCTV Webhook to ${targetName} failed`, {
                    level: 'error',
                    extra: { reason: result.reason.message }
                });
            }
        });

        if (successfulSends === webhookTargets.length) {
            showNotification('CCTV Request sent successfully!', "check-circle");
            return true;
        } else if (successfulSends > 0) {
            showNotification('CCTV Request sent, but some destinations failed.', "warning");
            return true;
        } else {
            showNotification('Failed to send CCTV request to any destination.', "error");
            return false;
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
        handleCctvWebhookSubmit,
        handlePhmcWebhookSubmit,
        handleWebhookSubmit,
    };
};
