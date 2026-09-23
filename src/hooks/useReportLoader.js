import { useState, useCallback } from 'react';
import { database } from '../firebase';
import { ref, get } from 'firebase/database';
import { triggerListSavedReports, triggerGetSavedReport } from '../services/firebaseFunctions';
import * as Sentry from "@sentry/react";
import { useNotification } from '../contexts/NotificationContext';
import { useData } from '../contexts/DataContext';
import { getCharacterName } from '../utils/identityUtils';
import { comprehensiveSanitize } from '../utils/textUtils';
import useGtaWorldAuth from './useGtaWorldAuth';

// Note: all non-scheduled reads go through the VPS after the Task 3b
// cutover — no RTDB report paths are read here anymore.

export const useReportLoader = () => {
    const { showNotification, removeNotification } = useNotification();
    const { factionListData, sendDataRequestLog } = useData();
    const { user: gtaWorldUser, isAuthenticated: isGtaAuthenticated } = useGtaWorldAuth();

    const [savedReports, setSavedReports] = useState([]);
    const [isLoadingUserReports, setIsLoadingUserReports] = useState(false);
    const [selectedUserForSavedReports, setSelectedUserForSavedReports] = useState(null);
    // VPS-side total for the selected user (paging: loaded < total => "Show more").
    const [savedReportsTotal, setSavedReportsTotal] = useState(0);

    const findEmployeeDetails = useCallback((employeeName) => {
        if (!employeeName) return null;
        const employee = factionListData.find(member =>
            (member.characterName && member.characterName === employeeName) ||
            (member.name && member.name === employeeName)
        );
        return employee || null;
    }, [factionListData]);

    // Paginated: loads the 50 most recent VPS reports by default.
    // "Show more" paging goes through loadMoreSavedReports(userId).
    const DEFAULT_REPORT_PAGE_SIZE = 50;
    const loadUserSavedReports = useCallback(async (userId, options = {}) => {
        if (!userId) {
            setSavedReports([]);
            setSelectedUserForSavedReports(null);
            setSavedReportsTotal(0);
            return [];
        }

        const limit = options.limit ?? DEFAULT_REPORT_PAGE_SIZE;
        const offset = options.offset ?? 0;
        const append = options.append === true && offset > 0;

        setIsLoadingUserReports(true);
        setSelectedUserForSavedReports(userId);
        const loadingNotifId = showNotification(`Loading reports for ${userId}...`, 'info-circle', 0);

        const sanitizedUserId = comprehensiveSanitize(userId);
        const scheduledRef = ref(database, `scheduledReports/${sanitizedUserId}`);

        try {
            let vpsReports = [];
            let vpsTotal = 0;
            try {
                const result = await triggerListSavedReports({ author: sanitizedUserId, limit, offset });
                vpsReports = Array.isArray(result?.reports) ? result.reports : [];
                vpsTotal = Number(result?.total) || (offset + vpsReports.length);
            } catch (error) {
                // Task 3b cutover: saved reports live on the VPS. No RTDB
                // fallback — a VPS failure surfaces as an error below instead
                // of silently re-reading the drained legacy nodes.
                console.warn('[useReportLoader] VPS report list unavailable:', error.message);
                throw error;
            }
            const scheduledSnapshot = await get(scheduledRef);
            setSavedReportsTotal(vpsTotal);

            let allReports = [];

            allReports.push(...vpsReports.map(report => ({ ...report, _src: 'vps', legacy: false })));

            // Deploy-tracked reports live under scheduledReports (bot queue) — the
            // deployed ones carry hasdeployed/deployStatus/deployUrl there. Include
            // them so the UI can show deploy status + "Edit & Repost".
            if (scheduledSnapshot.exists()) {
                const schedData = scheduledSnapshot.val();
                const schedReports = Object.keys(schedData).map(key => ({
                    ...schedData[key],
                    key: key,
                    _src: 'scheduled',
                }));
                allReports.push(...schedReports);
            }

            removeNotification(loadingNotifId);

            if (allReports.length > 0 || append) {
                allReports.sort((a, b) => b.timestamp - a.timestamp);
                if (append) {
                    // Append page: merge with existing, de-dupe by key.
                    // Functional update avoids a stale closure over savedReports.
                    setSavedReports(prev => {
                        const seen = new Set();
                        const merged = [];
                        for (const r of [...prev, ...allReports]) {
                            const k = `${r._src}:${r.key}`;
                            if (seen.has(k)) continue;
                            seen.add(k);
                            merged.push(r);
                        }
                        merged.sort((a, b) => b.timestamp - a.timestamp);
                        return merged;
                    });
                    showNotification(`Loaded more reports for ${userId}.`, 'check-circle');
                    return allReports;
                }
                setSavedReports(allReports);
                if (vpsTotal > vpsReports.length) {
                    showNotification(`Showing ${vpsReports.length} most recent of ${vpsTotal} reports for ${userId}.`, 'check-circle');
                } else {
                    showNotification(`Loaded ${allReports.length} report(s) for ${userId}.`, 'check-circle');
                }
            } else {
                showNotification(`No reports found for ${userId}.`, 'info-circle');
            }
            return allReports;
        } catch (error) {
            removeNotification(loadingNotifId);
            console.error(`Error loading reports for user ${userId}:`, error);
            Sentry.captureException(error, { extra: { context: 'loadUserSavedReports', userId } });
            showNotification(`Failed to load reports for ${userId}.`, 'error');
            if (!append) {
                setSavedReports([]);
                setSavedReportsTotal(0);
            }
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

        let reportPath = null;
        let bbCodePath = null;

        // Deploy-tracked reports (from the bot queue) read scheduledReports on
        // RTDB. Everything else lives on the VPS after the Task 3b cutover —
        // items without `_src` (pre-cutover bundles) resolve through the VPS
        // too, since the backfill covers all legacy authors/keys.
        if (report._src === 'scheduled') {
            reportPath = `scheduledReports/${sanitizedUserId}/${reportFirebaseKey}`;
            bbCodePath = `scheduledReportsBBCode/${sanitizedUserId}/${reportFirebaseKey}`;
        }
        
        let loadingNotifId;
        if (!returnOnly) {
            loadingNotifId = showNotification(`Loading report: ${reportFirebaseKey} for ${userId}...`, 'info-circle', 0);
        }

        try {
            let reportSnapshot;
            let bbCodeSnapshot = null;
            if (report._src === 'scheduled') {
                const reportRef = ref(database, reportPath);
                const bbCodeRef = ref(database, bbCodePath);
                reportSnapshot = await get(reportRef);
                bbCodeSnapshot = await get(bbCodeRef);
            } else {
                // Task 3b cutover: VPS is the only store for non-scheduled
                // reports (report + BBCode in one call). No RTDB fallback.
                const result = await triggerGetSavedReport({ author: sanitizedUserId, key: reportFirebaseKey });
                reportSnapshot = {
                    exists: () => !!result?.report,
                    val: () => result?.report || null,
                };
                bbCodeSnapshot = {
                    exists: () => typeof result?.bbCode === 'string' && result.bbCode.length > 0,
                    val: () => ({ bbCode: result?.bbCode || '' }),
                };
            }

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

                    const reportSizeKb = reportSize / 1024;
                    const bbCodeSizeKb = bbCodeSize / 1024;
                    sendDataRequestLog(
                        'useReportLoader.js/loadReportForUser',
                        false,
                        report._src === 'scheduled' ? 'Firebase Read' : 'VPS Report API',
                        0,
                        reportSizeKb + bbCodeSizeKb,
                        isGtaAuthenticated,
                        getCharacterName(gtaWorldUser),
                        ['saved-report'],
                        [],
                        { 'saved-report': reportSizeKb + bbCodeSizeKb },
                        null,
                        {
                            route: window.location.hash || '#/',
                            trigger: 'load-report',
                        },
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
                if (!returnOnly) showNotification(`Report not found: ${reportFirebaseKey}`, 'error');
                return { success: false, message: `Report not found: ${reportFirebaseKey}` };
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
        try {
            // No limit sent: server returns everything (plus a total count).
            const vpsResult = await triggerListSavedReports({ author: sanitizedUserId });
            if (Number.isFinite(Number(vpsResult?.total))) return Number(vpsResult.total);
            return Array.isArray(vpsResult?.reports) ? vpsResult.reports.length : 0;
        } catch (error) {
            // Task 3b cutover: VPS-only count, no RTDB fallback.
            console.error(`Error counting VPS reports for user ${userId}:`, error);
            return 0;
        }
    }, []);

    // "Show more" paging: appends the next page to the loaded list.
    const loadMoreSavedReports = useCallback(async (userId) => {
        if (!userId || isLoadingUserReports) return [];
        const offset = savedReports.filter(r => r._src === 'vps').length;
        if (savedReportsTotal > 0 && offset >= savedReportsTotal) return [];
        return loadUserSavedReports(userId, { offset, append: true });
    }, [savedReports, savedReportsTotal, isLoadingUserReports, loadUserSavedReports]);

    const checkIfMigratedReportExists = useCallback(async (userId, originalKey) => {
        if (!userId || !originalKey) return { exists: false };
        const sanitizedUserId = comprehensiveSanitize(userId);
        try {
            const vpsResult = await triggerListSavedReports({ author: sanitizedUserId });
            const match = (vpsResult?.reports || []).find(report => report.originalKey === originalKey);
            if (match) return { exists: true, reportKey: match.key };
            return { exists: false };
        } catch (error) {
            // Task 3b cutover: VPS-only check, no RTDB fallback.
            console.error(`Error checking VPS report:`, error);
            return { exists: false };
        }
    }, []);

    return {
        savedReports,
        setSavedReports,
        isLoadingUserReports,
        selectedUserForSavedReports,
        setSelectedUserForSavedReports,
        savedReportsTotal,
        loadUserSavedReports,
        loadMoreSavedReports,
        loadReportForUser,
        countAllUserReports,
        checkIfMigratedReportExists
    };
};
