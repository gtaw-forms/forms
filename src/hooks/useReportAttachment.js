import { useState, useRef, useCallback } from 'react';

export const useReportAttachment = (
    loadReportForUser,
    formData,
    setFormData,
    selectedForm,
    showNotification,
    removeNotification,
    modalCloseTimer,
    validateMembership
) => {
    const [reportSelectionFilter, setReportSelectionFilter] = useState(null);
    const [preselectedEmployeeType, setPreselectedEmployeeType] = useState(null);
    const [showSavedReports, setShowSavedReports] = useState(false);
    const [isAttachMode, setIsAttachMode] = useState(false);
    const pendingReportAttachmentCallback = useRef(null);
    const currentAttachmentTargetFieldRef = useRef(null);

    const handleReportSelectedForAttachment = useCallback(async (reportData, loadedFormData, loadedVersion, _loadedBbCode, sourceRef = null) => {
        const targetFieldName = currentAttachmentTargetFieldRef.current;
        // Identity of the attached report for deep links (the modal row's own
        // author/key — NOT the currently selected employee). Absent for
        // legacy/parse flows; link builders must treat it as optional.
        const attachedIdentity = (sourceRef && typeof sourceRef === 'object')
            ? { author: String(sourceRef.author || '').trim() || null, key: String(sourceRef.key || '').trim() || null }
            : { author: null, key: null };
        const withIdentity = (item) => ({ ...item, ...(attachedIdentity.author && attachedIdentity.key ? { attachedAuthor: attachedIdentity.author, attachedKey: attachedIdentity.key } : {}) });
        
        setFormData(prev => {
            if (loadedVersion === 11) {
                console.log(`[useReportAttachment] Attaching Version 11 Report. Current form: ${selectedForm?.name}`);
                let decedents = loadedFormData.decedents;
                if (decedents && typeof decedents === 'object' && !Array.isArray(decedents)) {
                    decedents = Object.values(decedents);
                }

                if (!Array.isArray(decedents) || decedents.length === 0) {
                    const reportContent = loadedFormData.deathReport || reportData.bbCode || '';
                    return { ...prev, additionalReports: [...(prev.additionalReports || []), withIdentity({ bbCode: reportContent, originalKey: reportData.originalKey, formId: reportData.formId })] };
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
                newState.additionalReports = [...(prev.additionalReports || []), withIdentity({ bbCode: reportContent, originalKey: reportData.originalKey, formId: reportData.formId })];

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
                    newState.additionalReports = [...(prev.additionalReports || []), withIdentity({ bbCode: reportContent, originalKey: reportData.originalKey, formId: reportData.formId })];

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

        // --- FINAL SECURITY FAIL-SAFE (scoped: restricted forms only) ---
        // Public forms: non-members may still browse/attach their own saved
        // reports — saves themselves stay standard-only via the saver gate.
        if (!showSavedReports && validateMembership && !validateMembership(selectedForm)) {
            return;
        }

        if (showSavedReports) {
            setShowSavedReports(false);
            setReportSelectionFilter(null); // Clear filter when closing
            return;
        }

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
    }, [showSavedReports, validateMembership, selectedForm]);

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
