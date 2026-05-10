import React, { useState, useEffect } from 'react';
import { Form, Button, Table, Alert, Card, Tabs, Tab, Spinner, InputGroup, Modal } from 'react-bootstrap';
import { ref, update, onValue, remove, push, set } from 'firebase/database';
import { database } from '../../firebase';
import { parseBulkMorgueRecords } from '../../utils/morgueParser';
import { useData } from '../../contexts/DataContext';

const MorgueManager = ({ showNotification }) => {
    const { morgueWhitelist } = useData();
    const [rawLogs, setRawLogs] = useState('');
    const [parsedRecords, setParsedRecords] = useState([]);
    const [existingRecords, setExistingRecords] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('upload');
    
    // Note editing state
    const [editingNoteRecord, setEditingNoteRecord] = useState(null);
    const [noteValue, setNoteValue] = useState('');
    const [isSavingNote, setIsSavingNote] = useState(false);
    
    // Whitelist state
    const [newWhitelistEntry, setNewWhitelistEntry] = useState('');
    const [whitelistType, setWhitelistType] = useState('characterId');

    useEffect(() => {
        const morgueRef = ref(database, 'morgue-records');
        const unsubscribe = onValue(morgueRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const recordList = Object.keys(data).map(key => ({
                    ...data[key],
                    firebaseKey: key
                }));
                // Sort by lastUpdated or caseId
                recordList.sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0));
                setExistingRecords(recordList);
            } else {
                setExistingRecords([]);
            }
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleParse = () => {
        if (!rawLogs.trim()) {
            showNotification('Please paste some logs first.', 'warning');
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

    const handleDeleteRecord = async (key, name) => {
        if (!window.confirm(`Are you sure you want to permanently delete the record for ${name}?`)) {
            return;
        }

        try {
            await remove(ref(database, `morgue-records/${key}`));
            showNotification(`Deleted record: ${name}`, 'success');
        } catch (error) {
            console.error('Error deleting record:', error);
            showNotification('Failed to delete record.', 'error');
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
            await remove(ref(database, 'morgue-records'));
            showNotification('Successfully purged all morgue records.', 'success');
        } catch (error) {
            console.error('Error purging records:', error);
            showNotification('Failed to purge records.', 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleAddWhitelist = async (e) => {
        e.preventDefault();
        if (!newWhitelistEntry.trim()) return;

        setIsProcessing(true);
        try {
            const whitelistRef = ref(database, 'morgue-whitelisted-users');
            const newEntryRef = push(whitelistRef);
            await set(newEntryRef, {
                [whitelistType === 'characterId' ? 'id' : 'username']: newWhitelistEntry.trim().toLowerCase(),
                addedAt: Date.now(),
                type: whitelistType
            });
            showNotification('User added to whitelist.', 'success');
            setNewWhitelistEntry('');
        } catch (error) {
            console.error('Error adding to whitelist:', error);
            showNotification('Failed to add to whitelist.', 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRemoveWhitelist = async (key) => {
        if (!window.confirm('Are you sure you want to remove this user from the whitelist?')) return;

        try {
            await remove(ref(database, `morgue-whitelisted-users/${key}`));
            showNotification('User removed from whitelist.', 'success');
        } catch (error) {
            console.error('Error removing from whitelist:', error);
            showNotification('Failed to remove from whitelist.', 'error');
        }
    };

    const handleSaveNote = async () => {
        if (!editingNoteRecord) return;
        
        setIsSavingNote(true);
        try {
            const noteRef = ref(database, `morgue-records/${editingNoteRecord.firebaseKey}/adminNote`);
            await set(noteRef, noteValue.trim());
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
                            <Form.Group className="mb-3">
                                <Form.Label>Paste Raw Morgue Logs</Form.Label>
                                <Form.Control
                                    as="textarea"
                                    rows={8}
                                    placeholder="Paste logs here..."
                                    value={rawLogs}
                                    onChange={(e) => setRawLogs(e.target.value)}
                                    className="bg-dark text-light border-secondary"
                                />
                                <Form.Text className="text-muted">
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

                <Tab eventKey="manage" title={<span><i className="fas fa-list me-2"></i>Manage Existing ({existingRecords.length})</span>}>
                    <Card className="bg-dark text-light border-secondary shadow">
                        <Card.Header className="border-secondary d-flex justify-content-between align-items-center">
                            <h4 className="mb-0">Existing Morgue Records</h4>
                            {existingRecords.length > 0 && (
                                <Button 
                                    variant="outline-danger" 
                                    size="sm" 
                                    onClick={handlePurgeRecords} 
                                    disabled={isProcessing}
                                >
                                    <i className="fas fa-bomb me-2"></i>Purge All Records
                                </Button>
                            )}
                        </Card.Header>
                        <Card.Body className="p-0">
                            {isLoading ? (
                                <div className="text-center p-5">
                                    <Spinner animation="border" variant="primary" />
                                    <p className="mt-2">Loading database...</p>
                                </div>
                            ) : (
                                <div className="table-responsive" style={{ maxHeight: '600px' }}>
                                    <Table striped bordered hover variant="dark" className="mb-0">
                                        <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                                            <tr>
                                                <th>Case #</th>
                                                <th>Name</th>
                                                <th>Location</th>
                                                <th>Last Updated</th>
                                                <th className="text-center">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {existingRecords.length > 0 ? (
                                                existingRecords.map((record) => (
                                                    <tr key={record.firebaseKey}>
                                                        <td>{record.caseId}</td>
                                                        <td><strong>{record.name}</strong></td>
                                                        <td>{record.location}</td>
                                                        <td className="small text-muted">
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
                                                                    onClick={() => handleDeleteRecord(record.firebaseKey, record.name)}
                                                                >
                                                                    <i className="fas fa-trash-alt"></i>
                                                                </Button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan="5" className="text-center p-4">No records found in database.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </Table>
                                </div>
                            )}
                        </Card.Body>
                    </Card>
                </Tab>

                <Tab eventKey="whitelist" title={<span><i className="fas fa-user-shield me-2"></i>Access Whitelist</span>}>
                    <Card className="mb-4 bg-dark text-light border-secondary">
                        <Card.Header className="border-secondary">
                            <h4 className="mb-0"><i className="fas fa-plus-circle me-2"></i>Authorize New User</h4>
                        </Card.Header>
                        <Card.Body>
                            <Form onSubmit={handleAddWhitelist}>
                                <div className="d-flex gap-3 align-items-end">
                                    <Form.Group className="flex-grow-1">
                                        <Form.Label>Search Value (ID or Username)</Form.Label>
                                        <InputGroup>
                                            <Form.Select 
                                                style={{ maxWidth: '150px' }} 
                                                className="bg-dark text-light border-secondary"
                                                value={whitelistType}
                                                onChange={(e) => setWhitelistType(e.target.value)}
                                            >
                                                <option value="characterId">Character ID</option>
                                                <option value="username">Username</option>
                                            </Form.Select>
                                            <Form.Control
                                                placeholder={`Enter ${whitelistType === 'characterId' ? 'Character ID (e.g. 1234)' : 'Username (e.g. JohnDoe)'}`}
                                                value={newWhitelistEntry}
                                                onChange={(e) => setNewWhitelistEntry(e.target.value)}
                                                className="bg-dark text-light border-secondary"
                                            />
                                        </InputGroup>
                                    </Form.Group>
                                    <Button variant="success" type="submit" disabled={isProcessing || !newWhitelistEntry}>
                                        <i className="fas fa-user-plus me-2"></i>Whitelist User
                                    </Button>
                                </div>
                                <Form.Text className="text-muted mt-2 d-block">
                                    Whitelisted users gain READ access to the Morgue Intake Database even if they are not PHMC employees.
                                </Form.Text>
                            </Form>
                        </Card.Body>
                    </Card>

                    <Card className="bg-dark text-light border-secondary shadow">
                        <Card.Header className="border-secondary">
                            <h4 className="mb-0">Currently Whitelisted</h4>
                        </Card.Header>
                        <Card.Body className="p-0">
                            <Table striped bordered hover variant="dark" className="mb-0">
                                <thead>
                                    <tr>
                                        <th>Type</th>
                                        <th>Value</th>
                                        <th>Date Added</th>
                                        <th className="text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {morgueWhitelist && Object.keys(morgueWhitelist).length > 0 ? (
                                        Object.entries(morgueWhitelist).map(([key, entry]) => (
                                            <tr key={key}>
                                                <td>
                                                    <span className={`badge bg-${entry.type === 'username' ? 'info' : 'primary'}`}>
                                                        {entry.type === 'username' ? 'Username' : 'Character ID'}
                                                    </span>
                                                </td>
                                                <td><code className="text-light">{entry.id || entry.username}</code></td>
                                                <td className="small text-muted">
                                                    {entry.addedAt ? new Date(entry.addedAt).toLocaleString() : 'Unknown'}
                                                </td>
                                                <td className="text-center">
                                                    <Button 
                                                        variant="outline-danger" 
                                                        size="sm"
                                                        onClick={() => handleRemoveWhitelist(key)}
                                                    >
                                                        <i className="fas fa-user-minus me-2"></i>Remove
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="4" className="text-center p-4">No users are currently whitelisted.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </Table>
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
                        <Form.Text className="text-muted">
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
            `}</style>
        </div>
    );
};

export default MorgueManager;

