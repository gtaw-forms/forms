import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Form, Button, Table, Card, Tabs, Tab, Spinner, InputGroup, Modal } from 'react-bootstrap';
import { ref, update, set, runTransaction } from 'firebase/database';
import { database } from '../../firebase';
import { parseBulkMorgueRecords } from '../../utils/morgue';
import { logDataVersionBump } from '../../utils/logging';
import { useDropzone } from 'react-dropzone';
import { useData } from '../../contexts/DataContext';
import { triggerDeleteMorgueRecord, triggerPurgeMorgueRecords, triggerSyncMorgueFile } from '../../services/firebaseFunctions';

const MorgueManager = ({ showNotification }) => {
    const { morgueRecords, loadMorgueRecords, removeMorgueRecord } = useData();

    // Bump the morgue data version after any write to trigger cache invalidation on connected clients
    const bumpMorgueVersion = async () => {
        try {
            const versionRef = ref(database, 'appMetadata/morgueDataVersion');
            await runTransaction(versionRef, (current) => (current || 0) + 1);
            logDataVersionBump('appMetadata/morgueDataVersion', 'MorgueManager', 'Morgue data changed');
        } catch (error) {
            console.warn('Failed to bump morgue data version:', error);
        }
    };

    const [rawLogs, setRawLogs] = useState('');
    const [parsedRecords, setParsedRecords] = useState([]);
    const [existingRecords, setExistingRecords] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('upload');

    // Search and Pagination state
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const recordsPerPage = 15;

    // Note editing state
    const [editingNoteRecord, setEditingNoteRecord] = useState(null);
    const [noteValue, setNoteValue] = useState('');
    const [isSavingNote, setIsSavingNote] = useState(false);
    const [selectedRecords, setSelectedRecords] = useState(new Set());

    // Manual entry state
    const emptyManualRecord = {
        caseId: '',
        name: '',
        sex: '',
        identified: '',
        location: '',
        timeOfDeath: '',
        causeOfDeath: '',
        dnaProfile: '',
        physicalDescription: '',
        estimatedAge: '',
        tattoos: '',
        bac: '',
        narcotics: '',
        bullets: [],
        findings: [],
        adminNote: ''
    };
    const [manualRecord, setManualRecord] = useState({ ...emptyManualRecord });
    const [isSavingManual, setIsSavingManual] = useState(false);

    // Load morgue records on demand via DataContext (lazy-loaded, no duplicate listener)
    useEffect(() => {
        loadMorgueRecords().finally(() => setIsLoading(false));
    }, [loadMorgueRecords]);

    // Sync context data to local state
    useEffect(() => {
        if (morgueRecords && morgueRecords.length > 0) {
            const sorted = [...morgueRecords].sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0));
            setExistingRecords(sorted);
        } else if (morgueRecords && morgueRecords.length === 0) {
            setExistingRecords([]);
        }
    }, [morgueRecords]);

    const onDrop = useCallback((acceptedFiles) => {
        const file = acceptedFiles[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target.result;
            setRawLogs(text);
            showNotification('File loaded. Click "Parse & Preview" to process.', 'info');
        };
        reader.onerror = () => showNotification('Failed to read file.', 'error');
        reader.readAsText(file);
    }, [showNotification]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'text/plain': ['.txt', '.log'] },
        multiple: false
    });

    const handleParse = () => {
        if (!rawLogs.trim()) {
            showNotification('Please paste some logs or upload a file first.', 'warning');
            return;
        }
        const records = parseBulkMorgueRecords(rawLogs);
        setParsedRecords(records);
        if (records.length === 0) {
            showNotification('No valid records found in the logs.', 'error');
        } else {
            showNotification(`Parsed ${records.length} records. Review them below.`, 'success');
        }
    };

    const handleUpload = async () => {
        if (parsedRecords.length === 0) return;
        
        setIsProcessing(true);
        try {
            const updates = {};
            let newCount = 0;
            let updatedCount = 0;

            parsedRecords.forEach(record => {
                const caseIdStr = String(record.caseId);
                // Find existing record by caseId to preserve notes
                const existing = existingRecords.find(r => String(r.caseId) === caseIdStr);
                
                // If we found an existing record, we use its key. Otherwise, generate one.
                const key = existing ? existing.firebaseKey : (record.caseId || record.name.replace(/[^a-zA-Z0-9]/g, '_'));
                
                const updateData = {
                    ...record,
                    lastUpdated: Date.now()
                };

                // CRITICAL: Preserve the admin note if it exists in the database
                if (existing) {
                    updatedCount++;
                    if (existing.adminNote) {
                        updateData.adminNote = existing.adminNote;
                    }
                } else {
                    newCount++;
                }

                updates[`morgue-records/${key}`] = updateData;
            });

            if (Object.keys(updates).length === 0) {
                showNotification('Nothing to upload.', 'warning');
                setIsProcessing(false);
                return;
            }

            await update(ref(database), updates);
            await bumpMorgueVersion();
            triggerSyncMorgueFile().catch(err => console.warn('[MORGUE] VPS sync error:', err.message));

            const message = updatedCount > 0 
                ? `Processed ${parsedRecords.length} records: ${newCount} new, ${updatedCount} updated. Admin Notes preserved.`
                : `Successfully uploaded ${newCount} new records.`;
            
            showNotification(message, 'success');

            setParsedRecords([]);
            setRawLogs('');
            setActiveTab('manage'); // Switch to manage tab to see results
        } catch (error) {
            console.error('Error uploading morgue records:', error);
            showNotification('Failed to upload records.', 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDeleteRecord = async (key, name, caseId) => {
        if (!window.confirm(`Are you sure you want to permanently delete the record for ${name}?`)) {
            return;
        }

        try {
            // Delete via Cloud Function (handles VPS local file + Firebase + version bump)
            await triggerDeleteMorgueRecord({ caseId: String(caseId || key) });
            // Remove from local state immediately — no full re-download needed
            removeMorgueRecord(String(caseId || key));
            showNotification(`Deleted record: ${name}`, 'success');
        } catch (error) {
            console.error('Error deleting record via function:', error);
            // Fallback: delete from Firebase directly, update local state
            try {
                const { remove } = await import('firebase/database');
                await remove(ref(database, `morgue-records/${key}`));
                removeMorgueRecord(String(caseId || key));
                showNotification(`Deleted record: ${name} (Firebase only — VPS may still have it)`, 'warning');
            } catch (fbErr) {
                console.error('Fallback delete also failed:', fbErr);
                showNotification('Failed to delete record.', 'error');
            }
        }
    };

    const handleBatchDelete = async () => {
        if (selectedRecords.size === 0) return;
        if (!window.confirm(`Delete ${selectedRecords.size} selected record(s)? This cannot be undone.`)) return;

        setIsProcessing(true);
        let success = 0;
        let fail = 0;

        for (const caseId of selectedRecords) {
            const record = existingRecords.find(r => String(r.caseId) === caseId || r.firebaseKey === caseId);
            const name = record?.name || caseId;
            try {
                await triggerDeleteMorgueRecord({ caseId: String(caseId) });
                removeMorgueRecord(String(caseId));
                success++;
            } catch {
                fail++;
            }
        }

        setSelectedRecords(new Set());
        showNotification(`Batch delete: ${success} deleted, ${fail} failed.`, fail > 0 ? 'warning' : 'success');
        setIsProcessing(false);
    };

    const toggleSelectRecord = (caseId) => {
        setSelectedRecords(prev => {
            const next = new Set(prev);
            if (next.has(caseId)) next.delete(caseId);
            else next.add(caseId);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedRecords.size === filteredRecords.length) {
            setSelectedRecords(new Set());
        } else {
            setSelectedRecords(new Set(filteredRecords.map(r => String(r.caseId))));
        }
    };

    const handlePurgeRecords = async () => {
        if (!window.confirm("CRITICAL: Are you sure you want to PERMANENTLY delete ALL morgue records? This action cannot be undone.")) {
            return;
        }

        const confirmation = window.prompt("To confirm, please type 'PURGE' below:");
        if (confirmation !== 'PURGE') {
            showNotification('Purge cancelled. Confirmation keyword did not match.', 'info');
            return;
        }

        setIsProcessing(true);
        try {
            // Purge via Cloud Function (handles VPS local file + Firebase + version bump)
            await triggerPurgeMorgueRecords();
            // Clear local state
            setExistingRecords([]);
            showNotification('Successfully purged all morgue records.', 'success');
        } catch (error) {
            console.error('Error purging records via function:', error);
            // Fallback: purge Firebase directly
            try {
                const { remove } = await import('firebase/database');
                await remove(ref(database, 'morgue-records'));
                showNotification('Purged Firebase only. Run /api/morgue/export on VPS to complete.', 'warning');
            } catch (fbErr) {
                console.error('Fallback purge also failed:', fbErr);
                showNotification('Failed to purge records.', 'error');
            }
        } finally {
            setIsProcessing(false);
        }
    };

    // Filtered and Paginated records
    const filteredRecords = useMemo(() => {
        return existingRecords.filter(record => 
            (record.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            String(record.caseId || '').toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [existingRecords, searchTerm]);

    const paginatedRecords = useMemo(() => {
        const startIndex = (currentPage - 1) * recordsPerPage;
        return filteredRecords.slice(startIndex, startIndex + recordsPerPage);
    }, [filteredRecords, currentPage]);

    const totalPages = Math.ceil(filteredRecords.length / recordsPerPage);

    const handlePageChange = (newPage) => {
        setCurrentPage(newPage);
        document.querySelector('.table-responsive')?.scrollTo(0, 0);
    };


    const handleSaveNote = async () => {
        if (!editingNoteRecord) return;
        
        setIsSavingNote(true);
        try {
            const noteRef = ref(database, `morgue-records/${editingNoteRecord.firebaseKey}/adminNote`);
            await set(noteRef, noteValue.trim());
            await bumpMorgueVersion();
            showNotification('Admin note updated successfully.', 'success');
            setEditingNoteRecord(null);
            setNoteValue('');
        } catch (error) {
            console.error('Error saving admin note:', error);
            showNotification('Failed to update admin note.', 'error');
        } finally {
            setIsSavingNote(false);
        }
    };

    const handleManualFieldChange = (field, value) => {
        setManualRecord(prev => ({ ...prev, [field]: value }));
    };

    const handleBulletChange = (index, field, value) => {
        setManualRecord(prev => {
            const bullets = [...prev.bullets];
            bullets[index] = { ...bullets[index], [field]: value };
            return { ...prev, bullets };
        });
    };

    const addBullet = () => {
        setManualRecord(prev => ({
            ...prev,
            bullets: [...prev.bullets, { type: '', id: '' }]
        }));
    };

    const removeBullet = (index) => {
        setManualRecord(prev => ({
            ...prev,
            bullets: prev.bullets.filter((_, i) => i !== index)
        }));
    };

    const handleFindingChange = (index, field, value) => {
        setManualRecord(prev => {
            const findings = [...prev.findings];
            findings[index] = { ...findings[index], [field]: value };
            return { ...prev, findings };
        });
    };

    const addFinding = () => {
        setManualRecord(prev => ({
            ...prev,
            findings: [...prev.findings, { time: '', type: '', part: '', dist: '' }]
        }));
    };

    const removeFinding = (index) => {
        setManualRecord(prev => ({
            ...prev,
            findings: prev.findings.filter((_, i) => i !== index)
        }));
    };

    const handleSaveManual = async () => {
        if (!manualRecord.name.trim() || !manualRecord.caseId.trim()) {
            showNotification('Name and Case # are required.', 'warning');
            return;
        }

        setIsSavingManual(true);
        try {
            const key = manualRecord.caseId.replace(/[^a-zA-Z0-9]/g, '_');
            const record = {
                ...manualRecord,
                caseId: String(manualRecord.caseId),
                lastUpdated: Date.now()
            };
            await set(ref(database, `morgue-records/${key}`), record);
            await bumpMorgueVersion();
            triggerSyncMorgueFile().catch(err => console.warn('[MORGUE] VPS sync error:', err.message));
            showNotification(`Manual entry saved for ${record.name}.`, 'success');
            setManualRecord({ ...emptyManualRecord });
            setActiveTab('manage');
        } catch (error) {
            console.error('Error saving manual entry:', error);
            showNotification('Failed to save manual entry.', 'error');
        } finally {
            setIsSavingManual(false);
        }
    };

    return (
        <div className="morgue-manager">
            <h2 className="mb-4 text-light"><i className="fas fa-microscope me-3 text-primary"></i>Morgue Record Management</h2>

            <Tabs
                activeKey={activeTab}
                onSelect={(k) => setActiveTab(k)}
                className="mb-4 custom-admin-tabs"
            >
                <Tab eventKey="upload" title={<span><i className="fas fa-upload me-2"></i>Bulk Upload</span>}>
                    <Card className="mb-4 bg-dark text-light border-secondary">
                        <Card.Header className="border-secondary">
                            <h4 className="mb-0"><i className="fas fa-file-import me-2"></i>Import New Records</h4>
                        </Card.Header>
                        <Card.Body>
                            <div 
                                {...getRootProps()} 
                                className={`mb-3 border-2 border-dashed p-4 text-center cursor-pointer transition-colors rounded ${isDragActive ? 'border-primary bg-primary bg-opacity-10' : 'border-secondary'}`}
                                style={{ minHeight: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                                <input {...getInputProps()} />
                                <div>
                                    <i className="fas fa-cloud-upload-alt fa-3x mb-3 opacity-50"></i>
                                    <p className="mb-1">{isDragActive ? 'Drop logs here...' : 'Drag & drop .txt logs here, or click to select'}</p>
                                    <p className="small opacity-50">You can also paste logs into the text area below</p>
                                </div>
                            </div>

                            <Form.Group className="mb-3">
                                <Form.Label>Raw Morgue Logs</Form.Label>
                                <Form.Control
                                    as="textarea"
                                    rows={5}
                                    placeholder="Paste logs here if not uploading a file..."
                                    value={rawLogs}
                                    onChange={(e) => setRawLogs(e.target.value)}
                                    className="bg-dark text-light border-secondary"
                                />
                                <Form.Text className="opacity-75">
                                    Records must be separated by the "MORGUE" header.
                                </Form.Text>
                            </Form.Group>
                            <div className="d-flex gap-2">
                                <Button variant="primary" onClick={handleParse} disabled={isProcessing}>
                                    <i className="fas fa-sync me-2"></i>Parse & Preview
                                </Button>
                                <Button variant="outline-danger" onClick={() => { setRawLogs(''); setParsedRecords([]); }} disabled={isProcessing}>
                                    <i className="fas fa-trash me-2"></i>Clear
                                </Button>
                            </div>
                        </Card.Body>
                    </Card>

                    {parsedRecords.length > 0 && (
                        <Card className="bg-dark text-light border-secondary shadow">
                            <Card.Header className="border-secondary d-flex justify-content-between align-items-center">
                                <h4 className="mb-0">Preview ({parsedRecords.length} Records)</h4>
                                <Button variant="success" onClick={handleUpload} disabled={isProcessing}>
                                    {isProcessing ? <Spinner animation="border" size="sm" /> : <><i className="fas fa-cloud-upload-alt me-2"></i>Commit to Database</>}
                                </Button>
                            </Card.Header>
                            <Card.Body className="p-0">
                                <div className="table-responsive" style={{ maxHeight: '400px' }}>
                                    <Table striped bordered hover variant="dark" className="mb-0">
                                        <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                                            <tr>
                                                <th>Case #</th>
                                                <th>Name</th>
                                                <th>Location</th>
                                                <th>Time of Death</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {parsedRecords.map((record, index) => {
                                                const isDuplicate = existingRecords.some(r => String(r.caseId) === String(record.caseId));
                                                return (
                                                    <tr key={index} className={isDuplicate ? 'table-warning opacity-75' : ''}>
                                                        <td>
                                                            {record.caseId}
                                                            {isDuplicate && <i className="fas fa-exclamation-triangle ms-2 text-warning" title="Already exists in database"></i>}
                                                        </td>
                                                        <td>{record.name}</td>
                                                        <td>{record.location}</td>
                                                        <td>{record.timeOfDeath}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </Table>
                                </div>
                            </Card.Body>
                        </Card>
                    )}
                </Tab>

                <Tab eventKey="manual" title={<span><i className="fas fa-pen me-2"></i>Manual Entry</span>}>
                    <Card className="bg-dark text-light border-secondary shadow mb-4">
                        <Card.Header className="border-secondary">
                            <h4 className="mb-0"><i className="fas fa-pen me-2"></i>Manual Morgue Entry</h4>
                        </Card.Header>
                        <Card.Body>
                            <div className="row g-3">
                                <div className="col-md-4">
                                    <Form.Group>
                                        <Form.Label>Case # <span className="text-danger">*</span></Form.Label>
                                        <Form.Control
                                            type="text"
                                            placeholder="e.g. 12345"
                                            value={manualRecord.caseId}
                                            onChange={(e) => handleManualFieldChange('caseId', e.target.value)}
                                            className="bg-dark text-light border-secondary"
                                        />
                                    </Form.Group>
                                </div>
                                <div className="col-md-4">
                                    <Form.Group>
                                        <Form.Label>Name <span className="text-danger">*</span></Form.Label>
                                        <Form.Control
                                            type="text"
                                            placeholder="Full name of deceased"
                                            value={manualRecord.name}
                                            onChange={(e) => handleManualFieldChange('name', e.target.value)}
                                            className="bg-dark text-light border-secondary"
                                        />
                                    </Form.Group>
                                </div>
                                <div className="col-md-2">
                                    <Form.Group>
                                        <Form.Label>Sex</Form.Label>
                                        <Form.Select
                                            value={manualRecord.sex}
                                            onChange={(e) => handleManualFieldChange('sex', e.target.value)}
                                            className="bg-dark text-light border-secondary"
                                        >
                                            <option value="">-- Select --</option>
                                            <option value="Male">Male</option>
                                            <option value="Female">Female</option>
                                            <option value="Other">Other</option>
                                        </Form.Select>
                                    </Form.Group>
                                </div>
                                <div className="col-md-2">
                                    <Form.Group>
                                        <Form.Label>Identified</Form.Label>
                                        <Form.Select
                                            value={manualRecord.identified}
                                            onChange={(e) => handleManualFieldChange('identified', e.target.value)}
                                            className="bg-dark text-light border-secondary"
                                        >
                                            <option value="">-- Select --</option>
                                            <option value="Yes">Yes</option>
                                            <option value="No">No</option>
                                            <option value="Unknown">Unknown</option>
                                        </Form.Select>
                                    </Form.Group>
                                </div>
                                <div className="col-md-6">
                                    <Form.Group>
                                        <Form.Label>Location</Form.Label>
                                        <Form.Control
                                            type="text"
                                            placeholder="Location where body was found"
                                            value={manualRecord.location}
                                            onChange={(e) => handleManualFieldChange('location', e.target.value)}
                                            className="bg-dark text-light border-secondary"
                                        />
                                    </Form.Group>
                                </div>
                                <div className="col-md-6">
                                    <Form.Group>
                                        <Form.Label>Time of Death</Form.Label>
                                        <Form.Control
                                            type="text"
                                            placeholder="e.g. 14/JUN/2026 22:45"
                                            value={manualRecord.timeOfDeath}
                                            onChange={(e) => handleManualFieldChange('timeOfDeath', e.target.value)}
                                            className="bg-dark text-light border-secondary"
                                        />
                                    </Form.Group>
                                </div>
                                <div className="col-12">
                                    <Form.Group>
                                        <Form.Label>Cause of Death</Form.Label>
                                        <Form.Control
                                            type="text"
                                            placeholder="e.g. Gunshot wound to the chest"
                                            value={manualRecord.causeOfDeath}
                                            onChange={(e) => handleManualFieldChange('causeOfDeath', e.target.value)}
                                            className="bg-dark text-light border-secondary"
                                        />
                                    </Form.Group>
                                </div>
                            </div>

                            <hr className="border-secondary my-4" />

                            <h5><i className="fas fa-dna me-2 text-info"></i>DNA & Physical Description</h5>
                            <div className="row g-3 mt-2">
                                <div className="col-12">
                                    <Form.Group>
                                        <Form.Label>DNA Profile</Form.Label>
                                        <Form.Control
                                            type="text"
                                            placeholder="DNA profile string"
                                            value={manualRecord.dnaProfile}
                                            onChange={(e) => handleManualFieldChange('dnaProfile', e.target.value)}
                                            className="bg-dark text-light border-secondary"
                                        />
                                    </Form.Group>
                                </div>
                                <div className="col-12">
                                    <Form.Group>
                                        <Form.Label>Physical Description</Form.Label>
                                        <Form.Control
                                            as="textarea"
                                            rows={3}
                                            placeholder="Height, build, hair color, eye color, distinguishing features..."
                                            value={manualRecord.physicalDescription}
                                            onChange={(e) => handleManualFieldChange('physicalDescription', e.target.value)}
                                            className="bg-dark text-light border-secondary"
                                        />
                                    </Form.Group>
                                </div>
                                <div className="col-md-6">
                                    <Form.Group>
                                        <Form.Label>Estimated Age</Form.Label>
                                        <Form.Control
                                            type="text"
                                            placeholder="e.g. 30-40 years"
                                            value={manualRecord.estimatedAge}
                                            onChange={(e) => handleManualFieldChange('estimatedAge', e.target.value)}
                                            className="bg-dark text-light border-secondary"
                                        />
                                    </Form.Group>
                                </div>
                                <div className="col-md-6">
                                    <Form.Group>
                                        <Form.Label>Tattoos Description</Form.Label>
                                        <Form.Control
                                            type="text"
                                            placeholder="Notable tattoos"
                                            value={manualRecord.tattoos}
                                            onChange={(e) => handleManualFieldChange('tattoos', e.target.value)}
                                            className="bg-dark text-light border-secondary"
                                        />
                                    </Form.Group>
                                </div>
                            </div>

                            <hr className="border-secondary my-4" />

                            <h5><i className="fas fa-flask me-2 text-warning"></i>Forensic Details</h5>
                            <div className="row g-3 mt-2">
                                <div className="col-md-6">
                                    <Form.Group>
                                        <Form.Label>Blood Alcohol Concentration (BAC)</Form.Label>
                                        <Form.Control
                                            type="text"
                                            placeholder="e.g. 0.08%"
                                            value={manualRecord.bac}
                                            onChange={(e) => handleManualFieldChange('bac', e.target.value)}
                                            className="bg-dark text-light border-secondary"
                                        />
                                    </Form.Group>
                                </div>
                                <div className="col-md-6">
                                    <Form.Group>
                                        <Form.Label>Traces of Narcotics</Form.Label>
                                        <Form.Control
                                            type="text"
                                            placeholder="e.g. Cocaine, Methamphetamine"
                                            value={manualRecord.narcotics}
                                            onChange={(e) => handleManualFieldChange('narcotics', e.target.value)}
                                            className="bg-dark text-light border-secondary"
                                        />
                                    </Form.Group>
                                </div>
                            </div>

                            <div className="mt-3">
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                    <Form.Label className="mb-0">Recovered Bullets</Form.Label>
                                    <Button variant="outline-info" size="sm" onClick={addBullet}>
                                        <i className="fas fa-plus me-1"></i>Add Bullet
                                    </Button>
                                </div>
                                {manualRecord.bullets.map((bullet, index) => (
                                    <div key={index} className="row g-2 mb-2 align-items-center">
                                        <div className="col-md-5">
                                            <Form.Control
                                                type="text"
                                                placeholder="Bullet type"
                                                value={bullet.type}
                                                onChange={(e) => handleBulletChange(index, 'type', e.target.value)}
                                                className="bg-dark text-light border-secondary"
                                            />
                                        </div>
                                        <div className="col-md-5">
                                            <Form.Control
                                                type="text"
                                                placeholder="Striation ID"
                                                value={bullet.id}
                                                onChange={(e) => handleBulletChange(index, 'id', e.target.value)}
                                                className="bg-dark text-light border-secondary"
                                            />
                                        </div>
                                        <div className="col-md-2">
                                            <Button variant="outline-danger" size="sm" onClick={() => removeBullet(index)}>
                                                <i className="fas fa-times"></i>
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <hr className="border-secondary my-4" />

                            <h5><i className="fas fa-notes-medical me-2 text-danger"></i>Autopsy Findings</h5>
                            <div className="mt-2">
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                    <Form.Label className="mb-0">Wound/Trauma Records</Form.Label>
                                    <Button variant="outline-info" size="sm" onClick={addFinding}>
                                        <i className="fas fa-plus me-1"></i>Add Finding
                                    </Button>
                                </div>
                                {manualRecord.findings.map((finding, index) => (
                                    <div key={index} className="row g-2 mb-2 align-items-center">
                                        <div className="col-md-3">
                                            <Form.Control
                                                type="text"
                                                placeholder="Time (HH:MM:SS)"
                                                value={finding.time}
                                                onChange={(e) => handleFindingChange(index, 'time', e.target.value)}
                                                className="bg-dark text-light border-secondary"
                                            />
                                        </div>
                                        <div className="col-md-3">
                                            <Form.Control
                                                type="text"
                                                placeholder="Wound type"
                                                value={finding.type}
                                                onChange={(e) => handleFindingChange(index, 'type', e.target.value)}
                                                className="bg-dark text-light border-secondary"
                                            />
                                        </div>
                                        <div className="col-md-3">
                                            <Form.Control
                                                type="text"
                                                placeholder="Body part"
                                                value={finding.part}
                                                onChange={(e) => handleFindingChange(index, 'part', e.target.value)}
                                                className="bg-dark text-light border-secondary"
                                            />
                                        </div>
                                        <div className="col-md-2">
                                            <Form.Control
                                                type="text"
                                                placeholder="Dist."
                                                value={finding.dist}
                                                onChange={(e) => handleFindingChange(index, 'dist', e.target.value)}
                                                className="bg-dark text-light border-secondary"
                                            />
                                        </div>
                                        <div className="col-md-1">
                                            <Button variant="outline-danger" size="sm" onClick={() => removeFinding(index)}>
                                                <i className="fas fa-times"></i>
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <hr className="border-secondary my-4" />

                            <Form.Group>
                                <Form.Label><i className="fas fa-sticky-note me-2 text-info"></i>Admin Note</Form.Label>
                                <Form.Control
                                    as="textarea"
                                    rows={2}
                                    placeholder="Internal admin notes..."
                                    value={manualRecord.adminNote}
                                    onChange={(e) => handleManualFieldChange('adminNote', e.target.value)}
                                    className="bg-dark text-light border-secondary"
                                />
                            </Form.Group>

                            <div className="d-flex gap-2 mt-4">
                                <Button variant="success" onClick={handleSaveManual} disabled={isSavingManual}>
                                    {isSavingManual ? <Spinner animation="border" size="sm" /> : <><i className="fas fa-save me-2"></i>Save Entry</>}
                                </Button>
                                <Button variant="outline-secondary" onClick={() => setManualRecord({ ...emptyManualRecord })} disabled={isSavingManual}>
                                    <i className="fas fa-undo me-2"></i>Reset
                                </Button>
                            </div>
                        </Card.Body>
                    </Card>
                </Tab>

                <Tab eventKey="manage" title={<span><i className="fas fa-list me-2"></i>Manage Existing ({existingRecords.length})</span>}>
                    <Card className="bg-dark text-light border-secondary shadow">
                        <Card.Header className="border-secondary d-flex justify-content-between align-items-center flex-wrap gap-3">
                            <h4 className="mb-0">Existing Morgue Records</h4>

                            <div className="d-flex gap-3 align-items-center">
                                {selectedRecords.size > 0 && (
                                    <Button
                                        variant="danger"
                                        size="sm"
                                        onClick={handleBatchDelete}
                                        disabled={isProcessing}
                                    >
                                        <i className="fas fa-trash-alt me-1"></i>Delete ({selectedRecords.size})
                                    </Button>
                                )}

                                <InputGroup size="sm" style={{ maxWidth: '300px' }}>
                                    <InputGroup.Text className="bg-dark border-secondary text-light">
                                        <i className="fas fa-search"></i>
                                    </InputGroup.Text>
                                    <Form.Control
                                        placeholder="Search records..."
                                        className="bg-dark border-secondary text-light"
                                        value={searchTerm}
                                        onChange={(e) => {
                                            setSearchTerm(e.target.value);
                                            setCurrentPage(1);
                                        }}
                                    />
                                </InputGroup>

                                {existingRecords.length > 0 && (
                                    <Button
                                        variant="outline-danger"
                                        size="sm"
                                        onClick={handlePurgeRecords}
                                        disabled={isProcessing}
                                    >
                                        <i className="fas fa-bomb me-2"></i>Purge All
                                    </Button>
                                )}
                            </div>
                        </Card.Header>
                        <Card.Body className="p-0">
                            {isLoading ? (
                                <div className="text-center p-5">
                                    <Spinner animation="border" variant="primary" />
                                    <p className="mt-2">Loading database...</p>
                                </div>
                            ) : (
                                <>
                                    <div className="table-responsive" style={{ maxHeight: '600px' }}>
                                        <Table striped bordered hover variant="dark" className="mb-0">
                                            <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                                                <tr>
                                                    <th style={{ width: '40px' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedRecords.size > 0 && selectedRecords.size === filteredRecords.length}
                                                            onChange={toggleSelectAll}
                                                        />
                                                    </th>
                                                    <th>Case #</th>
                                                    <th>Name</th>
                                                    <th>Location</th>
                                                    <th>Last Updated</th>
                                                    <th className="text-center">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {paginatedRecords.length > 0 ? (
                                                    paginatedRecords.map((record) => (
                                                        <tr key={record.firebaseKey}
                                                            style={{ background: selectedRecords.has(String(record.caseId)) ? 'rgba(52, 152, 219, 0.1)' : '' }}>
                                                            <td>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedRecords.has(String(record.caseId))}
                                                                    onChange={() => toggleSelectRecord(String(record.caseId))}
                                                                />
                                                            </td>
                                                            <td>{record.caseId}</td>
                                                            <td><strong>{record.name}</strong></td>
                                                            <td>{record.location}</td>
                                                            <td className="small opacity-75">
                                                                {record.lastUpdated ? new Date(record.lastUpdated).toLocaleString() : 'N/A'}
                                                            </td>
                                                            <td className="text-center">
                                                                <div className="d-flex gap-2 justify-content-center">
                                                                    <Button
                                                                        variant="outline-info"
                                                                        size="sm"
                                                                        onClick={() => {
                                                                            setEditingNoteRecord(record);
                                                                            setNoteValue(record.adminNote || '');
                                                                        }}
                                                                    >
                                                                        <i className="fas fa-edit"></i> Note
                                                                    </Button>
                                                                    <Button
                                                                        variant="outline-danger"
                                                                        size="sm"
                                                                        onClick={() => handleDeleteRecord(record.firebaseKey, record.name, record.caseId)}
                                                                    >
                                                                        <i className="fas fa-trash-alt"></i>
                                                                    </Button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr>
                                                        <td colSpan="6" className="text-center p-4">
                                                            {searchTerm ? `No records found matching "${searchTerm}"` : 'No records found in database.'}
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </Table>
                                    </div>
                                    
                                    {totalPages > 1 && (
                                        <div className="d-flex justify-content-center align-items-center p-3 border-top border-secondary">
                                            <Button 
                                                variant="outline-secondary" 
                                                size="sm" 
                                                disabled={currentPage === 1}
                                                onClick={() => handlePageChange(currentPage - 1)}
                                            >
                                                <i className="fas fa-chevron-left"></i>
                                            </Button>
                                            <span className="mx-3 small">
                                                Page <strong>{currentPage}</strong> of {totalPages}
                                            </span>
                                            <Button 
                                                variant="outline-secondary" 
                                                size="sm" 
                                                disabled={currentPage === totalPages}
                                                onClick={() => handlePageChange(currentPage + 1)}
                                            >
                                                <i className="fas fa-chevron-right"></i>
                                            </Button>
                                        </div>
                                    )}
                                </>
                            )}
                        </Card.Body>
                    </Card>
                </Tab>
            </Tabs>

            {/* Admin Note Modal */}
            <Modal show={!!editingNoteRecord} onHide={() => setEditingNoteRecord(null)} centered>
                <Modal.Header closeButton className="bg-dark text-light border-secondary">
                    <Modal.Title>
                        <i className="fas fa-sticky-note me-2 text-info"></i>
                        Edit Admin Note: {editingNoteRecord?.name}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="bg-dark text-light">
                    <Form.Group>
                        <Form.Label>Note Content</Form.Label>
                        <Form.Control
                            as="textarea"
                            rows={4}
                            placeholder="Add administrative notes here... (Visible in lookup)"
                            value={noteValue}
                            onChange={(e) => setNoteValue(e.target.value)}
                            className="bg-dark text-light border-secondary"
                        />
                        <Form.Text className="opacity-75">
                            This note will be displayed directly in the Morgue Intake Lookup table for authorized users.
                        </Form.Text>
                    </Form.Group>
                </Modal.Body>
                <Modal.Footer className="bg-dark border-secondary">
                    <Button variant="outline-secondary" onClick={() => setEditingNoteRecord(null)}>
                        Cancel
                    </Button>
                    <Button variant="info" onClick={handleSaveNote} disabled={isSavingNote}>
                        {isSavingNote ? <Spinner animation="border" size="sm" /> : 'Save Note'}
                    </Button>
                </Modal.Footer>
            </Modal>

            <style>{`
                .custom-admin-tabs .nav-link {
                    color: #bdc3c7;
                    border: none;
                    border-bottom: 2px solid transparent;
                    padding: 10px 20px;
                }
                .custom-admin-tabs .nav-link.active {
                    background-color: transparent !important;
                    color: #3498db !important;
                    border-bottom: 2px solid #3498db !important;
                }
                .custom-admin-tabs .nav-link:hover:not(.active) {
                    color: white;
                    border-bottom: 2px solid #555;
                }
                .cursor-pointer { cursor: pointer; }
                .transition-colors { transition: all 0.2s ease-in-out; }
                .extra-small { font-size: 0.7rem; }
            `}</style>
        </div>
    );
};

export default MorgueManager;
