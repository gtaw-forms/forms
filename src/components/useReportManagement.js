import { useState, useRef, useCallback } from 'react';
import { getFormDefinition } from '../formDefinitions'; // Assuming this path
import { database } from '../firebase'; // Assuming this path
import { ref, get, set, remove, runTransaction } from 'firebase/database';
import { getFunctions, httpsCallable } from 'firebase/functions';
import * as Sentry from "@sentry/react";
import useGtaWorldAuth from '../hooks/useGtaWorldAuth';
import { useFormHandler } from './form-handler/useFormHandler';
import { getCharacterName, getCharacterID } from '../utils/characterUtils';

import { useData } from '../contexts/DataContext';
import { useModal } from '../contexts/ModalProvider';

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

export const useReportManagement = (
    formData,
    setFormData,
    bbCodeVersion_DEPRECATED, // This is null from FormHandler
    setBbCodeVersion_DEPRECATED, // This is a placeholder from FormHandler
    getBBCodeContent,
    getCurrentReportAuthor,
    filterFormData,
    selectOptions,
    showNotification,
    removeNotification,
    setShowEasterEggModal,
    setEasterEggType,
    sendEasterEggNotification,
    modalCloseTimer,
    selectedForm, // This is the 15th argument
    getForms, // Changed from forms to getForms (a getter function)
    setSelectedForm,
    // The following are legacy and not passed by FormHandler.jsx
    // We keep them with default values to avoid breaking the old App.jsx implementation.
    versionNames = {},
    ER_PROTOCOL_VERSION = null,
    CONSULTATION_NOTES_PHMC_VERSION = null,
    CONSULTATION_NOTES_PBC_VERSION = null,
    selectedAgencyGroup = null
) => {    
    const bbCodeVersion = bbCodeVersion_DEPRECATED; // Define bbCodeVersion from the deprecated argument

    const { factionsData, coronerListData, phmcListData, sendDataRequestLog } = useData();
    const formHandler = useFormHandler(showNotification);

    const findEmployeeDetails = (employeeName) => {
        if (factionsData && factionsData['364'] && factionsData['364'].members) {
            const allMembers = Object.values(factionsData['364'].members);
            const employee = allMembers.find(member => 
                (member.characterName && member.characterName === employeeName) || 
                (member.name && member.name === employeeName)
            );
            if (employee) return employee;
        }

        // Fallback to legacy lists if not found in the new system
        const legacyCoroner = coronerListData.find(c => c.name === employeeName);
        if (legacyCoroner) return legacyCoroner;
        
        const legacyPhmc = phmcListData.find(p => p.name === employeeName);
        return legacyPhmc || null;
    };
    
    // GTAW OAuth integration for automatic character data inclusion
    const { user: gtaWorldUser, isAuthenticated: isGtaAuthenticated } = useGtaWorldAuth();
    const [savedReports, setSavedReports] = useState([]);
    const [showSavedReports, setShowSavedReports] = useState(false);
    const [isLoadingUserReports, setIsLoadingUserReports] = useState(false);
    const [selectedUserForSavedReports, setSelectedUserForSavedReports] = useState(null);
    const [preselectedEmployeeType, setPreselectedEmployeeType] = useState(null);
    const pendingReportAttachmentCallback = useRef(null);
    const currentAttachmentTargetFieldRef = useRef(null); // Add this line
    const [reportSelectionFilter, setReportSelectionFilter] = useState(null);
    const [showPositionInfoModal, setShowPositionInfoModal] = useState(false);
    const [currentPositionInfo, setCurrentPositionInfo] = useState(null);

    const logWebhook = async (type, payload) => {
        // Log to Firebase RTDB
        const logRef = ref(database, 'webhook_logs/' + Date.now());
        console.log('Logging legacy webhook to Firebase RTDB...', { type, payload });
        try {
            await set(logRef, {
                type: type,
                payload: payload,
                timestamp: Date.now()
            });
            console.log('Successfully logged legacy webhook to Firebase RTDB.');
        } catch (error) {
            console.error("Error logging legacy webhook to Firebase:", error);
            Sentry.captureException(error, { extra: { context: 'logWebhook - Firebase (legacy)' } });
        }

        // Send to Discord
        const discordWebhookUrl = import.meta.env.VITE_DISCORD_REPORTS_WEBHOOK_URL;
        if (discordWebhookUrl) {
            console.log('Attempting to send legacy report saved webhook to Discord...');
            try {
                const discordPayload = {
                    embeds: [
                        {
                            title: 'Legacy Report Saved',
                            description: `A new legacy report has been saved by **${payload.author}**.`,
                            color: 0xf59e0b, // amber-500
                            fields: [
                                { name: 'Author', value: payload.author, inline: true },
                                { name: 'Form Name', value: payload.formName, inline: true },
                                { name: 'Report Title', value: `\`${payload.originalKey}\``, inline: false },
                            ],
                            timestamp: new Date().toISOString(),
                            footer: {
                                text: `BBCodeVersion: ${payload.bbCodeVersion} | ReportKey: ${payload.reportKey}`
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
                    console.log('Successfully sent legacy report saved webhook to Discord.');
                }

            } catch (error) {
                console.error("Error sending legacy webhook to Discord:", error);
                Sentry.captureException(error, { extra: { context: 'logWebhook - Discord (legacy)' } });
            }
        } else {
            console.warn('VITE_DISCORD_REPORTS_WEBHOOK_URL is not set. Skipping Discord webhook.');
        }
    };
    
    const saveFormHandlerReport = async (reportName, bbCodeContent) => {
        const currentAuthor = getCurrentReportAuthor(formData);
        if (!currentAuthor) {
            showNotification('Cannot determine report author.', 'error');
            return { success: false, error: 'Cannot determine report author.' };
        }
        return await formHandler.saveReport(reportName, bbCodeContent, currentAuthor, formData, filterFormData);
    };

    const saveMigratedReport = async (migratedReport, bbCodeContent) => {
        const currentAuthor = migratedReport.authorName; // Use author from the migrated report
        const key = migratedReport.originalKey; // Use originalKey from the migrated report

        if (!currentAuthor) {
            showNotification('Cannot determine report author for migration.', 'error');
            return { success: false, error: 'Cannot determine report author for migration.' };
        }

        const sanitizedAuthorId = comprehensiveSanitize(currentAuthor);
        const sanitizedKey = key.trim().replace(/[.#$[\/ \]]+/g, '_') + '_' + Date.now();

        let baseReportPath = `savedReports`;
        let baseBbCodePath = `savedReportBBCode`;

        // Determine save path based on the legacy flag in the migrated report
        if (migratedReport.hasOwnProperty('legacy') && migratedReport.legacy === false) {
            baseReportPath = `newSavedReports`;
            baseBbCodePath = `newSavedReportBBCode`;
        }
        
        const reportPath = `${baseReportPath}/${sanitizedAuthorId}/${sanitizedKey}`;
        const bbCodePath = `${baseBbCodePath}/${sanitizedAuthorId}/${sanitizedKey}`;

        // --- MODIFIED GTAW DATA HANDLING (for migrated reports) ---
        let gtawDataFound = false;
        let userForGtawData = null;

        if (isGtaAuthenticated && gtaWorldUser) {
            gtawDataFound = true;
            userForGtawData = gtaWorldUser;
        } else {
            const storedProfileRaw = localStorage.getItem('phmc_gtaw_oauth_profile');
            if (storedProfileRaw) {
                try {
                    const storedProfile = JSON.parse(storedProfileRaw);
                    if (storedProfile) {
                        gtawDataFound = true;
                        userForGtawData = storedProfile;
                    }
                } catch (e) {
                    console.error("Error parsing stored GTAW profile:", e);
                    Sentry.captureException(e, { extra: { context: 'saveMigratedReport - parsing stored profile' } });
                }
            }
        }
        // --- END MODIFIED GTAW DATA HANDLING ---

        try {
            const reportRef = ref(database, reportPath);
            const bbCodeRef = ref(database, bbCodePath);

            const userReportCountRef = ref(database, `userReportCounts/${sanitizedAuthorId}/total`);

            // Save both main report data and BBCode data in parallel, and increment count
            await Promise.all([
                set(reportRef, migratedReport), // Save the entire migratedReport object
                set(bbCodeRef, { bbCode: bbCodeContent }),
                runTransaction(userReportCountRef, (currentCount) => {
                    return (currentCount || 0) + 1;
                })
            ]);

            if (sendDataRequestLog) {
                const reportSize = new TextEncoder().encode(JSON.stringify(migratedReport)).length;
                const bbCodeSize = new TextEncoder().encode(JSON.stringify({ bbCode: bbCodeContent })).length;
                const totalSize = reportSize + bbCodeSize;

                sendDataRequestLog(
                    'useReportManagement.js/saveMigratedReport',
                    false, // This is a write operation
                    'Firebase Write',
                    totalSize,
                    isGtaAuthenticated,
                    getCharacterName(gtaWorldUser),
                    `Report: ${reportPath} (${reportSize} bytes), BBCode: ${bbCodePath} (${bbCodeSize} bytes)`
                );
            }

            const successMessage = gtawDataFound ?
                `Migrated Report "${key}" saved for ${currentAuthor} to Firebase with GTAW data!` :
                `Migrated Report "${key}" saved for ${currentAuthor} to Firebase!`;
            showNotification(successMessage, 'save');

            // Log the webhook with GTAW data information
            const formName = migratedReport.formName || `FormV${migratedReport.bbCodeVersion}`; // Use formName from migrated report
            const webhookPayload = {
                author: currentAuthor,
                reportKey: sanitizedKey,
                originalKey: key,
                formName: formName,
                bbCodeVersion: migratedReport.bbCodeVersion === undefined ? null : migratedReport.bbCodeVersion, // Ensure bbCodeVersion is not undefined
                hasGtawData: gtawDataFound,
                data: migratedReport.data // Include the full migrated report data in webhook payload
            };

            if (gtawDataFound && userForGtawData) {
                webhookPayload.gtawUsername = userForGtawData.username;
                webhookPayload.gtawCharacterId = getCharacterID(userForGtawData);
                webhookPayload.gtawCharacterName = getCharacterName(userForGtawData);
            }

            await logWebhook(`migrated_report_saved by ${currentAuthor}`, webhookPayload);

            return { success: true }; // Indicate success

        } catch (error) {
            if (sendDataRequestLog) {
                sendDataRequestLog(
                    'useReportManagement.js/saveMigratedReport',
                    false,
                    'Firebase Write Error',
                    0,
                    isGtaAuthenticated,
                    getCharacterName(gtaWorldUser),
                    `Report: ${reportPath}, BBCode: ${bbCodePath}`,
                    error.message || 'Unknown Save Error'
                );
            }
            console.error("Error saving migrated report to Firebase:", error);
            Sentry.captureException(error, { extra: { context: 'Firebase set migrated report' } });
            const message = 'Something unexpected went wrong while saving migrated report!';
            showNotification(message, 'error');
            return { success: false, error: message }; // Indicate failure
        }
    };
    

    async function saveReport() {
        let key = '';
        const bbCodeContent = getBBCodeContent();
        const currentAuthor = getCurrentReportAuthor(formData);
        let isLegacy = false;

        // --- Validation logic to determine the key ---
        if (bbCodeVersion === 1) { // Death Report
            if (!formData.decedentOOC || !formData.dateTime) {
                const message = `Please fill in Decedent OOC and Date/Time fields.`;
                showNotification(message, 'exclamation-circle');
                return { success: false, error: message };
            }
            key = `[DEATH-REPORT] ${formData.decedentOOC} ${formData.dateTime}`;
            isLegacy = true;
        } else if (bbCodeVersion === 4) { // Autopsy Report
            if (!formData.decedentName || !formData.decedentOOC || !formData.autopsyDate) {
                const message = `Please fill in Decedent IC Name, OOC Name, and Autopsy Date fields.`;
                showNotification(message, 'exclamation-circle');
                return { success: false, error: message };
            }
            key = `[Autopsy] ${formData.decedentName} (${formData.decedentOOC}) - ${formData.autopsyDate}`;
            isLegacy = true;
        } else if (bbCodeVersion === 3) { // Detailed Patient File (PatientAdvanced)
            if (!formData.patientName || !formData.patientDateOfBirth) {
                const message = `Please fill in Patient Name and Date of Birth fields.`;
                showNotification(message, 'exclamation-circle');
                return { success: false, error: message };
            }
            key = `${formData.patientID || 'NO_ID'} - ${formData.patientName || 'NO_NAME'} - ${formData.patientDateOfBirth || 'NO_DATE'}`;
            isLegacy = true;
        } else if (((bbCodeVersion > 3 && bbCodeVersion <= 7) && bbCodeVersion !== 4)) { // SurgicalOps (5), PhysEval PHMC/PBC (6,7)
            let patientIdMissing = !formData.patientID;
            let dateMissing = !formData.date;
            let patientNameMissing = false;
            if (bbCodeVersion !== 5) { // Surgical doesn't strictly require patientName for this validation step.
                patientNameMissing = !formData.patientName;
            }
            if (patientIdMissing || dateMissing || patientNameMissing) {
                let missingFieldLabels = [];
                if (patientIdMissing) missingFieldLabels.push('Patient ID');
                if (patientNameMissing) missingFieldLabels.push('Patient Name');
                if (dateMissing) missingFieldLabels.push('Date');
                if (missingFieldLabels.length > 0) {
                    const message = `Please fill in ${missingFieldLabels.join(', ')} fields.`;
                    showNotification(message, 'exclamation-circle');
                    return { success: false, error: message };
                }
            }
            key = `${formData.patientID || 'NO_ID'} - ${formData.patientName || 'NO_NAME'} - ${formData.date || 'NO_DATE'}`;
            isLegacy = true;
        } else if (bbCodeVersion === 19) { // EmergencyProtocol
            if (!formData.patientID || !formData.date) {
                const message = `Please fill in Patient ID, and Date fields.`;
                showNotification(message, 'exclamation-circle');
                return { success: false, error: message };
            }
            key = `${formData.patientID} - ${formData.lastName} - ${formData.date}`;
            isLegacy = true;
        } else if (bbCodeVersion === 25) { // BasicPatientFile
            if (!formData.patientName || !formData.patientDateOfBirth) {
                const message = `Please fill in Patient Name and Date of Birth fields.`;
                showNotification(message, 'exclamation-circle');
                return { success: false, error: message };
            }
            key = `${formData.patientName} - ${formData.patientDateOfBirth}`;
            isLegacy = true;
        } else if (bbCodeVersion === 24) { // Medical Record Release
            // This form uses registrantFullName and dateOfRequest
            if (!formData.registrantFullName || !formData.dateOfRequest) {
                const message = `Please fill in Registrant Full Name and Date of Request fields.`;
                showNotification(message, 'exclamation-circle');
                return { success: false, error: message };
            }
            key = `[Medical Release] ${formData.registrantFullName} - ${formData.dateOfRequest}`;
            isLegacy = true;
        }
        // --- Add more 'else if' blocks here for other specific bbCodeVersions ---
        // Example for Coroner Email (bbCodeVersion 2)
        else if (bbCodeVersion === 2) {
            if (!formData.coronerEmployee || !formData.requestingOfficer || (!formData.decedentName && !formData.decedentOOC)) {
                const message = `Please fill in Coroner, Requesting Officer, and Decedent Name/OOC for Coroner Email.`;
                showNotification(message, 'exclamation-circle');
                return { success: false, error: message };
            }
            key = `[Email] ${formData.requestingOfficer} re: ${formData.decedentName || formData.decedentOOC} - ${new Date().toISOString().split('T')[0]}`;
            isLegacy = true;
        }
        // Example for Agency Feedback (bbCodeVersion 18)
        else if (bbCodeVersion === 18) {
            if (!formData.department || !formData.dateTime || !formData.synopsis) {
                const message = `Please fill in Department, Date/Time, and Synopsis for Agency Feedback.`;
                showNotification(message, 'exclamation-circle');
                return { success: false, error: message };
            }
            key = `[Feedback] ${formData.department} - ${formData.dateTime}`;
            isLegacy = true;
        }
        // --- MODIFICATION FOR PHMC RECRUITMENT ---
        else if (getFormDefinition(bbCodeVersion)?.group === 'PHMC Recruitment') {
            return { success: false, error: 'PHMC Recruitment forms cannot be saved to Firebase.' };
        }
        // --- END MODIFICATION ---
        else if (bbCodeVersion === 11) { // Mass Fatality Report
            const { decedents, dateTime } = formData;
            if (!decedents || decedents.length === 0) {
                const message = `Please add at least one decedent to the report.`;
                showNotification(message, 'exclamation-circle');
                return { success: false, error: message };
            }
            const firstDecedent = decedents[0];
            if (!firstDecedent.decedentName || !dateTime) {
                const message = `The first decedent must have a name and the main date/time must be set.`;
                showNotification(message, 'exclamation-circle');
                return { success: false, error: message };
            }
            const decedentNames = decedents.map(d => d.decedentName).filter(name => name).join(', ');
            key = `[Mass Fatality Report] - ${decedentNames} - ${(dateTime && dateTime.split('T')[0]) || 'No Date'}`;
            isLegacy = true;
        }
        else if (bbCodeVersion === 37) { // Death Record
            if (!formData.deathReportPostId || !formData.decedentName || !formData.dateOfDeath) {
                const message = `Please fill in Case Number, Decedent Name, and Date of Death fields.`;
                showNotification(message, 'exclamation-circle');
                return { success: false, error: message };
            }
            const caseNumber = parseCaseNumber(formData.deathReportPostId);
            // Format date to MM-DD-YYYY
            const formattedDate = formData.dateOfDeath ? new Date(formData.dateOfDeath).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase().replace(/,/g, '') : 'NO_DATE';
            key = `[CASE #${caseNumber}] ${formData.decedentName} (( ${formData.decedentOOC || 'N/A'} )) | [${formattedDate}]`;
            isLegacy = true;
        }
        else { // Default handler for any other bbCodeVersion (includes SAAA)
            const definition = getFormDefinition(bbCodeVersion); // Get current form definition


            // Existing generic key generation for non-SAAA, non-PHMC Recruitment forms
            const formName = versionNames[bbCodeVersion] || `FormV${bbCodeVersion}`;

            // MODIFIED: Prioritize decedentName, then patientName, then a generic placeholder
            let identifier = formData.decedentName || formData.patientName || 'Unnamed Report';
            if (Array.isArray(identifier)) identifier = identifier.join(', ');

            // MODIFIED: Ensure dateField always has a value
            const dateField = formData.date || formData.dateTime || formData.autopsyDate || 'No Date';

            // MODIFIED: Removed the check that would prevent saving if identifier was empty.
            // The identifier will now always have a value ('Unnamed Report' at minimum).

            key = `[${formName}] ${identifier} - ${dateField}`;
        }

        // If key is still empty, something went wrong (should be caught by validations)
        if (!key) {
            const message = 'Could not generate a report key. Save aborted.';
            showNotification(message, 'error');
            return { success: false, error: message };
        }

        if (!currentAuthor) {
            const message = 'Cannot determine report author. Please ensure an employee is selected or patient name is filled if applicable for this form type.';
            showNotification(message, 'error');
            return { success: false, error: message };
        }


        const sanitizedAuthorId = comprehensiveSanitize(currentAuthor);

        const sanitizedKey = key.trim().replace(/[.#$[\/ \]]+/g, '_') + '_' + Date.now();

        // --- Easter Egg Logic ---
        const currentSavedCountForAuthor = savedReports.filter(r => r.authorName === currentAuthor).length;
        const easterEggAlreadyShown = localStorage.getItem('easterEggShown') === 'true';
        let showNormalEasterEgg = false;
        let showRareEasterEgg = false;

        if (currentSavedCountForAuthor === 4 && !easterEggAlreadyShown) {
            showNormalEasterEgg = true;
        } else if (currentSavedCountForAuthor > 4 && !easterEggAlreadyShown) {
            showNormalEasterEgg = Math.random() < 0.05;
        } else if (easterEggAlreadyShown) {
            showRareEasterEgg = Math.random() < 0.01;
        }

        if (showNormalEasterEgg) {
            setShowEasterEggModal(true);
            setEasterEggType('normal');
            localStorage.setItem('easterEggShown', 'true');
            sendEasterEggNotification('normal');
        } else if (showRareEasterEgg) {
            setShowEasterEggModal(true);
            setEasterEggType('rare');
            sendEasterEggNotification('rare');
        }
        // --- End Easter Egg Logic ---


        const reportDataToSave = {
            bbCodeVersion: bbCodeVersion,
            data: filterFormData(formData, bbCodeVersion),
            // bbCode is now saved separately
            timestamp: Date.now(),
            originalKey: key,
            authorName: currentAuthor,
            legacy: isLegacy // Add the legacy flag
        };

        // --- MODIFIED GTAW DATA HANDLING ---
        let gtawDataFound = false;
        let userForGtawData = null;

        if (isGtaAuthenticated && gtaWorldUser) {
            gtawDataFound = true;
            userForGtawData = gtaWorldUser;
        } else {
            const storedProfileRaw = localStorage.getItem('phmc_gtaw_oauth_profile');
            if (storedProfileRaw) {
                try {
                    const storedProfile = JSON.parse(storedProfileRaw);
                    if (storedProfile) {
                        gtawDataFound = true;
                        userForGtawData = storedProfile;
                    }
                } catch (e) {
                    console.error("Error parsing stored GTAW profile:", e);
                    Sentry.captureException(e, { extra: { context: 'saveReport - parsing stored profile' } });
                }
            }
        }

        if (gtawDataFound && userForGtawData) {
            reportDataToSave.gtawUsername = userForGtawData.username;
            reportDataToSave.gtawCharacterId = getCharacterID(userForGtawData);
            reportDataToSave.gtawCharacterName = getCharacterName(userForGtawData);
            reportDataToSave.gtawSyncTimestamp = new Date().toISOString();
            reportDataToSave.gtawSyncVersion = '1.2-local'; // Mark as potentially from local storage

            console.log('📄 [Report Save] Added GTAW data to saved report:', {
                username: reportDataToSave.gtawUsername,
                characterId: reportDataToSave.gtawCharacterId,
                characterName: reportDataToSave.gtawCharacterName,
                author: currentAuthor,
                source: isGtaAuthenticated ? 'live' : 'local'
            });
        }
        // --- END MODIFIED GTAW DATA HANDLING ---

        let baseReportPath = `savedReports`;
        let baseBbCodePath = `savedReportBBCode`;

        // Check if reportDataToSave has a 'legacy' property and if it's explicitly false
        if (reportDataToSave.hasOwnProperty('legacy') && reportDataToSave.legacy === false) {
            baseReportPath = `newSavedReports`;
            baseBbCodePath = `newSavedReportBBCode`;
        }
        
        const reportPath = `${baseReportPath}/${sanitizedAuthorId}/${sanitizedKey}`;
        const bbCodePath = `${baseBbCodePath}/${sanitizedAuthorId}/${sanitizedKey}`;

        try {
            const reportRef = ref(database, reportPath);
            const bbCodeRef = ref(database, bbCodePath);

            const userReportCountRef = ref(database, `userReportCounts/${sanitizedAuthorId}/total`);

            // Save both main report data and BBCode data in parallel, and increment count
            await Promise.all([
                set(reportRef, reportDataToSave),
                set(bbCodeRef, { bbCode: bbCodeContent }),
                runTransaction(userReportCountRef, (currentCount) => {
                    return (currentCount || 0) + 1;
                })
            ]);

            if (sendDataRequestLog) {
                const reportSize = new TextEncoder().encode(JSON.stringify(reportDataToSave)).length;
                const bbCodeSize = new TextEncoder().encode(JSON.stringify({ bbCode: bbCodeContent })).length;
                const totalSize = reportSize + bbCodeSize;

                sendDataRequestLog(
                    'useReportManagement.js/saveReport',
                    false, // This is a write operation, not a cache read
                    'Firebase Write',
                    totalSize,
                    isGtaAuthenticated,
                    getCharacterName(gtaWorldUser),
                    `Report: ${reportPath} (${reportSize} bytes), BBCode: ${bbCodePath} (${bbCodeSize} bytes)`
                );
            }

            const successMessage = gtawDataFound ?
                `Report "${key}" saved for ${currentAuthor} to Firebase with GTAW data!` :
                `Report "${key}" saved for ${currentAuthor} to Firebase!`;
            showNotification(successMessage, 'save');

            // Log the webhook with GTAW data information
            const formName = versionNames[bbCodeVersion] || `Legacy Form V${bbCodeVersion}`;
            const webhookPayload = {
                author: currentAuthor,
                reportKey: sanitizedKey,
                originalKey: key,
                formName: formName,
                bbCodeVersion: bbCodeVersion,
                hasGtawData: gtawDataFound
            };

            if (gtawDataFound && userForGtawData) {
                webhookPayload.gtawUsername = userForGtawData.username;
                webhookPayload.gtawCharacterId = getCharacterID(userForGtawData);
                webhookPayload.gtawCharacterName = getCharacterName(userForGtawData);
            }

            await logWebhook(`report_saved by ${currentAuthor}`, webhookPayload);

            return { success: true }; // Indicate success

        } catch (error) {
            if (sendDataRequestLog) {
                sendDataRequestLog(
                    'useReportManagement.js/saveReport',
                    false,
                    'Firebase Write Error',
                    0,
                    isGtaAuthenticated,
                    getCharacterName(gtaWorldUser),
                    `Report: ${reportPath}, BBCode: ${bbCodePath}`,
                    error.message || 'Unknown Save Error'
                );
            }
            console.error("Error saving report to Firebase:", error);
            Sentry.captureException(error, { extra: { context: 'Firebase set report' } });
            const message = 'Something unexpected went wrong, report copied to clipboard!';
            showNotification(message, 'error');
            return { success: false, error: message }; // Indicate failure
        }
    };

    const handleCopyAndNotify = async () => {
        const bbCodeContent = getBBCodeContent();
        if (!bbCodeContent) {
            showNotification('BBCode content is empty, cannot copy.', 'error');
            return;
        }

        const saveReportResult = await saveReport();
        if (saveReportResult.success) {
            navigator.clipboard.writeText(bbCodeContent).then(() => {
                showNotification('BBCode copied to clipboard and report saved!', 'success');
            }).catch(err => {
                showNotification('Report saved, but failed to copy BBCode to clipboard.', 'warning');
                console.error('Clipboard copy failed:', err);
            });
        } else {
            // Notification is shown by saveReport on failure
        }
    };

    const loadUserSavedReports = useCallback(async (userId) => {
        if (!userId) {
            setSavedReports([]);
            setSelectedUserForSavedReports(null);
            return []; // MODIFIED: Return empty array
        }

        setIsLoadingUserReports(true);
        setSelectedUserForSavedReports(userId);
        const loadingNotifId = showNotification(`Loading reports for ${userId}...`, 'info-circle', 0);
        
        const sanitizedUserId = comprehensiveSanitize(userId);
        const legacyReportsRef = ref(database, `savedReports/${sanitizedUserId}`);
        const newReportsRef = ref(database, `newSavedReports/${sanitizedUserId}`);


        try {
            const [legacySnapshot, newSnapshot] = await Promise.all([
                get(legacyReportsRef),
                get(newReportsRef)
            ]);


            let allReports = [];

            if (legacySnapshot.exists()) {
                const legacyData = legacySnapshot.val();
                console.log(`[loadUserSavedReports] Raw legacy data:`, legacyData);
                const legacyReports = Object.keys(legacyData).map(key => ({
                    ...legacyData[key],
                    key: key // The firebase key
                }));

                const processedLegacyReports = legacyReports.map(report => {
                    if (report.legacy === undefined) {
                        // These versions were saved before the `legacy` flag existed.
                        const legacyVersions = [1, 2, 3, 4, 5, 6, 7, 11, 18, 19, 24, 25, 37];
                        const isLegacy = legacyVersions.includes(report.bbCodeVersion);
                        return { ...report, legacy: isLegacy };
                    }
                    return report;
                });
                allReports.push(...processedLegacyReports);
            }

            if (newSnapshot.exists()) {
                const newData = newSnapshot.val();
                const newReports = Object.keys(newData).map(key => ({
                    ...newData[key],
                    key: key // The firebase key
                }));
                // These reports should already have `legacy: false` set during save.
                allReports.push(...newReports);
            }

            removeNotification(loadingNotifId);

            if (allReports.length > 0) {
                allReports.sort((a, b) => b.timestamp - a.timestamp);
                setSavedReports(allReports);
                showNotification(`Loaded ${allReports.length} report(s) for ${userId}.`, 'check-circle');
            } else {
                showNotification(`No reports found for ${userId}.`, 'info-circle');
                        }
                        return allReports; // MODIFIED: Return allReports
                    } catch (error) {
                        removeNotification(loadingNotifId);
                        console.error(`Error loading reports for user ${userId}:`, error);
                        Sentry.captureException(error, { extra: { context: 'loadUserSavedReports', userId } });
                        showNotification(`Failed to load reports for ${userId}.`, 'error');
                        setSavedReports([]);
                        return []; // MODIFIED: Return empty array on error
        } finally {
            setIsLoadingUserReports(false);
        }
    }, [showNotification, removeNotification, setSavedReports, setSelectedUserForSavedReports, setIsLoadingUserReports]);

    const loadReportForUser = useCallback(async (report, userId, returnOnly = false) => {
        const reportFirebaseKey = report?.key;
        if (!userId || !reportFirebaseKey) {
            if (!returnOnly) showNotification('Cannot load report: User ID or Report Key is missing.', 'error');
            return { success: false, message: 'User ID or Report Key is missing.' };
        }

        const isLegacyReport = report.legacy;
        const sanitizedUserId = comprehensiveSanitize(userId);

        const reportPath = isLegacyReport
            ? `savedReports/${sanitizedUserId}/${reportFirebaseKey}`
            : `newSavedReports/${sanitizedUserId}/${reportFirebaseKey}`;
        const bbCodePath = isLegacyReport
            ? `savedReportBBCode/${sanitizedUserId}/${reportFirebaseKey}`
            : `newSavedReportBBCode/${sanitizedUserId}/${reportFirebaseKey}`;
        
        const reportRef = ref(database, reportPath);
        const bbCodeRef = ref(database, bbCodePath);


        let loadingNotifId;
        if (!returnOnly) { // Only show notification if we are directly loading into the form
            loadingNotifId = showNotification(`Loading report: ${reportFirebaseKey} for ${userId}...`, 'info-circle', 0);
        }

        try {
            const [reportSnapshot, bbCodeSnapshot] = await Promise.all([
                get(reportRef),
                get(bbCodeRef)
            ]);                if (reportSnapshot.exists()) {
                    const reportData = reportSnapshot.val();
                    const bbCodeData = bbCodeSnapshot.val();
                    
                    if (sendDataRequestLog) {
                        const reportSize = new TextEncoder().encode(JSON.stringify(reportData)).length;
                        const bbCodeSize = new TextEncoder().encode(JSON.stringify(bbCodeData)).length;
                        const totalSize = reportSize + bbCodeSize;

                        sendDataRequestLog(
                            'useReportManagement.js/loadReportForUser',
                            false, // This is a read operation, not from cache
                            'Firebase Read',
                            totalSize,
                            isGtaAuthenticated,
                            getCharacterName(gtaWorldUser),
                            `Report: ${reportPath} (${reportSize} bytes), BBCode: ${bbCodePath} (${bbCodeSize} bytes)`
                        );
                    }
                    // Manually add the bbCode to the reportData object
                    reportData.bbCode = bbCodeSnapshot.exists() ? bbCodeSnapshot.val().bbCode : '';

                    let loadedBbCode = reportData.bbCode || '';
                    // If bbCode is still empty, check within the reportData object itself
                    if (!loadedBbCode && reportData.bbCode) {
                        loadedBbCode = reportData.bbCode;
                    }
                    // If still empty, check a nested path within reportData
                    if (!loadedBbCode && reportData.data && reportData.data.bbCode) {
                        loadedBbCode = reportData.data.bbCode;
                    }
                    let loadedFormData = reportData.data || {};
                    const isFormHandlerReport = reportData.isFormHandler === true;

                    if (!isFormHandlerReport) {
                        if (returnOnly) {
                            // When attaching, convert [bold] to [b]
                            const boldMatches = (loadedBbCode.match(/\[bold\]/gi) || []).length;
                            if (boldMatches > 0) {
                                console.log(`[useReportManagement] Found ${boldMatches} [bold] tags. Converting to [b].`);
                                loadedBbCode = loadedBbCode.replace(/\[bold\]/gi, '[b]').replace(/\[\/bold\]/gi, '[/b]');
                                console.log(`[useReportManagement] Conversion complete.`);
                            }
                        } else {
                            // When loading into the form, ensure any escaped bold tags are converted to simple [b]
                            loadedBbCode = loadedBbCode.replace(/\[bold\]/gi, '[b]').replace(/\[\/bold\]/gi, '[/b]');
                        }
                    }
                    const loadedCoronerEmployee = loadedFormData.coronerEmployee;
                    const loadedPhmcEmployee = loadedFormData.phmcEmployee;
                    const currentTimestamp = Date.now().toString();

                    if (loadedCoronerEmployee) {
                        const coronerDetails = findEmployeeDetails(loadedCoronerEmployee);
                        if (coronerDetails) {
                            loadedFormData.coronerEmployee = loadedCoronerEmployee;
                            loadedFormData.coronerBadge = coronerDetails.badge || '';
                            loadedFormData.coronerRank = coronerDetails.rank || '';
                            loadedFormData.coronerDiscord = coronerDetails.discord || '';
                            loadedFormData.coronerPHNumber = coronerDetails.phNumber || '50056';
                            if (!returnOnly) {
                                localStorage.setItem('coronerEmployee', loadedFormData.coronerEmployee);
                                localStorage.setItem('coronerEmployee_timestamp', currentTimestamp);
                                localStorage.setItem('coronerBadge', loadedFormData.coronerBadge);
                                localStorage.setItem('coronerBadge_timestamp', currentTimestamp);
                                localStorage.setItem('coronerRank', loadedFormData.coronerRank);
                                localStorage.setItem('coronerRank_timestamp', currentTimestamp);
                                localStorage.setItem('coronerDiscord', loadedFormData.coronerDiscord);
                                localStorage.setItem('coronerDiscord_timestamp', currentTimestamp);
                                localStorage.setItem('coronerPHNumber', loadedFormData.coronerPHNumber);
                                localStorage.setItem('coronerPHNumber_timestamp', currentTimestamp);
                            }
                        } else {
                            if (!returnOnly) showNotification(`Coroner "${loadedCoronerEmployee}" not found in current staff list. Using data from saved report.`, 'warning', 7000);
                            if (!returnOnly) {
                                if (loadedFormData.coronerEmployee) localStorage.setItem('coronerEmployee_timestamp', currentTimestamp);
                                if (loadedFormData.coronerBadge) localStorage.setItem('coronerBadge_timestamp', currentTimestamp);
                                if (loadedFormData.coronerRank) localStorage.setItem('coronerRank_timestamp', currentTimestamp);
                                if (loadedFormData.coronerDiscord) localStorage.setItem('coronerDiscord_timestamp', currentTimestamp);
                                if (loadedFormData.coronerPHNumber) localStorage.setItem('coronerPHNumber_timestamp', currentTimestamp);
                            }
                        }
                    } else if (!returnOnly) {
                        const coronerFieldsToClear = ['coronerEmployee', 'coronerBadge', 'coronerRank', 'coronerDiscord', 'coronerPHNumber'];
                        coronerFieldsToClear.forEach(field => {
                            localStorage.removeItem(field);
                            localStorage.removeItem(`${field}_timestamp`);
                        });
                    }

                    if (loadedPhmcEmployee) {
                        const phmcDetails = findEmployeeDetails(loadedPhmcEmployee);
                        if (phmcDetails) {
                            loadedFormData.phmcEmployee = loadedPhmcEmployee;
                            loadedFormData.phmcEmployeeLastName = phmcDetails.lastName || '';
                            loadedFormData.phmcRank = phmcDetails.category || phmcDetails.rank || '';
                            if (!returnOnly) {
                                localStorage.setItem('phmcEmployee', loadedFormData.phmcEmployee);
                                localStorage.setItem('phmcEmployee_timestamp', currentTimestamp);
                                localStorage.setItem('phmcEmployeeLastName', loadedFormData.phmcEmployeeLastName);
                                localStorage.setItem('phmcEmployeeLastName_timestamp', currentTimestamp);
                                localStorage.setItem('phmcRank', loadedFormData.phmcRank);
                                localStorage.setItem('phmcRank_timestamp', currentTimestamp);
                            }
                        } else {
                            if (!returnOnly) showNotification(`PHMC Staff "${loadedPhmcEmployee}" not found in current staff list. Using data from saved report.`, 'warning', 7000);
                            if (!returnOnly) {
                                if (loadedFormData.phmcEmployee) localStorage.setItem('phmcEmployee_timestamp', currentTimestamp);
                                if (loadedFormData.phmcEmployeeLastName) localStorage.setItem('phmcEmployeeLastName_timestamp', currentTimestamp);
                                if (loadedFormData.phmcRank) localStorage.setItem('phmcRank_timestamp', currentTimestamp);
                            }
                        }
                    } else if (!returnOnly) {
                        const phmcFieldsToClear = ['phmcEmployee', 'phmcEmployeeLastName', 'phmcRank'];
                        phmcFieldsToClear.forEach(field => {
                            localStorage.removeItem(field);
                            localStorage.removeItem(`${field}_timestamp`);
                        });
                    }

                    const localStorageManagedFields = [
                        'placeOfDeath', 'pronouncedTimeOfDeath', 'dateTime', 'department',
                        'mannerOfDeath',
                    ];
                    localStorageManagedFields.forEach(field => {
                        if (loadedFormData.hasOwnProperty(field) && loadedFormData[field]) {
                            if (!returnOnly) {
                                localStorage.setItem(field, loadedFormData[field]);
                                localStorage.setItem(`${field}_timestamp`, currentTimestamp);
                            }
                        }
                    });
                    // --- End Employee Sync Logic ---

                    if (!returnOnly) {
                        // Dynamically get the latest forms array
                        const latestForms = getForms();
                        if (!isLegacyReport && reportData.formId && latestForms && setSelectedForm) {
                            console.log('[DEBUG] loadReportForUser: Attempting to auto-select form.');
                            console.log('[DEBUG] loadReportForUser: reportData.formId:', reportData.formId);
                            console.log('[DEBUG] loadReportForUser: forms array (from getter):', latestForms);
                            const formToLoad = latestForms.find(f => {
                                console.log('[DEBUG] loadReportForUser: Checking form:', f.id, 'against', reportData.formId);
                                return f.id === reportData.formId;
                            });
                            if (formToLoad) {
                                console.log('[DEBUG] loadReportForUser: Form found:', formToLoad);
                                setSelectedForm(formToLoad);
                            } else {
                                console.warn(`Could not find form with ID: ${reportData.formId} to auto-select.`);
                                showNotification(`Warning: Could not switch to the correct form automatically.`, 'warning');
                            }
                        }
                        
                        if (loadedVersion === 11) {
                            // Mass Fatality Report: set decedents array and other relevant fields
                            const decedents = Array.isArray(loadedFormData.decedents) ? loadedFormData.decedents.map(dec => ({
                                ...dec,
                                decedentName: dec.decedentName || dec.DecedentName,
                                decedentOOC: dec.decedentOOC || dec.DecedentOOC,
                            })) : [];

                            setFormData(prev => ({
                                ...prev,
                                ...loadedFormData,
                                decedents: decedents,
                                coronerEmployee: loadedFormData.coronerEmployee || prev.coronerEmployee,
                                phmcEmployee: loadedFormData.phmcEmployee || prev.phmcEmployee,
                            }));
                            showNotification(`Mass Fatality Report loaded.`, 'upload');
                        } else if ((selectedForm?.name === 'Coroner Email' || selectedForm?.id === 'coroner_email') && loadedVersion === 1) {
                            // ...existing code for v2 loading v1...
                            const currentDeathReportIsEmpty = !formData.deathReport || formData.deathReport.trim() === '';
                            let notificationMessage = '';
                            setFormData(prevFormData => {
                                let updatedName = prevFormData.decedentName || '';
                                let updatedOoc = prevFormData.decedentOOC || '';
                                let updatedDeathReport = prevFormData.deathReport || '';
                                let updatedAdditionalReports = prevFormData.additionalReports || [];
                                if (prevFormData.decedentName && loadedFormData.decedentName) {
                                    updatedName = `${prevFormData.decedentName}, ${loadedFormData.decedentName}`;
                                } else {
                                    updatedName = loadedFormData.decedentName || prevFormData.decedentName || '';
                                }
                                if (prevFormData.decedentOOC && loadedFormData.decedentOOC) {
                                    updatedOoc = `${prevFormData.decedentOOC}, ${loadedFormData.decedentOOC}`;
                                } else {
                                    updatedOoc = loadedFormData.decedentOOC || prevFormData.decedentOOC || '';
                                }
                                if (currentDeathReportIsEmpty) {
                                    updatedDeathReport = loadedBbCode;
                                    notificationMessage = `Loaded report for ${loadedFormData.decedentName || reportData.originalKey} into main Death Report field.`;
                                } else {
                                    updatedAdditionalReports = [...updatedAdditionalReports, loadedBbCode];
                                    notificationMessage = `Added report for ${loadedFormData.decedentName || reportData.originalKey} as an additional report.`;
                                }
                                const finalDataToSet = {
                                    ...prevFormData,
                                    ...loadedFormData,
                                    decedentName: updatedName,
                                    decedentOOC: updatedOoc,
                                    deathReport: updatedDeathReport,
                                    additionalReports: updatedAdditionalReports,
                                };
                                return finalDataToSet;
                            });
                            showNotification(notificationMessage, 'plus-circle');
                        } else {
                            setFormData(prev => ({
                                ...prev,
                                ...loadedFormData,
                                coronerEmployee: loadedFormData.coronerEmployee || prev.coronerEmployee,
                                phmcEmployee: loadedFormData.phmcEmployee || prev.phmcEmployee,
                            }));
                                                    showNotification(`Report "${reportData.originalKey || reportFirebaseKey}" loaded.`, 'upload');
                                                }                    }
                    // Always return the processed data, regardless of `returnOnly`
                    return { success: true, reportData: { ...reportData, data: loadedFormData, bbCode: loadedBbCode } };
                } else {
                    if (sendDataRequestLog) {
                        sendDataRequestLog(
                            'useReportManagement.js/loadReportForUser',
                            false,
                            'Firebase Read Error',
                            0,
                            isGtaAuthenticated,
                            getCharacterName(gtaWorldUser),
                            `Report: ${reportPath}, BBCode: ${bbCodePath}`,
                            'Report not found'
                        );
                    }
                    if (!returnOnly) showNotification(`Report not found in Firebase: ${reportFirebaseKey}`, 'error');
                    return { success: false, message: `Report not found in Firebase: ${reportFirebaseKey}` };
                }
            } catch (error) {
                if (sendDataRequestLog) {
                    sendDataRequestLog(
                        'useReportManagement.js/loadReportForUser',
                        false,
                        'Firebase ReadError',
                        0,
                        isGtaAuthenticated,
                        getCharacterName(gtaWorldUser),
                        `Report: ${reportPath}, BBCode: ${bbCodePath}`,
                        error.message || 'Unknown Load Error'
                    );
                }
                console.error(`[loadReportForUser] Error loading report ${reportFirebaseKey} for user ${userId}:`, error);
                Sentry.captureException(error, { extra: { context: 'loadReportForUser', userId, reportFirebaseKey } });
                if (!returnOnly) showNotification(`Failed to load report: ${error.message}`, 'error');
                return { success: false, message: `Failed to load report: ${error.message}` };
            } finally {
                if (!returnOnly && loadingNotifId) {
                    removeNotification(loadingNotifId);
                }
            }
        }, [selectedForm, factionsData, coronerListData, phmcListData, removeNotification, setFormData, showNotification, sendDataRequestLog, isGtaAuthenticated, gtaWorldUser, getForms]);

        const handleReportSelectedForAttachment = useCallback(async (report, userId, targetFieldName) => {

            // When multiple reports are being loaded, we need to delay closing the modal.

            // This clears any pending close command from a previous, rapidly-fired event.

            if (modalCloseTimer.current) {

                clearTimeout(modalCloseTimer.current);

            }

    

            // Show a loading notification for this specific attachment

            const loadingNotifId = showNotification(`Attaching report...`, 'info-circle', 0);

    

            const result = await loadReportForUser(report, userId, true);

    

            // Remove the loading notification once done

            removeNotification(loadingNotifId);

    

            if (result.success && pendingReportAttachmentCallback.current) {

                const reportData = result.reportData;

                const loadedFormData = reportData.data || {};

                const loadedVersion = reportData.bbCodeVersion;

    

                // --- MODIFICATION START: Generalized Field Population ---

                setFormData(prev => {

                    if ((selectedForm?.name === 'Coroner Email' || selectedForm?.id === 'coroner_email') && loadedVersion === 11) { // Attaching Mass Fatality to Coroner Email

                        const decedents = loadedFormData.decedents;

                        if (decedents && decedents.length > 0) {

                            const firstDecedent = decedents[0];

                            let icName = firstDecedent.decedentName || firstDecedent.DecedentName || '';

                            let oocName = firstDecedent.decedentOOC || firstDecedent.DecedentOOC || '';

    

                            if (decedents.length > 1) {

                                icName += ` (x${decedents.length})`;

                                oocName += ` (x${decedents.length})`;

                            }

                            

                            const currentDeathReportIsEmpty = !prev.deathReport || prev.deathReport.trim() === '';

                            let newState = { ...prev };

                            newState.decedentName = icName;

                            newState.decedentOOC = oocName;

                            newState.paperworkType = 'Mass Fatality';

    

                            if (currentDeathReportIsEmpty) {

                                newState.deathReport = reportData.bbCode;

                            } else {

                                newState.additionalReports = [...(prev.additionalReports || []), reportData.bbCode];

                            }

                            return newState;

                        }

                        return prev;

                    }

                    // Mass Fatality Report (bbCodeVersion 11): attach BBCode to deathReport and merge decedents

                    if (loadedVersion === 11) {

                        const currentDeathReportIsEmpty = !prev.deathReport || prev.deathReport.trim() === '';

                        let newState = { ...prev };

                        if (currentDeathReportIsEmpty) {

                            newState.deathReport = reportData.bbCode;

                        } else {

                            newState.additionalReports = [...(prev.additionalReports || []), reportData.bbCode];

                        }

                        // Merge decedents array if present

                        if (Array.isArray(loadedFormData.decedents)) {

                            newState.decedents = [...(prev.decedents || []), ...loadedFormData.decedents];

                        }

                        return newState;

                    }

                    // ...existing code...

                    const fieldsToUpdate = {

                        decedentName: loadedFormData.decedentName,

                        decedentOOC: loadedFormData.decedentOOC,

                        requestingOfficer: loadedFormData.requestingOfficer,

                        department: loadedFormData.department,

                    };

                    if (selectedForm?.name === 'Coroner Email' || selectedForm?.id === 'coroner_email') {

                        // If there's already a name, append the new one.

                                                    // 1. Aggregate Names

                                                    const existingNames = new Set((prev.decedentName || '').split(', ').filter(Boolean));

                                                    let decedentNameToAdd = null;

                                                    if (reportData.originalKey && reportData.originalKey.startsWith('[DEATH-REPORT]')) {

                                                        const nameMatch = reportData.originalKey.match(/\[DEATH-REPORT\]\s*([^-]+)/);

                                                        if (nameMatch && nameMatch[1]) {

                                                            decedentNameToAdd = nameMatch[1].trim();

                                                        }

                                                    }

                                                    if (!decedentNameToAdd && loadedFormData.decedentName) {

                                                        decedentNameToAdd = loadedFormData.decedentName;

                                                    }

                                                    if (decedentNameToAdd) {

                                                        existingNames.add(decedentNameToAdd);

                                                    }

                                                    const newDecedentName = Array.from(existingNames).join(', ');

    

                                                    // 2. Aggregate OOC Names

                                                    const existingOocNames = new Set((prev.decedentOOC || '').split(', ').filter(Boolean));

                                                    if (loadedFormData.decedentOOC) {

                                                        existingOocNames.add(loadedFormData.decedentOOC);

                                                    }

                                                    const newDecedentOOC = Array.from(existingOocNames).join(', ');

    

                                                    // 3. Aggregate Report BBCode into the single deathReport field

                                                    const newDeathReport = [prev.deathReport, reportData.bbCode].filter(Boolean).join('\n\n[hr]\n\n');

    

                                                    // 4. Aggregate Report Keys

                                                    const newAttachedReportKeys = [...(prev.attachedReportKeys || []), reportData.originalKey];

    

                                                    // 5. Return the complete new state object

                                                    return {

                                                        ...prev,

                                                        decedentName: newDecedentName,

                                                        decedentOOC: newDecedentOOC,

                                                        requestingOfficer: loadedFormData.requestingOfficer || prev.requestingOfficer,

                                                        department: loadedFormData.department || prev.department,

                                                        deathReport: newDeathReport,

                                                        attachedReportKeys: newAttachedReportKeys,

                                                        additionalReports: [], // Explicitly clear the unused field

                                                    };

                    } else {
                        let newState = { ...prev };
                        newState.decedentName = fieldsToUpdate.decedentName || prev.decedentName;
                        newState.decedentOOC = fieldsToUpdate.decedentOOC || prev.decedentOOC;
                        newState.requestingOfficer = fieldsToUpdate.requestingOfficer || prev.requestingOfficer;
                        newState.department = fieldsToUpdate.department || prev.department;

                        // If a targetFieldName is provided, attach the BBCode to it
                        if (targetFieldName && reportData.bbCode) {
                            const currentContent = newState[targetFieldName] || '';
                            newState[targetFieldName] = currentContent ? `${currentContent}\n\n${reportData.bbCode}` : reportData.bbCode;
                        }
                        return newState;
                    }

                });

                // --- MODIFICATION END ---

    

                // The pending callback now primarily handles form-specific fields like 'attachedReportSummary'

                pendingReportAttachmentCallback.current(reportData);

    

                showNotification(`Report "${reportData.originalKey}" attached successfully.`, 'check-circle');

    

            } else {

                if (!result.success) {

                    showNotification('Failed to load the selected report.', 'error');

                } else if (!pendingReportAttachmentCallback.current) {

                    showNotification('Attachment process could not be completed (no callback).', 'error');

                    Sentry.captureMessage('handleReportSelectedForAttachment was called but pendingReportAttachmentCallback.current was null.');

                }

            }

    

            // Set a timer to close the modal. If another report is loaded quickly,

            // the timer will be reset, ensuring the modal only closes after the last report is processed.

            modalCloseTimer.current = setTimeout(() => {

                setReportSelectionFilter(null);

                setPreselectedEmployeeType(null);

                setShowSavedReports(false);

            }, 1000); // 1-second delay

    

        }, [selectedForm, loadReportForUser, modalCloseTimer, removeNotification, setFormData, showNotification]);

    const onAttachReportSummaryRequest = useCallback((callback) => {
        // First, check if a relevant employee is selected
        const author = getCurrentReportAuthor(formData);

        if (!author) {
            // If no author is determined, show a notification and prevent the modal from opening
            showNotification('Please select a PHMC employee in the form before attaching a report.', 'warning');
            return; // Stop execution here
        }

        // If an author is found, proceed to open the modal
        pendingReportAttachmentCallback.current = callback;
        setReportSelectionFilter([ER_PROTOCOL_VERSION, CONSULTATION_NOTES_PHMC_VERSION, CONSULTATION_NOTES_PBC_VERSION]);
        setPreselectedEmployeeType('PHMC'); // Set to PHMC for this specific use case
        setShowSavedReports(true);
    }, [ER_PROTOCOL_VERSION, CONSULTATION_NOTES_PBC_VERSION, CONSULTATION_NOTES_PHMC_VERSION, getCurrentReportAuthor, formData, setReportSelectionFilter, setPreselectedEmployeeType, setShowSavedReports, showNotification]);

    const onParseDecedentRequest = useCallback((callback) => {
        // First, check if a relevant employee is selected
        const author = getCurrentReportAuthor(formData);

        if (!author) {
            // If no author is determined, show a notification and prevent the modal from opening
            showNotification('Please select a Coroner employee in the form before parsing decedent reports.', 'warning');
            return; // Stop execution here
        }

        // If an author is found, proceed to open the modal with Death Report (v1) and Autopsy Report (v4) filter
        pendingReportAttachmentCallback.current = callback;
        setReportSelectionFilter([1, 4]); // Death Reports and Autopsy Reports
        setPreselectedEmployeeType('Coroner'); // Set to Coroner for decedent report parsing
        setShowSavedReports(true);
    }, [getCurrentReportAuthor, formData, setReportSelectionFilter, setPreselectedEmployeeType, setShowSavedReports, showNotification]);

    const deleteReportForUser = useCallback(async (report, userId) => {
        const reportFirebaseKey = report?.key;
        if (!userId || !reportFirebaseKey) {
            showNotification('Cannot delete report: User ID or Report Key is missing.', 'error');
            return;
        }

        const isLegacyReport = report.legacy;
        const sanitizedUserId = comprehensiveSanitize(userId);
        const reportPath = isLegacyReport
            ? `savedReports/${sanitizedUserId}/${reportFirebaseKey}`
            : `newSavedReports/${sanitizedUserId}/${reportFirebaseKey}`;
        const bbCodePath = isLegacyReport
            ? `savedReportBBCode/${sanitizedUserId}/${reportFirebaseKey}`
            : `newSavedReportBBCode/${sanitizedUserId}/${reportFirebaseKey}`;

        const reportRef = ref(database, reportPath);
        const bbCodeRef = ref(database, bbCodePath);

        try {
            // Delete both the main report and the BBCode in parallel
            await Promise.all([
                remove(reportRef),
                remove(bbCodeRef)
            ]);

            if (sendDataRequestLog) {
                sendDataRequestLog(
                    'useReportManagement.js/deleteReportForUser',
                    false,
                    'Firebase Delete',
                    0,
                    isGtaAuthenticated,
                    getCharacterName(gtaWorldUser),
                    `Report: ${reportPath}, BBCode: ${bbCodePath}`
                );
            }

            showNotification(`Report deleted successfully from Firebase.`, 'trash');
            // Refresh the list of saved reports for the current user
            if (selectedUserForSavedReports === userId) {
                loadUserSavedReports(userId);
            }
        } catch (error) {
            if (sendDataRequestLog) {
                sendDataRequestLog(
                    'useReportManagement.js/deleteReportForUser',
                    false,
                    'Firebase Delete Error',
                    0,
                    isGtaAuthenticated,
                    getCharacterName(gtaWorldUser),
                    `Report: ${reportPath}, BBCode: ${bbCodePath}`,
                    error.message || 'Unknown Delete Error'
                );
            }
            console.error(`Error deleting report ${reportFirebaseKey} for user ${userId}:`, error);
            Sentry.captureException(error, { extra: { context: 'deleteReportForUser', userId, reportFirebaseKey } });
            showNotification(`Failed to delete report: ${error.message}`, 'error');
        }
    }, [loadUserSavedReports, selectedUserForSavedReports, showNotification, sendDataRequestLog, isGtaAuthenticated, gtaWorldUser]);

    const showRareEasterEggDirectly = useCallback(() => {
        setShowEasterEggModal(true);
        setEasterEggType('rare');
        // Send webhook only if on localhost for the manual trigger
        if (window.location.hostname === 'localhost') {
            sendEasterEggNotification('rare'); // Pass 'rare' type
        }
    }, [sendEasterEggNotification, setEasterEggType, setShowEasterEggModal]);

    const toggleSavedReports = useCallback((filterVersions = null, employeeType = null, callback = null, targetFieldName = null) => {
        if (showSavedReports) {
            setShowSavedReports(false);
            setPreselectedEmployeeType(null);
            setReportSelectionFilter(null);
            pendingReportAttachmentCallback.current = null;
            currentAttachmentTargetFieldRef.current = null; // Clear target field on close

            return;
        }

        let author = null;
        if (employeeType === 'PHMC' && formData.phmcEmployee) {
            author = formData.phmcEmployee;
        } else if (employeeType === 'Coroner' && formData.coronerEmployee) {
            author = formData.coronerEmployee;
        }

        // If no author is found from the form data, try the generic author
        if (!author) {
            author = getCurrentReportAuthor(formData);
        }

        if (author) {
            setShowSavedReports(true);
            setPreselectedEmployeeType(employeeType);
            setReportSelectionFilter(filterVersions);
            pendingReportAttachmentCallback.current = callback;
            currentAttachmentTargetFieldRef.current = targetFieldName; // Set target field on open
        } else {
            const message = employeeType
                ? `Please select a ${employeeType} employee in the form to view their reports.`
                : 'Please select an employee in the form before viewing saved reports.';
            showNotification(message, 'warning');
        }
    }, [getCurrentReportAuthor, formData, setPreselectedEmployeeType, setReportSelectionFilter, setShowSavedReports, showNotification, showSavedReports, getForms]);

    const handleShowPositionInfo = useCallback((positionKey) => {
        let data = null;
        const definition = selectedForm; // Replaced getFormDefinition(bbCodeVersion)

        if (!positionKey) {
            showNotification("Please select a position first.", 'warning');
            return;
        }

        if (selectedAgencyGroup === 'PHMC Recruitment') {
            if (definition?.titleKey === "phmcGeneralApplication" && selectOptions?.physicianRecruitmentDetails) {
                data = selectOptions.physicianRecruitmentDetails[positionKey];
            } else if (definition?.titleKey === "phmcPsychApplication" && selectOptions?.psychPositionDetailsData) {
                data = selectOptions.psychPositionDetailsData[positionKey];
            } else if (definition?.titleKey === "phmcAdminApplication" && selectOptions?.adminPositionDetailsData) {
                data = selectOptions.adminPositionDetailsData[positionKey];
            } else if (definition?.titleKey === "phmcNursingApplication" && selectOptions?.nursePositionDetailsData) {
                data = selectOptions.nursePositionDetailsData[positionKey];
            } else if (definition?.titleKey === "phmcEMSApplication" && selectOptions?.emsPositionDetailsData) {
                data = selectOptions.emsPositionDetailsData[positionKey];
            } else if (definition?.titleKey === "phmcCoronerRecruitmentApplication" && selectOptions?.coronerPositionDetailsData) {
                data = selectOptions.coronerPositionDetailsData[positionKey];
            }
        }

        if (data) {
            setCurrentPositionInfo(data);
            setShowPositionInfoModal(true);
        } else {
            showNotification("Detailed information for this position is not available.", 'warning');
        }
    }, [selectedForm, selectOptions, selectedAgencyGroup, showNotification]);

    const countAllUserReports = useCallback(async (userId) => {
        if (!userId) {
            return 0;
        }

        const sanitizedUserId = comprehensiveSanitize(userId);
        const legacyReportsRef = ref(database, `savedReports/${sanitizedUserId}`);
        const newReportsRef = ref(database, `newSavedReports/${sanitizedUserId}`);

        try {
            const [legacySnapshot, newSnapshot] = await Promise.all([
                get(legacyReportsRef),
                get(newReportsRef)
            ]);

            let totalCount = 0;
            if (legacySnapshot.exists()) {
                totalCount += Object.keys(legacySnapshot.val()).length;
            }
            if (newSnapshot.exists()) {
                totalCount += Object.keys(newSnapshot.val()).length;
            }
            return totalCount;
        } catch (error) {
            console.error(`Error counting reports for user ${userId}:`, error);
            Sentry.captureException(error, { extra: { context: 'countAllUserReports', userId } });
            return 0;
        }
    }, []);

    const backupUserReports = useCallback(async (userId) => {
        if (!userId) {
            return { success: false, error: "User ID is required for backup." };
        }

        const sanitizedUserId = comprehensiveSanitize(userId);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-'); // Sanitize timestamp for Firebase key
        const fullBackupPath = `migrateBackup/${sanitizedUserId}_${timestamp}`;

        try {
            const legacyReportsRef = ref(database, `savedReports/${sanitizedUserId}`);
            const newReportsRef = ref(database, `newSavedReports/${sanitizedUserId}`);
            const legacyBBCodeRef = ref(database, `savedReportBBCode/${sanitizedUserId}`);
            const newBBCodeRef = ref(database, `newSavedReportBBCode/${sanitizedUserId}`);

            const [
                legacyReportSnapshot,
                newReportSnapshot,
                legacyBBCodeSnapshot,
                newBBCodeSnapshot
            ] = await Promise.all([
                get(legacyReportsRef),
                get(newReportsRef),
                get(legacyBBCodeRef),
                get(newBBCodeRef)
            ]);

            const allReportsToBackup = {};
            const allBBCodesToBackup = {};

            if (legacyReportSnapshot.exists()) {
                allReportsToBackup.legacy = legacyReportSnapshot.val();
            }
            if (newReportSnapshot.exists()) {
                allReportsToBackup.new = newReportSnapshot.val();
            }
            if (legacyBBCodeSnapshot.exists()) {
                allBBCodesToBackup.legacy = legacyBBCodeSnapshot.val();
            }
            if (newBBCodeSnapshot.exists()) {
                allBBCodesToBackup.new = newBBCodeSnapshot.val();
            }

            if (Object.keys(allReportsToBackup).length === 0 && Object.keys(allBBCodesToBackup).length === 0) {
                return { success: true, path: fullBackupPath, message: "No reports found to backup." };
            }

            const backupRef = ref(database, fullBackupPath);
            await set(backupRef, {
                reports: allReportsToBackup,
                bbCodes: allBBCodesToBackup,
                timestamp: Date.now(),
                userId: userId
            });

            if (sendDataRequestLog) {
                const reportsSize = new TextEncoder().encode(JSON.stringify(allReportsToBackup)).length;
                const bbCodeSize = new TextEncoder().encode(JSON.stringify(allBBCodesToBackup)).length;
                sendDataRequestLog(
                    'useReportManagement.js/backupUserReports',
                    false, // Write operation
                    'Firebase Write (Backup)',
                    reportsSize + bbCodeSize,
                    isGtaAuthenticated,
                    getCharacterName(gtaWorldUser),
                    `Backup path: ${fullBackupPath}`
                );
            }

            return { success: true, path: fullBackupPath };

        } catch (error) {
            console.error(`Error backing up reports for user ${userId}:`, error);
            Sentry.captureException(error, { extra: { context: 'backupUserReports', userId } });
            if (sendDataRequestLog) {
                sendDataRequestLog(
                    'useReportManagement.js/backupUserReports',
                    false,
                    'Firebase Write Error (Backup)',
                    0,
                    isGtaAuthenticated,
                    getCharacterName(gtaWorldUser),
                    `Backup path: ${fullBackupPath}`,
                    error.message || 'Unknown Backup Error'
                );
            }
            return { success: false, error: error.message || "Failed to backup reports." };
        }
    }, [sendDataRequestLog, isGtaAuthenticated, gtaWorldUser]);

    const checkIfMigratedReportExists = useCallback(async (userId, originalKey) => {
        if (!userId || !originalKey) {
            return { exists: false };
        }

        const sanitizedUserId = comprehensiveSanitize(userId);
        // The originalKey needs to be sanitized to match how it's stored in Firebase
        // NOTE: The stored key in Firebase is `originalKey + '_' + Date.now()`.
        // We are checking by the `originalKey` property *within` the report object,
        // not by the Firebase key itself.
        
        const newReportsRef = ref(database, `newSavedReports/${sanitizedUserId}`);

        try {
            const snapshot = await get(newReportsRef);
            if (snapshot.exists()) {
                const reports = snapshot.val();
                // Iterate through the reports to find a match by originalKey
                for (const key in reports) {
                    if (reports.hasOwnProperty(key)) {
                        const report = reports[key];
                        if (report.originalKey === originalKey) {
                            return { exists: true, reportKey: key };
                        }
                    }
                }
            }
            return { exists: false };
        } catch (error) {
            console.error(`Error checking for migrated report existence for user ${userId}, key ${originalKey}:`, error);
            Sentry.captureException(error, { extra: { context: 'checkIfMigratedReportExists', userId, originalKey } });
            return { exists: false };
        }
    }, []);

        return {
            saveReport,
            saveFormHandlerReport,
            saveMigratedReport,
            savedReports,
            setSavedReports,
            showSavedReports,
            setShowSavedReports,
            isLoadingUserReports,
            setIsLoadingUserReports,
            selectedUserForSavedReports,
            setSelectedUserForSavedReports,
            preselectedEmployeeType,
            setPreselectedEmployeeType,
            loadUserSavedReports,
            loadReportForUser,
            handleReportSelectedForAttachment,
            onAttachReportSummaryRequest,
            onParseDecedentRequest,
            deleteReportForUser,
            showRareEasterEggDirectly,
            toggleSavedReports,
            showPositionInfoModal,
            setShowPositionInfoModal,
            currentPositionInfo,
            setCurrentPositionInfo,
            handleShowPositionInfo,
            pendingReportAttachmentCallback,
            currentAttachmentTargetFieldRef, // Add this line
            reportSelectionFilter,
            setReportSelectionFilter,
            backupUserReports,
            checkIfMigratedReportExists,
            countAllUserReports
        };
    };