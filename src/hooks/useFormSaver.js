import { useCallback } from 'react';
import { database } from '../firebase';
import { ref, set, runTransaction } from 'firebase/database';
import * as Sentry from "@sentry/react";
import useGtaWorldAuth from './useGtaWorldAuth';
import { getCharacterName, getCharacterID } from '../utils/characterUtils';
import { useNotification } from '../contexts/NotificationContext';

const comprehensiveSanitize = (str) => {
    if (!str) return '';
    let sanitized = str.trim().replace(/[.#$[\/ \]]+/g, '_');
    sanitized = sanitized.replace(/_{2,}/g, '_');
    sanitized = sanitized.replace(/^_+|_+$/g, '');
    return sanitized;
};

export const useFormSaver = () => {
    const { user: gtaWorldUser, isAuthenticated: isGtaAuthenticated } = useGtaWorldAuth();
    const { showNotification } = useNotification();

    const logWebhook = useCallback(async (type, payload) => {
        // Log to Firebase RTDB
        const logRef = ref(database, 'webhook_logs/' + Date.now());
        console.log('Logging webhook to Firebase RTDB...', { type, payload });
        try {
            await set(logRef, {
                type: type,
                payload: payload,
                timestamp: Date.now()
            });
            console.log('Successfully logged webhook to Firebase RTDB.');
        } catch (error) {
            console.error("Error logging webhook to Firebase:", error);
            Sentry.captureException(error, { extra: { context: 'logWebhook - Firebase' } });
        }

        // Send to Discord
        const discordWebhookUrl = import.meta.env.VITE_DEV_WEBHOOK;
        if (discordWebhookUrl) {
            console.log('Attempting to send report saved webhook to Discord...');
            try {
                const discordPayload = {
                    embeds: [
                        {
                            title: 'Report Saved',
                            description: `A new report has been saved by **${payload.author}**.`,
                            color: 5814783, // A nice blue color
                            fields: [
                                { name: 'Author', value: payload.author, inline: true },
                                { name: 'Form Name', value: payload.formName, inline: true },
                                { name: 'Report Title', value: `\`${payload.originalKey}\``, inline: false },
                            ],
                            timestamp: new Date().toISOString(),
                            footer: {
                                text: `FormID: ${payload.formId} | ReportKey: ${payload.reportKey}`
                            }
                        }
                    ]
                };

                if (payload.hasGtawData) {
                    discordPayload.embeds[0].fields.push(
                        { name: 'GTAW Username', value: payload.gtawUsername, inline: true },
                        { name: 'GTAW Character', value: `${payload.gtawCharacterName} (${payload.gtawCharacterId})`, inline: true }
                    );
                }

                const response = await fetch(discordWebhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(discordPayload)
                });
                
                if (!response.ok) {
                    const responseBody = await response.text();
                    console.error('Discord webhook response not OK:', { status: response.status, body: responseBody });
                    Sentry.captureMessage(`Discord webhook failed with status ${response.status}: ${responseBody}`);
                } else {
                    console.log('Successfully sent report saved webhook to Discord.');
                }

            } catch (error) {
                console.error("Error sending webhook to Discord:", error);
                Sentry.captureException(error, { extra: { context: 'logWebhook - Discord' } });
            }
        } else {
            console.warn('VITE_DEV_WEBHOOK is not set. Skipping Discord webhook.');
        }
    }, []);

    const saveReport = useCallback(async (selectedForm, formValues, title, bbCode) => {
        if (!selectedForm || !formValues || !title || !bbCode) {
            showNotification('Missing data required to save the report.', 'error');
            return { success: false, error: 'Missing data.' };
        }

        const currentAuthor = getCharacterName(gtaWorldUser);
        if (!currentAuthor) {
            showNotification('Cannot determine report author. Please ensure you are signed in.', 'error');
            return { success: false, error: 'Cannot determine report author.' };
        }

        const sanitizedAuthorId = comprehensiveSanitize(currentAuthor);
        const sanitizedKey = title.trim().replace(/[.#$[\/ \]]+/g, '_') + '_' + Date.now();

        const reportDataToSave = {
            formId: selectedForm.firebaseKey,
            formName: selectedForm.name,
            data: formValues,
            timestamp: Date.now(),
            originalKey: title,
            authorName: currentAuthor,
            legacy: false, // As requested
        };

        // Add GTAW Auth data if available
        if (isGtaAuthenticated && gtaWorldUser) {
            reportDataToSave.gtawUsername = gtaWorldUser.username;
            reportDataToSave.gtawCharacterId = getCharacterID(gtaWorldUser);
            reportDataToSave.gtawCharacterName = getCharacterName(gtaWorldUser);
            reportDataToSave.gtawSyncTimestamp = new Date().toISOString();
        }

        const reportPath = `newSavedReports/${sanitizedAuthorId}/${sanitizedKey}`;
        const bbCodePath = `newSavedReportBBCode/${sanitizedAuthorId}/${sanitizedKey}`;

        try {
            const reportRef = ref(database, reportPath);
            const bbCodeRef = ref(database, bbCodePath);
            const userReportCountRef = ref(database, `userReportCounts/${sanitizedAuthorId}/total`);

            // Save both main report data and BBCode data in parallel
            await Promise.all([
                set(reportRef, reportDataToSave),
                set(bbCodeRef, { bbCode: bbCode }),
                runTransaction(userReportCountRef, (currentCount) => (currentCount || 0) + 1),
            ]);

            showNotification(`Report "${title}" saved successfully!`, 'save');

            // Webhook Logging
            const webhookPayload = {
                author: currentAuthor,
                reportKey: sanitizedKey,
                originalKey: title,
                formId: selectedForm.firebaseKey,
                formName: selectedForm.name,
                hasGtawData: !!(isGtaAuthenticated && gtaWorldUser),
            };

            if (isGtaAuthenticated && gtaWorldUser) {
                webhookPayload.gtawUsername = gtaWorldUser.username;
                webhookPayload.gtawCharacterId = getCharacterID(gtaWorldUser);
                webhookPayload.gtawCharacterName = getCharacterName(gtaWorldUser);
            }

            await logWebhook(`report_saved (new) by ${currentAuthor}`, webhookPayload);

            return { success: true };

        } catch (error) {
            console.error("Error saving new report to Firebase:", error);
            Sentry.captureException(error, { extra: { context: 'useFormSaver - saveReport' } });
            showNotification('Something went wrong while saving the report.', 'error');
            return { success: false, error: error.message };
        }
    }, [gtaWorldUser, isGtaAuthenticated, showNotification, logWebhook]);

    return { saveReport };
};
