import { useState, useRef, useCallback } from 'react';
import * as Sentry from "@sentry/react";

// Helper to transform the report title on attachment
const transformReportTitle = (originalKey) => {
    if (typeof originalKey !== 'string') {
        return 'Attached Report';
    }

    let finalKey = originalKey;

    // 1. Handle Death Report prefix and date stripping
    if (finalKey.startsWith('[DEATH-REPORT]')) {
        finalKey = finalKey.replace('[DEATH-REPORT]', 'Coroner Report -').trim();
        // Remove date like MM/DD/YYYY from the end
        finalKey = finalKey.replace(/\s+\d{2}\/\d{2}\/\d{4}$/, '').trim();
    } 
    // 2. Handle Mass Fatality Report titles (prefix and x{times})
    else if (finalKey.startsWith('[Mass Fatality Report]') || finalKey.startsWith('[Multi Fatality Report]')) {
        // Remove the leading "[Mass Fatality Report]" or "[Multi Fatality Report]"
        finalKey = finalKey.replace(/\[(Mass|Multi) Fatality Report\]\s*/i, '').trim();
        // Remove the date from the end (e.g., "- 03/01/2026")
        finalKey = finalKey.replace(/\s*-\s*\d{2}\/\d{2}\/\d{4}$/, '').trim();
        // Remove any pipe separators from concatenated names
        finalKey = finalKey.replace(/\s*\|\s*/g, ', ').trim(); // Replace '|' with ', ' for better display

        // Prepend the standardized report type
        finalKey = `Mass Fatality Report - ${finalKey}`;
        // Ensure "x{times}" is correctly formatted without parentheses if it was " (x{times})"
        finalKey = finalKey.replace(/\s*\(x(\d+)\)/g, ' x$1');
    }
    
    // Replace text within double parentheses ((...)) with "OOC - <content>"
    finalKey = finalKey.replace(/\(\((.*?)\)\)/g, 'OOC - $1').trim();

    // Finally, remove any remaining square brackets to prevent breaking altspoilers
    finalKey = finalKey.replace(/\[|\]/g, '').trim();

    return finalKey;
};

