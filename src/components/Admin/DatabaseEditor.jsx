import React, { useState } from 'react';
import { Button, Form, Spinner, Card, Alert } from 'react-bootstrap';
import { ref, get, update } from 'firebase/database'; // Changed set to update
import { database } from '../../firebase';

const DatabaseEditor = ({ showNotification }) => {
    const [path, setPath] = useState('/agencies');
    const [jsonData, setJsonData] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [restoreFile, setRestoreFile] = useState(null);
    const [isRestoring, setIsRestoring] = useState(false);

    const handleFetch = async () => {
        if (!path) {
            showNotification('Please enter a database path.', 'warning');
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const dbRef = ref(database, path);
            const snapshot = await get(dbRef);
            if (snapshot.exists()) {
                setJsonData(JSON.stringify(snapshot.val(), null, 2));
            } else {
                setJsonData('');
                showNotification('No data at this path.', 'info');
            }
        } catch (e) {
            setError(e.message);
            showNotification(`Error fetching data: ${e.message}`, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!path) {
            showNotification('Please enter a database path.', 'warning');
            return;
        }
        let dataToSave;
        try {
            dataToSave = JSON.parse(jsonData);
        } catch (e) {
            setError('Invalid JSON format.');
            showNotification('Invalid JSON format. Please correct it before saving.', 'error');
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            const dbRef = ref(database, path);
            // Using update instead of set to prevent overwriting entire nodes unintentionally
            await update(dbRef, dataToSave);
            showNotification('Data updated successfully!', 'check-circle');
        } catch (e) {
            setError(e.message);
            showNotification(`Error saving data: ${e.message}`, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRestoreReports = async () => {
        if (!restoreFile) {
            showNotification('Please select a JSON file to restore.', 'warning');
            return;
        }

        setIsRestoring(true);
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const fileContent = e.target.result;
                const parsedData = JSON.parse(fileContent);

                if (!parsedData.savedReports) {
                    showNotification('Invalid JSON: File must contain a "savedReports" key to restore reports.', 'error');
                    setIsRestoring(false);
                    return;
                }

                const reportsRef = ref(database, '/savedReports');
                await update(reportsRef, parsedData.savedReports);
                
                showNotification('Successfully restored saved reports from backup!', 'check-circle');
            } catch (err) {
                showNotification(`Error processing file: ${err.message}`, 'error');
                console.error(err);
            } finally {
                setIsRestoring(false);
            }
        };
        reader.onerror = (err) => {
            showNotification(`Error reading file: ${err.message}`, 'error');
            setIsRestoring(false);
        };
        reader.readAsText(restoreFile);
    };

    const handleRestoreBBCode = async () => {
        if (!restoreFile) {
            showNotification('Please select a JSON file to restore.', 'warning');
            return;
        }

        setIsRestoring(true);
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const fileContent = e.target.result;
                const parsedData = JSON.parse(fileContent);

                if (!parsedData.savedReportBBCode) {
                    showNotification('Invalid JSON: File must contain a "savedReportBBCode" key to restore BBCode.', 'error');
                    setIsRestoring(false);
                    return;
                }

                const bbCodeRef = ref(database, '/savedReportBBCode');
                await update(bbCodeRef, parsedData.savedReportBBCode);
                
                showNotification('Successfully restored saved BBCode from backup!', 'check-circle');
            } catch (err) {
                showNotification(`Error processing file: ${err.message}`, 'error');
                console.error(err);
            } finally {
                setIsRestoring(false);
            }
        };
        reader.onerror = (err) => {
            showNotification(`Error reading file: ${err.message}`, 'error');
            setIsRestoring(false);
        };
        reader.readAsText(restoreFile);
    };

    return (
        <>
            <Card className="mb-4">
                <Card.Header>Firebase Realtime Database Editor</Card.Header>
                <Card.Body>
                    <Alert variant="warning">
                        <i className="fas fa-exclamation-triangle me-2"></i>
                        <strong>Warning:</strong> Editing the database directly can cause permanent data loss. Proceed with caution.
                    </Alert>
                    <Form.Group className="mb-3">
                        <Form.Label>Database Path</Form.Label>
                        <Form.Control
                            type="text"
                            value={path}
                            onChange={(e) => setPath(e.target.value)}
                            placeholder="e.g., /agencies/LSSD"
                        />
                    </Form.Group>
                    <Button onClick={handleFetch} disabled={isLoading} className="me-2">
                        {isLoading ? <Spinner as="span" animation="border" size="sm" /> : 'Fetch Data'}
                    </Button>
                    <hr />
                    <Form.Group className="mb-3">
                        <Form.Label>JSON Data</Form.Label>
                        <Form.Control
                            as="textarea"
                            rows={20}
                            value={jsonData}
                            onChange={(e) => setJsonData(e.target.value)}
                            placeholder="JSON data will appear here..."
                        />
                    </Form.Group>
                    {error && <Alert variant="danger">{error}</Alert>}
                    <Button onClick={handleSave} disabled={isLoading}>
                        {isLoading ? <Spinner as="span" animation="border" size="sm" /> : 'Update Data at Path'}
                    </Button>
                </Card.Body>
            </Card>

                <Card.Header>Restore from JSON Backup</Card.Header>
                <Card.Body>
                    <Form.Group controlId="formFile" className="mb-3">
                        <Form.Label>Select JSON Backup File</Form.Label>
                        <Form.Control 
                            type="file" 
                            accept=".json"
                            onChange={(e) => setRestoreFile(e.target.files[0])}
                        />
                    </Form.Group>
                    <Button onClick={handleRestoreReports} disabled={isRestoring} className="me-2">
                        {isRestoring ? <Spinner as="span" animation="border" size="sm" /> : 'Restore `savedReports`'}
                    </Button>
                    <Button onClick={handleRestoreBBCode} disabled={isRestoring} variant="secondary">
                        {isRestoring ? <Spinner as="span" animation="border" size="sm" /> : 'Restore `savedReportBBCode`'}
                    </Button>
                </Card.Body>
        </>
    );
};

export default DatabaseEditor;
