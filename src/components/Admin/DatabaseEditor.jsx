import React, { useState, useCallback } from 'react';
import { Button, Form, Spinner, Card, Alert, Col, Row, ListGroup } from 'react-bootstrap';
import { ref, get, update, set } from 'firebase/database';
import { database } from '../../firebase';

import { logAdminAction, getUserContext } from '../../utils/adminLogger';
import useGtaWorldAuth from '../../hooks/useGtaWorldAuth';

const DatabaseEditor = ({ showNotification, currentUser: propCurrentUser, gtawUser: propGtawUser }) => {
    const { user: gtawUser, username: gtawUsername } = useGtaWorldAuth();
    const currentUser = propCurrentUser || gtawUser;
    const [path, setPath] = useState('/agencies');
    const [jsonData, setJsonData] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [restoreFile, setRestoreFile] = useState(null);
    const [isRestoring, setIsRestoring] = useState(false);

    // New state for Select Options editor
    const [optionCategory, setOptionCategory] = useState('');
    const [currentOptions, setCurrentOptions] = useState(null); // null if not loaded, array if loaded
    const [newOptionLabel, setNewOptionLabel] = useState('');
    const [newOptionValue, setNewOptionValue] = useState('');
    const [isLoadingOptions, setIsLoadingOptions] = useState(false);

    const handleFetch = async () => {
        if (!path) {
            showNotification('Please enter a database path.', 'warning');
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const { userAgent, timeZone } = getUserContext();
            logAdminAction(
                currentUser?.email || gtawUsername,
                'Fetched Database Path',
                `Path: ${path}`,
                'Database Editor',
                userAgent,
                timeZone,
                gtawUsername,
                gtawUser
            );
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
            const { userAgent, timeZone } = getUserContext();
            logAdminAction(
                currentUser?.email || gtawUsername,
                'Saved Data to Database',
                `Path: ${path}\nData: ${jsonData.substring(0, 500)}...`,
                'Database Editor',
                userAgent,
                timeZone,
                gtawUsername,
                gtawUser
            );
            const dbRef = ref(database, path);
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
                const { userAgent, timeZone } = getUserContext();
                logAdminAction(
                    currentUser?.email || gtawUsername,
                    'Restored Reports from Backup',
                    `File: ${restoreFile.name}`,
                    'Database Editor',
                    userAgent,
                    timeZone,
                    gtawUsername,
                    gtawUser
                );
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
                const { userAgent, timeZone } = getUserContext();
                logAdminAction(
                    currentUser?.email || gtawUsername,
                    'Restored BBCode from Backup',
                    `File: ${restoreFile.name}`,
                    'Database Editor',
                    userAgent,
                    timeZone,
                    gtawUsername,
                    gtawUser
                );

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

    const handleLoadCategory = useCallback(async () => {
        if (!optionCategory) {
            showNotification('Please enter an option category name.', 'warning');
            return;
        }
        setIsLoadingOptions(true);
        try {
            const { userAgent, timeZone } = getUserContext();
            logAdminAction(
                currentUser?.email || gtawUsername,
                'Loaded Select Options Category',
                `Category: ${optionCategory}`,
                'Database Editor',
                userAgent,
                timeZone,
                gtawUsername,
                gtawUser
            );
            const optionsRef = ref(database, `/selectOptions/${optionCategory}`);
            const snapshot = await get(optionsRef);
            if (snapshot.exists()) {
                setCurrentOptions(snapshot.val());
            } else {
                setCurrentOptions([]); // Category doesn't exist, start with an empty array
                showNotification(`Category "${optionCategory}" does not exist. You can add the first option to create it.`, 'info');
            }
        } catch (e) {
            showNotification(`Error fetching options: ${e.message}`, 'error');
            setCurrentOptions(null); // Reset on error
        } finally {
            setIsLoadingOptions(false);
        }
    }, [optionCategory, showNotification, currentUser, gtawUser, gtawUsername]);

    const handleAddNewOption = async () => {
        if (!newOptionLabel || !newOptionValue) {
            showNotification('Please provide both a label and a value for the new option.', 'warning');
            return;
        }

        setIsLoadingOptions(true);

        const newOption = { label: newOptionLabel, value: newOptionValue };
        const updatedOptions = [...(currentOptions || []), newOption];

        try {
            const { userAgent, timeZone } = getUserContext();
            logAdminAction(
                currentUser?.email || gtawUsername,
                'Added New Select Option',
                `Category: ${optionCategory}\nLabel: ${newOptionLabel}\nValue: ${newOptionValue}`,
                'Database Editor',
                userAgent,
                timeZone,
                gtawUsername,
                gtawUser
            );
            const categoryRef = ref(database, `/selectOptions/${optionCategory}`);
            await set(categoryRef, updatedOptions);
            
            showNotification('Option added successfully!', 'check-circle');
            
            setCurrentOptions(updatedOptions);
            setNewOptionLabel('');
            setNewOptionValue('');
        } catch (e) {
            showNotification(`Error adding option: ${e.message}`, 'error');
        } finally {
            setIsLoadingOptions(false);
        }
    };

    const handleDeleteOption = async (indexToDelete) => {
        if (!window.confirm('Are you sure you want to delete this option? This action cannot be undone.')) {
            return;
        }

        setIsLoadingOptions(true);
        const optionToDelete = currentOptions[indexToDelete];
        const updatedOptions = currentOptions.filter((_, index) => index !== indexToDelete);

        try {
            const { userAgent, timeZone } = getUserContext();
            logAdminAction(
                currentUser?.email || gtawUsername,
                'Deleted Select Option',
                `Category: ${optionCategory}\nLabel: ${optionToDelete.label}\nValue: ${optionToDelete.value}`,
                'Database Editor',
                userAgent,
                timeZone,
                gtawUsername,
                gtawUser
            );
            const categoryRef = ref(database, `/selectOptions/${optionCategory}`);
            await set(categoryRef, updatedOptions);
            
            showNotification('Option deleted successfully!', 'check-circle');
            
            // Refresh the list in the UI
            setCurrentOptions(updatedOptions);
        } catch (e) {
            showNotification(`Error deleting option: ${e.message}`, 'error');
        } finally {
            setIsLoadingOptions(false);
        }
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

            <Card className="mb-4">
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
            </Card>

            <Card className="mt-4">
                <Card.Header>Select Options Editor</Card.Header>
                <Card.Body>
                    <Form.Group as={Row} className="mb-3">
                        <Form.Label column sm={2}>Option Category</Form.Label>
                        <Col sm={10}>
                            <div className="d-flex">
                                <Form.Control
                                    type="text"
                                    value={optionCategory}
                                    onChange={(e) => setOptionCategory(e.target.value)}
                                    placeholder="e.g., dnrTypes"
                                />
                                <Button onClick={handleLoadCategory} disabled={isLoadingOptions || !optionCategory} className="ms-2">
                                    {isLoadingOptions ? <Spinner as="span" animation="border" size="sm" /> : 'Load'}
                                </Button>
                            </div>
                        </Col>
                    </Form.Group>

                    {currentOptions && (
                        <>
                            <hr />
                            <h5>Current Options for "{optionCategory}"</h5>
                            {currentOptions.length > 0 ? (
                                <ListGroup style={{ maxHeight: '200px', overflowY: 'auto' }} className="mb-3">
                                    {currentOptions.map((opt, index) => (
                                        <ListGroup.Item key={index} className="d-flex justify-content-between align-items-center">
                                            <div>
                                                <strong>Label:</strong> {opt.label} <br />
                                                <strong>Value:</strong> {opt.value}
                                            </div>
                                            <Button variant="danger" size="sm" onClick={() => handleDeleteOption(index)}>
                                                Delete
                                            </Button>
                                        </ListGroup.Item>
                                    ))}
                                </ListGroup>
                            ) : <p>No options found for this category. Add one below.</p>}

                            <h5>Add New Option</h5>
                            <Form.Group as={Row} className="mb-2">
                                <Form.Label column sm={2}>New Label</Form.Label>
                                <Col sm={10}>
                                    <Form.Control
                                        type="text"
                                        value={newOptionLabel}
                                        onChange={(e) => setNewOptionLabel(e.target.value)}
                                        placeholder="e.g., Full Code"
                                    />
                                </Col>
                            </Form.Group>
                            <Form.Group as={Row} className="mb-3">
                                <Form.Label column sm={2}>New Value</Form.Label>
                                <Col sm={10}>
                                    <Form.Control
                                        type="text"
                                        value={newOptionValue}
                                        onChange={(e) => setNewOptionValue(e.target.value)}
                                        placeholder="e.g., full_code"
                                    />
                                </Col>
                            </Form.Group>
                            <Button onClick={handleAddNewOption} disabled={isLoadingOptions}>
                                {isLoadingOptions ? <Spinner as="span" animation="border" size="sm" /> : 'Add Option'}
                            </Button>
                        </>
                    )}
                </Card.Body>
            </Card>
        </>
    );
};

export default DatabaseEditor;

