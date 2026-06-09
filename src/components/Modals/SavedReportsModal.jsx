import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button, Form, Spinner } from 'react-bootstrap';
import Select from 'react-select';
import BaseModal from './BaseModal';

// Common form types used in the application
const AVAILABLE_FORMS = [
    { value: 'coroner-report', label: 'Coroner Report' },
    { value: 'mass-ftality-test', label: 'Mass Fatality Report' },
    { value: 'coroner_email', label: 'Coroner Email' },
    { value: 'death-record', label: 'Death Record' },
    { value: 'autopsy', label: 'Autopsy Report' },
];

const STORAGE_KEY = 'savedReportsFormFilter';

const SavedReportsModal = ({ 
    show, 
    onHide, 
    employeeOptions, 
    currentPhmcEmployee, 
    currentCoronerEmployee, 
    showNotification, 
    loadReport, 
    deleteReportForUser, 
    reportsForSelectedUser = [], 
    isLoadingReports, 
    isAttachMode, 
    handleReportSelectedForAttachment, 
    loadButtonText, 
    isParseDecedentMode, 
    pendingReportAttachmentCallback, 
    loadReportForUser, 
    onEmployeeSelect,
    preselectedEmployeeType,
    reportSelectionFilter
}) => {
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const reportsPerPage = 10;
    const [selectedReportKeys, setSelectedReportKeys] = useState([]);
    const [selectedForms, setSelectedForms] = useState([]);
    const [isFilterActive, setIsFilterActive] = useState(false);

    // Check if we're in a localhost environment
    const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    // Build employee options — always include GTAW Dev on localhost regardless of OAuth data
    const effectiveEmployeeOptions = useMemo(() => {
        const base = (employeeOptions && employeeOptions.length > 0) ? [...employeeOptions] : [];
        
        if (isLocalhost) {
            // Prepend GTAW Dev group so it's always available (reports save under this name)
            base.unshift({
                label: 'Local Development',
                options: [
                    { value: 'GTAW Dev', label: '🔧 GTAW Dev (testing)' }
                ]
            });
        }
        
        return base;
    }, [employeeOptions, isLocalhost]);

    // Initialize selected employee when modal opens
    useEffect(() => {
        if (show) {
            // Load saved form filter from localStorage
            try {
                const savedFilter = localStorage.getItem(STORAGE_KEY);
                if (savedFilter) {
                    const savedFormIds = JSON.parse(savedFilter);
                    const selectedFormObjects = AVAILABLE_FORMS.filter(f => savedFormIds.includes(f.value));
                    setSelectedForms(selectedFormObjects);
                    setIsFilterActive(selectedFormObjects.length > 0);
                }
            } catch (e) {
                console.error('Error loading form filter from localStorage:', e);
            }

            let initialEmployeeValue = null;
            if (isLocalhost) {
                initialEmployeeValue = 'GTAW Dev';
            } else if (preselectedEmployeeType === 'PHMC' && currentPhmcEmployee) {
                initialEmployeeValue = currentPhmcEmployee;
            } else if (preselectedEmployeeType === 'Coroner' && currentCoronerEmployee) {
                initialEmployeeValue = currentCoronerEmployee;
            } else if (currentPhmcEmployee) {
                initialEmployeeValue = currentPhmcEmployee;
            } else if (currentCoronerEmployee) {
                initialEmployeeValue = currentCoronerEmployee;
            }

            if (initialEmployeeValue) {
                const option = effectiveEmployeeOptions?.flatMap(g => g.options).find(o => o.value === initialEmployeeValue);
                if (option) {
                    setSelectedEmployee(option);
                    if (onEmployeeSelect) onEmployeeSelect(option.value);
                }
            }
            setSelectedReportKeys([]);
            setCurrentPage(1);
        }
    }, [show, currentPhmcEmployee, currentCoronerEmployee, effectiveEmployeeOptions, preselectedEmployeeType, onEmployeeSelect, isLocalhost]);

    const handleEmployeeChange = (option) => {
        setSelectedEmployee(option);
        if (onEmployeeSelect) onEmployeeSelect(option?.value);
        setCurrentPage(1);
    };

    const handleSaveFormFilter = useCallback(() => {
        try {
            const selectedFormIds = selectedForms.map(f => f.value);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedFormIds));
            setIsFilterActive(selectedForms.length > 0);
            setCurrentPage(1);
            showNotification(`Form filter saved! Showing ${selectedForms.length > 0 ? selectedForms.length + ' selected form(s)' : 'all reports'}.`, 'check-circle');
        } catch (e) {
            console.error('Error saving form filter:', e);
            showNotification('Failed to save form filter.', 'error');
        }
    }, [selectedForms, showNotification]);

    const handleClearFilter = useCallback(() => {
        try {
            localStorage.removeItem(STORAGE_KEY);
            setSelectedForms([]);
            setIsFilterActive(false);
            setCurrentPage(1);
            showNotification('Form filter cleared. Showing all reports.', 'check-circle');
        } catch (e) {
            console.error('Error clearing form filter:', e);
        }
    }, [showNotification]);

    const filteredReports = useMemo(() => {
        if (!reportsForSelectedUser) return [];
        let filtered = reportsForSelectedUser.filter(r => 
            r.originalKey?.toLowerCase().includes(searchQuery.toLowerCase())
        );
        
        // Apply form type filter if specified (for attachment mode)
        if (reportSelectionFilter && reportSelectionFilter.allowedFormIds) {
            filtered = filtered.filter(r => 
                reportSelectionFilter.allowedFormIds.includes(r.formId)
            );
        }

        // Apply user-selected form filter if active
        if (isFilterActive && selectedForms.length > 0) {
            const selectedFormIds = selectedForms.map(f => f.value);
            filtered = filtered.filter(r => selectedFormIds.includes(r.formId));
        }
        
        return filtered;
    }, [reportsForSelectedUser, searchQuery, reportSelectionFilter, isFilterActive, selectedForms]);

    const totalPages = Math.ceil(filteredReports.length / reportsPerPage);
    const currentReports = filteredReports.slice((currentPage - 1) * reportsPerPage, currentPage * reportsPerPage);

    const handleLoadAction = (report) => {
        if (isParseDecedentMode && pendingReportAttachmentCallback) {
            loadReportForUser(report, selectedEmployee.value, true).then((result) => {
                if (result.success && pendingReportAttachmentCallback) {
                    pendingReportAttachmentCallback(result.reportData);
                }
            });
        } else if (isAttachMode) {
            // First, load the full report data including BBCode
            loadReportForUser(report, selectedEmployee.value, true).then((result) => {
                if (result.success) {
                    // Then, call the attachment handler with the full data
                    handleReportSelectedForAttachment(result.reportData, result.reportData.data, result.reportData.bbCodeVersion, result.reportData.bbCode);
                } else {
                    showNotification('Failed to load report for attachment.', 'error');
                }
            });
        } else {
            loadReport(report, selectedEmployee.value);
        }
        onHide();
    };

    const reactSelectStyles = {
        control: (base) => ({ ...base, backgroundColor: '#161b22', borderColor: '#30363d', color: '#e6edf3' }),
        menu: (base) => ({ ...base, backgroundColor: '#161b22', zIndex: 9999 }),
        option: (base, state) => ({ 
            ...base, 
            backgroundColor: state.isFocused ? '#30363d' : '#161b22', 
            color: '#e6edf3',
            '&:active': { backgroundColor: '#0066cc' }
        }),
        singleValue: (base) => ({ ...base, color: '#e6edf3' }),
        input: (base) => ({ ...base, color: '#e6edf3' }),
        placeholder: (base) => ({ ...base, color: '#7d8590' })
    };

    const getButtonLabel = () => {
        if (isAttachMode) return 'Attach';
        if (isParseDecedentMode) return 'Parse';
        return loadButtonText || 'Load';
    };

    const extractOocNames = (report) => {
        if (!report || !report.data) return null;
        
        const oocNames = [];
        
        // Check for multi-decedent (Mass Fatality / Multi Fatality)
        if (Array.isArray(report.data.decedents)) {
            const oocSet = new Set();
            report.data.decedents.forEach(dec => {
                if (dec.decedentOOC) {
                    oocSet.add(dec.decedentOOC);
                }
            });
            oocNames.push(...Array.from(oocSet));
        }
        // Fallback to single decedent OOC
        else if (report.data.decedentOOC && report.data.decedentOOC !== 'N/A') {
            oocNames.push(...report.data.decedentOOC.split(',').map(s => s.trim()).filter(Boolean));
        }
        
        return oocNames.length > 0 ? oocNames : null;
    };


    return (
        <BaseModal
            isOpen={show}
            onClose={onHide}
            title="Saved Reports"
            modalSize="xl"
            variant="info"
            footer={
                <Button variant="secondary" onClick={onHide}>Close</Button>
            }
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <Form.Group>
                        <Form.Label style={{ color: '#8b949e', fontWeight: '600' }}>Search Reports</Form.Label>
                        <Form.Control 
                            type="text" 
                            placeholder="Filter by name/identifier..." 
                            value={searchQuery} 
                            onChange={e => setSearchQuery(e.target.value)}
                            style={{ backgroundColor: '#161b22', color: '#e6edf3', borderColor: '#30363d', padding: '10px' }}
                            disabled={!selectedEmployee}
                        />
                    </Form.Group>
                    <Form.Group>
                        <Form.Label style={{ color: '#8b949e', fontWeight: '600' }}>Select Employee</Form.Label>
                        <Select 
                            options={effectiveEmployeeOptions} 
                            value={selectedEmployee} 
                            onChange={handleEmployeeChange}
                            placeholder="Search or select employee..."
                            styles={reactSelectStyles}
                        />
                    </Form.Group>
                </div>

                <div style={{ backgroundColor: '#161b22', padding: '15px', borderRadius: '8px', border: '1px solid #30363d' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '15px' }}>
                        <div style={{ flex: 1 }}>
                            <Form.Label style={{ color: '#8b949e', fontWeight: '600', marginBottom: '10px', display: 'block' }}>
                                📋 Filter by Form Type
                            </Form.Label>
                            <Select 
                                isMulti
                                options={AVAILABLE_FORMS}
                                value={selectedForms}
                                onChange={(selected) => setSelectedForms(selected || [])}
                                placeholder="Select form types to display..."
                                styles={reactSelectStyles}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '8px', paddingTop: '24px' }}>
                            <Button 
                                variant="primary" 
                                size="sm"
                                onClick={handleSaveFormFilter}
                                style={{ fontWeight: '600' }}
                            >
                                💾 Save Options
                            </Button>
                            {isFilterActive && (
                                <Button 
                                    variant="outline-secondary" 
                                    size="sm"
                                    onClick={handleClearFilter}
                                    style={{ fontWeight: '600' }}
                                >
                                    ✕ Clear
                                </Button>
                            )}
                        </div>
                    </div>
                    {isFilterActive && selectedForms.length > 0 && (
                        <div style={{ marginTop: '10px', fontSize: '0.85em', color: '#7d8590' }}>
                            <i className="fas fa-filter"></i> Filtering to: {selectedForms.map(f => f.label).join(', ')}
                        </div>
                    )}
                </div>

                <div style={{ border: '1px solid #30363d', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#0d1117' }}>
                    {isLoadingReports ? (
                        <div style={{ padding: '40px', textAlign: 'center' }}>
                            <Spinner animation="border" variant="primary" />
                            <p style={{ marginTop: '10px', color: '#8b949e' }}>Loading reports...</p>
                        </div>
                    ) : !selectedEmployee ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: '#8b949e' }}>
                            <i className="fas fa-user-circle fa-3x mb-3" style={{ opacity: 0.5 }}></i>
                            <p>{isLocalhost ? 'Select "GTAW Dev" to browse available reports.' : 'Please select an employee to view their saved reports.'}</p>
                        </div>
                    ) : filteredReports.length === 0 ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: '#8b949e' }}>
                            <i className="fas fa-file-alt fa-3x mb-3" style={{ opacity: 0.5 }}></i>
                            <p>{searchQuery ? 'No reports match your search.' : 'No saved reports found for this employee.'}</p>
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#161b22', borderBottom: '1px solid #30363d' }}>
                                        <th style={{ padding: '15px', textAlign: 'left', color: '#8b949e', fontWeight: '600' }}>Name / Identifier</th>
                                        <th style={{ padding: '15px', textAlign: 'left', color: '#8b949e', fontWeight: '600' }}>OOC Names</th>
                                        <th style={{ padding: '15px', textAlign: 'left', color: '#8b949e', fontWeight: '600' }}>Date Saved</th>
                                        <th style={{ padding: '15px', textAlign: 'right', color: '#8b949e', fontWeight: '600' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {currentReports.map(report => {
                                        const oocNames = extractOocNames(report);
                                        return (
                                            <tr key={report.key} style={{ borderBottom: '1px solid #30363d', transition: 'background-color 0.2s' }} className="report-row">
                                                <td style={{ padding: '15px', color: '#e6edf3' }}>{report.originalKey}</td>
                                                <td style={{ padding: '15px', color: '#8b949e', fontSize: '0.9em' }}>
                                                    {oocNames ? oocNames.join(', ') : <span style={{ fontStyle: 'italic' }}>No OOC</span>}
                                                </td>
                                                <td style={{ padding: '15px', color: '#8b949e' }}>{new Date(report.timestamp).toLocaleString()}</td>
                                                <td style={{ padding: '15px', textAlign: 'right' }}>
                                                    <Button 
                                                        variant="primary" 
                                                        size="sm" 
                                                        onClick={() => handleLoadAction(report)} 
                                                        className="me-2"
                                                        style={{ fontWeight: '600' }}
                                                    >
                                                        {getButtonLabel()}
                                                    </Button>
                                                    <Button 
                                                        variant="outline-danger" 
                                                        size="sm" 
                                                        onClick={() => {
                                                            if (window.confirm(`Are you sure you want to delete "${report.originalKey}"?`)) {
                                                                deleteReportForUser(report, selectedEmployee.value);
                                                            }
                                                        }}
                                                        style={{ fontWeight: '600' }}
                                                    >
                                                        Delete
                                                    </Button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {totalPages > 1 && !isLoadingReports && selectedEmployee && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', alignItems: 'center', marginTop: '10px' }}>
                        <Button 
                            variant="outline-secondary" 
                            disabled={currentPage === 1} 
                            onClick={() => setCurrentPage(p => p - 1)}
                        >
                            <i className="fas fa-chevron-left"></i> Previous
                        </Button>
                        <span style={{ color: '#8b949e', fontWeight: '600' }}>Page {currentPage} of {totalPages}</span>
                        <Button 
                            variant="outline-secondary" 
                            disabled={currentPage === totalPages} 
                            onClick={() => setCurrentPage(p => p + 1)}
                        >
                            Next <i className="fas fa-chevron-right"></i>
                        </Button>
                    </div>
                )}
            </div>
            <style>{`
                .report-row:hover {
                    background-color: rgba(255, 255, 255, 0.02);
                }
            `}</style>
        </BaseModal>
    );
};

export default SavedReportsModal;