export const useReportAttachment = (
    loadReportForUser,
    formData,
    setFormData,
    selectedForm,
    showNotification,
    removeNotification,
    modalCloseTimer
) => {
    const [reportSelectionFilter, setReportSelectionFilter] = useState(null);
    const [preselectedEmployeeType, setPreselectedEmployeeType] = useState(null);
    const [showSavedReports, setShowSavedReports] = useState(false);
    const [isAttachMode, setIsAttachMode] = useState(false);
    const pendingReportAttachmentCallback = useRef(null);
    const currentAttachmentTargetFieldRef = useRef(null);

    const getCurrentReportAuthor = useCallback(() => {
        return formData.phmcEmployee || formData.coronerEmployee || null;
    }, [formData]);

    const handleReportSelectedForAttachment = useCallback(async (reportData, loadedFormData, loadedVersion, loadedBbCode) => {
        const targetFieldName = currentAttachmentTargetFieldRef.current;
        
        setFormData(prev => {
            if (loadedVersion === 11) {
                console.log(`[useReportAttachment] Attaching Version 11 Report. Current form: ${selectedForm?.name}`);
                let decedents = loadedFormData.decedents;
                if (decedents && typeof decedents === 'object' && !Array.isArray(decedents)) {
                    decedents = Object.values(decedents);
                }

                if (!Array.isArray(decedents) || decedents.length === 0) {
                    const reportContent = loadedFormData.deathReport || reportData.bbCode || '';
                    return { ...prev, additionalReports: [...(prev.additionalReports || []), { bbCode: reportContent, originalKey: reportData.originalKey, formId: reportData.formId }] };
                }
                
                const firstDecedent = decedents[0];
                let icName = firstDecedent.decedentName || firstDecedent.DecedentName || '';
                if (decedents.length > 1) {
                    icName += ` (x${decedents.length})`;
                }

                let newState = { ...prev };
                if (selectedForm?.name === 'Coroner Email' || selectedForm?.id === 'coroner_email') {
                    const oocNamesList = decedents.map(d => d.decedentOOC || d.DecedentOOC).filter(Boolean);
                    newState.decedentName = icName;
                    newState.decedentOOC = oocNamesList.length > 0 ? oocNamesList.join(', ') : 'N/A';
                    newState.paperworkType = decedents.length >= 4 ? 'Mass Fatality' : 'Multi Fatality';
                }

                const reportContent = loadedFormData.deathReport || reportData.bbCode || '';
                newState.additionalReports = [...(prev.additionalReports || []), { bbCode: reportContent, originalKey: reportData.originalKey, formId: reportData.formId }];

                if (Array.isArray(loadedFormData.decedents)) {
                    newState.decedents = [...(prev.decedents || []), ...loadedFormData.decedents];
                }
                
                if (loadedFormData.requestingOfficer) newState.requestingOfficer = loadedFormData.requestingOfficer;
                if (loadedFormData.department) newState.department = loadedFormData.department;

                return newState;
            } else {
                // Standard Attachment Logic
                if (selectedForm?.name === 'Coroner Email' || selectedForm?.id === 'coroner_email') {
                    console.log(`[useReportAttachment] Attaching standard report to Coroner Email.`);
                    const reportContent = reportData.bbCode || '';
                    
                    let newState = { ...prev };
                    newState.additionalReports = [...(prev.additionalReports || []), { bbCode: reportContent, originalKey: reportData.originalKey, formId: reportData.formId }];

                    if (loadedFormData.requestingOfficer) newState.requestingOfficer = loadedFormData.requestingOfficer;
                    if (loadedFormData.department) newState.department = loadedFormData.department;
                    
                    return newState;
                } else {
                    let newState = { ...prev };
                    if (targetFieldName && reportData.bbCode) {
                        const currentContent = newState[targetFieldName] || '';
                        newState[targetFieldName] = currentContent ? `${currentContent}\n\n${reportData.bbCode}` : reportData.bbCode;
                    }
                    return newState;
                }
            }
        });
        
        showNotification(`Report "${reportData.originalKey}" attached successfully.`, 'check-circle');

    }, [selectedForm, setFormData, showNotification]);

    const toggleSavedReports = useCallback((
        event, 
        employeeType = null, 
        callback = null,
        targetField = null,
        isAttaching = false // Explicit flag from FormFieldRenderer
    ) => {
        if (event) event.preventDefault();

        if (showSavedReports) {
            setShowSavedReports(false);
            setReportSelectionFilter(null); // Clear filter when closing
            return;
        }

        let author = formData.phmcEmployee || formData.coronerEmployee;
        if (employeeType === 'PHMC' && formData.phmcEmployee) author = formData.phmcEmployee;
        if (employeeType === 'Coroner' && formData.coronerEmployee) author = formData.coronerEmployee;
        
        if (!author) author = getCurrentReportAuthor();

        if (author) {
            // Determine attach mode: true if called from the attach button, false otherwise.
            setIsAttachMode(isAttaching);
            setPreselectedEmployeeType(employeeType);
            currentAttachmentTargetFieldRef.current = targetField;
            pendingReportAttachmentCallback.current = callback; // Keep for now, though it's null for our use case
            
            // When in attachment mode, filter to only show specific form types
            if (isAttaching) {
                setReportSelectionFilter({
                    allowedFormIds: ['mass-ftality-test', 'coroner-report']
                });
            } else {
                setReportSelectionFilter(null);
            }
            
            setShowSavedReports(true);
        } else {
            showNotification('Please select an employee in the form to view their reports.', 'warning');
        }
    }, [showSavedReports, formData, getCurrentReportAuthor, showNotification]);

    return {
        handleReportSelectedForAttachment,
        toggleSavedReports,
        showSavedReports,
        setShowSavedReports,
        isAttachMode,
        preselectedEmployeeType,
        reportSelectionFilter,
        pendingReportAttachmentCallback,
        currentAttachmentTargetFieldRef
    };
};
