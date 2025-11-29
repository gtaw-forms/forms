import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Button, Form } from 'react-bootstrap';
import Select from 'react-select';
import { copyToClipboard } from './notificationService';

const modalStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
};

const modalContentStyle = {
    backgroundColor: '#0d1117',
    color: '#c9d1d9',
    padding: '20px',
    borderRadius: '5px',
    width: '95%',
    maxWidth: '1200px',
    height: '90vh',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'hidden',
    position: 'relative',
    border: '1px solid #30363d',
};

const modalHeaderStyle = {
    fontSize: '1.3em',
    fontWeight: 'bold',
    marginBottom: '15px',
    textAlign: 'center',
    paddingBottom: '10px',
    flexShrink: 0,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
};

const closeButtonStyle = {
    position: 'absolute',
    top: '15px',
    right: '15px',
    background: 'transparent',
    border: 'none',
    color: '#f85149',
    fontSize: '28px',
    fontWeight: 'bold',
    lineHeight: '1',
    padding: '0.25rem 0.5rem',
    cursor: 'pointer',
    zIndex: 10,
};

const controlsContainerStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '15px',
    flexShrink: 0,
    gap: '10px',
    paddingRight: '50px',
};

const tableContainerStyle = {
    flexGrow: 1,
    overflowY: 'auto',
    marginTop: '10px',
};

const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse',
};

const thStyle = {
    backgroundColor: '#161b22',
    border: '1px solid #30363d',
    padding: '10px',
    textAlign: 'left',
    fontWeight: '600',
    position: 'sticky',
    top: 0,
    zIndex: 1,
};

const thCheckboxStyle = {
    ...thStyle,
    width: '40px',
    textAlign: 'center',
};

const tdStyle = {
    border: '1px solid #30363d',
    padding: '8px 10px',
    verticalAlign: 'middle',
    maxWidth: '250px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
};

const tdCheckboxStyle = {
    ...tdStyle,
    textAlign: 'center',
};

const actionButtonStyle = {
    backgroundColor: '#238636',
    color: 'white',
    border: 'none',
    padding: '5px 10px',
    borderRadius: '4px',
    cursor: 'pointer',
    marginRight: '5px',
    fontSize: '0.9em',
    whiteSpace: 'nowrap',
};

const deleteButtonStyle = {
    ...actionButtonStyle,
    backgroundColor: '#da3633',
};

const copyButtonStyle = {
    ...actionButtonStyle,
    backgroundColor: '#2f81f7',
};

const bulkActionsContainerStyle = {
    display: 'flex',
    gap: '10px',
    marginTop: '15px',
    paddingTop: '10px',
    borderTop: '1px solid #30363d',
    flexShrink: 0,
};

const paginationStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: '20px',
    paddingTop: '10px',
    borderTop: '1px solid #30363d',
    flexShrink: 0,
};

const searchInputStyle = {
    padding: '8px 10px',
    borderRadius: '5px',
    border: '1px solid #30363d',
    backgroundColor: '#0d1117',
    color: '#c9d1d9',
    flexGrow: 1,
    maxWidth: '450px',
};

const switchButtonStyle = {
    ...actionButtonStyle,
    backgroundColor: '#1f6feb',
    marginRight: '10px',
    flexShrink: 0,
};

const hrStyle = {
    borderColor: '#30363d',
    margin: '15px 0',
};

const reactSelectStyles = {
    control: (base) => ({
        ...base,
        backgroundColor: '#0d1117',
        color: '#c9d1d9',
        borderColor: '#30363d',
        '&:hover': {
            borderColor: '#c9d1d9',
        },
    }),
    menu: (base) => ({
        ...base,
        backgroundColor: '#0d1117',
        zIndex: 1051,
    }),
    option: (base, state) => ({
        ...base,
        backgroundColor: state.isFocused ? '#1f2937' : '#0d1117',
        color: '#c9d1d9',
        '&:hover': {
            backgroundColor: '#1f2937',
        },
    }),
    singleValue: (base) => ({
        ...base,
        color: '#c9d1d9',
    }),
    input: (base) => ({
        ...base,
        color: '#c9d1d9',
    }),
    placeholder: (base) => ({
        ...base,
        color: '#6c757d',
    }),
    group: (base) => ({
        ...base,
        paddingTop: 8,
        paddingBottom: 8,
    }),
    groupHeading: (base) => ({
        ...base,
        color: '#6c757d',
        fontWeight: 600,
        textTransform: 'uppercase',
        fontSize: '0.75rem',
        marginBottom: 4,
    }),
};

