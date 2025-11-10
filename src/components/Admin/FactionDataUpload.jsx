import React, { useState, useCallback, useEffect } from 'react';
import { Card, Button, Alert, Table, Badge, Spinner, Tabs, Tab } from 'react-bootstrap';
import { useDropzone } from 'react-dropzone';
import { httpsCallable } from 'firebase/functions';
import { ref, get, set } from 'firebase/database';
import { functions, database } from '../../firebase';
import * as Sentry from "@sentry/react";

/**
 * Faction Data Upload Component
 * Handles CSV file upload, parsing, and preview for faction member data
 */
const FactionDataUpload = ({ showNotification }) => {
    const [uploadStatus, setUploadStatus] = useState('idle'); // idle, uploading, preview, success, error
    const [uploadedFile, setUploadedFile] = useState(null);
    const [parsedData, setParsedData] = useState(null);
    const [uploadResult, setUploadResult] = useState(null);
    const [error, setError] = useState(null);
    
    // Database content state
    const [storedData, setStoredData] = useState(null);
    const [loadingStored, setLoadingStored] = useState(false);
    const [activeTab, setActiveTab] = useState('upload');
    const [lastUpdateInfo, setLastUpdateInfo] = useState(null);

    const parseJSONFile = useCallback((file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const text = e.target.result;
                    let jsonData = JSON.parse(text);
                    let isUcpFormat = false;

                    if (jsonData && typeof jsonData === 'object' && jsonData.data && Array.isArray(jsonData.data)) {
                        isUcpFormat = true;
                        jsonData = jsonData.data;
                    }

                    if (!Array.isArray(jsonData)) {
                        reject(new Error('JSON file must contain an array of faction members, or be a UCP export with a "data" property.'));
                        return;
                    }

                    const parsed = [];
                    const errors = [];

                    jsonData.forEach((member, index) => {
                        let characterId, characterName, rank, scriptRank, lastDuty, lastOnline, activity;

                        if (isUcpFormat) {
                            const idMatch = member.id ? String(member.id).match(/\/(\d+)/) : null;
                            characterId = idMatch ? idMatch[1] : null;
                            characterName = member.firstname && member.lastname ? `${member.firstname} ${member.lastname}` : null;
                            rank = member.rank;
                            scriptRank = member.scriptrank; // lowercase from UCP
                            lastDuty = member.lastduty;
                            lastOnline = member.lastonline;
                            activity = member.abas;
                        } else {
                            // This is for the simple format I assumed before
                            characterId = member.characterId;
                            characterName = member.characterName;
                            rank = member.rank;
                            scriptRank = member.scriptRank;
                            lastDuty = member.lastDuty;
                            lastOnline = member.lastOnline;
                            activity = member.activity;
                        }

                        if (!characterId || !characterName || !rank || scriptRank === undefined || scriptRank === null) {
                            errors.push(`Row ${index + 1}: Missing or invalid data - ID: ${characterId}, Name: ${characterName}, Rank: ${rank}, ScriptRank: ${scriptRank}`);
                            return;
                        }

                        parsed.push({
                            characterId: parseInt(characterId),
                            characterName,
                            rank,
                            scriptRank: parseInt(scriptRank),
                            lastDuty: lastDuty || null,
                            lastOnline: lastOnline || null,
                            activity: activity || null,
                            lineNumber: index + 1
                        });
                    });

                    resolve({
                        totalRows: jsonData.length,
                        validRows: parsed.length,
                        errors,
                        data: parsed,
                        fileName: file.name,
                        fileSize: file.size,
                        uploadTime: new Date().toISOString()
                    });

                } catch (error) {
                    reject(new Error(`Failed to parse JSON: ${error.message}`));
                }
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }, []);

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
            let parsed;
            const isJson = file.type === 'application/json' || file.name.toLowerCase().endsWith('.json');

            if (isJson) {
                console.log('[Faction Upload] Processing JSON file:', file.name);
                parsed = await parseJSONFile(file);
            } else {
                console.log('[Faction Upload] Processing CSV file:', file.name);
                parsed = await parseCSVFile(file);
            }
            
            console.log('[Faction Upload] Parsed data:', {
                totalRows: parsed.totalRows,
                validRows: parsed.validRows,
                errorCount: parsed.errors.length
            });

            setParsedData(parsed);
            setUploadStatus('preview');
            
            const fileType = isJson ? 'JSON' : 'CSV';
            if (parsed.errors.length > 0) {
                showNotification && showNotification(
                    `${fileType} parsed with ${parsed.errors.length} errors. Please review before uploading.`,
                    'warning'
                );
            } else {
                showNotification && showNotification(
                    `Successfully parsed ${parsed.validRows} faction members from ${fileType}`,
                    'success'
                );
            }

        } catch (error) {
            console.error('[Faction Upload] Parse error:', error);
            setError(error.message);
            setUploadStatus('error');
            showNotification && showNotification(`Failed to parse file: ${error.message}`, 'error');
        }
    }, [parseCSVFile, parseJSONFile, showNotification]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'text/csv': ['.csv'],
            'application/vnd.ms-excel': ['.csv'],
            'application/json': ['.json']
        },
        multiple: false,
        disabled: uploadStatus === 'uploading'
    });

    // Upload to Firebase
    const handleUploadToFirebase = async () => {
        if (!parsedData) return;

        setUploadStatus('uploading');
        setError(null);

        try {
            console.log('[Faction Upload] Uploading to Firebase...');
            // Hard-clear previous members to avoid stale entries and unnecessary storage
            try {
                showNotification && showNotification('Clearing previous faction member records…', 'info');
                await set(ref(database, 'factions/364/members'), null);
                console.log('[Faction Upload] Cleared existing factions/364/members');
            } catch (clearErr) {
                console.warn('[Faction Upload] Failed to clear existing members before upload:', clearErr);
                // Proceed with upload even if clear fails, but inform user
                showNotification && showNotification('Warning: Could not clear previous records. Proceeding with upload.', 'warning');
            }
            
            const uploadFactionData = httpsCallable(functions, 'uploadFactionData');
            const result = await uploadFactionData({
                factionData: parsedData.data,
                metadata: {
                    fileName: parsedData.fileName,
                    totalRows: parsedData.totalRows,
                    validRows: parsedData.validRows,
                    uploadTime: parsedData.uploadTime,
                    factionId: 364 // PHMC
                }
            });

            console.log('[Faction Upload] Upload result:', result.data);
            setUploadResult(result.data);
            setUploadStatus('success');
            
            showNotification && showNotification(
                `Successfully uploaded ${parsedData.validRows} faction members to database`,
                'success'
            );

        } catch (error) {
            console.error('[Faction Upload] Upload error:', error);
            Sentry.captureException(error, {
                extra: { context: 'Faction Data Upload' }
            });
            
            setError(error.message);
            setUploadStatus('error');
            showNotification && showNotification(`Upload failed: ${error.message}`, 'error');
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
                            {isDragActive ? 'Drop the file here' : 'Drag & drop faction CSV or JSON file here, or click to select'}
                        </p>
                        <p className="text-muted small mb-0">
                            Supports CSV files from GTA World UCP or a custom JSON array.
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
                    <Button variant="outline-secondary" size="sm" onClick={handleReset}>
                        Upload Different File
                    </Button>
                    <Button 
                        variant="success" 
                        size="sm" 
                        onClick={handleUploadToFirebase}
                        disabled={parsedData?.errors?.length > 0}
                    >
                        <i className="fas fa-upload me-2"></i>
                        Upload to Database
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
        <Card className="mb-4">
            <Card.Header>
                <h5 className="mb-0">
                    <i className="fas fa-users me-2"></i>
                    Faction Data Management
                </h5>
            </Card.Header>
            <Card.Body>
                <Tabs 
                    activeKey={activeTab} 
                    onSelect={(k) => setActiveTab(k)}
                    className="mb-3"
                >
                    <Tab eventKey="upload" title={
                        <span>
                            <i className="fas fa-upload me-2"></i>
                            Upload File
                        </span>
                    }>
                    Hello! Please grab a copy of the faction CSV from the GTAWorld UCP and upload it here to manage faction data. <a href="https://ucp.gta.world/view/faction/364/populate?draw=2&columns%5B0%5D%5Bdata%5D=actions&columns%5B0%5D%5Bname%5D=actions&columns%5B0%5D%5Bsearchable%5D=true&columns%5B0%5D%5Borderable%5D=true&columns%5B0%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B0%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B1%5D%5Bdata%5D=id&columns%5B1%5D%5Bname%5D=characters.id&columns%5B1%5D%5Bsearchable%5D=true&columns%5B1%5D%5Borderable%5D=true&columns%5B1%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B1%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B2%5D%5Bdata%5D=name&columns%5B2%5D%5Bname%5D=name&columns%5B2%5D%5Bsearchable%5D=true&columns%5B2%5D%5Borderable%5D=true&columns%5B2%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B2%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B3%5D%5Bdata%5D=rank&columns%5B3%5D%5Bname%5D=rank&columns%5B3%5D%5Bsearchable%5D=true&columns%5B3%5D%5Borderable%5D=true&columns%5B3%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B3%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B4%5D%5Bdata%5D=scriptrank&columns%5B4%5D%5Bname%5D=scriptrank&columns%5B4%5D%5Bsearchable%5D=true&columns%5B4%5D%5Borderable%5D=true&columns%5B4%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B4%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B5%5D%5Bdata%5D=lastduty&columns%5B5%5D%5Bname%5D=lastduty&columns%5B5%5D%5Bsearchable%5D=true&columns%5B5%5D%5Borderable%5D=true&columns%5B5%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B5%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B6%5D%5Bdata%5D=lastonline&columns%5B6%5D%5Bname%5D=lastonline&columns%5B6%5D%5Bsearchable%5D=true&columns%5B6%5D%5Borderable%5D=true&columns%5B6%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B6%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B7%5D%5Bdata%5D=abas&columns%5B7%5D%5Bname%5D=abas&columns%5B7%5D%5Bsearchable%5D=true&columns%5B7%5D%5Borderable%5D=true&columns%5B7%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B7%5D%5Bsearch%5D%5Bregex%5D=false&order%5B0%5D%5Bcolumn%5D=3&order%5B0%5D%5Bdir%5D=desc&start=0&length=500&search%5Bvalue%5D=&search%5Bregex%5D=false&type=members&filters=&searchTerm=&_=1762736428879">Expand by 'all' and then get CSV.</a> Alternatively, you can upload a JSON file with an array of member objects.
                        {activeTab === 'upload' && (
                            <>
                                {uploadStatus === 'idle' && renderUploadArea()}
                                
                                {uploadStatus === 'uploading' && renderUploadArea()}
                                
                                {uploadStatus === 'preview' && renderPreview()}
                                
                                {uploadStatus === 'success' && (
                                    <Alert variant="success">
                                        <Alert.Heading>Upload Successful!</Alert.Heading>
                                        <p>Faction data has been successfully uploaded to the database.</p>
                                        <hr />
                                        <div className="d-flex justify-content-between">
                                            <Button variant="outline-success" onClick={handleReset}>
                                                Upload Another File
                                            </Button>
                                            <Button variant="primary" onClick={() => setActiveTab('stored')}> 
                                                View Stored Data
                                            </Button>
                                        </div>
                                    </Alert>
                                )}
                                
                                {error && (
                                    <Alert variant="danger">
                                        <Alert.Heading>Upload Error</Alert.Heading>
                                        <p>{error}</p>
                                        <hr />
                                        <Button variant="outline-danger" onClick={handleReset}>
                                            Try Again
                                        </Button>
                                    </Alert>
                                )}
                            </>
                        )}
                    </Tab>
                    
                    <Tab eventKey="stored" title={
                        <span>
                            <i className="fas fa-database me-2"></i>
                            Stored Data ({storedData?.length || 0})
                        </span>
                    }>
                        {activeTab === 'stored' && (
                            <>
                                {/* Stored Data Header */}
                                <div className="d-flex justify-content-between align-items-center mb-3">
                                    <div>
                                        <h6 className="mb-1">Current Faction Database - Hit 'Refresh' to get the latest data</h6>
                                        {lastUpdateInfo && lastUpdateInfo.uploadTime && (
                                            <small className="text-muted">
                                                Last updated: {new Date(lastUpdateInfo.uploadTime).toLocaleString()} 
                                                {lastUpdateInfo.uploadedBy && ` by ${lastUpdateInfo.uploadedBy}`}
                                                {lastUpdateInfo.fileName && ` (${lastUpdateInfo.fileName})`}
                                                {lastUpdateInfo.statistics && (
                                                    <> • {lastUpdateInfo.statistics.validRecords} members</>
                                                )}
                                            </small>
                                        )}
                                    </div>
                                    <Button 
                                        variant="outline-primary" 
                                        size="sm" 
                                        onClick={loadStoredFactionData}
                                        disabled={loadingStored}
                                    >
                                        {loadingStored ? (
                                            <>
                                                <Spinner animation="border" size="sm" className="me-2" />
                                                Loading...
                                            </>
                                        ) : (
                                            <>
                                                <i className="fas fa-refresh me-2"></i>
                                                Refresh
                                            </>
                                        )}
                                    </Button>
                                </div>

                                {/* Stored Data Content */}
                                {loadingStored && !storedData && (
                                    <div className="text-center py-4">
                                        <Spinner animation="border" />
                                        <p className="mt-2">Loading stored faction data...</p>
                                    </div>
                                )}

                                {storedData && storedData.length > 0 && (
                                    <>
                                        {/* Activity Overview */}
                                        {(() => {
                                            const inactiveMembers = storedData.filter(member => {
                                                const activity = parseFloat(member.activity || '0');
                                                return activity < 0.25;
                                            });
                                            const activeMembers = storedData.filter(member => {
                                                const activity = parseFloat(member.activity || '0');
                                                return activity >= 0.25;
                                            });
                                            
                                            return (
                                                <>
                                                    <Alert variant="info">
                                                        <div className="d-flex justify-content-between align-items-center">
                                                            <div>
                                                                <strong>{storedData.length} faction members</strong> currently stored in database.
                                                                <br />
                                                                <small>Data is used for authentication and permission management throughout the system.</small>
                                                            </div>
                                                            <div className="text-end">
                                                                <Badge bg="success" className="me-2">
                                                                    Active: {activeMembers.length}
                                                                </Badge>
                                                                {inactiveMembers.length > 0 && (
                                                                    <Badge bg="warning">
                                                                        Inactive: {inactiveMembers.length}
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </Alert>
                                                    
                                                    {/* High-Priority Admin Alert for Rank 14+ */}
                                                    {(() => {
                                                        const highRankInactive = inactiveMembers.filter(member => member.scriptRank >= 14);
                                                        if (highRankInactive.length > 0) {
                                                            return (
                                                                <Alert variant="danger" className="mb-3">
                                                                    <Alert.Heading>
                                                                        <i className="fas fa-crown me-2"></i>
                                                                        High-Priority Admin Alert
                                                                    </Alert.Heading>
                                                                    <p className="mb-2">
                                                                        <strong>{highRankInactive.length} high-ranking administrator(s)</strong> (Rank 14+) are inactive and require immediate attention:
                                                                    </p>
                                                                    <ul className="mb-2">
                                                                        {highRankInactive.map(admin => (
                                                                            <li key={admin.characterId}>
                                                                                <strong>{admin.characterName}</strong> - 
                                                                                {admin.scriptRank >= 15 ? ' Hospital President' : ' Executive Leadership'} 
                                                                                (Rank {admin.scriptRank}, ABAS: {parseFloat(admin.activity || '0').toFixed(2)})
                                                                            </li>
                                                                        ))}
                                                                    </ul>
                                                                    <small className="text-muted">
                                                                        <i className="fas fa-info-circle me-1"></i>
                                                                        High-ranking inactive administrators may impact department operations and require priority intervention.
                                                                    </small>
                                                                </Alert>
                                                            );
                                                        }
                                                        return null;
                                                    })()}
                                                    
                                                    {/* Standard Inactivity Warning */}
                                                    {inactiveMembers.length > 0 && (
                                                        <Alert variant="warning" className="mb-3">
                                                            <Alert.Heading>
                                                                <i className="fas fa-exclamation-triangle me-2"></i>
                                                                Inactivity Warning
                                                            </Alert.Heading>
                                                            <p className="mb-2">
                                                                <strong>{inactiveMembers.length} members</strong> have an ABAS below 0.25 and are considered inactive.
                                                            </p>
                                                            <details>
                                                                <summary className="fw-bold" style={{cursor: 'pointer'}}>
                                                                    View Inactive Members ({inactiveMembers.length})
                                                                </summary>
                                                                <Table striped size="sm" className="mt-2 mb-0">
                                                                    <thead>
                                                                        <tr>
                                                                            <th>Character Name</th>
                                                                            <th>Rank</th>
                                                                            <th>Script Rank</th>
                                                                            <th>ABAS</th>
                                                                            <th>Status</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {inactiveMembers
                                                                            .sort((a, b) => parseFloat(a.activity || '0') - parseFloat(b.activity || '0'))
                                                                            .map((member) => {
                                                                                const activity = parseFloat(member.activity || '0');
                                                                                let statusColor = 'danger';
                                                                                let statusText = 'Critical';
                                                                                
                                                                                // Enhanced rank-based categories for Rank 14+ administrators
                                                                                if (member.scriptRank >= 15) {
                                                                                    // President Level - Most critical
                                                                                    statusColor = 'danger';
                                                                                    statusText = activity >= 0.15 ? 'Presidential Alert' : 
                                                                                                activity >= 0.05 ? 'Presidential Critical' : 'Presidential Emergency';
                                                                                } else if (member.scriptRank >= 14) {
                                                                                    // Executive Level - High priority
                                                                                    statusColor = 'warning';
                                                                                    statusText = activity >= 0.15 ? 'Executive Alert' : 
                                                                                                activity >= 0.05 ? 'Executive Critical' : 'Executive Emergency';
                                                                                } else {
                                                                                    // Standard categorization for lower ranks
                                                                                    if (activity >= 0.15) {
                                                                                        statusColor = 'warning';
                                                                                        statusText = 'At Risk';
                                                                                    } else if (activity >= 0.05) {
                                                                                        statusColor = 'danger';
                                                                                        statusText = 'Inactive';
                                                                                    } else {
                                                                                        statusColor = 'dark';
                                                                                        statusText = 'Very Inactive';
                                                                                    }
                                                                                }
                                                                                
                                                                                return (
                                                                                    <tr key={member.characterId} className="table-warning">
                                                                                        <td><strong>{member.characterName}</strong></td>
                                                                                        <td>{member.rank}</td>
                                                                                        <td>
                                                                                            <Badge bg="secondary">{member.scriptRank}</Badge>
                                                                                        </td>
                                                                                        <td>
                                                                                            <Badge bg={activity === 0 ? 'dark' : 'warning'}>
                                                                                                {activity.toFixed(2)}
                                                                                            </Badge>
                                                                                        </td>
                                                                                        <td>
                                                                                            <Badge bg={statusColor}>{statusText}</Badge>
                                                                                        </td>
                                                                                    </tr>
                                                                                );
                                                                            })
                                                                        }
                                                                    </tbody>
                                                                </Table>
                                                            </details>
                                                        </Alert>
                                                    )}
                                                </>
                                            );
                                        })()}
                                        
                                        {/* Active Members Table */}
                                        
                                        <Table striped bordered hover responsive>
                                            <thead>
                                                <tr>
                                                    <th>#</th>
                                                    <th>Character Name</th>
                                                    <th>Rank</th>
                                                    <th>Script Rank</th>
                                                    <th>ABAS</th>
                                                    <th>Access Level</th>
                                                    <th>Permissions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {storedData
                                                    .map((member, index) => {
                                                        const activity = parseFloat(member.activity || '0');
                                                        
                                        // Determine access level based on script rank
                                        let accessLevel = 'Member';
                                        let badgeVariant = 'secondary';
                                        let permissions = [];

                                        if (member.scriptRank >= 15) {
                                            accessLevel = 'Leadership';
                                            badgeVariant = 'danger';
                                            permissions = ['All Permissions', 'Executive Control', 'Strategic Oversight'];
                                        } else if (member.scriptRank >= 14) {
                                            accessLevel = 'Leadership';
                                            badgeVariant = 'warning';
                                            permissions = ['Admin', 'Department Management', 'All Reports', 'Webhooks', 'Faction Upload'];
                                        } else if (member.scriptRank >= 13) {
                                            accessLevel = 'Senior Management';
                                            badgeVariant = 'info';
                                            permissions = ['Limited Admin', 'Department Reports', 'Audit Logs'];
                                        } else if (member.scriptRank >= 12) {
                                            accessLevel = 'Middle Management';
                                            badgeVariant = 'primary';
                                            permissions = ['Limited Admin', 'Own Reports', 'View Members'];
                                        } else if (member.scriptRank >= 11) {
                                            accessLevel = 'Supervisor';
                                            badgeVariant = 'info';
                                            permissions = ['Admin', 'Webhooks', 'Faction Upload'];
                                        } else if (member.scriptRank >= 10) {
                                            accessLevel = 'Attending';
                                            badgeVariant = 'primary';
                                            permissions = ['Admin', 'Faction Upload'];
                                        } else if (member.scriptRank >= 9) {
                                            accessLevel = 'Resident';
                                            badgeVariant = 'success';
                                            permissions = ['Basic Access'];
                                        } else if (member.scriptRank >= 8) {
                                            accessLevel = 'Upper Level';
                                            badgeVariant = 'success';
                                            permissions = ['Basic Access'];
                                        } else if (member.scriptRank >= 7) {
                                            accessLevel = 'Mid Level';
                                            badgeVariant = 'secondary';
                                            permissions = ['Basic Access'];
                                        } else if (member.scriptRank >= 6) {
                                            accessLevel = 'Administration';
                                            badgeVariant = 'secondary';
                                            permissions = ['Basic Access'];
                                        } else if (member.scriptRank >= 5) {
                                            accessLevel = 'Entry Level';
                                            badgeVariant = 'light';
                                            permissions = ['Basic Access'];
                                        }                                                        // Activity badge color and inactivity check
                                                        let activityBadge = 'success';
                                                        let isInactive = false;
                                                        if (activity < 0.25) {
                                                            activityBadge = 'danger';
                                                            isInactive = true;
                                                        } else if (activity < 0.35) {
                                                            activityBadge = 'warning';
                                                        } else if (activity < 0.5) {
                                                            activityBadge = 'info';
                                                        }

                                                        return (
                                                            <tr key={member.characterId} className={isInactive ? 'table-danger' : ''}>
                                                                <td>{member.characterId}</td>
                                                                <td>
                                                                    <strong>{member.characterName}</strong>
                                                                    {isInactive && (
                                                                        <i className="fas fa-exclamation-triangle text-danger ms-2" 
                                                                           title="Inactive member (ABAS < 0.25)"></i>
                                                                    )}
                                                                </td>
                                                                <td>{member.rank}</td>
                                                                <td>
                                                                    <Badge bg={badgeVariant}>
                                                                        {member.scriptRank}
                                                                    </Badge>
                                                                </td>
                                                                <td>
                                                                    <Badge bg={activityBadge} title={isInactive ? 'Inactive - ABAS below 0.25 threshold' : `Active - ABAS ${activity.toFixed(2)}`}>
                                                                        {activity.toFixed(2)}
                                                                        {isInactive && ' (INACTIVE)'}
                                                                    </Badge>
                                                                </td>
                                                                <td>
                                                                    <Badge bg={badgeVariant}>
                                                                        {accessLevel}
                                                                    </Badge>
                                                                </td>
                                                                <td>
                                                                    <small className="text-muted">
                                                                        {permissions.join(', ')}
                                                                    </small>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                            </tbody>
                                        </Table>
                                    </>
                                )}

                                {storedData && storedData.length === 0 && (
                                    <Alert variant="warning">
                                        <Alert.Heading>No Faction Data</Alert.Heading>
                                        <p>No faction member data is currently stored in the database.</p>
                                        <hr />
                                        <Button variant="primary" onClick={() => setActiveTab('upload')}> 
                                            Upload CSV Data
                                        </Button>
                                    </Alert>
                                )}

                                {error && (
                                    <Alert variant="danger">
                                        <Alert.Heading>Database Error</Alert.Heading>
                                        <p>{error}</p>
                                        <hr />
                                        <Button variant="outline-danger" onClick={loadStoredFactionData}>
                                            Retry Loading
                                        </Button>
                                    </Alert>
                                )}
                            </>
                        )}
                    </Tab>
                </Tabs>
            </Card.Body>
        </Card>
    );
};

export default FactionDataUpload;
