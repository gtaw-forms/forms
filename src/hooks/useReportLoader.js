import { useState, useCallback } from 'react';
import { database } from '../firebase';
import { ref, get } from 'firebase/database';
import * as Sentry from "@sentry/react";
import { useNotification } from '../contexts/NotificationContext';
import { useData } from '../contexts/DataContext';
import { getCharacterName } from '../utils/identityUtils';
import { comprehensiveSanitize } from '../utils/textUtils';
import useGtaWorldAuth from './useGtaWorldAuth';

const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const REPORTS_PATH = isLocalHost ? 'testingSavedReports' : 'newSavedReports';
const BBCODE_PATH = isLocalHost ? 'testingSavedReportBBCode' : 'newSavedReportBBCode';

export const useReportLoader = () => {
    const { showNotification, removeNotification } = useNotification();
    const { factionsData, coronerListData, phmcListData, sendDataRequestLog } = useData();
    const { user: gtaWorldUser, isAuthenticated: isGtaAuthenticated } = useGtaWorldAuth();

    const [savedReports, setSavedReports] = useState([]);
    const [isLoadingUserReports, setIsLoadingUserReports] = useState(false);
    const [selectedUserForSavedReports, setSelectedUserForSavedReports] = useState(null);

    const findEmployeeDetails = useCallback((employeeName) => {
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
    }, [factionsData, coronerListData, phmcListData]);

    const loadUserSavedReports = useCallback(async (userId) => {
        if (!userId) {
            setSavedReports([]);
            setSelectedUserForSavedReports(null);
            return [];
        }

        setIsLoadingUserReports(true);
        setSelectedUserForSavedReports(userId);
        const loadingNotifId = showNotification(`Loading reports for ${userId}...`, 'info-circle', 0);
        
        const sanitizedUserId = comprehensiveSanitize(userId);
        const legacyReportsRef = ref(database, `savedReports/${sanitizedUserId}`);
        const newReportsRef = ref(database, `${REPORTS_PATH}/${sanitizedUserId}`);

        try {
            const [legacySnapshot, newSnapshot] = await Promise.all([
                get(legacyReportsRef),
                get(newReportsRef)
            ]);

            let allReports = [];

            if (legacySnapshot.exists()) {
                const legacyData = legacySnapshot.val();
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
            return allReports;
        } catch (error) {
            removeNotification(loadingNotifId);
            console.error(`Error loading reports for user ${userId}:`, error);
            Sentry.captureException(error, { extra: { context: 'loadUserSavedReports', userId } });
            showNotification(`Failed to load reports for ${userId}.`, 'error');
            setSavedReports([]);
            return [];
        } finally {
            setIsLoadingUserReports(false);
        }
    }, [showNotification, removeNotification]);

    const loadReportForUser = useCallback(async (report, userId, returnOnly = false, setFormData = null, selectedForm = null, setSelectedForm = null, getForms = null) => {
        const reportFirebaseKey = report?.key;
        if (!userId || !reportFirebaseKey) {
            if (!returnOnly) showNotification('Cannot load report: User ID or Report Key is missing.', 'error');
            return { success: false, message: 'User ID or Report Key is missing.' };
        }

        const isLegacyReport = report.legacy;
        const sanitizedUserId = comprehensiveSanitize(userId);

        let reportPath = isLegacyReport
            ? `savedReports/${sanitizedUserId}/${reportFirebaseKey}`
            : `${REPORTS_PATH}/${sanitizedUserId}/${reportFirebaseKey}`;

        const bbCodePath = isLegacyReport
            ? `savedReportBBCode/${sanitizedUserId}/${reportFirebaseKey}`
            : `${BBCODE_PATH}/${sanitizedUserId}/${reportFirebaseKey}`;
        
        const reportRef = ref(database, reportPath);
        const bbCodeRef = ref(database, bbCodePath);

        let loadingNotifId;
        if (!returnOnly) {
            loadingNotifId = showNotification(`Loading report: ${reportFirebaseKey} for ${userId}...`, 'info-circle', 0);
        }

        try {
            const [reportSnapshot, bbCodeSnapshot] = await Promise.all([
                get(reportRef),
                get(bbCodeRef)
            ]);

            if (reportSnapshot.exists()) {
                const reportData = reportSnapshot.val();
                const bbCodeData = bbCodeSnapshot.exists() ? bbCodeSnapshot.val() : null;
                let loadedVersion = reportData.bbCodeVersion;

                // Fallback: Infer version from title if missing
                if (!loadedVersion && reportData.originalKey) {
                    if (reportData.originalKey.includes('[Mass Fatality Report]') || reportData.originalKey.includes('[Multi Fatality Report]')) {
                        loadedVersion = 11;
                        reportData.bbCodeVersion = 11; // Update object
                        console.log(`[useReportLoader] Inferred version 11 (${reportData.originalKey.includes('[Mass Fatality Report]') ? 'Mass' : 'Multi'} Fatality) from title.`);
                    }
                }
                
                if (sendDataRequestLog) {
                    const reportSize = new TextEncoder().encode(JSON.stringify(reportData)).length;
                    const bbCodeSize = bbCodeData ? new TextEncoder().encode(JSON.stringify(bbCodeData)).length : 0;
                    const totalSize = reportSize + bbCodeSize;

                    sendDataRequestLog(
                        'useReportLoader.js/loadReportForUser',
                        false,
                        'Firebase Read',
                        totalSize,
                        isGtaAuthenticated,
                        getCharacterName(gtaWorldUser),
                        `Report: ${reportPath} (${reportSize} bytes)${bbCodeData ? `, BBCode: ${bbCodePath} (${bbCodeSize} bytes)` : ''}`
                    );
                }

                reportData.bbCode = bbCodeSnapshot.exists() ? bbCodeSnapshot.val().bbCode : '';
                let loadedBbCode = reportData.bbCode || '';
                if (!loadedBbCode && reportData.bbCode) loadedBbCode = reportData.bbCode;
                if (!loadedBbCode && reportData.data && reportData.data.bbCode) loadedBbCode = reportData.data.bbCode;
                
                let loadedFormData = reportData.data || {};
                const isFormHandlerReport = reportData.isFormHandler === true;

                // Standardize bold tags for all reports on load
                if (!isFormHandlerReport) {
                    if (returnOnly) {
                        const boldMatches = (loadedBbCode.match(/\[bold\]/gi) || []).length;
                        if (boldMatches > 0) {
                            loadedBbCode = loadedBbCode.replace(/\[bold\]/gi, '[b]').replace(/\[\/bold\]/gi, '[/b]');
                        }
                    } else {
                        loadedBbCode = loadedBbCode.replace(/\[bold\]/gi, '[b]').replace(/\[\/bold\]/gi, '[/b]');
                    }
                }

                // Normalization of Decedents (Array as Object fix)
                // We do this here so both attachment and loading logic benefit
                if (loadedFormData.decedents && typeof loadedFormData.decedents === 'object' && !Array.isArray(loadedFormData.decedents)) {
                     loadedFormData.decedents = Object.values(loadedFormData.decedents);
                }

                if (!returnOnly && setFormData) {
                    const currentTimestamp = Date.now().toString();
                    
                    // --- Employee Sync Logic ---
                    const loadedCoronerEmployee = loadedFormData.coronerEmployee;
                    if (loadedCoronerEmployee) {
                        const coronerDetails = findEmployeeDetails(loadedCoronerEmployee);
                        if (coronerDetails) {
                            loadedFormData.coronerEmployee = loadedCoronerEmployee;
                            loadedFormData.coronerBadge = coronerDetails.badge || '';
                            loadedFormData.coronerRank = coronerDetails.rank || '';
                            loadedFormData.coronerDiscord = coronerDetails.discord || '';
                            loadedFormData.coronerPHNumber = coronerDetails.phNumber || '50056';
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
                        } else {
                            showNotification(`Coroner "${loadedCoronerEmployee}" not found in current staff list. Using data from saved report.`, 'warning', 7000);
                        }
                    }

                    const loadedPhmcEmployee = loadedFormData.phmcEmployee;
                    if (loadedPhmcEmployee) {
                        const phmcDetails = findEmployeeDetails(loadedPhmcEmployee);
                        if (phmcDetails) {
                            loadedFormData.phmcEmployee = loadedPhmcEmployee;
                            loadedFormData.phmcEmployeeLastName = phmcDetails.lastName || '';
                            loadedFormData.phmcRank = phmcDetails.category || phmcDetails.rank || '';
                            localStorage.setItem('phmcEmployee', loadedFormData.phmcEmployee);
                            localStorage.setItem('phmcEmployee_timestamp', currentTimestamp);
                            localStorage.setItem('phmcEmployeeLastName', loadedFormData.phmcEmployeeLastName);
                            localStorage.setItem('phmcEmployeeLastName_timestamp', currentTimestamp);
                            localStorage.setItem('phmcRank', loadedFormData.phmcRank);
                            localStorage.setItem('phmcRank_timestamp', currentTimestamp);
                        } else {
                            showNotification(`PHMC Staff "${loadedPhmcEmployee}" not found in current staff list. Using data from saved report.`, 'warning', 7000);
                        }
                    }

                    const localStorageManagedFields = [
                        'placeOfDeath', 'pronouncedTimeOfDeath', 'dateTime', 'department',
                        'mannerOfDeath',
                    ];
                    localStorageManagedFields.forEach(field => {
                        if (Object.prototype.hasOwnProperty.call(loadedFormData, field) && loadedFormData[field]) {
                            localStorage.setItem(field, loadedFormData[field]);
                            localStorage.setItem(`${field}_timestamp`, currentTimestamp);
                        }
                    });
                    // --- End Employee Sync Logic ---

                    // Form Switching Logic
                    if (!isLegacyReport && reportData.formId && getForms && setSelectedForm) {
                        const latestForms = getForms();
                        const formToLoad = latestForms.find(f => f.id === reportData.formId);
                        if (formToLoad) {
                            setSelectedForm(formToLoad);
                        } else {
                            showNotification(`Warning: Could not switch to the correct form automatically.`, 'warning');
                        }
                    }

                    // Mass Fatality Loading Logic
                    if (loadedVersion === 11 || reportData.formId === 'mass-ftality-test') {
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
                        // Logic for loading Death Report (v1) into Coroner Email (v2)
                        setFormData(prevFormData => {
                            const currentDeathReportIsEmpty = !prevFormData.deathReport || prevFormData.deathReport.trim() === '';
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

                            let notificationMessage = '';
                            if (currentDeathReportIsEmpty) {
                                updatedDeathReport = loadedBbCode;
                                notificationMessage = `Loaded report for ${loadedFormData.decedentName || reportData.originalKey} into main Death Report field.`;
                            } else {
                                updatedAdditionalReports = [...updatedAdditionalReports, { bbCode: loadedBbCode, originalKey: reportData.originalKey }];
                                notificationMessage = `Added report for ${loadedFormData.decedentName || reportData.originalKey} as an additional report.`;
                            }
                            showNotification(notificationMessage, 'plus-circle');

                            return {
                                ...prevFormData,
                                ...loadedFormData,
                                decedentName: updatedName,
                                decedentOOC: updatedOoc,
                                deathReport: updatedDeathReport,
                                additionalReports: updatedAdditionalReports,
                            };
                        });
                    } else {
                        // Standard Load
                        setFormData(prev => ({
                            ...prev,
                            ...loadedFormData,
                            coronerEmployee: loadedFormData.coronerEmployee || prev.coronerEmployee,
                            phmcEmployee: loadedFormData.phmcEmployee || prev.phmcEmployee,
                        }));
                        showNotification(`Report "${reportData.originalKey || reportFirebaseKey}" loaded.`, 'upload');
                    }
                }

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
    }, [showNotification, removeNotification, sendDataRequestLog, isGtaAuthenticated, gtaWorldUser, findEmployeeDetails]);

    const countAllUserReports = useCallback(async (userId) => {
        if (!userId) return 0;
        const sanitizedUserId = comprehensiveSanitize(userId);
        const legacyReportsRef = ref(database, `savedReports/${sanitizedUserId}`);
        const newReportsRef = ref(database, `${REPORTS_PATH}/${sanitizedUserId}`);

        try {
            const [legacySnapshot, newSnapshot] = await Promise.all([
                get(legacyReportsRef),
                get(newReportsRef)
            ]);
            let totalCount = 0;
            if (legacySnapshot.exists()) totalCount += Object.keys(legacySnapshot.val()).length;
            if (newSnapshot.exists()) totalCount += Object.keys(newSnapshot.val()).length;
            return totalCount;
        } catch (error) {
            console.error(`Error counting reports for user ${userId}:`, error);
            return 0;
        }
    }, []);

    const checkIfMigratedReportExists = useCallback(async (userId, originalKey) => {
        if (!userId || !originalKey) return { exists: false };
        const sanitizedUserId = comprehensiveSanitize(userId);
        const newReportsRef = ref(database, `${REPORTS_PATH}/${sanitizedUserId}`);
        try {
            const snapshot = await get(newReportsRef);
            if (snapshot.exists()) {
                const reports = snapshot.val();
                for (const key in reports) {
                    if (Object.prototype.hasOwnProperty.call(reports, key)) {
                        const report = reports[key];
                        if (report.originalKey === originalKey) {
                            return { exists: true, reportKey: key };
                        }
                    }
                }
            }
            return { exists: false };
        } catch (error) {
            console.error(`Error checking migrated report:`, error);
            return { exists: false };
        }
    }, []);

    return {
        savedReports,
        setSavedReports,
        isLoadingUserReports,
        selectedUserForSavedReports,
        setSelectedUserForSavedReports,
        loadUserSavedReports,
        loadReportForUser,
        countAllUserReports,
        checkIfMigratedReportExists
    };
};
