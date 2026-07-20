import { logAdminAction, getUserContext, logDataVersionBump } from '../../utils/logging';
import useGtaWorldAuth from '../../hooks/useGtaWorldAuth';
import useFactionPermissions from '../../hooks/useFactionPermissions';
import React, { useState, useCallback, useEffect } from 'react';
import { Card, Button, Alert, Table, Badge, Spinner, Tabs, Tab, Form } from 'react-bootstrap';
import { useDropzone } from 'react-dropzone';
import { httpsCallable } from 'firebase/functions';
import { ref, get, set, remove } from 'firebase/database';
import { functions, database } from '../../firebase';
import * as Sentry from "@sentry/react";

/**
 * Faction Data Upload Component
 * Handles CSV file upload, parsing, and preview for faction member data
 */
const FactionDataUpload = ({ showNotification }) => {
    const { user: gtawUser, username: gtawUsername } = useGtaWorldAuth();
    const { permissions } = useFactionPermissions();
    const [uploadStatus, setUploadStatus] = useState('idle'); // idle, uploading, preview, success, error
    const [uploadedFile, setUploadedFile] = useState(null);
    const [parsedData, setParsedData] = useState(null);
    const [uploadResult, setUploadResult] = useState(null);
    const [error, setError] = useState(null);
    
    // Database content state
    const [storedData, setStoredData] = useState(null);
    const [loadingStored, setLoadingStored] = useState(false);
    const [isRevoking, setIsRevoking] = useState(null); // ID of member being revoked
    const [activeTab, setActiveTab] = useState('upload');
    const [lastUpdateInfo, setLastUpdateInfo] = useState(null);

    // Remote Sync State
    const [isSyncing, setIsSyncing] = useState(false);
    const [isUploadingAuth, setIsUploadingAuth] = useState(false);

    const handleRevokeMember = async (member) => {
        if (!member || !member.characterId) return;

        const confirmMessage = `ARE YOU SURE?\n\nThis will PERMANENTLY remove ${member.characterName} (ID: ${member.characterId}) from the local database.\n\nIF THEY ARE CURRENTLY LOGGED IN, THEIR SESSION WILL BE INSTANTLY TERMINATED.`;
        
        if (!window.confirm(confirmMessage)) return;

        setIsRevoking(member.characterId);
        try {
            const { userAgent, timeZone } = getUserContext();
            
            // 1. Remove from database
            await remove(ref(database, `factions/364/members/${member.characterId}`));

            // 2. Update version to trigger cache invalidation
            const factionsVersionRef = ref(database, 'appMetadata/factionsDataVersion');
            await set(factionsVersionRef, Date.now());
            logDataVersionBump('appMetadata/factionsDataVersion', 'FactionDataUpload', 'Removed member: ' + member.characterName);

            // 3. Log action
            logAdminAction(
                gtawUsername,
                'Revoked Faction Membership',
                `Target: ${member.characterName} (ID: ${member.characterId})\nAction: Manual Revocation/Removal`,
                'Faction Data Management',
                userAgent,
                timeZone,
                gtawUsername,
                gtawUser
            );

            showNotification && showNotification(`Successfully revoked access for ${member.characterName}.`, 'success');
            
            // Refresh local state
            await loadStoredFactionData();
        } catch (err) {
            console.error('[Faction Data] Revoke error:', err);
            showNotification && showNotification(`Failed to revoke access: ${err.message}`, 'error');
            Sentry.captureException(err);
        } finally {
            setIsRevoking(null);
        }
    };

    const handleTriggerRemoteSync = async () => {
        setIsSyncing(true);
        try {
            const triggerSync = httpsCallable(functions, 'triggerFactionSync');
            const result = await triggerSync();
            
            if (result.data.success) {
                showNotification(`Successfully synced ${result.data.count} members!`, 'success');
                loadStoredFactionData();
            } else {
                showNotification(`Sync failed: ${result.data.error}`, 'error');
            }
        } catch (error) {
            showNotification(`Error triggering sync: ${error.message}`, 'error');
        } finally {
            setIsSyncing(false);
        }
    };

    const handleUploadAuthState = async (file) => {
        setIsUploadingAuth(true);
        try {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const storageState = JSON.parse(e.target.result);
                    const updateAuth = httpsCallable(functions, 'updateAuthState');
                    const result = await updateAuth({ storageState, path: '/factions/364/ucp_auth_state' });
                    
                    if (result.data.success) {
                        showNotification('UCP Auth State updated successfully!', 'success');
                        if (result.data.syncResult?.success) {
                            showNotification(`Initial sync successful: ${result.data.syncResult.count} members.`, 'success');
                            loadStoredFactionData();
                        }
                    }
                } catch (err) {
                    showNotification(`Failed to process auth file: ${err.message}`, 'error');
                } finally {
                    setIsUploadingAuth(false);
                }
            };
            reader.readAsText(file);
        } catch (error) {
            showNotification(`Error reading file: ${error.message}`, 'error');
            setIsUploadingAuth(false);
        }
    };

    // CSV file processing
    const parseCSVFile = useCallback((file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const text = e.target.result;
                    const lines = text.split('\n').filter(line => line.trim());
                    
                    if (lines.length < 2) {
                        reject(new Error('CSV file must contain at least a header and one data row'));
                        return;
                    }

                    // Parse header
                    const header = lines[0].split(',').map(col => col.replace(/"/g, '').trim());
                    console.log('[CSV Parser] Header:', header);

                    // Find column indices
                    const characterIdIndex = 1; // Column #
                    const characterNameIndex = 2; // Character
                    const rankIndex = 3; // Rank
                    const scriptRankIndex = 4; // (( Script Rank ))

                    // Parse data rows (skip header)
                    const parsed = [];
                    const errors = [];

                    for (let i = 1; i < lines.length; i++) {
                        const line = lines[i];
                        if (!line.trim()) continue;

                        // Parse CSV row (handle quoted values)
                        const columns = [];
                        let current = '';
                        let inQuotes = false;
                        
                        for (let j = 0; j < line.length; j++) {
                            const char = line[j];
                            if (char === '"') {
                                inQuotes = !inQuotes;
                            } else if (char === ',' && !inQuotes) {
                                columns.push(current.trim());
                                current = '';
                            } else {
                                current += char;
                            }
                        }
                        columns.push(current.trim()); // Add last column

                        // Extract required data
                        const characterId = columns[characterIdIndex]?.replace(/"/g, '').trim();
                        const characterName = columns[characterNameIndex]?.replace(/"/g, '').trim();
                        const rank = columns[rankIndex]?.replace(/"/g, '').trim();
                        const scriptRankStr = columns[scriptRankIndex]?.replace(/"/g, '').trim();
                        const scriptRank = parseInt(scriptRankStr);

                        // Validation
                        if (!characterId || !characterName || !rank || isNaN(scriptRank)) {
                            errors.push(`Line ${i + 1}: Missing or invalid data - ID: ${characterId}, Name: ${characterName}, Rank: ${rank}, ScriptRank: ${scriptRankStr}`);
                            continue;
                        }

                        parsed.push({
                            characterId: parseInt(characterId),
                            characterName,
                            rank,
                            scriptRank,
                            lastDuty: columns[5]?.replace(/"/g, '').trim() || null,
                            lastOnline: columns[6]?.replace(/"/g, '').trim() || null,
                            activity: columns[7]?.replace(/"/g, '').trim() || null,
                            lineNumber: i + 1
                        });
                    }

                    resolve({
                        totalRows: lines.length - 1,
                        validRows: parsed.length,
                        errors,
                        data: parsed,
                        fileName: file.name,
                        fileSize: file.size,
                        uploadTime: new Date().toISOString()
                    });

                } catch (error) {
                    reject(new Error(`Failed to parse CSV: ${error.message}`));
                }
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }, []);

    // Load stored faction data from database
    const loadStoredFactionData = useCallback(async () => {
        setLoadingStored(true);
        setError(null); // Clear any previous errors
        
        try {
            const factionId = 364; // PHMC faction ID
            
            // Load current faction data from the correct path
            const factionRef = ref(database, `factions/${factionId}`);
            const factionSnapshot = await get(factionRef);
            
            if (factionSnapshot.exists()) {
                const factionData = factionSnapshot.val();
                const members = factionData.members || {};
                const metadata = factionData.metadata || {};
                
                // Check if members object has any data
                if (Object.keys(members).length === 0) {
                    setStoredData([]);
                    setLastUpdateInfo(metadata.lastUpdated ? {
                        uploadTime: metadata.lastUpdated,
                        uploadedBy: metadata.uploadedBy,
                        fileName: metadata.fileName,
                        statistics: metadata.statistics
                    } : null);
                    showNotification && showNotification('No faction members found in database', 'warning');
                    return;
                }
                
                // Convert to array format for display
                const memberArray = Object.entries(members).map(([characterId, memberData]) => ({
                    characterId: parseInt(characterId),
                    ...memberData
                }));
                
                // Sort by script rank (highest first), then by character name
                memberArray.sort((a, b) => {
                    if (b.scriptRank !== a.scriptRank) {
                        return b.scriptRank - a.scriptRank;
                    }
                    return a.characterName.localeCompare(b.characterName);
                });
                
                setStoredData(memberArray);
                setLastUpdateInfo({
                    uploadTime: metadata.lastUpdated,
                    uploadedBy: metadata.uploadedBy,
                    fileName: metadata.fileName,
                    statistics: metadata.statistics
                });
                
                showNotification && showNotification(
                    `Loaded ${memberArray.length} faction members from database`,
                    'success'
                );
            } else {
                setStoredData([]);
                setLastUpdateInfo(null);
                showNotification && showNotification('No faction data found in database', 'info');
            }
        } catch (error) {
            console.error('[Faction Data] Error loading stored data:', error);
            setError(`Failed to load stored data: ${error.message}`);
            setStoredData(null); // Set to null to indicate error state
            showNotification && showNotification(`Failed to load stored data: ${error.message}`, 'error');
        } finally {
            setLoadingStored(false);
        }
    }, [showNotification]);

    // Load metadata on component mount for counter, full data when switching to stored tab
    useEffect(() => {
        // Prevent infinite loops by checking if we're already loading
        if (loadingStored) return;
        
        if (activeTab === 'stored') {
            // Always load data when switching to stored tab (unless we already have valid data)
            if (storedData === null || (error && storedData === null)) {
                console.log('[Faction Data] Loading stored data due to tab switch to stored');
                loadStoredFactionData();
            }
        } else {
            // Load just metadata for counter display when not on stored tab
            const loadCountOnly = async () => {
                try {
                    const snapshot = await get(ref(database, 'factions/364/metadata'));
                    const metadata = snapshot.val();
                    
                    if (metadata && metadata.statistics && metadata.statistics.validRecords) {
                        // Create a minimal array just for count display
                        setStoredData(new Array(metadata.statistics.validRecords));
                    } else {
                        setStoredData([]);
                    }
                } catch (error) {
                    console.error('[Faction Data] Error loading count:', error);
                    setStoredData([]);
                }
            };
            
            // Only load count if we don't have data yet and we're not on stored tab
            if (storedData === null) {
                console.log('[Faction Data] Loading count metadata for non-stored tab');
                loadCountOnly();
            }
        }
    }, [activeTab, loadStoredFactionData]); // Removed storedData and error from dependencies

    // Initial data load on component mount
    useEffect(() => {
        // Load initial data based on the starting tab
        if (activeTab === 'stored' && storedData === null && !loadingStored) {
            console.log('[Faction Data] Initial load for stored tab');
            loadStoredFactionData();
        } else if (activeTab !== 'stored' && storedData === null && !loadingStored) {
            // Load count metadata for initial display
            const loadInitialCount = async () => {
                try {
                    const snapshot = await get(ref(database, 'factions/364/metadata'));
                    const metadata = snapshot.val();
                    
                    if (metadata && metadata.statistics && metadata.statistics.validRecords) {
                        setStoredData(new Array(metadata.statistics.validRecords));
                    } else {
                        setStoredData([]);
                    }
                } catch (error) {
                    console.error('[Faction Data] Error loading initial count:', error);
                    setStoredData([]);
                }
            };
            
            console.log('[Faction Data] Initial count load for upload tab');
            loadInitialCount();
        }
    }, []); // Empty dependency array - only run on mount

    // Dropzone configuration
    const onDrop = useCallback(async (acceptedFiles) => {
        const file = acceptedFiles[0];
        if (!file) return;

        setUploadStatus('uploading');
        setError(null);
        setUploadedFile(file);

        try {
            console.log('[Faction Upload] Processing CSV file:', file.name);
            const parsed = await parseCSVFile(file);
            
            console.log('[Faction Upload] Parsed data:', {
                totalRows: parsed.totalRows,
                validRows: parsed.validRows,
                errorCount: parsed.errors.length
            });

            setParsedData(parsed);
            setUploadStatus('preview');
            
            if (parsed.errors.length > 0) {
                showNotification && showNotification(
                    `CSV parsed with ${parsed.errors.length} errors. Please review before uploading.`,
                    'warning'
                );
            } else {
                showNotification && showNotification(
                    `Successfully parsed ${parsed.validRows} faction members from CSV`,
                    'success'
                );
            }

        } catch (error) {
            console.error('[Faction Upload] Parse error:', error);
            setError(error.message);
            setUploadStatus('error');
            showNotification && showNotification(`Failed to parse file: ${error.message}`, 'error');
        }
    }, [parseCSVFile, showNotification]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'text/csv': ['.csv'],
            'application/vnd.ms-excel': ['.csv']
        },
        multiple: false,
        disabled: uploadStatus === 'uploading'
    });

    // Reusable upload logic
    const performFactionDataUpload = async (dataToUpload, fileName) => {
        try {
            const { userAgent, timeZone } = getUserContext();
            logAdminAction(
                gtawUsername,
                'Uploaded Faction Data',
                `File: ${fileName}\nRows: ${dataToUpload.length}`,
                'Faction Data Management',
                userAgent,
                timeZone,
                gtawUsername,
                gtawUser
            );

            console.log('[Faction Upload] Uploading to Firebase...');
            
            // 1. Fetch current Discord information to preserve manual entries
            let preservedDiscordInfo = {};
            try {
                const snapshot = await get(ref(database, 'factions/364/members'));
                if (snapshot.exists()) {
                    const members = snapshot.val();
                    Object.entries(members).forEach(([id, data]) => {
                        if (data.discordName || data.discord) {
                            preservedDiscordInfo[id] = data.discordName || data.discord;
                        }
                    });
                    console.log(`[Faction Upload] Preserving Discord info for ${Object.keys(preservedDiscordInfo).length} members.`);
                }
            } catch (err) {
                console.warn('[Faction Upload] Failed to fetch existing members for merging:', err);
            }

            // 2. Merge preserved Discord info into new dataToUpload
            const mergedData = dataToUpload.map(member => {
                const preservedDiscord = preservedDiscordInfo[member.characterId];
                if (preservedDiscord) {
                    return { 
                        ...member, 
                        discordName: preservedDiscord, 
                        discord: preservedDiscord 
                    };
                }
                return member;
            });

            // 3. Hard-clear previous members to avoid stale entries and unnecessary storage
            try {
                showNotification && showNotification('Clearing previous faction member records…', 'info');
                await set(ref(database, 'factions/364/members'), null);
                console.log('[Faction Upload] Cleared existing factions/364/members');
            } catch (clearErr) {
                console.warn('[Faction Upload] Failed to clear existing members before upload:', clearErr);
                showNotification && showNotification('Warning: Could not clear previous records. Proceeding with upload.', 'warning');
            }
            
            const uploadFactionData = httpsCallable(functions, 'uploadFactionData');
            const result = await uploadFactionData({
                factionData: mergedData,
                metadata: {
                    fileName: fileName,
                    totalRows: dataToUpload.length,
                    validRows: dataToUpload.length,
                    uploadTime: new Date().toISOString(),
                    factionId: 364 // PHMC
                }
            });

            // Update factionsDataVersion to trigger cache invalidation for all users
            try {
                const factionsVersionRef = ref(database, 'appMetadata/factionsDataVersion');
                await set(factionsVersionRef, Date.now());
                logDataVersionBump('appMetadata/factionsDataVersion', 'FactionDataUpload', 'Uploaded faction data');
                console.log('[Faction Upload] Successfully updated factionsDataVersion.');
                showNotification && showNotification('Forcing cache refresh for all clients.', 'info');
            } catch (versionError) {
                console.error('[Faction Upload] Failed to update factionsDataVersion:', versionError);
                Sentry.captureException(versionError, { extra: { context: 'FactionDataUpload - Update Version' } });
                showNotification && showNotification('Warning: Could not update the faction data version. Caches may be stale.', 'warning');
            }

            // Clear the audit trail after successful upload
            try {
                const auditRef = ref(database, 'audit/faction_uploads/');
                await set(auditRef, null);
                console.log('[Faction Upload] Successfully cleared audit trail.');
            } catch (auditError) {
                console.error('[Faction Upload] Failed to clear audit trail:', auditError);
                Sentry.captureException(auditError, { extra: { context: 'FactionDataUpload - Clear Audit' } });
                showNotification && showNotification('Warning: Could not clear the faction upload audit trail.', 'warning');
            }

            console.log('[Faction Upload] Upload result:', result.data);
            return { success: true, data: result.data };
        } catch (error) {
            console.error('[Faction Upload] Upload error:', error);
            Sentry.captureException(error, {
                extra: { context: 'Faction Data Upload' }
            });
            setError(error.message);
            setUploadStatus('error');
            showNotification && showNotification(`Upload failed: ${error.message}`, 'error');
            return { success: false, error: error.message };
        }
    };

    // Upload to Firebase from UI
    const handleUploadToFirebase = async () => {
        if (!parsedData) return;

        setUploadStatus('uploading');
        setError(null);

        const result = await performFactionDataUpload(parsedData.data, parsedData.fileName);

        if (result.success) {
            setUploadResult(result.data);
            setUploadStatus('success');
            showNotification && showNotification(
                `Successfully uploaded ${parsedData.validRows} faction members to database`,
                'success'
            );
        }
    };

    // Reset for new upload
    const handleReset = () => {
        setUploadStatus('idle');
        setUploadedFile(null);
        setParsedData(null);
        setUploadResult(null);
        setError(null);
    };

    // Render upload area
    const renderUploadArea = () => (
        <div
            {...getRootProps()}
            className={`border-2 border-dashed p-4 text-center cursor-pointer transition-colors ${isDragActive ? 'border-primary bg-light' : 'border-secondary'} ${uploadStatus === 'uploading' ? 'opacity-50' : ''}`}
            style={{ minHeight: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
            <input {...getInputProps()} />
            <div>
                {uploadStatus === 'uploading' ? (
                    <>
                        <Spinner animation="border" className="mb-3" />
                        <p className="mb-0">Processing file...</p>
                    </>
                ) : (
                    <>
                        <i className="fas fa-cloud-upload-alt fa-3x text-muted mb-3"></i>
                        <p className="mb-2">
                            {isDragActive ? 'Drop the file here' : 'Drag & drop faction CSV file here, or click to select'}
                        </p>
                        <p className="text-muted small mb-0">
                            Supports standard CSV exports from the GTA World UCP.
                        </p>
                    </>
                )}
            </div>
        </div>
    );

    // Render data preview
    const renderPreview = () => (
        <div className="mt-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
                <h5>Data Preview</h5>
                <div className="d-flex gap-2">
                    <Button variant="outline-secondary" size="sm" onClick={handleReset} className="admin-btn">
                        Different File
                    </Button>
                    <Button variant="success" size="sm" onClick={handleUploadToFirebase} disabled={parsedData?.errors?.length > 0} className="admin-btn">
                        <i className="fas fa-upload me-2"></i> Sync Database
                    </Button>
                </div>
            </div>

            {/* Summary */}
            <div className="row mb-3">
                <div className="col-md-3">
                    <Card className="text-center">
                        <Card.Body>
                            <h4 className="text-primary">{parsedData?.validRows || 0}</h4>
                            <small className="text-muted">Valid Records</small>
                        </Card.Body>
                    </Card>
                </div>
                <div className="col-md-3">
                    <Card className="text-center">
                        <Card.Body>
                            <h4 className="text-danger">{parsedData?.errors?.length || 0}</h4>
                            <small className="text-muted">Errors</small>
                        </Card.Body>
                    </Card>
                </div>
                <div className="col-md-3">
                    <Card className="text-center">
                        <Card.Body>
                            <h4 className="text-info">{Math.max(...(parsedData?.data?.map(d => d.scriptRank) || [0]))}</h4>
                            <small className="text-muted">Highest Rank</small>
                        </Card.Body>
                    </Card>
                </div>
                <div className="col-md-3">
                    <Card className="text-center">
                        <Card.Body>
                            <h4 className="text-success">{parsedData?.fileName}</h4>
                            <small className="text-muted">File Name</small>
                        </Card.Body>
                    </Card>
                </div>
            </div>

            {/* Errors */}
            {parsedData?.errors?.length > 0 && (
                <Alert variant="warning">
                    <Alert.Heading>Data Parsing Errors</Alert.Heading>
                    <ul className="mb-0">
                        {parsedData.errors.slice(0, 10).map((error, index) => (
                            <li key={index}>{error}</li>
                        ))}
                        {parsedData.errors.length > 10 && (
                            <li><em>...and {parsedData.errors.length - 10} more errors</em></li>
                        )}
                    </ul>
                </Alert>
            )}

            {/* Data table */}
            <Table striped bordered hover responsive size="sm">
                <thead>
                    <tr>
                        <th>Character ID</th>
                        <th>Character Name</th>
                        <th>Rank</th>
                        <th>Script Rank</th>
                        <th>Last Online</th>
                        <th>Activity</th>
                    </tr>
                </thead>
                <tbody>
                    {parsedData?.data?.slice(0, 20).map((member, index) => (
                        <tr key={index}>
                            <td>{member.characterId}</td>
                            <td>{member.characterName}</td>
                            <td>{member.rank}</td>
                            <td>
                                <Badge 
                                    bg={member.scriptRank >= 13 ? 'danger' : member.scriptRank >= 10 ? 'warning' : member.scriptRank >= 7 ? 'info' : 'secondary'}
                                >
                                    {member.scriptRank}
                                </Badge>
                            </td>
                            <td className="small">{member.lastOnline}</td>
                            <td className="small">{member.activity}</td>
                        </tr>
                    ))}
                </tbody>
            </Table>
            
            {parsedData?.data?.length > 20 && (
                <p className="text-muted text-center">
                    Showing first 20 of {parsedData.data.length} records
                </p>
            )}
        </div>
    );

    return (
        <div className="admin-section">
            <div className="d-flex justify-content-between align-items-center mb-5">
                <h2 className="mb-0 fw-800"><i className="fas fa-users me-3 text-indigo"></i>Faction Member Sync</h2>
            </div>

            <Tabs 
                activeKey={activeTab} 
                onSelect={(k) => setActiveTab(k)}
                className="mb-4"
                variant="pills"
            >
                <Tab eventKey="upload" title={<span><i className="fas fa-upload me-2"></i>Bulk Import</span>}>
                    <div className="card border-0 shadow-sm">
                        <div className="card-body p-4">
                            <p className="text-muted small mb-4">
                                <i className="fas fa-info-circle me-2 text-indigo"></i>
                                Upload a CSV or Excel file exported from the GTAWorld UCP to sync member data.
                                <a href="https://ucp.gta.world/view/faction/364/populate?..." target="_blank" rel="noopener noreferrer" className="ms-2 text-indigo text-decoration-none fw-bold">Open UCP Export <i className="fas fa-external-link-alt small"></i></a>
                            </p>

                            {activeTab === 'upload' && (
                                <div className="admin-section">
                                    {uploadStatus === 'idle' && renderUploadArea()}
                                    {uploadStatus === 'uploading' && renderUploadArea()}
                                    {uploadStatus === 'preview' && renderPreview()}
                                    
                                    {uploadStatus === 'success' && (
                                        <Alert variant="success" className="border-0 shadow-sm">
                                            <Alert.Heading className="fw-bold">Synchronization Successful!</Alert.Heading>
                                            <p>Faction member data has been verified and committed to the database.</p>
                                            <hr className="opacity-10" />
                                            <div className="d-flex gap-2">
                                                <Button variant="outline-success" onClick={handleReset} className="admin-btn small">Import Another</Button>
                                                <Button variant="primary" onClick={() => setActiveTab('stored')} className="admin-btn small">View Live Database</Button>
                                            </div>
                                        </Alert>
                                    )}
                                    
                                    {error && (
                                        <Alert variant="danger" className="border-0 shadow-sm">
                                            <Alert.Heading className="fw-bold">Processing Error</Alert.Heading>
                                            <p>{error}</p>
                                            <hr className="opacity-10" />
                                            <Button variant="outline-danger" onClick={handleReset} className="admin-btn small">Try Again</Button>
                                        </Alert>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </Tab>
                
                {permissions.includes('superadmin_access') && (
                    <Tab eventKey="remote" title={<span><i className="fas fa-sync-alt me-2"></i>UCP Cloud Sync</span>}>
                        {activeTab === 'remote' && (
                            <div className="admin-section">
                                <Alert variant="info" className="border-0 shadow-sm mb-4">
                                    <Alert.Heading className="fw-bold">UCP Remote Synchronization</Alert.Heading>
                                    <p>Automate member syncing using session cookies. The system fetches fresh data daily at 09:00 UTC.</p>
                                </Alert>

                                <div className="row g-4">
                                    <div className="col-md-6">
                                        <div className="card h-100 border-indigo border-opacity-25 bg-indigo bg-opacity-5">
                                            <div className="card-body p-4">
                                                <h6 className="text-indigo uppercase fw-bold small mb-3">1. Identity Authentication</h6>
                                                <p className="small text-muted mb-4">If sync fails with "Session Expired", upload a fresh <code>ucp-auth-state.json</code> file.</p>
                                                <input type="file" id="auth-file-input" accept=".json" style={{ display: 'none' }} onChange={(e) => e.target.files[0] && handleUploadAuthState(e.target.files[0])} />
                                                <Button variant="primary" disabled={isUploadingAuth} onClick={() => document.getElementById('auth-file-input').click()} className="w-100 admin-btn">
                                                    {isUploadingAuth ? <Spinner size="sm" /> : <><i className="fas fa-key me-2"></i>Upload Session State</>}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="col-md-6">
                                        <div className="card h-100 border-success border-opacity-25 bg-success bg-opacity-5">
                                            <div className="card-body p-4">
                                                <h6 className="text-success uppercase fw-bold small mb-3">2. Manual Trigger</h6>
                                                <p className="small text-muted mb-4">Force an immediate background sync to update the live database with UCP data.</p>
                                                <Button variant="success" disabled={isSyncing} onClick={handleTriggerRemoteSync} className="w-100 admin-btn">
                                                    {isSyncing ? <Spinner size="sm" /> : <><i className="fas fa-sync me-2"></i>Trigger Cloud Sync</>}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {lastUpdateInfo && (
                                    <div className="card mt-4 border-0 shadow-sm bg-dark bg-opacity-50">
                                        <div className="card-body p-4">
                                            <h6 className="text-indigo small uppercase fw-bold mb-3"><i className="fas fa-history me-2"></i>Last Synchronization Status</h6>
                                            <div className="row g-3 small">
                                                <div className="col-sm-3 text-muted uppercase fw-bold x-small">Timestamp:</div>
                                                <div className="col-sm-9 fw-bold">{new Date(lastUpdateInfo.uploadTime).toLocaleString()}</div>
                                                <div className="col-sm-3 text-muted uppercase fw-bold x-small">Initiated By:</div>
                                                <div className="col-sm-9 fw-bold">{lastUpdateInfo.uploadedBy}</div>
                                                {lastUpdateInfo.statistics && (
                                                    <>
                                                        <div className="col-sm-3 text-muted uppercase fw-bold x-small">Records:</div>
                                                        <div className="col-sm-9"><span className="admin-badge admin-badge-success">{lastUpdateInfo.statistics.validRecords} members</span></div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </Tab>
                )}

                <Tab eventKey="stored" title={<span><i className="fas fa-database me-2"></i>Live Database ({storedData?.length || 0})</span>}>
                    {activeTab === 'stored' && (
                        <div className="admin-section">
                            <div className="card border-0 shadow-sm mb-4">
                                <div className="card-body p-4">
                                    <div className="d-flex justify-content-between align-items-start mb-4">
                                        <div>
                                            <h6 className="mb-1 fw-bold">Live Member Registry</h6>
                                            {lastUpdateInfo && lastUpdateInfo.uploadTime && (
                                                <p className="text-muted small mb-0 italic">
                                                    Last updated: {new Date(lastUpdateInfo.uploadTime).toLocaleString()} 
                                                    {lastUpdateInfo.uploadedBy && ` by ${lastUpdateInfo.uploadedBy}`}
                                                </p>
                                            )}
                                        </div>
                                        <Button variant="outline-primary" size="sm" onClick={loadStoredFactionData} disabled={loadingStored} className="admin-btn">
                                            {loadingStored ? <Spinner animation="border" size="sm" /> : <><i className="fas fa-sync me-2"></i>Refresh Registry</>}
                                        </Button>
                                    </div>

                                    {loadingStored && !storedData && (
                                        <div className="text-center py-5"><Spinner animation="border" variant="primary" /></div>
                                    )}

                                    {storedData && storedData.length > 0 && (
                                        <>
                                            <div className="admin-stat-row mb-4">
                                                <div className="admin-stat-card py-3">
                                                    <span className="stat-label">Total Registry</span>
                                                    <span className="stat-value">{storedData.length}</span>
                                                </div>
                                                <div className="admin-stat-card py-3">
                                                    <span className="stat-label">Active (ABAS &gt;= 0.25)</span>
                                                    <span className="stat-value text-success">{storedData.filter(m => parseFloat(m.activity || '0') >= 0.25).length}</span>
                                                </div>
                                                <div className="admin-stat-card py-3">
                                                    <span className="stat-label">Inactive / Low Duty</span>
                                                    <span className="stat-value text-warning">{storedData.filter(m => parseFloat(m.activity || '0') < 0.25).length}</span>
                                                </div>
                                            </div>
                                            
                                            <div className="admin-modern-table">
                                                <Table hover responsive>
                                                    <thead>
                                                        <tr>
                                                            <th>ID</th>
                                                            <th>Character Name</th>
                                                            <th>Rank</th>
                                                            <th className="text-center">Script</th>
                                                            <th className="text-center">ABAS</th>
                                                            <th className="text-center">Access Level</th>
                                                            <th className="text-end">Actions</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {storedData.map((member) => {
                                                            const activityVal = member.activity;
                                                            const isMissingData = activityVal === 'MISSING_DATA';
                                                            const activity = isMissingData ? 0 : parseFloat(activityVal || '0');
                                                            
                                                            let accessLevel = 'Member';
                                                            let levelClass = 'admin-badge-indigo';
                                                            if (member.scriptRank >= 14) { accessLevel = 'Leadership'; levelClass = 'admin-badge-danger'; }
                                                            else if (member.scriptRank >= 13) { accessLevel = 'Senior Mgmt'; levelClass = 'admin-badge-warning'; }
                                                            else if (member.scriptRank >= 11) { accessLevel = 'Supervisor'; levelClass = 'admin-badge-indigo'; }

                                                            let activityClass = 'admin-badge-success';
                                                            if (isMissingData) activityClass = 'admin-badge-warning';
                                                            else if (activity < 0.25) activityClass = 'admin-badge-danger';
                                                            else if (activity < 0.45) activityClass = 'admin-badge-warning';

                                                            return (
                                                                <tr key={member.characterId}>
                                                                    <td className="font-monospace small text-muted">{member.characterId}</td>
                                                                    <td className="font-monospace small text-muted">{member.characterName}</td>
                                                                    <td><small className="text-muted">{member.rank}</small></td>
                                                                    <td className="text-center font-monospace">{member.scriptRank}</td>
                                                                    <td className="text-center font-monospace">
                                                                        <span className={`admin-badge ${activityClass}`}>{isMissingData ? 'MANUAL' : activity.toFixed(2)}</span>
                                                                    </td>
                                                                    <td className="text-center">
                                                                        <span className={`admin-badge ${levelClass}`}>{accessLevel}</span>
                                                                    </td>
                                                                    <td className="text-end">
                                                                        <Button 
                                                                            variant="outline-danger" 
                                                                            size="sm" 
                                                                            className="admin-btn-table"
                                                                            disabled={isRevoking !== null}
                                                                            onClick={() => handleRevokeMember(member)}
                                                                        >
                                                                            {isRevoking === member.characterId ? (
                                                                                <Spinner size="sm" animation="border" />
                                                                            ) : (
                                                                                <><i className="fas fa-user-slash me-1"></i> Revoke</>
                                                                            )}
                                                                        </Button>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </Table>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </Tab>
            </Tabs>

        </div>
    );
};

export default FactionDataUpload;
