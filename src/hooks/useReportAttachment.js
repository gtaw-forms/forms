import { useState, useRef, useCallback } from 'react';
import * as Sentry from "@sentry/react";
import { useData } from '../contexts/DataContext';

export const useReportAttachment = (
    loadReportForUser,
    formData,
    setFormData,
    selectedForm,
    showNotification,
    removeNotification,
    modalCloseTimer
) => {
    const { 
        ER_PROTOCOL_VERSION, 
        CONSULTATION_NOTES_PHMC_VERSION, 
        CONSULTATION_NOTES_PBC_VERSION 
    } = useData(); // Assuming these versions might be needed, or we pass them in.
    
    // Actually, useData doesn't export these versions directly usually, they were passed as args.
    // We'll stick to the args pattern or constants if they are static.
    // For now, let's keep the internal state for the modal logic.

    const [reportSelectionFilter, setReportSelectionFilter] = useState(null);
    const [preselectedEmployeeType, setPreselectedEmployeeType] = useState(null);
    const [showSavedReports, setShowSavedReports] = useState(false);
    const pendingReportAttachmentCallback = useRef(null);
    const currentAttachmentTargetFieldRef = useRef(null);

    const getCurrentReportAuthor = useCallback(() => {
        // This helper was passed in before. We might need to assume it's available or pass it.
        // For attachment logic, it's used to check if an employee is selected.
        return formData.phmcEmployee || formData.coronerEmployee || null;
    }, [formData]);

    const handleReportSelectedForAttachment = useCallback(async (report, userId, targetFieldName) => {
        if (modalCloseTimer.current) {
            clearTimeout(modalCloseTimer.current);
        }

        const loadingNotifId = showNotification(`Attaching report...`, 'info-circle', 0);
        const result = await loadReportForUser(report, userId, true);
        removeNotification(loadingNotifId);

        if (result.success && pendingReportAttachmentCallback.current) {
            const reportData = result.reportData;
            const loadedFormData = reportData.data || {};
            const loadedVersion = reportData.bbCodeVersion;

            // --- MODIFICATION START: Generalized Field Population ---
            setFormData(prev => {
                console.log(`[useReportAttachment] Checking attachment logic. Form: ${selectedForm?.name} (${selectedForm?.id}), Loaded Version: ${loadedVersion}`);

                // Logic for Attaching Mass Fatality to Coroner Email
                if ((selectedForm?.name === 'Coroner Email' || selectedForm?.id === 'coroner_email') && loadedVersion === 11) { 
                    console.log('[useReportAttachment] Attaching Mass Fatality to Coroner Email. Loaded Data:', loadedFormData);
                    let decedents = loadedFormData.decedents;
                    
                    console.log('[useReportAttachment] Raw Decedents Field:', decedents, 'Type:', typeof decedents, 'Is Array:', Array.isArray(decedents));

                    // Handle Firebase array-as-object conversion
                    if (decedents && typeof decedents === 'object' && !Array.isArray(decedents)) {
                        console.log('[useReportAttachment] converting object-based decedents to array...');
                        decedents = Object.values(decedents);
                    }
                    
                    console.log('[useReportAttachment] Processed Decedents Array:', decedents);

                    if (decedents && decedents.length > 0) {
                        const firstDecedent = decedents[0];
                        let icName = firstDecedent.decedentName || firstDecedent.DecedentName || '';
                        
                        // Extract and join all OOC names for the title list
                        const oocNamesList = decedents
                            .map(d => d.decedentOOC || d.DecedentOOC)
                            .filter(n => n && String(n).trim() !== '');
                        
                        let oocName = oocNamesList.length > 0 ? oocNamesList.join(', ') : 'N/A';

                        if (decedents.length > 1) {
                            icName += ` (x${decedents.length})`;
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
                    if (Array.isArray(loadedFormData.decedents)) {
                        newState.decedents = [...(prev.decedents || []), ...loadedFormData.decedents];
                    }
                    return newState;
                }

                // Standard Attachment Logic
                const fieldsToUpdate = {
                    decedentName: loadedFormData.decedentName,
                    decedentOOC: loadedFormData.decedentOOC,
                    requestingOfficer: loadedFormData.requestingOfficer,
                    department: loadedFormData.department,
                };

                if (selectedForm?.name === 'Coroner Email' || selectedForm?.id === 'coroner_email') {
                    const existingNames = new Set((prev.decedentName || '').split(', ').filter(Boolean));
                    let decedentNameToAdd = null;
                    if (reportData.originalKey && reportData.originalKey.startsWith('[DEATH-REPORT]')) {
                        const nameMatch = reportData.originalKey.match(/[\[]DEATH-REPORT[^\]]*\][\s]*([^-]+)/);
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

                    const existingOocNames = new Set((prev.decedentOOC || '').split(', ').filter(Boolean));
                    if (loadedFormData.decedentOOC) {
                        existingOocNames.add(loadedFormData.decedentOOC);
                    }
                    const newDecedentOOC = Array.from(existingOocNames).join(', ');

                    const newDeathReport = [prev.deathReport, reportData.bbCode].filter(Boolean).join('\n\n[hr]\n\n');
                    const newAttachedReportKeys = [...(prev.attachedReportKeys || []), reportData.originalKey];

                    return {
                        ...prev,
                        decedentName: newDecedentName,
                        decedentOOC: newDecedentOOC,
                        requestingOfficer: loadedFormData.requestingOfficer || prev.requestingOfficer,
                        department: loadedFormData.department || prev.department,
                        deathReport: newDeathReport,
                        attachedReportKeys: newAttachedReportKeys,
                        additionalReports: [], 
                    };
                } else {
                    let newState = { ...prev };
                    newState.decedentName = fieldsToUpdate.decedentName || prev.decedentName;
                    newState.decedentOOC = fieldsToUpdate.decedentOOC || prev.decedentOOC;
                    newState.requestingOfficer = fieldsToUpdate.requestingOfficer || prev.requestingOfficer;
                    newState.department = fieldsToUpdate.department || prev.department;

                    if (targetFieldName && reportData.bbCode) {
                        const currentContent = newState[targetFieldName] || '';
                        newState[targetFieldName] = currentContent ? `${currentContent}\n\n${reportData.bbCode}` : reportData.bbCode;
                    }
                    return newState;
                }
            });
            // --- MODIFICATION END ---

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

        modalCloseTimer.current = setTimeout(() => {
            setReportSelectionFilter(null);
            setPreselectedEmployeeType(null);
            setShowSavedReports(false);
        }, 1000);

    }, [loadReportForUser, modalCloseTimer, showNotification, removeNotification, selectedForm, setFormData]);

    const toggleSavedReports = useCallback((filterVersions = null, employeeType = null, callback = null, targetFieldName = null) => {
        if (showSavedReports) {
            setShowSavedReports(false);
            setPreselectedEmployeeType(null);
            setReportSelectionFilter(null);
            pendingReportAttachmentCallback.current = null;
            currentAttachmentTargetFieldRef.current = null;
            return;
        }

        let author = null;
        if (employeeType === 'PHMC' && formData.phmcEmployee) {
            author = formData.phmcEmployee;
        } else if (employeeType === 'Coroner' && formData.coronerEmployee) {
            author = formData.coronerEmployee;
        }

        if (!author) {
            author = getCurrentReportAuthor();
        }

        if (author) {
            setShowSavedReports(true);
            setPreselectedEmployeeType(employeeType);
            setReportSelectionFilter(filterVersions);
            pendingReportAttachmentCallback.current = callback;
            currentAttachmentTargetFieldRef.current = targetFieldName;
        } else {
            const message = employeeType
                ? `Please select a ${employeeType} employee in the form to view their reports.`
                : 'Please select an employee in the form before viewing saved reports.';
            showNotification(message, 'warning');
        }
    }, [showSavedReports, formData, getCurrentReportAuthor, showNotification]);

    return {
        handleReportSelectedForAttachment,
        toggleSavedReports,
        showSavedReports,
        setShowSavedReports,
        preselectedEmployeeType,
        reportSelectionFilter,
        pendingReportAttachmentCallback,
        currentAttachmentTargetFieldRef
    };
};
