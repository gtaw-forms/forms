import { useState, useRef, useCallback } from 'react';
import { getFormDefinition } from '../formDefinitions'; // Assuming this path
import { database } from '../firebase'; // Assuming this path
import { ref, get, set, remove } from 'firebase/database';
import * as Sentry from "@sentry/react";

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
    bbCodeVersion,
    setBbCodeVersion,
    getBBCodeContent,
    getCurrentReportAuthor,
    filterFormData,
    coronerListData,
    phmcListData,
    selectOptions,
    showNotification,
    removeNotification,
    setShowEasterEggModal,
    setEasterEggType,
    sendEasterEggNotification,
    modalCloseTimer,
    versionNames,
    ER_PROTOCOL_VERSION,
    CONSULTATION_NOTES_PHMC_VERSION,
    CONSULTATION_NOTES_PBC_VERSION,
    physicianRecruitmentDetails,
    adminRecruitmentDetails,
    emsRecruitmentDetails,
    nurseRecruitmentDetails,
    coronerRecruitmentDetails,
    selectedAgencyGroup
) => {
    const [savedReports, setSavedReports] = useState([]);
    const [showSavedReports, setShowSavedReports] = useState(false);
    const [isLoadingUserReports, setIsLoadingUserReports] = useState(false);
    const [selectedUserForSavedReports, setSelectedUserForSavedReports] = useState(null);
    const [preselectedEmployeeType, setPreselectedEmployeeType] = useState(null);
    const pendingReportAttachmentCallback = useRef(null);
    const [reportSelectionFilter, setReportSelectionFilter] = useState(null);
    const [showPositionInfoModal, setShowPositionInfoModal] = useState(false);
    const [currentPositionInfo, setCurrentPositionInfo] = useState(null);

    async function saveReport() {
        let key = '';
        const bbCodeContent = getBBCodeContent();
        const currentAuthor = getCurrentReportAuthor(formData);

        // --- Validation logic to determine the key ---
        if (bbCodeVersion === 1) { // Death Report
            if (!formData.decedentOOC || !formData.dateTime) {
                const message = `Please fill in Decedent OOC and Date/Time fields.`;
                showNotification(message, 'exclamation-circle');
                return { success: false, error: message };
            }
            key = `[DEATH-REPORT] ${formData.decedentOOC} - ${formData.dateTime}`;
        } else if (bbCodeVersion === 4) { // Autopsy Report
            if (!formData.decedentName || !formData.decedentOOC || !formData.autopsyDate) {
                const message = `Please fill in Decedent IC Name, OOC Name, and Autopsy Date fields.`;
                showNotification(message, 'exclamation-circle');
                return { success: false, error: message };
            }
            key = `[Autopsy] ${formData.decedentName} (${formData.decedentOOC}) - ${formData.autopsyDate}`;
        } else if (((bbCodeVersion >= 3 && bbCodeVersion <= 7) && bbCodeVersion !== 4)) { // PatientAdvanced (3), SurgicalOps (5), PhysEval PHMC/PBC (6,7)
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
        } else if (bbCodeVersion === 19) { // EmergencyProtocol
            if (!formData.patientID || !formData.date) {
                const message = `Please fill in Patient ID, and Date fields.`;
                showNotification(message, 'exclamation-circle');
                return { success: false, error: message };
            }
            key = `${formData.patientID} - ${formData.lastName} - ${formData.date}`;
        } else if (bbCodeVersion === 25) { // BasicPatientFile
            if (!formData.patientName || !formData.date) {
                const message = `Please fill in Patient Name and Date fields.`;
                showNotification(message, 'exclamation-circle');
                return { success: false, error: message };
            }
            key = `${formData.patientName} - ${formData.date}`;
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
        }
        // Example for Agency Feedback (bbCodeVersion 18)
        else if (bbCodeVersion === 18) {
            if (!formData.department || !formData.dateTime || !formData.synopsis) {
                const message = `Please fill in Department, Date/Time, and Synopsis for Agency Feedback.`;
                showNotification(message, 'exclamation-circle');
                return { success: false, error: message };
            }
            key = `[Feedback] ${formData.department} - ${formData.dateTime}`;
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
            bbCode: bbCodeContent,
            timestamp: Date.now(),
            originalKey: key,
            authorName: currentAuthor
        };

        const reportPath = `savedReports/${sanitizedAuthorId}/${sanitizedKey}`;

        try {
            const reportRef = ref(database, reportPath);
            await set(reportRef, reportDataToSave);
            showNotification(`Report "${key}" saved for ${currentAuthor} to Firebase!`, 'save');
            return { success: true }; // Indicate success

        } catch (error) {
            console.error("Error saving report to Firebase:", error);
            Sentry.captureException(error, { extra: { context: 'Firebase set report' } });
            const message = 'Something unexpected went wrong, report copied to clipboard!';
            showNotification(message, 'error');
            return { success: false, error: message }; // Indicate failure
        }
    };

    const loadUserSavedReports = useCallback(async (userId) => {
        if (!userId) {
            setSavedReports([]);
            setSelectedUserForSavedReports(null);
            return;
        }

        setIsLoadingUserReports(true);
        setSelectedUserForSavedReports(userId);
        const loadingNotifId = showNotification(`Loading reports for ${userId}...`, 'info-circle', 0);

        const sanitizedUserId = comprehensiveSanitize(userId);
        const userReportsPath = `savedReports/${sanitizedUserId}`;
        const reportsRef = ref(database, userReportsPath);

        try {
            const snapshot = await get(reportsRef);
            removeNotification(loadingNotifId);

            if (snapshot.exists()) {
                const reportsData = snapshot.val();
                const validReports = [];
                for (const reportKey in reportsData) {
                    const report = reportsData[reportKey];
                    validReports.push({
                        key: reportKey,
                        originalKey: report.originalKey,
                        bbCodeVersion: report.bbCodeVersion,
                        timestamp: report.timestamp,
                        authorName: report.authorName,
                        bbCode: report.bbCode,
                    });
                }

                validReports.sort((a, b) => b.timestamp - a.timestamp);
                setSavedReports(validReports);

                if (validReports.length > 0) {
                    showNotification(`Loaded ${validReports.length} report(s) for ${userId}.`, 'check-circle');
                } else {
                    showNotification(`No active reports found for ${userId}.`, 'info-circle');
                }

            } else {
                setSavedReports([]);
                showNotification(`No reports found for ${userId}.`, 'info-circle');
            }
        } catch (error) {
            removeNotification(loadingNotifId);
            console.error(`Error loading reports for user ${userId}:`, error);
            Sentry.captureException(error, { extra: { context: 'loadUserSavedReports', userId } });
            showNotification(`Failed to load reports for ${userId}.`, 'error');
            setSavedReports([]);
        } finally {
            setIsLoadingUserReports(false);
        }
    }, [showNotification, removeNotification, setSavedReports, setSelectedUserForSavedReports, setIsLoadingUserReports, database]);

    const loadReportForUser = useCallback(async (reportFirebaseKey, userId, returnOnly = false) => {
        if (!userId || !reportFirebaseKey) {
            if (!returnOnly) showNotification('Cannot load report: User ID or Report Key is missing.', 'error');
            return { success: false, message: 'User ID or Report Key is missing.' };
        }

        const sanitizedUserId = comprehensiveSanitize(userId);
        const reportPath = `savedReports/${sanitizedUserId}/${reportFirebaseKey}`;
        const reportRef = ref(database, reportPath);

        let loadingNotifId;
        if (!returnOnly) { // Only show notification if we are directly loading into the form
            loadingNotifId = showNotification(`Loading report: ${reportFirebaseKey} for ${userId}...`, 'info-circle', 0);
        }

            try {
                const snapshot = await get(reportRef);
                if (snapshot.exists()) {
                    const reportData = snapshot.val();
                    const loadedVersion = reportData.bbCodeVersion;
                    let loadedBbCode = reportData.bbCode || '';
                    let loadedFormData = reportData.data || {};

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
                    const loadedCoronerEmployee = loadedFormData.coronerEmployee;
                    const loadedPhmcEmployee = loadedFormData.phmcEmployee;
                    const currentTimestamp = Date.now().toString();

                    if (loadedCoronerEmployee) {
                        const coronerDetails = coronerListData.find(c => c.name === loadedCoronerEmployee);
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
                        const phmcDetails = phmcListData.find(p => p.name === loadedPhmcEmployee);
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
                            setBbCodeVersion(loadedVersion);
                            showNotification(`Mass Fatality Report loaded.`, 'upload');
                        } else if (bbCodeVersion === 2 && loadedVersion === 1) {
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
                            setBbCodeVersion(loadedVersion);
                            showNotification(`Report "${reportData.originalKey || reportFirebaseKey}" loaded.`, 'upload');
                        }
                        setShowSavedReports(false);
                    }
                    // Always return the processed data, regardless of `returnOnly`
                    return { success: true, reportData: { ...reportData, data: loadedFormData, bbCode: loadedBbCode } };
                } else {
                    if (!returnOnly) showNotification(`Report not found in Firebase: ${reportFirebaseKey}`, 'error');
                    return { success: false, message: `Report not found in Firebase: ${reportFirebaseKey}` };
                }
            } catch (error) {
                console.error(`[loadReportForUser] Error loading report ${reportFirebaseKey} for user ${userId}:`, error);
                Sentry.captureException(error, { extra: { context: 'loadReportForUser', userId, reportFirebaseKey } });
                if (!returnOnly) showNotification(`Failed to load report: ${error.message}`, 'error');
                return { success: false, message: `Failed to load report: ${error.message}` };
            } finally {
                if (!returnOnly && loadingNotifId) {
                    removeNotification(loadingNotifId);
                }
            }
        }, [bbCodeVersion, coronerListData, phmcListData, removeNotification, setBbCodeVersion, setFormData, showNotification]);

    const handleReportSelectedForAttachment = useCallback(async (reportFirebaseKey, userId) => {
        // When multiple reports are being loaded, we need to delay closing the modal.
        // This clears any pending close command from a previous, rapidly-fired event.
        if (modalCloseTimer.current) {
            clearTimeout(modalCloseTimer.current);
        }

        // Show a loading notification for this specific attachment
        const loadingNotifId = showNotification(`Attaching report...`, 'info-circle', 0);

        const result = await loadReportForUser(reportFirebaseKey, userId, true);

        // Remove the loading notification once done
        removeNotification(loadingNotifId);

        if (result.success && pendingReportAttachmentCallback.current) {
            const reportData = result.reportData;
            const loadedFormData = reportData.data || {};
            const loadedVersion = reportData.bbCodeVersion;

            // --- MODIFICATION START: Generalized Field Population ---
            setFormData(prev => {
                if (bbCodeVersion === 2 && loadedVersion === 11) { // Attaching Mass Fatality to Coroner Email
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
                if (bbCodeVersion === 2) {
                    // If there's already a name, append the new one.
                    let newState = { ...prev };
                    newState.decedentName = prev.decedentName && fieldsToUpdate.decedentName ? `${prev.decedentName}, ${fieldsToUpdate.decedentName}` : fieldsToUpdate.decedentName || prev.decedentName || '';
                    newState.decedentOOC = prev.decedentOOC && fieldsToUpdate.decedentOOC ? `${prev.decedentOOC}, ${fieldsToUpdate.decedentOOC}` : fieldsToUpdate.decedentOOC || prev.decedentOOC || '';
                    newState.requestingOfficer = fieldsToUpdate.requestingOfficer || prev.requestingOfficer;
                    newState.department = fieldsToUpdate.department || prev.department;
                    if (loadedVersion === 1 && bbCodeVersion === 2) {
                        const currentDeathReportIsEmpty = !prev.deathReport || prev.deathReport.trim() === '';
                        if (currentDeathReportIsEmpty) {
                            newState.deathReport = reportData.bbCode;
                        } else {
                            newState.additionalReports = [...(prev.additionalReports || []), reportData.bbCode];
                        }
                    }
                    return newState;
                } else {
                    let newState = { ...prev };
                    newState.decedentName = fieldsToUpdate.decedentName || prev.decedentName;
                    newState.decedentOOC = fieldsToUpdate.decedentOOC || prev.decedentOOC;
                    newState.requestingOfficer = fieldsToUpdate.requestingOfficer || prev.requestingOfficer;
                    newState.department = fieldsToUpdate.department || prev.department;
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

    }, [bbCodeVersion, loadReportForUser, modalCloseTimer, removeNotification, setFormData, showNotification]);

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

    const deleteReportForUser = useCallback(async (reportFirebaseKey, userId) => {
        if (!userId || !reportFirebaseKey) {
            showNotification('Cannot delete report: User ID or Report Key is missing.', 'error');
            return;
        }

        const sanitizedUserId = comprehensiveSanitize(userId);
        // reportFirebaseKey is already sanitized
        const reportPath = `savedReports/${sanitizedUserId}/${reportFirebaseKey}`;
        const reportRef = ref(database, reportPath);

        // Optional: Ask for confirmation before deleting
        // if (!window.confirm(`Are you sure you want to delete this report?`)) {
        //     return;
        // }

        try {
            await remove(reportRef);
            showNotification(`Report deleted successfully from Firebase.`, 'trash');
            // Refresh the list of saved reports for the current user
            if (selectedUserForSavedReports === userId) {
                loadUserSavedReports(userId);
            }
        } catch (error) {
            console.error(`Error deleting report ${reportFirebaseKey} for user ${userId}:`, error);
            Sentry.captureException(error, { extra: { context: 'deleteReportForUser', userId, reportFirebaseKey } });
            showNotification(`Failed to delete report: ${error.message}`, 'error');
        }
    }, [loadUserSavedReports, selectedUserForSavedReports, showNotification]);

    const showRareEasterEggDirectly = useCallback(() => {
        setShowEasterEggModal(true);
        setEasterEggType('rare');
        // Send webhook only if on localhost for the manual trigger
        if (window.location.hostname === 'localhost') {
            sendEasterEggNotification('rare'); // Pass 'rare' type
        }
    }, [sendEasterEggNotification, setEasterEggType, setShowEasterEggModal]);

    const toggleSavedReports = useCallback((filterVersions = null, employeeType = null, callback = null) => {
        if (showSavedReports) {
            setShowSavedReports(false);
            setPreselectedEmployeeType(null);
            setReportSelectionFilter(null);
            pendingReportAttachmentCallback.current = null;

            return;
        }

        const author = getCurrentReportAuthor(formData);

        if (author) {
            setShowSavedReports(true);
            setPreselectedEmployeeType(employeeType);
            setReportSelectionFilter(filterVersions);
            pendingReportAttachmentCallback.current = callback;
        } else {
            showNotification('Please select an employee in the form before viewing saved reports.', 'warning');
        }
    }, [getCurrentReportAuthor, formData, setPreselectedEmployeeType, setReportSelectionFilter, setShowSavedReports, showNotification, showSavedReports]);

    const handleShowPositionInfo = useCallback((positionKey) => {
        let data = null;
        const definition = getFormDefinition(bbCodeVersion);

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
    }, [bbCodeVersion, selectOptions, selectedAgencyGroup, showNotification]);

    return {
        saveReport,
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
        deleteReportForUser,
        showRareEasterEggDirectly,
        toggleSavedReports,
        showPositionInfoModal,
        setShowPositionInfoModal,
        currentPositionInfo,
        setCurrentPositionInfo,
        handleShowPositionInfo,
        pendingReportAttachmentCallback,
        reportSelectionFilter,
        setReportSelectionFilter
    };
};