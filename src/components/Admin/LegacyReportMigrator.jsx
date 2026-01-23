import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { database } from '../../firebase';
import { get, ref, onValue } from 'firebase/database';
import { useReportLoader } from '../../hooks/useReportLoader';
import { useReportActions } from '../../hooks/useReportActions';
import { useMigrationSaver } from '../../hooks/useMigrationSaver';
import { useFormSaver } from '../../hooks/useFormSaver';
import useBbcodeGenerator from '../../hooks/useBbcodeGenerator';
import { useData } from '../../contexts/DataContext';
import SavedReportsModal from '../Modals/SavedReportsModal';
import { useNotification } from '../../contexts/NotificationContext';
import { Button } from 'react-bootstrap';


const LegacyReportMigrator = ({ onClose }) => {
    const [forms, setForms] = useState([]);
    const [isLoadingForms, setIsLoadingForms] = useState(true); // New state for loading forms
    const [userToMigrate, setUserToMigrate] = useState(''); // Renamed from targetUser
    const [showModal, setShowModal] = useState(false); // Controls visibility of SavedReportsModal
    const [migrationStage, setMigrationStage] = useState('input'); // 'input', 'confirm', 'backup', 'migrate', 'complete'
    const [migrationStatus, setMigrationStatus] = useState(''); // Status messages for the user
    const [progress, setProgress] = useState(0); // Progress percentage
    const [totalReportsToMigrate, setTotalReportsToMigrate] = useState(0);
    const [successfulMigrations, setSuccessfulMigrations] = useState(0);
    const [failedMigrations, setFailedMigrations] = useState(0);
    const [backupPath, setBackupPath] = useState(''); // Path where backup is stored
    const [reportsToMigrate, setReportsToMigrate] = useState([]); // Legacy reports to process
    const [isProcessing, setIsProcessing] = useState(false); // Track if migration is in progress
    const [totalSavedReports, setTotalSavedReports] = useState(0); // New state to hold total saved reports

    // --- Hooks ---
    const { showNotification, removeNotification } = useNotification();
    const { employeeOptions, phmcListData, coronerListData } = useData(); // Get lists for user validation
    
    // Function to validate if the userToMigrate is a known employee
    const validateUser = useCallback(() => {
        if (!userToMigrate.trim()) return false;
        const allEmployees = [...phmcListData, ...coronerListData];
        return allEmployees.some(emp => emp.name === userToMigrate.trim());
    }, [userToMigrate, phmcListData, coronerListData]);


    // Augment employeeOptions to always include the targetUser
    const displayEmployeeOptions = useMemo(() => {
        const defaultOptions = employeeOptions || [];
        
        // Create a flat list of all existing employee values for easy checking
        const existingEmployeeValues = defaultOptions.flatMap(group => group.options).map(opt => opt.value);

        if (userToMigrate && !existingEmployeeValues.includes(userToMigrate)) {
            // Add userToMigrate as a generic option if not already present
            const genericUserOption = { label: `${userToMigrate} (Migration Target)`, value: userToMigrate };
            // Create a new group or add to an existing 'Other' group
            const otherGroupIndex = defaultOptions.findIndex(group => group.label === 'Other Users');
            if (otherGroupIndex !== -1) {
                // If 'Other Users' group exists, add the option to it
                const newOptions = [...defaultOptions];
                newOptions[otherGroupIndex] = {
                    ...newOptions[otherGroupIndex],
                    options: [...newOptions[newOptions.length-1].options, genericUserOption]
                };
                return newOptions;
            } else {
                // Otherwise, create a new 'Other Users' group
                return [...defaultOptions, { label: 'Other Users', options: [genericUserOption] }];
            }
        }
        return defaultOptions;
    }, [employeeOptions, userToMigrate]);

    // Minimal set of dependencies for useReportManagement replaced by focused hooks
    const { 
        savedReports,
        isLoadingUserReports,
        loadUserSavedReports,
        loadReportForUser,
        checkIfMigratedReportExists, 
        countAllUserReports 
    } = useReportLoader();

    const { 
        deleteReportForUser, 
        backupUserReports: backupReports 
    } = useReportActions();

    const { saveMigratedReport } = useMigrationSaver();

    // The legacy hook required a lot of props we don't need anymore.
    // We can just rely on the specialized hooks.
    
    // --- Logic ---

    // Fetch all form definitions
    useEffect(() => {
        const formsRef = ref(database, "forms");
        const unsub = onValue(formsRef, (snap) => {
            const data = snap.val() || {};
            const list = Object.keys(data).map(key => ({ ...data[key], firebaseKey: key }));
            setForms(list);
            console.log(`[LegacyReportMigrator] Loaded ${list.length} form definitions.`);
            setIsLoadingForms(false); // Set to false after forms are loaded
        });
        return () => unsub();
    }, []);

        const migrateSingleReport = useCallback(async (report) => {
            console.log(`[migrateSingleReport] Called for report: ${report.originalKey}`);
            
            let originalBbCode = '';
            try {
                console.log(`[migrateSingleReport] Attempting to load original BBCode for: ${report.originalKey}`);
                const loadResult = await loadReportForUser(report, userToMigrate, true);
                console.log(`[migrateSingleReport] loadReportForUser completed for ${report.originalKey}. Success: ${loadResult.success}, BBCode present: ${!!loadResult.reportData.bbCode}`);
                if (loadResult.success && loadResult.reportData.bbCode) {
                    originalBbCode = loadResult.reportData.bbCode;
                } else {
                    throw new Error(`Failed to load original BBCode for "${report.originalKey}".`);
                }
            } catch (error) {
                console.error("[ERROR] Failed to load original report BBCode for migration:", error);
                throw new Error(`Failed to load original BBCode for "${report.originalKey}". ${error.message}`);
            }
    
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
                }
                else {
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
    
            // --- Specific Override for Death Reports and Mass Fatality Reports ---
            // If the originalKey indicates a Death Report, set specific formId and formName
            if (migratedReport.originalKey && migratedReport.originalKey.includes('[DEATH-REPORT]')) {
                migratedReport.formId = "coroner-report";
                migratedReport.formName = "Coroner Report";
            } else if (migratedReport.originalKey && migratedReport.originalKey.includes('[Mass Fatality Report]')) {
                migratedReport.formId = "mass-ftality-test";
                migratedReport.formName = "Mass Fatality Form";
            }
            // --- End Specific Override ---
    
            // 7. Add scenePhotosBBCode_narrative if missing
            if (!migratedReport.data.scenePhotosBBCode_narrative) {
                migratedReport.data.scenePhotosBBCode_narrative = "";
            }
    
            // 8. Set patientName if missing
            if (!migratedReport.data.patientName && migratedReport.authorName) {
                migratedReport.data.patientName = migratedReport.authorName;
            }
    
            // 9. Ensure formName is present and derived correctly
            if (!migratedReport.formName || migratedReport.formName === 'Unknown Form') { // Check for explicit 'Unknown Form' or absence
                if (migratedReport.originalKey) {
                    const match = migratedReport.originalKey.match(/\[(.*?)\]/);
                    if (match && match[1]) {
                        migratedReport.formName = match[1].replace(/-/g, ' ').trim(); // Use trim() to clean up
                    } else if (migratedReport.formId) { // Fallback to formId if originalKey parsing fails
                        migratedReport.formName = migratedReport.formId.replace(/-/g, ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                    } else {
                        migratedReport.formName = 'unknown-form';
                    }
                } else if (migratedReport.formId) { // If no originalKey but formId exists
                    migratedReport.formName = migratedReport.formId.replace(/-/g, ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                }
                else {
                    migratedReport.formName = 'Unknown Form';
                }
            }
        
            try {
                console.log(`[migrateSingleReport] Attempting to save migrated report for: ${report.originalKey}`);
                await saveMigratedReport(migratedReport, originalBbCode); // Call saveMigratedReport with originalBbCode
                console.log(`[migrateSingleReport] Successfully saved migrated report for: ${report.originalKey}`);
            } catch (error) {
                console.error("[ERROR] Failed to save migrated report:", error);
                throw new Error(`Failed to save migrated report "${migratedReport.originalKey}". ${error.message}`);
            }
            console.log(`[migrateSingleReport] Finished processing report: ${report.originalKey}`);
        }); // Closing for migrateSingleReport useCallback
    const loadUserSavedReportsStandalone = async (userId) => {
    if (!userId) return [];

    const sanitizedUserId = comprehensiveSanitize(userId);

    try {
      const legacyRef = ref(database, `savedReports/${sanitizedUserId}`);
      const newRef = ref(database, `newSavedReports/${sanitizedUserId}`);

      const [legacySnap, newSnap] = await Promise.all([
        get(legacyRef),
        get(newRef),
      ]);

      const reports = [];

      if (legacySnap.exists()) {
        legacySnap.forEach((child) => {
          reports.push({ ...child.val(), key: child.key, legacy: true });
        });
      }
      if (newSnap.exists()) {
        newSnap.forEach((child) => {
          reports.push({ ...child.val(), key: child.key, legacy: false });
        });
      }

      reports.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      console.log(`[Standalone] Loaded ${reports.length} total reports for ${userId}`);
      return reports;
    } catch (error) {
      console.error("Standalone load failed:", error);
      showNotification("Failed to load reports.", "error");
      return [];
    }
  };

  const loadSingleReportBBCode = async (report, userId) => {
    const { key: reportKey, legacy = true } = report;
    const sanitizedUserId = comprehensiveSanitize(userId);

    const basePath = legacy ? "savedReportBBCode" : "newSavedReportBBCode";
    const primaryPath = `${basePath}/${sanitizedUserId}/${reportKey}`;
    const fallbackPaths = legacy
      ? [`newSavedReportBBCode/${sanitizedUserId}/${reportKey}`]
      : [`savedReportBBCode/${sanitizedUserId}/${reportKey}`];

    try {
      let snap = await get(ref(database, primaryPath));
      if (snap.exists() && snap.val()?.bbCode) {
        return snap.val().bbCode;
      }

      for (const path of fallbackPaths) {
        snap = await get(ref(database, path));
        if (snap.exists() && snap.val()?.bbCode) {
          return snap.val().bbCode;
        }
      }

      return null;
    } catch (error) {
      console.error("BBCode load failed:", error);
      return null;
    }
  };
const startMigration = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setMigrationStage('backup');
    setMigrationStatus('Creating backup...');

    const backupResult = await backupReports(userToMigrate);
    if (!backupResult.success) {
      showNotification('Backup failed!', 'error');
      setIsProcessing(false);
      return;
    }
    setBackupPath(backupResult.path);
    setMigrationStatus('Loading reports...');

    const allReports = await loadUserSavedReportsStandalone(userToMigrate);
    const legacyReports = allReports.filter(r => r.legacy === true && (r.originalKey?.includes('[DEATH-REPORT]') || r.originalKey?.includes('[Mass Fatality Report]')));

    if (legacyReports.length === 0) {
      showNotification('No legacy death reports found to migrate.', 'warning');
      setIsProcessing(false);
      return;
    }

    setReportsToMigrate(legacyReports);
    setTotalReportsToMigrate(legacyReports.length);
    setMigrationStage('migrate');
    setMigrationStatus('Migrating reports...');

    let processed = 0;
    for (const report of legacyReports) {
      processed++;
      setProgress((processed / legacyReports.length) * 100);

      try {
        const bbCode = await loadSingleReportBBCode(report, userToMigrate);
        if (!bbCode) {
          console.warn(`No BBCode for ${report.originalKey}, skipping save`);
        }

        const cleanedReport = {
          ...report,
          legacy: false,
          formId: "coroner-report",
          formName: "Coroner Report",
          bbCodeVersion: undefined,
        };
        delete cleanedReport.bbCodeVersion;

        await saveMigratedReport(cleanedReport, bbCode || '');

        await deleteReportForUser(report, userToMigrate);
        setSuccessfulMigrations(prev => prev + 1);
        console.log(`Migrated: ${report.originalKey}`);
      } catch (err) {
        console.error(`Failed: ${report.originalKey}`, err);
        setFailedMigrations(prev => prev + 1);
      }
    }

    setMigrationStage('complete');
    setMigrationStatus('Done!');
    setIsProcessing(false);
    showNotification('Migration complete!', 'success');
  };
  const comprehensiveSanitize = (str) => {
  if (!str) return '';
  let sanitized = str.trim().replace(/[.#$[\/ \]]+/g, '_');
  sanitized = sanitized.replace(/_{2,}/g, '_');
  sanitized = sanitized.replace(/^_+|_+$/g, '');
  return sanitized;
};
  const handleLoadReportsClick = useCallback(async () => { // Make async
                if (!userToMigrate.trim()) {
                    showNotification('Please enter a user name.', 'warning');
                    return;
                }
                if (!validateUser()) {
                    showNotification(`User "${userToMigrate}" is not a recognized PHMC or Coroner employee. Please ensure the name is correct.`, 'error');
                    return;
                }
        
                // Call countAllUserReports here
                const count = await countAllUserReports(userToMigrate);
                setTotalSavedReports(count); // Update the new state variable
                console.log(`[LegacyReportMigrator] User ${userToMigrate} has a total of ${count} reports.`); // Debugging
        
                setMigrationStage('confirm');
                setMigrationStatus(`Ready to migrate reports for "${userToMigrate}".`);
            }, [userToMigrate, validateUser, showNotification, countAllUserReports]); // Add countAllUserReports to dependencies
                // --- Render ---

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1100, display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={onClose}>
            <div style={{ background: '#0d1117', padding: '25px', borderRadius: '10px', color: 'white', maxWidth: '500px', width: '90%' }} onClick={e => e.stopPropagation()}>
                <h3 style={{ borderBottom: '1px solid #30363d', paddingBottom: '15px', marginBottom: '20px' }}>Legacy Report Migration</h3>

                {migrationStage === 'input' && (
                    <>
                        <p>Enter the full character name of the user whose reports you want to migrate.</p>
                        <div className="form-group mb-3">
                            <input
                                type="text"
                                className="form-control"
                                value={userToMigrate}
                                onChange={(e) => setUserToMigrate(e.target.value)}
                                placeholder="e.g., Alyson Frost"
                                disabled={isProcessing}
                            />
                        </div>
                        <div className="d-flex justify-content-between">
                            <Button onClick={handleLoadReportsClick} disabled={isProcessing || isLoadingForms}>
                                Check User
                            </Button>
                            <Button variant="secondary" onClick={onClose} disabled={isProcessing}>
                                Cancel
                            </Button>
                        </div>
                    </>
                )}

                {migrationStage === 'confirm' && (
                    <>
                        <p className="lead">Ready to migrate reports for:</p>
                        <h4 className="text-info mb-3">{userToMigrate}</h4>
                        <p>Total reports found for this user: <strong>{totalSavedReports}</strong></p> {/* New line */}
                        <p>This process will:</p>
                        <ul>
                            <li>Backup all existing reports for this user.</li>
                            <li>Load all legacy reports.</li>
                            <li>Convert and save them in the new format (removing the 'legacy' flag).</li>
                            <li>Handle duplicate report names safely.</li>
                        </ul>
                        <p className="text-warning">This process can take a few moments. Please do not close this window.</p>
                        <div className="d-flex justify-content-between mt-4">
                            <Button onClick={startMigration} disabled={isProcessing}>
                                Start Migration
                            </Button>
                            <Button variant="secondary" onClick={() => setMigrationStage('input')} disabled={isProcessing}>
                                Back
                            </Button>
                            <Button variant="danger" onClick={onClose} disabled={isProcessing}>
                                Cancel
                            </Button>
                        </div>
                    </>
                )}

                {(migrationStage === 'backup' || migrationStage === 'migrate') && (
                    <>
                        <p className="lead">{migrationStatus}</p>
                        <div className="progress mb-3" style={{ height: '25px' }}>
                            <div
                                className="progress-bar"
                                role="progressbar"
                                style={{ width: `${progress}%` }}
                                aria-valuenow={progress}
                                aria-valuemin="0"
                                aria-valuemax="100"
                            >
                                {progress.toFixed(1)}%
                            </div>
                        </div>
                        <p>Total: {totalReportsToMigrate}, Successful: {successfulMigrations}, Failed: {failedMigrations}</p>
                        <p className="text-muted small">Backup Path: {backupPath || 'N/A'}</p>
                    </>
                )}

                {migrationStage === 'complete' && (
                    <>
                        <p className="lead text-success">Migration Complete!</p>
                        <p>Processed {totalReportsToMigrate} reports.</p>
                        <p className="text-success">Successful: {successfulMigrations}</p>
                        <p className="text-danger">Failed: {failedMigrations}</p>
                        {backupPath && <p className="text-muted small">Backup stored at: {backupPath}</p>}
                        <div className="d-flex justify-content-end mt-4">
                            <Button onClick={onClose}>
                                Done
                            </Button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default LegacyReportMigrator;