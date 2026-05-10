import React, { useState, useCallback } from 'react';
import { Button, Form, Spinner, Card, Alert, Col, Row, ListGroup, Badge } from 'react-bootstrap';
import { ref, get, update, set, runTransaction } from 'firebase/database';
import { database } from '../../firebase';

import { logAdminAction, getUserContext } from '../../utils/adminLogger';
import useGtaWorldAuth from '../../hooks/useGtaWorldAuth';

const versionToNameMap = new Map([
    [1, 'Coroner Report'],
    [4, 'Mass Fatality Report'],
    [11, 'Mass Fatality Report (v11)']
]);

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

    // New state for metrics
    const [metrics, setMetrics] = useState(null);
    const [isFetchingMetrics, setIsFetchingMetrics] = useState(false);

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

            // Bump global version
            const versionRef = ref(database, 'appMetadata/selectOptionsDataVersion');
            await runTransaction(versionRef, (currentVersion) => (currentVersion || 0) + 1);
            
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

            // Bump global version
            const versionRef = ref(database, 'appMetadata/selectOptionsDataVersion');
            await runTransaction(versionRef, (currentVersion) => (currentVersion || 0) + 1);
            
            showNotification('Option deleted successfully!', 'check-circle');
            
            // Refresh the list in the UI
            setCurrentOptions(updatedOptions);
        } catch (e) {
            showNotification(`Error deleting option: ${e.message}`, 'error');
        } finally {
            setIsLoadingOptions(false);
        }
    };

    const handleFetchMetrics = async () => {
        setIsFetchingMetrics(true);
        setMetrics(null);
        try {
            const { userAgent, timeZone } = getUserContext();
            logAdminAction(
                currentUser?.email || gtawUsername,
                'Fetched Database Metrics',
                'Triggered fetching of database metrics.',
                'Database Editor',
                userAgent,
                timeZone,
                gtawUsername,
                gtawUser
            );

            const [newReportsSnapshot, legacyReportsSnapshot] = await Promise.all([
                get(ref(database, 'newSavedReports')),
                get(ref(database, 'savedReports'))
            ]);

            const allReports = [];
            if (newReportsSnapshot.exists()) {
                const newReports = newReportsSnapshot.val();
                for (const user in newReports) {
                    for (const reportId in newReports[user]) {
                        allReports.push({ ...newReports[user][reportId], author: user });
                    }
                }
            }
            if (legacyReportsSnapshot.exists()) {
                const legacyReports = legacyReportsSnapshot.val();
                for (const user in legacyReports) {
                    for (const reportId in legacyReports[user]) {
                        allReports.push({ ...legacyReports[user][reportId], author: user, isLegacy: true });
                    }
                }
            }

            const totalReports = allReports.length;
            const reportTypes = allReports.reduce((acc, report) => {
                const type = report.isLegacy 
                    ? `${versionToNameMap.get(report.bbCodeVersion) || `Legacy (v${report.bbCodeVersion})`} (LEGACY)`
                    : `${report.formName || 'Unknown'} (MODERN)`;
                acc[type] = (acc[type] || 0) + 1;
                return acc;
            }, {});

            const topUsers = allReports.reduce((acc, report) => {
                const user = report.authorName || report.author || 'Unknown';
                acc[user] = (acc[user] || 0) + 1;
                return acc;
            }, {});

            const sortedTopUsers = Object.entries(topUsers).sort(([, a], [, b]) => b - a).slice(0, 10);

            setMetrics({
                totalReports,
                reportTypes: Object.entries(reportTypes).sort(([, a], [, b]) => b - a),
                topUsers: sortedTopUsers,
            });

        } catch (e) {
            setError(e.message);
            showNotification(`Error fetching metrics: ${e.message}`, 'error');
        } finally {
            setIsFetchingMetrics(false);
        }
    };

    return (
        <div className="admin-section">
            <div className="d-flex justify-content-between align-items-center mb-5">
                <h2 className="mb-0 fw-800"><i className="fas fa-database me-3 text-indigo"></i>Database Editor</h2>
                <div className="d-flex gap-2">
                    <Button onClick={handleFetch} disabled={isLoading} className="admin-btn admin-btn-primary shadow-sm">
                        {isLoading ? <Spinner as="span" animation="border" size="sm" /> : <><i className="fas fa-download me-2"></i>Fetch Data</>}
                    </Button>
                    <Button onClick={handleFetchMetrics} disabled={isFetchingMetrics} variant="info" className="admin-btn text-white shadow-sm">
                        {isFetchingMetrics ? <Spinner as="span" animation="border" size="sm" /> : <><i className="fas fa-chart-pie me-2"></i>Analytics</>}
                    </Button>
                </div>
            </div>

            <div className="row g-4">
                <div className="col-lg-8">
                    <div className="card border-0 shadow-sm mb-4">
                        <div className="card-header bg-warning bg-opacity-10 text-warning border-warning border-opacity-25 py-3">
                            <i className="fas fa-exclamation-triangle me-2"></i> Direct Write Warning
                        </div>
                        <div className="card-body p-4">
                            <Form.Group className="mb-4">
                                <Form.Label className="small text-muted uppercase fw-bold mb-2">Target Database Path</Form.Label>
                                <Form.Control
                                    type="text"
                                    className="bg-dark border-secondary text-white font-monospace"
                                    value={path}
                                    onChange={(e) => setPath(e.target.value)}
                                    placeholder="e.g., /agencies/LSSD"
                                />
                            </Form.Group>

                            <Form.Group className="mb-4">
                                <Form.Label className="small text-muted uppercase fw-bold mb-2">JSON Structure Editor</Form.Label>
                                <Form.Control
                                    as="textarea"
                                    rows={18}
                                    className="admin-code-editor"
                                    value={jsonData}
                                    onChange={(e) => setJsonData(e.target.value)}
                                    placeholder='{ "key": "value" }'
                                />
                            </Form.Group>

                            {error && <Alert variant="danger" className="border-0 shadow-sm mb-4">{error}</Alert>}

                            <Button 
                                onClick={handleSave} 
                                disabled={isLoading || !jsonData} 
                                variant="success" 
                                className="w-100 py-3 admin-btn shadow-lg fw-bold"
                            >
                                {isLoading ? <Spinner as="span" animation="border" size="sm" /> : <><i className="fas fa-save me-2"></i>Commit Changes to Path</>}
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="col-lg-4">
                    {/* Select Options Editor */}
                    <div className="card border-0 shadow-sm mb-4">
                        <div className="card-header"><i className="fas fa-list-ul me-2 text-indigo"></i>Select Options</div>
                        <div className="card-body p-4">
                            <div className="input-group mb-3">
                                <Form.Control
                                    type="text"
                                    className="bg-dark border-secondary text-white"
                                    value={optionCategory}
                                    onChange={(e) => setOptionCategory(e.target.value)}
                                    placeholder="Category ID..."
                                />
                                <Button onClick={handleLoadCategory} disabled={isLoadingOptions || !optionCategory} variant="outline-primary">
                                    {isLoadingOptions ? <Spinner as="span" animation="border" size="sm" /> : 'Load'}
                                </Button>
                            </div>

                            {currentOptions && (
                                <div className="mt-4 admin-section">
                                    <h6 className="text-muted small uppercase fw-bold mb-3">Active Options</h6>
                                    <div className="list-group list-group-flush bg-transparent border-top border-secondary border-opacity-25">
                                        {currentOptions.length > 0 ? (
                                            currentOptions.map((opt, index) => (
                                                <div key={index} className="list-group-item bg-transparent border-secondary border-opacity-25 px-0 py-3 d-flex justify-content-between align-items-center">
                                                    <div>
                                                        <div className="text-white fw-bold small">{opt.label}</div>
                                                        <code className="text-muted extra-small">{opt.value}</code>
                                                    </div>
                                                    <Button variant="link" className="text-danger p-0" onClick={() => handleDeleteOption(index)}>
                                                        <i className="fas fa-trash-alt"></i>
                                                    </Button>
                                                </div>
                                            ))
                                        ) : <p className="text-muted small italic my-3">No entries found.</p>}
                                    </div>

                                    <div className="mt-4 p-3 rounded bg-dark border border-secondary border-opacity-25">
                                        <h6 className="text-indigo small fw-bold mb-3">Add Entry</h6>
                                        <Form.Control size="sm" type="text" className="bg-black border-secondary text-white mb-2" value={newOptionLabel} onChange={(e) => setNewOptionLabel(e.target.value)} placeholder="Display Label" />
                                        <Form.Control size="sm" type="text" className="bg-black border-secondary text-white mb-3" value={newOptionValue} onChange={(e) => setNewOptionValue(e.target.value)} placeholder="Internal Value" />
                                        <Button size="sm" onClick={handleAddNewOption} disabled={isLoadingOptions} variant="primary" className="w-100">Add Option</Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Restore Section */}
                    <div className="card border-0 shadow-sm">
                        <div className="card-header"><i className="fas fa-history me-2 text-warning"></i>Backup & Restore</div>
                        <div className="card-body p-4">
                            <Form.Group className="mb-4">
                                <Form.Label className="small text-muted uppercase fw-bold">JSON Backup File</Form.Label>
                                <Form.Control 
                                    type="file" 
                                    accept=".json"
                                    className="bg-dark border-secondary text-white small"
                                    onChange={(e) => setRestoreFile(e.target.files[0])}
                                />
                            </Form.Group>
                            <div className="d-grid gap-2">
                                <Button onClick={handleRestoreReports} disabled={isRestoring} variant="outline-warning" size="sm">
                                    {isRestoring ? <Spinner as="span" animation="border" size="sm" /> : 'Restore Reports'}
                                </Button>
                                <Button onClick={handleRestoreBBCode} disabled={isRestoring} variant="outline-secondary" size="sm">
                                    {isRestoring ? <Spinner as="span" animation="border" size="sm" /> : 'Restore BBCode'}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Metrics View */}
            {metrics && (
                <div className="mt-5 admin-section">
                    <h3 className="mb-4 fw-800"><i className="fas fa-chart-pie me-3 text-indigo"></i>Database Statistics</h3>
                    <div className="admin-stat-row">
                        <div className="admin-stat-card">
                            <span className="stat-label">Total Document Count</span>
                            <span className="stat-value">{metrics.totalReports}</span>
                        </div>
                    </div>

                    <div className="row g-4">
                        <div className="col-md-6">
                            <div className="card border-0 shadow-sm">
                                <div className="card-header">Report Distribution</div>
                                <div className="card-body p-0">
                                    <div className="admin-modern-table">
                                        <Table hover size="sm">
                                            <thead>
                                                <tr><th>Type / Version</th><th className="text-end">Count</th></tr>
                                            </thead>
                                            <tbody>
                                                {metrics.reportTypes.map(([type, count]) => (
                                                    <tr key={type}>
                                                        <td><span className="small">{type}</span></td>
                                                        <td className="text-end fw-bold"><span className="admin-badge admin-badge-indigo">{count}</span></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </Table>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="col-md-6">
                            <div className="card border-0 shadow-sm">
                                <div className="card-header">Most Productive Users</div>
                                <div className="card-body p-0">
                                    <div className="admin-modern-table">
                                        <Table hover size="sm">
                                            <thead>
                                                <tr><th>UCP / Author</th><th className="text-end">Submissions</th></tr>
                                            </thead>
                                            <tbody>
                                                {metrics.topUsers.map(([user, count]) => (
                                                    <tr key={user}>
                                                        <td className="fw-bold">{user}</td>
                                                        <td className="text-end"><span className="admin-badge admin-badge-success">{count}</span></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </Table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <style>{`
                .fw-800 { font-weight: 800; }
                .uppercase { text-transform: uppercase; }
                .extra-small { font-size: 0.7rem; }
            `}</style>
        </div>
    );
};

export default DatabaseEditor;
