import React, { useState, useCallback, useEffect } from 'react';
import { Button, Form, Spinner, Card, Alert, Col, Row, ListGroup, Badge } from 'react-bootstrap';
import BaseModal from '../Modals/BaseModal';
import { ref, get, update, set, runTransaction } from 'firebase/database';
import { database } from '../../firebase';

import { logAdminAction, getUserContext } from '../../utils/logging';
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
    const [optionCategories, setOptionCategories] = useState([]);
    const [currentOptions, setCurrentOptions] = useState(null);
    const [newOptionLabel, setNewOptionLabel] = useState('');
    const [newOptionValue, setNewOptionValue] = useState('');
    const [isLoadingOptions, setIsLoadingOptions] = useState(false);

    // New state for metrics
    const [metrics, setMetrics] = useState(null);
    const [isFetchingMetrics, setIsFetchingMetrics] = useState(false);

    // Unused options scanner
    const [unusedOptions, setUnusedOptions] = useState(null);
    const [isScanningOptions, setIsScanningOptions] = useState(false);
    const [unusedFilter, setUnusedFilter] = useState('');
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [isDeletingUnused, setIsDeletingUnused] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const snapshot = await get(ref(database, '/selectOptions'));
                if (snapshot.exists()) {
                    setOptionCategories(Object.keys(snapshot.val()));
                }
            } catch (e) {
                // Silently fail — user can still type a category name manually
            }
        })();
    }, []);

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

    const handleCategorySelect = useCallback(async (category) => {
        if (!category) return;
        setOptionCategory(category);
        setIsLoadingOptions(true);
        try {
            const optionsRef = ref(database, `/selectOptions/${category}`);
            const snapshot = await get(optionsRef);
            if (snapshot.exists()) {
                setCurrentOptions(snapshot.val());
            } else {
                setCurrentOptions([]);
            }
        } catch (e) {
            showNotification(`Error loading options: ${e.message}`, 'error');
        } finally {
            setIsLoadingOptions(false);
        }
    }, [showNotification]);

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

    const handleScanUnusedOptions = useCallback(async () => {
        setIsScanningOptions(true);
        setUnusedOptions(null);
        try {
            const [formsSnapshot, optionsSnapshot] = await Promise.all([
                get(ref(database, '/forms')),
                get(ref(database, '/selectOptions'))
            ]);

            const templates = [];
            if (formsSnapshot.exists()) {
                const forms = formsSnapshot.val();
                for (const formId of Object.keys(forms)) {
                    const form = forms[formId];
                    if (form.template) templates.push(form.template);
                    if (form.bbcodeTemplate) templates.push(form.bbcodeTemplate);
                }
            }

            const allTemplateText = templates.join('\n').toLowerCase();
            const results = [];

            if (optionsSnapshot.exists()) {
                const categories = optionsSnapshot.val();
                for (const category of Object.keys(categories)) {
                    const options = categories[category];
                    if (!Array.isArray(options)) continue;
                    for (const opt of options) {
                        if (!opt || !opt.value) continue;
                        const value = String(opt.value);
                        const label = opt.label || value;
                        const usedInTemplates = allTemplateText.includes(value.toLowerCase()) ||
                            allTemplateText.includes(label.toLowerCase()) ||
                            allTemplateText.includes(`[cb:${category}]${value}`.toLowerCase()) ||
                            allTemplateText.includes(`{{${value}}}`.toLowerCase()) ||
                            allTemplateText.includes(value.replace(/\s+/g, '_').toLowerCase());
                        if (!usedInTemplates) {
                            results.push({ category, label, value });
                        }
                    }
                }
            }

            results.sort((a, b) => a.category.localeCompare(b.category) || a.label.localeCompare(b.label));
            setUnusedOptions(results);
        } catch (e) {
            showNotification(`Error scanning: ${e.message}`, 'error');
        } finally {
            setIsScanningOptions(false);
        }
    }, [showNotification]);

    const handleDeleteUnused = useCallback(async () => {
        if (!unusedOptions || unusedOptions.length === 0) return;
        setIsDeletingUnused(true);
        try {
            const { userAgent, timeZone } = getUserContext();

            // Group by category — one read+write per category
            const byCategory = {};
            unusedOptions.forEach(o => {
                if (!byCategory[o.category]) byCategory[o.category] = [];
                byCategory[o.category].push(o);
            });

            // Clear Firebase local cache before bulk writes to avoid quota overflow
            try {
                const storageKeys = Object.keys(localStorage).filter(k =>
                    k.startsWith('firebase:previous_') || k.startsWith('firebase:database:')
                );
                storageKeys.forEach(k => localStorage.removeItem(k));
            } catch { /* best effort */ }

            for (const category of Object.keys(byCategory)) {
                const categoryRef = ref(database, `/selectOptions/${category}`);
                const snapshot = await get(categoryRef);
                if (snapshot.exists()) {
                    let options = snapshot.val();
                    if (Array.isArray(options)) {
                        const valuesToRemove = new Set(byCategory[category].map(o => o.value));
                        options = options.filter(opt => !valuesToRemove.has(String(opt.value)));
                        await set(categoryRef, options);
                    }
                }
            }

            const versionRef = ref(database, 'appMetadata/selectOptionsDataVersion');
            await runTransaction(versionRef, (v) => (v || 0) + 1);

            logAdminAction(
                currentUser?.email || gtawUsername,
                'Bulk Deleted Unused Select Options',
                `Removed ${unusedOptions.length} unused options across ${Object.keys(byCategory).length} categories.`,
                'Database Editor',
                userAgent, timeZone, gtawUsername, gtawUser
            );

            showNotification(`Deleted ${unusedOptions.length} unused options.`, 'check-circle');
            setUnusedOptions(null);
            setShowDeleteModal(false);
        } catch (e) {
            showNotification(`Error deleting: ${e.message}`, 'error');
        } finally {
            setIsDeletingUnused(false);
        }
    }, [unusedOptions, showNotification, currentUser, gtawUser, gtawUsername]);

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
                        <div className="card-header py-3">
                            <i className="fas fa-pen me-2 text-indigo"></i> Database Editor
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

                            {/* Select Options Editor — integrated */}
                            <div className="mb-4 p-3 rounded bg-dark bg-opacity-50 border border-secondary border-opacity-25">
                                <h6 className="text-indigo small fw-bold mb-3"><i className="fas fa-list-ul me-1"></i>Select Options</h6>
                                <div className="mb-3 p-2 rounded" style={{ background: '#1a1a2e', borderLeft: '3px solid #60a5fa', fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.5 }}>
                                    <strong style={{ color: '#60a5fa' }}>Label</strong> is what users see in the dropdown. <strong style={{ color: '#60a5fa' }}>Value</strong> is what gets compared in <code style={{ color: '#f0c674' }}>[cb:fieldName]</code> BBCode tags — it must match the text after <code style={{ color: '#f0c674' }}>]</code> for checkboxes to highlight correctly.
                                </div>
                                <div className="input-group mb-3">
                                    <Form.Select
                                        className="bg-dark border-secondary text-white"
                                        value={optionCategory}
                                        onChange={(e) => handleCategorySelect(e.target.value)}
                                    >
                                        <option value="">— Choose category or type below —</option>
                                        {optionCategories.map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </Form.Select>
                                    <Form.Control
                                        type="text"
                                        className="bg-dark border-secondary text-white font-monospace"
                                        style={{ maxWidth: 200 }}
                                        value={optionCategory}
                                        onChange={(e) => setOptionCategory(e.target.value)}
                                        placeholder="Or type custom..."
                                    />
                                    <Button onClick={handleLoadCategory} disabled={isLoadingOptions || !optionCategory} variant="outline-primary">
                                        {isLoadingOptions ? <Spinner as="span" animation="border" size="sm" /> : 'Load'}
                                    </Button>
                                </div>

                                {currentOptions && (
                                    <div className="mt-3">
                                        <div className="d-flex justify-content-between align-items-center mb-2">
                                            <span className="text-muted extra-small uppercase fw-bold">Options</span>
                                            {currentOptions.length > 0 && <Badge bg="secondary">{currentOptions.length}</Badge>}
                                        </div>
                                        <div style={{ maxHeight: 240, overflowY: 'auto' }} className="border border-secondary border-opacity-25 rounded p-1">
                                            {currentOptions.length > 0 ? (
                                                currentOptions.map((opt, index) => (
                                                    <div key={index} className="d-flex justify-content-between align-items-center px-2 py-2 border-bottom border-secondary border-opacity-10">
                                                        <div className="d-flex align-items-center gap-2" style={{ minWidth: 0 }}>
                                                            <span className="text-white small fw-bold text-truncate">{opt.label}</span>
                                                            <code className="text-muted extra-small flex-shrink-0">{opt.value}</code>
                                                        </div>
                                                        <Button variant="link" className="text-danger p-0 flex-shrink-0" onClick={() => handleDeleteOption(index)} style={{ fontSize: '0.75rem' }}>
                                                            <i className="fas fa-trash-alt"></i>
                                                        </Button>
                                                    </div>
                                                ))
                                            ) : <p className="text-muted extra-small text-center py-2 mb-0">No entries.</p>}
                                        </div>
                                        <div className="d-flex gap-2 mt-2">
                                            <Form.Control size="sm" type="text" className="bg-black border-secondary text-white" value={newOptionLabel} onChange={(e) => setNewOptionLabel(e.target.value)} placeholder="Label" />
                                            <Form.Control size="sm" type="text" className="bg-black border-secondary text-white" value={newOptionValue} onChange={(e) => setNewOptionValue(e.target.value)} placeholder="Value" />
                                            <Button size="sm" onClick={handleAddNewOption} disabled={isLoadingOptions || !newOptionLabel || !newOptionValue} variant="primary" className="flex-shrink-0">Add</Button>
                                        </div>
                                    </div>
                                )}

                                {currentOptions && currentOptions.length > 0 && (
                                    <div className="mt-3 p-2 rounded" style={{ background: '#0a0e14', border: '1px solid #1e293b' }}>
                                        <span className="text-muted extra-small uppercase fw-bold mb-2 d-block">BBCode Preview</span>
                                        <div className="d-flex align-items-center gap-2 mb-2" style={{ fontSize: '0.78rem' }}>
                                            <span className="text-muted" style={{ minWidth: 60 }}>Dropdown:</span>
                                            <select disabled style={{ flex: 1, padding: '0.3rem 0.5rem', background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0', borderRadius: 4, fontSize: '0.78rem' }}>
                                                {currentOptions.map((opt, i) => (
                                                    <option key={i} value={opt.value}>{opt.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div style={{ maxHeight: 150, overflowY: 'auto', fontSize: '0.75rem', fontFamily: 'monospace', lineHeight: 1.8 }}>
                                            {currentOptions.map((opt, i) => (
                                                <div key={i} className="d-flex align-items-baseline gap-2 px-1" style={{ borderBottom: i < currentOptions.length - 1 ? '1px solid #1e293b' : 'none', padding: '2px 0' }}>
                                                    <span style={{ color: '#f0c674' }}>{'[cb:' + optionCategory + ']'}</span>
                                                    <span style={{ color: '#e2e8f0' }}>{opt.label}</span>
                                                    <span style={{ color: '#64748b', marginLeft: 'auto', fontSize: '0.65rem' }}>
                                                        compares against value: <span style={{ color: '#34d399' }}>{'"' + opt.value + '"'}</span>
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                            <Form.Group className="mb-4">
                                <Form.Label className="small text-muted uppercase fw-bold mb-2">JSON Structure Editor</Form.Label>
                                <Form.Control
                                    as="textarea"
                                    rows={14}
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
                </div>

                <div className="col-lg-4">

                    {/* Restore Section */}
                    <div className="card border-0 shadow-sm mb-4">
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

                    {/* Unused Options Scanner */}
                    <div className="card border-0 shadow-sm">
                        <div className="card-header"><i className="fas fa-search me-2 text-info"></i>Unused Select Options</div>
                        <div className="card-body p-4">
                            <Button onClick={handleScanUnusedOptions} disabled={isScanningOptions} variant="outline-info" size="sm" className="w-100 mb-3">
                                {isScanningOptions ? <Spinner as="span" animation="border" size="sm" /> : <><i className="fas fa-search me-1"></i> Scan All Templates</>}
                            </Button>

                            {unusedOptions !== null && (
                                <>
                                    <div className="d-flex justify-content-between align-items-center mb-2">
                                        <span className="text-muted extra-small uppercase fw-bold">{unusedOptions.length} unused</span>
                                        <div className="d-flex gap-1">
                                            {unusedOptions.length > 0 && (
                                                <>
                                                    <Form.Control
                                                        size="sm"
                                                        type="text"
                                                        className="bg-dark border-secondary text-white font-monospace"
                                                        style={{ maxWidth: 120, fontSize: '0.7rem' }}
                                                        placeholder="Filter..."
                                                        value={unusedFilter}
                                                        onChange={(e) => setUnusedFilter(e.target.value)}
                                                    />
                                                    <Button size="sm" variant="outline-danger" onClick={() => setShowDeleteModal(true)} style={{ fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
                                                        <i className="fas fa-trash-alt me-1"></i>Delete
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                                        {unusedOptions.length === 0 ? (
                                            <p className="text-muted extra-small text-center py-2 mb-0"><i className="fas fa-check-circle text-success me-1"></i>All options are in use.</p>
                                        ) : (
                                            unusedOptions
                                                .filter(o => !unusedFilter || o.value.toLowerCase().includes(unusedFilter.toLowerCase()) || o.label.toLowerCase().includes(unusedFilter.toLowerCase()))
                                                .map((o, i) => (
                                                    <div key={i} className="d-flex justify-content-between align-items-center px-2 py-1 border-bottom border-secondary border-opacity-10" style={{ fontSize: '0.75rem' }}>
                                                        <div className="d-flex align-items-center gap-2" style={{ minWidth: 0 }}>
                                                            <Badge bg="secondary" className="flex-shrink-0" style={{ fontSize: '0.6rem' }}>{o.category}</Badge>
                                                            <span className="text-white text-truncate">{o.label}</span>
                                                            <code className="text-muted flex-shrink-0" style={{ fontSize: '0.65rem' }}>{o.value}</code>
                                                        </div>
                                                    </div>
                                                ))
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Delete Confirmation Modal */}
                    <BaseModal
                        isOpen={showDeleteModal}
                        onClose={() => setShowDeleteModal(false)}
                        title={<><i className="fas fa-trash-alt me-2 text-danger"></i>Delete Unused Options</>}
                        modalSize="large"
                        variant="danger"
                        footer={
                            <>
                                <Button variant="secondary" size="sm" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
                                <Button variant="danger" size="sm" onClick={handleDeleteUnused} disabled={isDeletingUnused}>
                                    {isDeletingUnused ? <Spinner as="span" animation="border" size="sm" /> : 'Delete ' + (unusedOptions?.length || 0) + ' Option' + ((unusedOptions?.length || 0) !== 1 ? 's' : '')}
                                </Button>
                            </>
                        }
                    >
                        <p className="small text-danger mb-3"><i className="fas fa-exclamation-triangle me-1"></i>This will permanently remove {unusedOptions?.length || 0} unused option(s) across {new Set(unusedOptions?.map(o => o.category)).size} categor{(unusedOptions?.length || 0) > 1 ? 'ies' : 'y'}. This cannot be undone.</p>
                        {unusedOptions?.map((o, i) => (
                            <div key={i} className="d-flex align-items-center gap-2 px-2 py-1 border-bottom border-secondary border-opacity-10" style={{ fontSize: '0.8rem' }}>
                                <Badge bg="secondary" className="flex-shrink-0" style={{ fontSize: '0.6rem' }}>{o.category}</Badge>
                                <span className="fw-bold">{o.label}</span>
                                <code className="text-muted ms-auto" style={{ fontSize: '0.7rem' }}>{o.value}</code>
                            </div>
                        ))}
                    </BaseModal>
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
