import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { database } from '../../firebase';
import { ref, onValue } from 'firebase/database';
import { useReportManagement } from '../useReportManagement';
import { useFormSaver } from '../../hooks/useFormSaver';
import useBbcodeGenerator from '../../hooks/useBbcodeGenerator';
import { useData } from '../../contexts/DataContext';
import SavedReportsModal from '../SavedReportsModal';
import { useNotification } from '../../contexts/NotificationContext';
import { Button } from 'react-bootstrap';


const LegacyReportMigrator = ({ onClose }) => {
    const [forms, setForms] = useState([]);
    const [isMigrating, setIsMigrating] = useState(false);
    const [targetUser, setTargetUser] = useState('');
    const [showModal, setShowModal] = useState(false);

    // --- Hooks ---
    const { showNotification, removeNotification } = useNotification();
    const { employeeOptions } = useData();
    console.log('[DEBUG] LegacyReportMigrator - employeeOptions from useData:', employeeOptions);

    // Augment employeeOptions to always include the targetUser
    const displayEmployeeOptions = useMemo(() => {
        const defaultOptions = employeeOptions || [];
        
        // Create a flat list of all existing employee values for easy checking
        const existingEmployeeValues = defaultOptions.flatMap(group => group.options).map(opt => opt.value);

        if (targetUser && !existingEmployeeValues.includes(targetUser)) {
            // Add targetUser as a generic option if not already present
            const genericUserOption = { label: `${targetUser} (Migration Target)`, value: targetUser };
            // Create a new group or add to an existing 'Other' group
            const otherGroupIndex = defaultOptions.findIndex(group => group.label === 'Other Users');
            if (otherGroupIndex !== -1) {
                // If 'Other Users' group exists, add the option to it
                const newOptions = [...defaultOptions];
                newOptions[otherGroupIndex] = {
                    ...newOptions[otherGroupIndex],
                    options: [...newOptions[otherGroupIndex].options, genericUserOption]
                };
                return newOptions;
            } else {
                // Otherwise, create a new 'Other Users' group
                return [...defaultOptions, { label: 'Other Users', options: [genericUserOption] }];
            }
        }
        return defaultOptions;
    }, [employeeOptions, targetUser]);


    // Minimal set of dependencies for useReportManagement
    const { 
        savedReports,
        isLoadingUserReports,
        loadUserSavedReports,
        loadReportForUser,
        saveReport,
    } = useReportManagement(
        {}, 
        () => {}, 
        null, 
        () => {}, 
        () => '', 
        () => 'MIGRATION_USER', // Dummy author
        () => ({}), 
        displayEmployeeOptions, // Pass real options
        showNotification, 
        removeNotification,
        () => {}, 
        () => {}, 
        () => {}, 
        { current: null }, 
        null, 
        forms, 
        () => {}
    );
    
    // --- Logic ---

    // Fetch all form definitions
    useEffect(() => {
        const formsRef = ref(database, "forms");
        const unsub = onValue(formsRef, (snap) => {
            const data = snap.val() || {};
            const list = Object.keys(data).map(key => ({ ...data[key], firebaseKey: key }));
            setForms(list);
            console.log(`[LegacyReportMigrator] Loaded ${list.length} form definitions.`);
        });
        return () => unsub();
    }, []);

    const handleLoadReportsClick = () => {
        if (!targetUser) {
            showNotification('Please enter a user name.', 'warning');
            return;
        }
        setShowModal(true); // Open the modal
        loadUserSavedReports(targetUser); // Explicitly load reports for the target user
    };
    
    const handleSelectReportToMigrate = async (report) => {
        console.log("Selected report to migrate:", report);
        showNotification(`Migration for "${report.originalKey}" started...`, 'info');

        let migratedReport = { ...report };

        // 1. Remove bbCodeVersion
        delete migratedReport.bbCodeVersion;

        // 2. Handle data.additionalImages to data.additionalPhotos
        if (migratedReport.data.additionalImages && typeof migratedReport.data.additionalImages === 'string') {
            migratedReport.data.additionalPhotos = [migratedReport.data.additionalImages];
            delete migratedReport.data.additionalImages;
        } else {
            migratedReport.data.additionalPhotos = migratedReport.data.additionalPhotos || []; // Ensure it's always an array
        }

        // 3. Handle data.scenePhotos to data.scenePhotosBBCode
        if (migratedReport.data.scenePhotos && typeof migratedReport.data.scenePhotos === 'string') {
            // Exclude "Scene Photos are unavailable" from migration, as it's not a valid URL
            if (migratedReport.data.scenePhotos !== "Scene Photos are unavailable") {
                migratedReport.data.scenePhotosBBCode = [migratedReport.data.scenePhotos];
            } else {
                migratedReport.data.scenePhotosBBCode = [];
            }
            delete migratedReport.data.scenePhotos;
        } else {
            migratedReport.data.scenePhotosBBCode = migratedReport.data.scenePhotosBBCode || []; // Ensure it's always an array
        }

        // 4. Set legacy to false
        migratedReport.legacy = false;

        // 5. Update timestamps
        migratedReport.gtawSyncTimestamp = new Date().toISOString();
        migratedReport.timestamp = Date.now();

        // 6. Derive formId if not present (should be from report.formName)
        if (!migratedReport.formId && migratedReport.formName) {
            migratedReport.formId = migratedReport.formName.toLowerCase().replace(/\s/g, '-');
        } else if (!migratedReport.formId) {
            // Fallback for cases where formName might be missing, try to infer from originalKey
            const match = migratedReport.originalKey.match(/\[(.*?)\]/);
            if (match && match[1]) {
                migratedReport.formId = match[1].toLowerCase().replace(/-report$/, '').replace(/\s/g, '-');
            } else {
                migratedReport.formId = 'unknown-form';
            }
        }

        // 7. Add scenePhotosBBCode_narrative if missing
        if (!migratedReport.data.scenePhotosBBCode_narrative) {
            migratedReport.data.scenePhotosBBCode_narrative = "";
        }

        // 8. Set patientName if missing
        if (!migratedReport.data.patientName && migratedReport.authorName) {
            migratedReport.data.patientName = migratedReport.authorName;
        }

        // 9. Ensure formName is present
        if (!migratedReport.formName) {
            // Try to derive formName from originalKey or formId
            if (migratedReport.originalKey) {
                const match = migratedReport.originalKey.match(/\[(.*?)\]/);
                if (match && match[1]) {
                    migratedReport.formName = match[1].replace(/-/g, ' ');
                }
            }
            if (!migratedReport.formName && migratedReport.formId) {
                migratedReport.formName = migratedReport.formId.replace(/-/g, ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
            } else {
                migratedReport.formName = 'Unknown Form';
            }
        }


        console.log("Migrated report:", migratedReport);

        try {
            // Assume saveReport takes the report object and a boolean indicating if it's a migration
            await saveReport(migratedReport, true);
            showNotification(`Successfully migrated "${migratedReport.originalKey}"!`, 'success');
        } catch (error) {
            console.error("Error saving migrated report:", error);
            showNotification(`Failed to migrate "${migratedReport.originalKey}". Error: ${error.message}`, 'error');
        }
    };

    // --- Render ---

    return (
        <>
            {/* The modal is the main UI, but we need a way to trigger it for a specific user */}
            {!showModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0, 0, 0, 0.7)', zIndex: 1100, display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={onClose}>
                    <div style={{ background: '#0d1117', padding: '20px', borderRadius: '8px', color: 'white' }} onClick={e => e.stopPropagation()}>
                        <h3>Legacy Report Migration (Experimental)</h3>
                        <p>Enter the full character name of the user whose legacy reports you want to migrate.</p>
                        <div className="form-group">
                            <input
                                type="text"
                                className="form-control"
                                value={targetUser}
                                onChange={(e) => setTargetUser(e.target.value)}
                                placeholder="e.g., Alyson Frost"
                            />
                        </div>
                        <Button onClick={handleLoadReportsClick} className="mt-3">Load User's Legacy Reports</Button>
                        <Button variant="secondary" onClick={onClose} className="mt-3 ms-2">Cancel</Button>
                    </div>
                </div>
            )}

            {showModal && (
                 <SavedReportsModal
                    show={showModal}
                    onHide={() => { setShowModal(false); onClose(); }}
                    onClose={() => { setShowModal(false); onClose(); }}
                    showNotification={showNotification}
                    reportsForSelectedUser={savedReports}
                    onEmployeeSelect={loadUserSavedReports}
                    employeeOptions={displayEmployeeOptions}
                    isLoadingReports={isLoadingUserReports}
                    loadReport={handleSelectReportToMigrate}
                    deleteReportForUser={() => { showNotification('Deletion is disabled in migration mode.', 'warning'); }}
                    handleReportSelectedForAttachment={() => {}}
                    currentCoronerEmployee={targetUser}
                    currentPhmcEmployee={targetUser}
                    legacyOnly={true}
                    loadButtonText="Migrate"
                    disableAutoLoad={true}
                />
            )}
        </>
    );
};

export default LegacyReportMigrator;
