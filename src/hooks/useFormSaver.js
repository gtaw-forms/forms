import { useCallback } from 'react';
import { database } from '../firebase';
import { ref, set, runTransaction } from 'firebase/database';
import * as Sentry from "@sentry/react";
import { getCharacterName, getCharacterID } from '../utils/identityUtils';
import { comprehensiveSanitize } from '../utils/textUtils';
import { useNotification } from '../contexts/NotificationContext';
import { reportLogicalError } from '../utils/logging';
import { useAuth } from '../contexts/AuthContext';
import { checkConsentDirect } from './useConsent';

const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

const deployTrackedForms = ['coroner-report', 'coroner_email', 'death_record', 'autopsy', 'mass-ftality-test',
    'patient_notes', 'er_protocol', 'physical_evaluation', 'staff-patient-file', 'surgical',
    'session_notes', 'intensive_treatment', 'psych_eval', 'testing-compact-mode'];

export function getReportBasePath(formFirebaseKey, botDeployOptedIn = false) {
  if (deployTrackedForms.includes(formFirebaseKey)) {
    if (isLocalHost) return 'dev-reports'; // Dev sandbox — no auth needed
    if (botDeployOptedIn) return 'scheduledReports';
  }
  return 'newSavedReports';
}

export function getBBCodeBasePath(formFirebaseKey, botDeployOptedIn = false) {
  if (deployTrackedForms.includes(formFirebaseKey)) {
    if (isLocalHost) return 'dev-reports-bbcode'; // Dev sandbox (separate from report data)
    if (botDeployOptedIn) return 'scheduledReportsBBCode';
  }
  return 'newSavedReportBBCode';
}