const itemsPerPage = 7;
const LOAD_DELAY_MS = 1000;

const SavedReportsModal = ({
    show,
    onClose,
    onHide,
    showNotification,
    reportsForSelectedUser,
    onEmployeeSelect,
    employeeOptions,
    isLoadingReports,
    loadReport,
    deleteReportForUser,
    loadReportForUser,
    handleReportSelectedForAttachment,
    currentCoronerEmployee,
    currentPhmcEmployee,
    filterByBbCodeVersions,
    onAttachReportSummaryRequest,
    preselectedEmployeeType,
    reportSelectionFilter,
    pendingReportAttachmentCallback,
    selectedForm,
    legacyOnly = false,
    loadButtonText = 'Load',
    disableAutoLoad = false,
}) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedReportKeys, setSelectedReportKeys] = useState([]);
    const [isLoadingMultiple, setIsLoadingMultiple] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    
    const lastLoadedEmployeeRef = useRef(null);
    const isManualSelectionRef = useRef(false);
    
    // Detect if we're in "Parse Decedent" mode based on reportSelectionFilter
    const isParseDecedentMode = reportSelectionFilter && 
        Array.isArray(reportSelectionFilter) && 
        reportSelectionFilter.length === 2 && 
        reportSelectionFilter.includes(1) && 
        reportSelectionFilter.includes(4);
    const isAttachMode = !!handleReportSelectedForAttachment;


    useEffect(() => {
        if (!show) { // When modal closes, reset all state
            setSelectedEmployee(null);
            setSearchQuery('');
            setCurrentPage(1);
            setSelectedReportKeys([]);
            lastLoadedEmployeeRef.current = null;
            isManualSelectionRef.current = false;
            return;
        }

        // Logic to set selectedEmployee when modal is shown and employeeOptions are available
        // This runs if:
        // 1. Not a manual selection AND not disableAutoLoad (normal auto-load)
        // 2. OR disableAutoLoad is true (we still need to set the employee in the UI)
        if (show && employeeOptions) { // Only proceed if modal is shown and employeeOptions have potentially loaded
            let employeeToSelectValue = null;
            
            if (currentPhmcEmployee && currentPhmcEmployee !== 'Unknown') {
                employeeToSelectValue = currentPhmcEmployee;
            } else if (currentCoronerEmployee && currentCoronerEmployee !== 'Unknown') {
                employeeToSelectValue = currentCoronerEmployee;
            } else if (preselectedEmployeeType === 'PHMC' && currentPhmcEmployee !== 'Unknown') {
                employeeToSelectValue = currentPhmcEmployee;
            } else {
                employeeToSelectValue = (currentCoronerEmployee !== 'Unknown' ? currentCoronerEmployee : null) || (currentPhmcEmployee !== 'Unknown' ? currentPhoncEmployee : null);
            }

            const employeeOption = employeeOptions.flatMap(group => group.options).find(
                (opt) => opt.value === employeeToSelectValue
            );

            // This condition determines if we need to update selectedEmployee or call onEmployeeSelect
            const shouldUpdateSelectedEmployee = employeeOption && selectedEmployee?.value !== employeeOption.value;
            const shouldCallOnEmployeeSelect = !isManualSelectionRef.current && !disableAutoLoad && employeeOption && employeeToSelectValue !== lastLoadedEmployeeRef.current;

            if (shouldUpdateSelectedEmployee) {
                setSelectedEmployee(employeeOption);
            }
            
            if (shouldCallOnEmployeeSelect) {
                onEmployeeSelect(employeeOption.label);
                lastLoadedEmployeeRef.current = employeeToSelectValue;
            } else if (!employeeOption && selectedEmployee) { // If no option found, but something is selected, clear it
                setSelectedEmployee(null);
                if (!disableAutoLoad && !isManualSelectionRef.current) { // Only clear if not in disableAutoLoad mode
                    onEmployeeSelect(null);
                }
            }
        }
    }, [show, currentCoronerEmployee, currentPhmcEmployee, employeeOptions, preselectedEmployeeType, onEmployeeSelect, disableAutoLoad, selectedEmployee]);

    const handleEmployeeSelect = (selectedOption) => {
        isManualSelectionRef.current = true;
        setSelectedEmployee(selectedOption);
        setSearchQuery('');
        setCurrentPage(1);
        setSelectedReportKeys([]);

        if (selectedOption) {
            onEmployeeSelect(selectedOption.label);
            lastLoadedEmployeeRef.current = selectedOption.label;
        } else {
            onEmployeeSelect(null);
            lastLoadedEmployeeRef.current = null;
        }
    };
    const filteredEmployeeOptions = useMemo(() => {
        if (preselectedEmployeeType === 'PHMC') {
            return (employeeOptions || []).filter((group) => group.label === 'PHMC Staff');
        }
        if (preselectedEmployeeType === 'Coroner') {
            return (employeeOptions || []).filter((group) => group.label === 'Coroner Staff');
        }
        return employeeOptions || [];
    }, [employeeOptions, preselectedEmployeeType]);

    const sortedReports = useMemo(() => {
        return [...(reportsForSelectedUser || [])].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    }, [reportsForSelectedUser]);

    const searchedAndFilteredReports = useMemo(() => {
        let reports = sortedReports;
        if (legacyOnly) {
            reports = reports.filter(report => report.legacy);
        }

        // If in attach mode, only show relevant coroner reports.
        if (isAttachMode) {
            reports = reports.filter(report => 
                report.originalKey.toLowerCase().includes('[death-report]') || report.originalKey.toLowerCase().includes('[pk]') ||
                report.originalKey.toLowerCase().includes('[mass fatality report]')
            );
        }

        if (filterByBbCodeVersions && filterByBbCodeVersions.length > 0) {
            reports = reports.filter((report) => filterByBbCodeVersions.includes(report.bbCodeVersion));
        }
        if (searchQuery) {
            reports = reports.filter((report) =>
                report.originalKey.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }
        return reports;
    }, [sortedReports, legacyOnly, filterByBbCodeVersions, searchQuery, isAttachMode]);

    useEffect(() => {
        setCurrentPage(1);
        setSelectedReportKeys([]);
    }, [searchedAndFilteredReports]);

    const totalPages = Math.ceil(searchedAndFilteredReports.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentReportsOnPage = searchedAndFilteredReports.slice(startIndex, endIndex);

    const handleCheckboxChange = (reportKey, checked) => {
        setSelectedReportKeys((prev) =>
            checked ? [...prev, reportKey] : prev.filter((k) => k !== reportKey)
        );
    };

    const handleSelectAllChange = (checked) => {
        if (checked) {
            setSelectedReportKeys((prev) => [
                ...new Set([...prev, ...currentReportsOnPage.map((r) => r.key)]),
            ]);
        } else {
            const currentPageKeysSet = new Set(currentReportsOnPage.map((r) => r.key));
            setSelectedReportKeys((prev) => prev.filter((k) => !currentPageKeysSet.has(k)));
        }
    };

    const handleLoadSelected = async () => {
        if (selectedReportKeys.length === 0 || !selectedEmployee?.value) {
            showNotification('No reports selected or no employee identified.', 'warning');
            return;
        }

        const reportsToLoadCheck = sortedReports.filter((r) => selectedReportKeys.includes(r.key));
        if (reportsToLoadCheck.some(report => report.legacy) && loadButtonText === 'Load') {
            showNotification('Legacy reports cannot be loaded. Please unselect them to proceed.', 'warning');
            return;
        }

        if (isLoadingMultiple) return;

        setIsLoadingMultiple(true);
        const numToLoad = selectedReportKeys.length;
        const calculatedDuration = numToLoad > 1 ? (numToLoad - 1) * LOAD_DELAY_MS + 500 : 3000;
        showNotification(`Processing ${numToLoad} report(s)...`, 'info-circle', calculatedDuration);

        const reportsToLoad = sortedReports
            .filter((r) => selectedReportKeys.includes(r.key))
            .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

        const isParsing = isParseDecedentMode;
        
        let actionFunction;
        if (loadButtonText !== 'Load') {
            actionFunction = loadReport;
        } else if (isParsing && pendingReportAttachmentCallback?.current) {
            actionFunction = async (report, employeeValue) => {
                const result = await loadReportForUser(report, employeeValue, true);
                if (result.success && pendingReportAttachmentCallback.current) {
                    pendingReportAttachmentCallback.current(result.reportData);
                }
            };
        } else if (isAttachMode) {
            actionFunction = handleReportSelectedForAttachment;
        } else {
            actionFunction = loadReport;
        }

        for (let i = 0; i < reportsToLoad.length; i++) {
            const report = reportsToLoad[i];
            const actionName = loadButtonText !== 'Load' ? loadButtonText : (isParsing ? 'Parse' : (isAttachMode ? 'Attach' : 'Load'));
            console.log(`[SavedReportsModal] Processing report ${i + 1}/${reportsToLoad.length}: ${report.originalKey} (Action: ${actionName})`);
            try {
                await actionFunction(report, selectedEmployee.value);
                if (i < reportsToLoad.length - 1) {
                    await new Promise((resolve) => setTimeout(resolve, LOAD_DELAY_MS));
                }
            } catch (error) {
                console.error(`Error ${actionName.toLowerCase()}ing report ${report.originalKey}:`, error);
                showNotification(`Error ${actionName.toLowerCase()}ing report ${report.originalKey}.`, 'error');
            }
        }
        const finalActionName = loadButtonText !== 'Load' ? loadButtonText : (isParsing ? 'parsing' : (isAttachMode ? 'attaching' : 'loading'));
        showNotification(`Finished ${finalActionName} ${reportsToLoad.length} report(s).`, 'check-circle');
        setIsLoadingMultiple(false);
        setSelectedReportKeys([]);
        onHide(); // Close modal after operation completes
    };

    const handleDeleteSelected = () => {
        if (selectedReportKeys.length === 0 || !selectedEmployee?.value) {
            showNotification('No reports selected or no employee identified.', 'warning');
            return;
        }
        if (!window.confirm(`Are you sure you want to delete ${selectedReportKeys.length} selected report(s)? This action cannot be undone.`)) {
            return;
        }
        const reportsToDelete = sortedReports.filter(r => selectedReportKeys.includes(r.key));
        reportsToDelete.forEach((report) => {
            deleteReportForUser(report, selectedEmployee.value);
        });
        showNotification(`${selectedReportKeys.length} report(s) deleted.`, 'trash');
        setSelectedReportKeys([]);
    };

    const handleCopySelectedBBCode = async () => {
        if (selectedReportKeys.length === 0 || !selectedEmployee?.value) {
            showNotification('No reports selected to copy.', 'warning');
            return;
        }
        
        showNotification(`Loading BBCode for ${selectedReportKeys.length} report(s)...`, 'info-circle', 4000);
    
        const reportsToCopy = sortedReports.filter((r) => selectedReportKeys.includes(r.key));
        const bbCodes = [];
    
        for (const report of reportsToCopy) {
            const result = await loadReportForUser(report, selectedEmployee.value, true);
            if (result.success && result.reportData.bbCode) {
                bbCodes.push(result.reportData.bbCode);
            } else {
                showNotification(`Could not load BBCode for report: ${report.originalKey}`, 'warning');
            }
        }
        
        if (bbCodes.length > 0) {
            const combinedBbCode = bbCodes.join('\n\n');
            await copyToClipboard(combinedBbCode, showNotification, `${bbCodes.length} BBCode(s) copied!`);
        } else {
            showNotification('No BBCode found in selected reports.', 'warning');
        }
    };

    const handleCopyBBCode = async (report) => {
        if (!selectedEmployee?.value) {
            showNotification('No employee selected.', 'warning');
            return;
        }
        const result = await loadReportForUser(report, selectedEmployee.value, true);
        if (result.success && result.reportData.bbCode) {
            await copyToClipboard(result.reportData.bbCode, showNotification, 'BBCode copied!');
        } else {
            showNotification('Could not load BBCode for this report.', 'error');
        }
    };

    const goToPreviousPage = () => setCurrentPage((prev) => Math.max(prev - 1, 1));
    const goToNextPage = () => setCurrentPage((prev) => Math.min(prev + 1, totalPages));

    const isAllCurrentPageSelected =
        currentReportsOnPage.length > 0 && currentReportsOnPage.every((report) => selectedReportKeys.includes(report.key));

    const canSwitchEmployee = currentPhmcEmployee && currentCoronerEmployee && currentPhmcEmployee !== currentCoronerEmployee;
    let otherEmployeeName = '';
    if (canSwitchEmployee) {
        otherEmployeeName = selectedEmployee?.value === currentCoronerEmployee ? currentPhmcEmployee : currentCoronerEmployee;
    }

    if (!show) return null;

    return ReactDOM.createPortal(
        <div style={modalStyle} onClick={onHide}>
            <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
                <div style={modalHeaderStyle}>
                    <h5 style={{ margin: 0 }}>Saved Reports</h5>
                    <button onClick={onHide} style={closeButtonStyle} aria-label="Close modal">
                        &times;
                    </button>
                </div>

                <div style={controlsContainerStyle}>
                    <input
                        type="text"
                        placeholder="Search reports by name/identifier..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={searchInputStyle}
                        disabled={!selectedEmployee || isLoadingReports}
                    />
                    <Form.Group controlId="employeeSelect" className="mb-3">
                        <Form.Label>Select Employee to View Reports:</Form.Label>
                        <Select
                            name="employeeSelect"
                            options={filteredEmployeeOptions}
                            value={selectedEmployee}
                            onChange={handleEmployeeSelect}
                            isClearable
                            placeholder="Search or select employee..."
                            styles={reactSelectStyles}
                        />
                    </Form.Group>
                    {canSwitchEmployee && !preselectedEmployeeType && (
                        <Button
                            onClick={() => {
                                const newEmployeeValue =
                                    selectedEmployee?.value === currentCoronerEmployee ? currentPhmcEmployee : currentCoronerEmployee;
                                const newEmployeeOption = employeeOptions
                                    ?.flatMap((g) => g.options)
                                    .find((o) => o.value === newEmployeeValue);
                                if (newEmployeeOption) {
                                    handleEmployeeSelect(newEmployeeOption);
                                    showNotification(`Switched to reports for ${newEmployeeOption.label}`, 'exchange-alt');
                                }
                            }}
                            style={switchButtonStyle}
                            title={`Switch to reports for ${otherEmployeeName}`}
                        >
                            <i className="fas fa-exchange-alt" style={{ marginRight: '5px' }}></i>
                            Switch to {otherEmployeeName}
                        </Button>
                    )}
                </div>

                <hr style={hrStyle} />

                <div style={modalHeaderStyle} key={selectedEmployee ? selectedEmployee.value : 'noEmployee'}>
                    <h5 style={{ margin: 0 }}>
                        Saved Reports {selectedEmployee ? `for ${selectedEmployee.label}` : '(No Employee Selected)'}
                        {selectedEmployee && ` (${searchedAndFilteredReports.length} total)`}
                    </h5>
                </div>

                {isLoadingReports && selectedEmployee && (
                    <p style={{ textAlign: 'center', flexShrink: 0 }}>Loading reports for {selectedEmployee.label}...</p>
                )}

                <div style={tableContainerStyle}>
                    {!isLoadingReports && selectedEmployee && searchedAndFilteredReports.length > 0 ? (
                        <table style={tableStyle}>
                            <thead>
                                <tr>
                                    <th style={thCheckboxStyle}>
                                        <Form.Check
                                            type="checkbox"
                                            id="selectAllCheckbox"
                                            checked={isAllCurrentPageSelected}
                                            onChange={(e) => handleSelectAllChange(e.target.checked)}
                                            title="Select/Deselect all on this page"
                                        />
                                    </th>
                                    <th style={thStyle}>Name / Identifier</th>
                                    <th style={thStyle}>Saved Date & Time</th>
                                    <th style={thStyle}>Legacy</th>
                                    <th style={thStyle}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentReportsOnPage.map((report) => {
                                    const isSelected = selectedReportKeys.includes(report.key);
                                    return (
                                        <tr key={report.key} style={isSelected ? { backgroundColor: '#161b22' } : {}}>
                                            <td style={tdCheckboxStyle}>
                                                <Form.Check
                                                    type="checkbox"
                                                    id={`select-${report.key}`}
                                                    checked={isSelected}
                                                    onChange={(e) => handleCheckboxChange(report.key, e.target.checked)}
                                                />
                                            </td>
                                            <td style={tdStyle} title={report.originalKey}>
                                                {report.originalKey}
                                                {report.legacy && <span style={{ color: '#f85149', marginLeft: '10px', fontWeight: 'bold' }}>LEGACY</span>}
                                            </td>
                                            <td style={tdStyle}>{new Date(report.timestamp).toLocaleString()}</td>
                                            <td style={tdStyle}>
                                                {report.legacy ? (
                                                    <span style={{ color: '#f85149', fontWeight: 'bold' }}>Yes</span>
                                                ) : (
                                                    <span style={{ color: '#28a745' }}>No</span>
                                                )}
                                            </td>
                                            <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                                                <Button
                                                    variant="primary"
                                                    size="sm"
                                                    className="me-2"
                                                    onClick={() => {
                                                        if (report.legacy && loadButtonText === 'Load') {
                                                            showNotification('This report is flagged as Legacy, you cannot load it at this time.', 'warning');
                                                            return;
                                                        }
                                                        if (loadButtonText !== 'Load') {
                                                            loadReport(report, selectedEmployee.value);
                                                            // Keep modal open for migration tasks unless explicitly closed by the handler
                                                            if (loadButtonText !== "Migrate") {
                                                                onHide();
                                                            }
                                                            return;
                                                        }
                                                        if (isParseDecedentMode && pendingReportAttachmentCallback?.current) {
                                                            loadReportForUser(report, selectedEmployee.value, true).then((result) => {
                                                                if (result.success && pendingReportAttachmentCallback.current) {
                                                                    pendingReportAttachmentCallback.current(result.reportData);
                                                                }
                                                            });
                                                        } else if (isAttachMode) {
                                                            handleReportSelectedForAttachment(report, selectedEmployee.value);
                                                        } else if (loadReport) {
                                                            loadReport(report, selectedEmployee.value);
                                                        }
                                                        onHide(); // Close modal after action
                                                    }}
                                                    disabled={(report.legacy && loadButtonText === 'Load') || isLoadingReports || !selectedEmployee}
                                                    title={report.legacy && loadButtonText === 'Load' ? 'This report is flagged as Legacy, you cannot load it at this time.' : ''}
                                                >
                                                    {isAttachMode ? 'Attach' : (loadButtonText || (isParseDecedentMode ? 'Parse' : 'Load'))}
                                                </Button>
                                                <Button
                                                    variant="danger"
                                                    size="sm"
                                                    onClick={() => {
                                                        if (window.confirm('Are you sure you want to delete this report?')) {
                                                            deleteReportForUser(report, selectedEmployee.value);
                                                        }
                                                    }}
                                                    disabled={isLoadingReports || !selectedEmployee}
                                                >
                                                    Delete
                                                </Button>
                                                <Button
                                                    onClick={() => handleCopyBBCode(report)}
                                                    style={copyButtonStyle}
                                                    title="Copy BBCode"
                                                >
                                                    Copy BBCode
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    ) : (
                        !isLoadingReports &&
                        selectedEmployee && (
                            <p style={{ textAlign: 'center', marginTop: '20px' }}>
                                {searchQuery
                                    ? `No reports match your search for ${selectedEmployee.label}.`
                                    : `No reports saved for ${selectedEmployee.label}.`}
                            </p>
                        )
                    )}
                    {!isLoadingReports && !selectedEmployee && (
                        <p style={{ textAlign: 'center', marginTop: '20px' }}>
                            Please select an employee in the main form to view their saved reports.
                        </p>
                    )}
                </div>

                {!isLoadingReports && selectedEmployee && searchedAndFilteredReports.length > 0 && (
                    <div style={bulkActionsContainerStyle}>
                        <Button
                            onClick={handleDeleteSelected}
                            style={deleteButtonStyle}
                            disabled={selectedReportKeys.length === 0}
                        >
                            Delete Selected ({selectedReportKeys.length})
                        </Button>
                        <Button
                            onClick={handleCopySelectedBBCode}
                            style={copyButtonStyle}
                            disabled={selectedReportKeys.length === 0}
                        >
                            Copy Selected BBCode ({selectedReportKeys.length})
                        </Button>
                        <Button
                            style={actionButtonStyle}
                            disabled={selectedReportKeys.length === 0 || isLoadingMultiple}
                            onClick={handleLoadSelected}
                        >
                            {isLoadingMultiple ? (
                                <>
                                    <i className="fas fa-spinner fa-spin" style={{ marginRight: '5px' }}></i>
                                    Loading...
                                </>
                            ) : (
                                `${isAttachMode ? 'Attach Selected' : (loadButtonText ? loadButtonText + ' Selected' : (isParseDecedentMode ? 'Parse Selected' : 'Load Selected'))} (${selectedReportKeys.length})`
                            )}
                        </Button>
                    </div>
                )}

                {totalPages > 1 && !isLoadingReports && selectedEmployee && (
                    <div style={paginationStyle}>
                        <Button onClick={goToPreviousPage} disabled={currentPage === 1} style={actionButtonStyle}>
                            Previous
                        </Button>
                        <span>
                            Page {currentPage} of {totalPages}
                        </span>
                        <Button onClick={goToNextPage} disabled={currentPage === totalPages} style={actionButtonStyle}>
                            Next
                        </Button>
                    </div>
                )}
            </div>
        </div>,
        document.getElementById('modal-root')
    );
};

export default SavedReportsModal;