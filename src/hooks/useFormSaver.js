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

const parseCaseNumber = (url) => {
    if (!url) return '';
    const match = url.match(/\d+$/);
    return match ? match[0] : '';
};

// Function to format date to MM/DD/YYYY
const formatToNorthAmericanDate = (isoDateTime) => {
    if (!isoDateTime) return 'NO_DATE';
    try {
        const date = new Date(isoDateTime);
        // Ensure date is valid
        if (isNaN(date.getTime())) {
            // Try to parse YYYY-MM-DD if ISO string also has time
            const parts = isoDateTime.split('T')[0].split('-');
            if (parts.length === 3) {
                 const year = parseInt(parts[0], 10);
                 const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
                 const day = parseInt(parts[2], 10);
                 const reconsDate = new Date(year, month, day);
                 if (!isNaN(reconsDate.getTime())) {
                    return `${(reconsDate.getMonth() + 1).toString().padStart(2, '0')}/${reconsDate.getDate().toString().padStart(2, '0')}/${reconsDate.getFullYear()}`;
                 }
            }
            return isoDateTime; // Return original if cannot parse
        }
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const year = date.getFullYear();
        return `${month}/${day}/${year}`;
    } catch (e) {
        console.error("Error formatting date for title:", e);
        return isoDateTime; // Fallback to original
    }
};