const parseCaseNumber = (url) => {
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

import { useGtaWorldAuthContext } from '../contexts/GtaWorldAuthContext';
import { triggerWebhookProxy } from '../services/firebaseFunctions';

export const useFormSaver = (gtaWorldUser, isGtaAuthenticated) => {
    const { showNotification } = useNotification();
    const { isFactionMember } = useGtaWorldAuthContext();
    const { user: authUser } = useAuth();
    const firebaseUid = authUser?.uid || null;

    const validateMembership = useCallback(() => {
        // --- LOCALHOST DEVELOPMENT BYPASS ---
        // Allow saving reports on localhost even if faction membership cannot be verified.
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.log('[useFormSaver] 🛠️ Localhost detected: Bypassing strict faction membership validation.');
            return true;
        }

        if (!isFactionMember) {
            showNotification('ACCESS DENIED: You are no longer recognized as a faction member. Action blocked.', 'error', 10000);
            return false;
        }
        return true;
    }, [isFactionMember, showNotification]);

    const saveReport = useCallback(async (selectedForm, formValues, title, bbCode, options = {}) => {
        // validate user's faction membership
        if (!validateMembership()) {
            return { success: false, error: 'Membership validation failed.' };
        }

        if (!selectedForm || !formValues || !bbCode) {
            const missingFields = [];
            if (!selectedForm) missingFields.push('selectedForm');
            if (!formValues) missingFields.push('formValues');
            if (!bbCode) missingFields.push('bbCode');
            if (!title && selectedForm?.category !== 'PHMC Staff') missingFields.push('title');
            if (missingFields.length > 0) {
                console.error('[DEBUG useFormSaver] Save failed due to missing required data:', missingFields.join(', '));
                if (!options.silent) {
                    showNotification('Missing data required to save the report.', 'error');
                }
                return { success: false, error: 'Missing data.' };
            }
        }

        let finalTitle = title;
        if (selectedForm.firebaseKey === 'coroner-report') {
            if (formValues.decedentName && formValues.decedentOOC && formValues.dateTime) {
                const formattedDate = formatToNorthAmericanDate(formValues.dateTime);
                const deathType = (formValues.typeOfDeath || 'PK').toUpperCase();
                finalTitle = `[${deathType}] ${formValues.decedentName} ((${formValues.decedentOOC})) ${formattedDate}`;
            } else {
                console.warn("Could not generate standardized Coroner Report title due to missing decedentName, decedentOOC or dateTime. Using default title.");
            }
        } else if (selectedForm.firebaseKey === 'mass-ftality-test') { // Handle Mass Fatality Report
            const decedents = Array.isArray(formValues.decedents) ? formValues.decedents : [];
            const label = (selectedForm.name || '').toLowerCase().includes('multi')
                ? 'Multi Fatality Report'
                : 'Mass Fatality Report';
            // Group decedents by display name: CKs show real (OOC) name, PKs show character name
            const nameGroups = {};
            for (const dec of decedents) {
                const isCK = dec?.typeOfDeath?.toUpperCase() === 'CK';
                const displayName = isCK && dec?.decedentOOC
                    ? dec.decedentOOC.trim()
                    : (dec?.decedentName || 'Unknown').trim();
                nameGroups[displayName] = (nameGroups[displayName] || 0) + 1;
            }
            // Format: "John Doe (x2), Kelly Clarkson"
            const nameParts = Object.entries(nameGroups).map(([name, count]) =>
                count > 1 ? `${name} (x${count})` : name
            );
            const nameSummary = nameParts.join(', ');
            // Find the best date from any decedent that has one, or fall back to form level
            const anyDecWithDate = decedents.find(d => d.dateOfDeath);
            const dateSource = anyDecWithDate?.dateOfDeath || formValues.dateTime;
            const formattedMFDate = formatToNorthAmericanDate(dateSource);
            finalTitle = `[${label}] ${nameSummary} - ${formattedMFDate}`;
        } else if (['patient_notes', 'er_protocol', 'physical_evaluation', 'staff-patient-file', 'surgical', 'session_notes', 'intensive_treatment', 'psych_eval'].includes(selectedForm.firebaseKey) && !title) {
            // Medical record fallback title
            const pName = formValues.decedentName || formValues.patientName || 'Unknown Patient';
            const pId = formValues.patientID || '';
            finalTitle = pId ? `Patient #${pId} - ${pName}` : `Patient - ${pName}`;
        } else if (selectedForm.firebaseKey === 'coroner_email' && !title) {
            // Only use fallback when saved without BBCode generation (title is empty)
            const reqOfficer = formValues.requestingOfficer || formValues.requesting_officer || '';
            const dept = (typeof formValues.department === 'object' ? (formValues.department.label || formValues.department.value) : formValues.department) || '';
            if (reqOfficer && dept) {
                finalTitle = `Coroner Email - ${reqOfficer} (${dept})`;
            } else if (reqOfficer) {
                finalTitle = `Coroner Email - ${reqOfficer}`;
            } else {
                finalTitle = 'Coroner Email';
            }
        } else if (selectedForm.firebaseKey === 'death_record') { // Handle Death Record title
            const decedentName = formValues.decedentName || 'UNKNOWN';
            const decedentOOC = formValues.decedentOOC || 'N/A';
            const year = new Date().getFullYear();
            const caseNum = parseCaseNumber(formValues.deathReportPostId) || parseCaseNumber(formValues.caseNumber) || 'UNKNOWN';
            const formattedDateOfDeath = formatToMMM_DD_YYYY(formValues.dateOfDeath || formValues.formattedDateOfDeath);

            finalTitle = `[CASE #${year}-${caseNum}] ${decedentName} ((${decedentOOC})) | ${formattedDateOfDeath}`;
        }

        let currentAuthor = getCharacterName(gtaWorldUser);

        // Localhost override — use dev identity so OAuth names don't leak into prod data or Discord webhooks
        if (isLocalHost) {
            currentAuthor = 'GTAW Dev';
        }
        
        // --- EMERGENCY FALLBACK FOR authorName ---
        // Catch cases where OAuth is active but name sync is incomplete ('GTAW User')
        // We look for explicit employee names in formValues as a fallback truth.
        if (currentAuthor === 'GTAW User' || !currentAuthor) {
            const possibleAuthorFields = [
                'coronerEmployee', 'phmcEmployee', 'employeeName', 'staffName',
                'doctorName', 'examinerName', 'officerName'
            ];
            
            let foundFallback = null;
            for (const field of possibleAuthorFields) {
                if (formValues[field] && typeof formValues[field] === 'string' && formValues[field].trim().length > 3) {
                    foundFallback = formValues[field].trim();
                    break;
                }
            }
            
            // Second level fallback: First + Last name combination
            if (!foundFallback) {
                const firstName = formValues.coronerFirstName || formValues.phmcFirstName || formValues.firstName;
                const lastName = formValues.coronerLastName || formValues.phmcLastName || formValues.lastName;
                if (firstName && lastName) {
                    foundFallback = `${firstName} ${lastName}`.trim();
                }
            }

            if (foundFallback) {
                console.warn(`[useFormSaver] 🕵️ Author fallback triggered: Using "${foundFallback}" from form fields instead of "${currentAuthor || 'null'}".`);
                
                // Track this rare event via the Error Handler for debugging
                reportLogicalError("Author Name Fallback Triggered", "OAuth data was incomplete (GTAW User), using form values as fallback truth.", {
                    originalAuthor: currentAuthor || 'null',
                    fallbackName: foundFallback,
                    formId: selectedForm?.firebaseKey,
                    gtaWorldUser: gtaWorldUser ? {
                        username: gtaWorldUser.username,
                        id: gtaWorldUser.id,
                        hasFaction: !!gtaWorldUser.faction,
                        characterName: gtaWorldUser.characterName
                    } : 'null',
                    formValuesKeys: Object.keys(formValues)
                });

                currentAuthor = foundFallback;
            }
        }

        if (!currentAuthor || currentAuthor === 'GTAW User') {
            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            
            if (isLocalhost) {
                currentAuthor = currentAuthor || 'GTAW Dev';
                console.log(`[useFormSaver] 🛠️ Localhost detected: Allowing author "${currentAuthor}" for development.`);
            } else {
                if (!options.silent) {
                    showNotification('Cannot determine report author. Please ensure you are signed in and your name is correctly filled on the form.', 'error');
                }
                return { success: false, error: 'Cannot determine report author.' };
            }
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
            legacy: false,
            ...(deployTrackedForms.includes(selectedForm.firebaseKey) && { hasdeployed: false }),
            ...(isLocalHost && { _devMode: true }),
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

        // ── Pre-save validation: ensure BBCode matches the form ──
        // Catches cases where the user switched forms without re-generating BBCode.
        if (deployTrackedForms.includes(selectedForm.firebaseKey)) {
            const formLabel = selectedForm.name || '';
            const formIdLabel = selectedForm.firebaseKey || '';
            // Check that the finalTitle at least references the form type, not a completely different form
            const titleLower = finalTitle.toLowerCase();
            const mismatch = (
                (formIdLabel === 'coroner_email' && titleLower.includes('mass fatality')) ||
                (formIdLabel === 'coroner_email' && titleLower.includes('multi fatality')) ||
                (formIdLabel === 'coroner-report' && titleLower.includes('coroner email'))
            );
            if (mismatch) {
                const msg = `Title "${finalTitle}" doesn't match form "${formLabel}". Please generate BBCode first.`;
                console.warn(`[useFormSaver] ⚠️ ${msg}`);
                if (!options.silent) {
                    showNotification(msg, 'error', 8000);
                }
                return { success: false, error: 'Title/form mismatch' };
            }
        }

        // Determine deploy path and consent for this form type
        const isDeployTracked = deployTrackedForms.includes(selectedForm.firebaseKey);
        const hasConsent = isDeployTracked
            ? await checkConsentDirect(firebaseUid, selectedForm.firebaseKey)
            : false;

        const reportBasePath = getReportBasePath(selectedForm.firebaseKey, hasConsent);
        const bbCodeBasePath = getBBCodeBasePath(selectedForm.firebaseKey, hasConsent);
        const reportPath = `${reportBasePath}/${sanitizedAuthorId}/${sanitizedKey}`;
        const bbCodePath = `${bbCodeBasePath}/${sanitizedAuthorId}/${sanitizedKey}`;

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
                ...(!isLocalHost ? [runTransaction(userReportCountRef, (currentCount) => (currentCount || 0) + 1)] : []),
            ];

            // Dual-save: when user has consented on live site, also save to newSavedReports
            // so the Saved Reports modal can find it.
            if (hasConsent && !isLocalHost && isDeployTracked) {
                const liveReportRef = ref(database, `newSavedReports/${sanitizedAuthorId}/${sanitizedKey}`);
                const liveBBCodeRef = ref(database, `newSavedReportBBCode/${sanitizedAuthorId}/${sanitizedKey}`);
                promises.push(set(liveReportRef, reportDataToSave));
                promises.push(set(liveBBCodeRef, { bbCode: bbCode }));
            }

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

                const isDeathRecord = selectedForm.firebaseKey === 'death_record';
                const discordPayload = {
                    embeds: [{
                        title: isDeathRecord ? '💀 Death Record Saved (CK)' : 'Report Saved',
                        description: isDeathRecord 
                            ? `**A CK report has been posted, review and upload the Death Record to PHMC Forums.**\nSaved by **${webhookPayload.author}**.`
                            : `A new report has been saved by **${webhookPayload.author}**.`,
                        color: isDeathRecord ? 15548997 : 5814783,
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

                triggerWebhookProxy('forms', discordPayload).catch(error => {
                    console.error("Error sending webhook to Discord:", error);
                    Sentry.captureException(error, { extra: { context: 'saveReport - Discord Webhook' } });
                });
            } catch (err) {
                console.error("Fatal error constructing or sending Discord webhook.", err);
                Sentry.captureException(err, { extra: { context: 'saveReport - Webhook' } });
            }

            return { success: true, reportKey: sanitizedKey, authorId: sanitizedAuthorId, reportPath, originalKey: finalTitle };

        } catch (error) {
            console.error("Error saving new report to Firebase:", error);
            Sentry.captureException(error, {
                extra: {
                    context: 'useFormSaver - saveReport',
                    formId: selectedForm?.firebaseKey,
                    formName: selectedForm?.name,
                    reportPath: `${reportBasePath}/${sanitizedAuthorId}/${sanitizedKey}`,
                    firebaseUid,
                    hasConsent,
                    isDeployTracked,
                    isLocalHost,
                    userAgent: navigator.userAgent,
                },
            });
            // Fire Discord webhook for save failures (Sentry is returning 404)
            try {
                const webhookUrl = import.meta.env.VITE_DEV_WEBHOOK;
                if (webhookUrl) {
                    fetch(webhookUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            embeds: [{
                                title: '❌ Report Save Failed',
                                description: `**Form:** ${selectedForm?.name || 'Unknown'}\n**Error:** ${error.message || 'Unknown'}\n**Code:** ${error.code || 'N/A'}`,
                                color: 0xdc3545,
                                timestamp: new Date().toISOString(),
                            }],
                        }),
                    }).catch(() => {});
                }
            } catch {}
            if (!options.silent) {
                showNotification('Something went wrong while saving the report.', 'error');
            }
            return { success: false, error: error.message };
        }
    }, [gtaWorldUser, isGtaAuthenticated, authUser, showNotification]);

    return { saveReport, validateMembership };
};
