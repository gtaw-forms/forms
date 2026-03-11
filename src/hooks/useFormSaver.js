import { useCallback } from 'react';
import { database } from '../firebase';
import { ref, set, runTransaction } from 'firebase/database';
import * as Sentry from "@sentry/react";
import useGtaWorldAuth from './useGtaWorldAuth';
import { getCharacterName, getCharacterID } from '../utils/characterUtils';
import { comprehensiveSanitize } from '../utils/textUtils';
import { useNotification } from '../contexts/NotificationContext';

export const useFormSaver = () => {

    if (!url) return '';
    const match = url.match(/\d+$/);
    return match ? match[0] : '';
};

// Recursive helper to ensure no 'undefined' values are sent to Firebase
const sanitizeForFirebase = (obj) => {
    if (obj === null || typeof obj !== 'object') {
        return obj === undefined ? null : obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeForFirebase(item));
    }

    const sanitized = {};
    Object.keys(obj).forEach(key => {
        const value = obj[key];
        if (value !== undefined) {
            sanitized[key] = sanitizeForFirebase(value);
        } else {
            sanitized[key] = null; // Convert undefined to null
        }
    });
    return sanitized;
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
        // Handle date-only strings by splitting at 'T' and taking the date part.
        const dateString = isoDateTime.split('T')[0];
        const date = new Date(dateString);

        if (isNaN(date.getTime())) {
            const parts = dateString.split('-');
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

export const useFormSaver = (gtaWorldUser, isGtaAuthenticated) => {
    const { showNotification } = useNotification();

    const saveReport = useCallback(async (selectedForm, formValues, title, bbCode, options = {}) => {
        if (!selectedForm || !formValues || !title || !bbCode) {
            const missingFields = [];
            if (!selectedForm) missingFields.push('selectedForm');
            if (!formValues) missingFields.push('formValues');
            if (!title) missingFields.push('title');
            if (!bbCode) missingFields.push('bbCode');
            console.error('[DEBUG useFormSaver] Save failed due to missing required data:', missingFields.join(', '));
            if (!options.silent) {
                showNotification('Missing data required to save the report.', 'error');
            }
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
            const formattedDateOfDeath = formatToMMM_DD_YYYY(formValues.dateOfDeath || formValues.formattedDateOfDeath);

            finalTitle = `[CASE #${currentYear}-${caseNumber}] ${decedentName} ((${decedentOOC})) - ${formattedDateOfDeath}`;
        }

        const currentAuthor = getCharacterName(gtaWorldUser);
        if (!currentAuthor) {
            if (!options.silent) {
                showNotification('Cannot determine report author. Please ensure you are signed in.', 'error');
            }
            return { success: false, error: 'Cannot determine report author.' };
        }

        const sanitizedAuthorId = comprehensiveSanitize(currentAuthor);
        const sanitizedKey = finalTitle.trim().replace(/[.#$[/ \]]+/g, '_') + '_' + Date.now();

        const reportDataToSave = {
            formId: selectedForm.firebaseKey,
            formName: selectedForm.name,
            data: sanitizeForFirebase(formValues),
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

            // Handle Mass Fatality CKs
            const isMassFatality = selectedForm.firebaseKey === 'mass-ftality-test' || 
                                 selectedForm.id === 'mass-fatality' || 
                                 selectedForm.name?.toLowerCase().includes('mass fatality');

            if (isMassFatality && Array.isArray(formValues.decedents)) {
                formValues.decedents.forEach((dec, index) => {
                    if (dec.typeOfDeath === 'CK' && !dec.processed) {
                        const ckRef = ref(database, `unprocessedCKs/${sanitizedKey}_${index}`);
                        promises.push(set(ckRef, {
                            reportPath: reportPath,
                            authorId: sanitizedAuthorId,
                            reportKey: sanitizedKey,
                            decedentIndex: index,
                            decedentName: dec.decedentName || 'Unknown',
                            decedentOOC: dec.decedentOOC || 'Unknown',
                            dateOfDeath: dec.pronouncedTimeOfDeath || formValues.dateTime || new Date().toISOString(),
                            timestamp: Date.now(),
                            isMassFatality: true
                        }));
                    }
                });
            }

            await Promise.all(promises);

            if (!options.silent) {
                showNotification(`Report "${finalTitle}" saved successfully!`, 'save');
            }

            // Webhook Logging
            try {
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

                const discordWebhookUrl = import.meta.env.VITE_DISCORD_WEBHOOK_FORMS || import.meta.env.VITE_DEV_WEBHOOK;
                if (discordWebhookUrl) {
                    const discordPayload = {
                        embeds: [{
                            title: 'Report Saved',
                            description: `A new report has been saved by **${webhookPayload.author}**.`,
                            color: 5814783,
                            fields: [
                                { name: 'Author', value: webhookPayload.author, inline: true },
                                { name: 'Form Name', value: webhookPayload.formName, inline: true },
                                { name: 'Report Title', value: `\`${webhookPayload.originalKey}\``, inline: false },
                            ],
                            timestamp: new Date().toISOString(),
                            footer: {
                                text: `FormID: ${webhookPayload.formId} | ReportKey: ${webhookPayload.reportKey}`
                            }
                        }]
                    };

                    if (webhookPayload.hasGtawData) {
                        discordPayload.embeds[0].fields.push(
                            { name: 'GTAW Username', value: webhookPayload.gtawUsername, inline: true },
                            { name: 'GTAW Character', value: `${webhookPayload.gtawCharacterName} (${webhookPayload.gtawCharacterId})`, inline: true }
                        );
                    }
                    if (webhookPayload.requestingOfficer) {
                        discordPayload.embeds[0].fields.push({ name: 'Requesting Officer', value: webhookPayload.requestingOfficer, inline: true });
                    }
                    if (webhookPayload.department) {
                        discordPayload.embeds[0].fields.push({ name: 'Department', value: webhookPayload.department, inline: true });
                    }

                    fetch(discordWebhookUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(discordPayload)
                    }).then(response => {
                        if (!response.ok) {
                            console.error('Discord webhook response not OK:', response.status);
                            Sentry.captureMessage(`Discord webhook failed with status ${response.status}`);
                        }
                    }).catch(error => {
                        console.error("Error sending webhook to Discord:", error);
                        Sentry.captureException(error, { extra: { context: 'saveReport - Discord Webhook' } });
                    });
                }
            } catch (err) {
                console.error("Fatal error constructing or sending Discord webhook.", err);
                Sentry.captureException(err, { extra: { context: 'saveReport - Webhook' } });
            }

            return { success: true };

        } catch (error) {
            console.error("Error saving new report to Firebase:", error);
            Sentry.captureException(error, { extra: { context: 'useFormSaver - saveReport' } });
            if (!options.silent) {
                showNotification('Something went wrong while saving the report.', 'error');
            }
            return { success: false, error: error.message };
        }
    }, [gtaWorldUser, isGtaAuthenticated, showNotification]);

    return { saveReport };
};