// Function to format date to MMM-DD-YYYY
const formatToMMM_DD_YYYY = (isoDateTime) => {
    if (!isoDateTime) return 'NO_DATE';
    try {
        const date = new Date(isoDateTime);
        if (isNaN(date.getTime())) {
            const parts = isoDateTime.split('T')[0].split('-');
            if (parts.length === 3) {
                 const year = parseInt(parts[0], 10);
                 const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
                 const day = parseInt(parts[2], 10);
                 const reconsDate = new Date(year, month, day);
                 if (!isNaN(reconsDate.getTime())) {
                    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                    return `${monthNames[reconsDate.getMonth()]}-${reconsDate.getDate().toString().padStart(2, '0')}-${reconsDate.getFullYear()}`;
                 }
            }
            return isoDateTime;
        }
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const month = monthNames[date.getMonth()];
        const day = date.getDate().toString().padStart(2, '0');
        const year = date.getFullYear();
        return `${month}-${day}-${year}`;
    } catch (e) {
        console.error("Error formatting date for title (MMM-DD-YYYY):", e);
        return isoDateTime;
    }
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
        const discordWebhookUrl = import.meta.env.VITE_DISCORD_WEBHOOK_FORMS || import.meta.env.VITE_DEV_WEBHOOK;
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
                                text: `FormID: ${payload.formId} | ReportKey: ${payload.reportKey} | `
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

                if (payload.requestingOfficer) {
                    discordPayload.embeds[0].fields.push(
                        { name: 'Requesting Officer', value: payload.requestingOfficer, inline: true }
                    );
                }

                if (payload.department) {
                    discordPayload.embeds[0].fields.push(
                        { name: 'Department', value: payload.department, inline: true }
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
            const missingFields = [];
            if (!selectedForm) missingFields.push('selectedForm');
            if (!formValues) missingFields.push('formValues');
            if (!title) missingFields.push('title');
            if (!bbCode) missingFields.push('bbCode');
            console.error('[DEBUG useFormSaver] Save failed due to missing required data:', missingFields.join(', '));
            showNotification('Missing data required to save the report.', 'error');
            return { success: false, error: 'Missing data.' };
        }

        let finalTitle = title;
        // For Coroner Reports, enforce the standardized title format.
        if (selectedForm.firebaseKey === 'coroner-report') {
            if (formValues.decedentName && formValues.decedentOOC && formValues.dateTime) {
                const formattedDate = formatToNorthAmericanDate(formValues.dateTime);
                finalTitle = `[DEATH-REPORT] ${formValues.decedentName} ((${formValues.decedentOOC})) ${formattedDate}`;
            } else {
                console.warn("Could not generate standardized Coroner Report title due to missing decedentName, decedentOOC or dateTime. Using default title.");
            }
        } else if (selectedForm.firebaseKey === 'mass-ftality-test') { // Handle Mass Fatality Report
            // ... Mass Fatality Report logic ...
        } else if (selectedForm.firebaseKey === 'death-record') { // Handle Death Record title
            const currentYear = new Date().getFullYear();
            const caseNumber = parseCaseNumber(formValues.deathReportPostId) || formValues.caseNumber || 'UNKNOWN';
            const decedentName = formValues.decedentName || 'UNKNOWN';
            const decedentOOC = formValues.decedentOOC || 'N/A';
            const formattedDateOfDeath = formatToMMM_DD_YYYY(formValues.dateOfDeath);

            finalTitle = `[CASE-#${currentYear}-${caseNumber}] ${decedentName} ((${decedentOOC} | ${formattedDateOfDeath}))`;
        }

        const currentAuthor = getCharacterName(gtaWorldUser);
        if (!currentAuthor) {
            showNotification('Cannot determine report author. Please ensure you are signed in.', 'error');
            return { success: false, error: 'Cannot determine report author.' };
        }

        const sanitizedAuthorId = comprehensiveSanitize(currentAuthor);
        const sanitizedKey = finalTitle.trim().replace(/[.#$[\/ \]]+/g, '_') + '_' + Date.now();

        const reportDataToSave = {
            formId: selectedForm.firebaseKey,
            formName: selectedForm.name,
            data: formValues,
            timestamp: Date.now(),
            originalKey: finalTitle,
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

        // Add Coroner Report specific metadata
        if (selectedForm.firebaseKey === 'coroner-report') {
            reportDataToSave.isCK = formValues.typeOfDeath === 'CK';
            reportDataToSave.processed = !!formValues.processed;
        }

        const reportPath = `newSavedReports/${sanitizedAuthorId}/${sanitizedKey}`;
        const bbCodePath = `newSavedReportBBCode/${sanitizedAuthorId}/${sanitizedKey}`;

        try {
            const reportRef = ref(database, reportPath);
            const bbCodeRef = ref(database, bbCodePath);
            const userReportCountRef = ref(database, `userReportCounts/${sanitizedAuthorId}/total`);

            // Save both main report data and BBCode data in parallel
            // We use individual sets here to be safe, though a multi-path update at root would be more atomic.
            // given existing imports, we stick to set/runTransaction.
            
            const promises = [
                set(reportRef, reportDataToSave),
                set(bbCodeRef, { bbCode: bbCode }),
                runTransaction(userReportCountRef, (currentCount) => (currentCount || 0) + 1),
            ];

            if (selectedForm.firebaseKey === 'coroner-report' && reportDataToSave.isCK && !reportDataToSave.processed) {
                 const ckRef = ref(database, `unprocessedCKs/${sanitizedKey}`);
                 promises.push(set(ckRef, {
                    reportPath: reportPath,
                    authorId: sanitizedAuthorId,
                    reportKey: sanitizedKey,
                    decedentName: formValues.decedentName || 'Unknown',
                    decedentOOC: formValues.decedentOOC || 'Unknown',
                    dateOfDeath: formValues.dateTime || new Date().toISOString(),
                    timestamp: Date.now()
                 }));
            }

            await Promise.all(promises);

            showNotification(`Report "${finalTitle}" saved successfully!`, 'save');

            // Webhook Logging
            const webhookPayload = {
                author: currentAuthor,
                reportKey: sanitizedKey,
                originalKey: finalTitle,
                formId: selectedForm.firebaseKey,
                formName: selectedForm.name,
                hasGtawData: !!(isGtaAuthenticated && gtaWorldUser),
            };

            if (isGtaAuthenticated && gtaWorldUser) {
                webhookPayload.gtawUsername = gtaWorldUser.username;
                webhookPayload.gtawCharacterId = getCharacterID(gtaWorldUser);
                webhookPayload.gtawCharacterName = getCharacterName(gtaWorldUser);
            }

            // Include Requesting Officer if it's a Coroner Report and one was requested
            if (selectedForm.firebaseKey === 'coroner-report' && (formValues.ReportRequested === true || formValues.ReportRequested === 'true')) {
                webhookPayload.requestingOfficer = formValues['Requesting Officer'] || formValues.requestingOfficer || 'N/A';
                
                const deptVal = formValues.department;
                webhookPayload.department = (typeof deptVal === 'object' && deptVal !== null) ? (deptVal.label || deptVal.value) : deptVal;
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
