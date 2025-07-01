import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom'; // Import ReactDOM for portals
import { Button, Form } from 'react-bootstrap';
import Select from 'react-select'; // Still needed for the internal logic of selectedEmployee
import { copyToClipboard } from './notificationService'; 
// --- Styles (These are now directly applied to the custom modal structure) ---
const modalStyle = {
    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
    justifyContent: 'center', alignItems: 'center', zIndex: 1000,
};
const modalContentStyle = {
    backgroundColor: '#0d1117', color: '#c9d1d9', padding: '20px',
    borderRadius: '5px', width: '95%', maxWidth: '1200px',
    height: '90vh', maxHeight: '90vh', display: 'flex',
    flexDirection: 'column', overflowY: 'hidden', position: 'relative',
    border: '1px solid #30363d',
};
const modalHeaderStyle = {
    fontSize: '1.3em', fontWeight: 'bold', marginBottom: '15px',
    textAlign: 'center', paddingBottom: '10px', flexShrink: 0,
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', // Added for header layout
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
    zIndex: 10
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
const tableContainerStyle = { flexGrow: 1, overflowY: 'auto', marginTop: '10px' };
const tableStyle = { width: '100%', borderCollapse: 'collapse' };
const thStyle = {
    backgroundColor: '#161b22', border: '1px solid #30363d', padding: '10px',
    textAlign: 'left', fontWeight: '600', position: 'sticky', top: 0, zIndex: 1,
};
const thCheckboxStyle = { ...thStyle, width: '40px', textAlign: 'center' };
const tdStyle = {
    border: '1px solid #30363d', padding: '8px 10px', verticalAlign: 'middle',
    maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
};
const tdCheckboxStyle = { ...tdStyle, textAlign: 'center' };
const actionButtonStyle = {
    backgroundColor: '#238636', color: 'white', border: 'none', padding: '5px 10px',
    borderRadius: '4px', cursor: 'pointer', marginRight: '5px', fontSize: '0.9em', whiteSpace: 'nowrap',
};
const deleteButtonStyle = { ...actionButtonStyle, backgroundColor: '#da3633' };
const copyButtonStyle = { ...actionButtonStyle, backgroundColor: '#2f81f7' };
const bulkActionsContainerStyle = {
    display: 'flex', gap: '10px', marginTop: '15px', paddingTop: '10px',
    borderTop: '1px solid #30363d', flexShrink: 0,
};
const paginationStyle = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginTop: '20px', paddingTop: '10px', borderTop: '1px solid #30363d', flexShrink: 0,
};
const searchInputStyle = {
    padding: '8px 10px', borderRadius: '5px', border: '1px solid #30363d',
    backgroundColor: '#0d1117', color: '#c9d1d9',
    flexGrow: 1,
    maxWidth: '450px',
};
const switchButtonStyle = {
    ...actionButtonStyle,
    backgroundColor: '#1f6feb',
    marginRight: '10px',
    flexShrink: 0,
};
const hrStyle = { borderColor: '#30363d', margin: '15px 0' };
// --- End Styles ---

const itemsPerPage = 7;
const LOAD_DELAY_MS = 1000;

const SavedReportsModal = ({
    show,
    onClose,
    showNotification,
    reportsForSelectedUser,
    onEmployeeSelect,
    employeeOptions,
    isLoadingReports,
    loadReportForUser,
    deleteReportForUser,
    currentCoronerEmployee,
    currentPhmcEmployee,
    filterByBbCodeVersions,
    onReportSelectedForAttachment,
    preselectedEmployeeType,
}) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedReportKeys, setSelectedReportKeys] = useState([]);
    const [isLoadingMultiple, setIsLoadingMultiple] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState(null); // This state is still needed internally

    const lastLoadedEmployeeRef = useRef(null);

    useEffect(() => {
        if (show) {
            let employeeToSelectValue = null;

            if (preselectedEmployeeType === 'PHMC') {
                employeeToSelectValue = currentPhmcEmployee;
            } else {
                employeeToSelectValue = currentCoronerEmployee || currentPhmcEmployee;
            }

            // Find the corresponding option object for the determined employee value
            const employeeOption = employeeOptions.flatMap(group => group.options)
                                                .find(opt => opt.value === employeeToSelectValue);

            // Update the local `selectedEmployee` state if it's different from the current value
            if (employeeOption?.value !== selectedEmployee?.value) {
                setSelectedEmployee(employeeOption || null);
            }

            // Crucial: Only call `onEmployeeSelect` if the employee has changed
            // or if reports haven't been loaded for the current employee yet.
            // This prevents the infinite loop.
            if (employeeToSelectValue && employeeToSelectValue !== lastLoadedEmployeeRef.current) {
                lastLoadedEmployeeRef.current = employeeToSelectValue; // Update the ref to prevent re-trigger
                onEmployeeSelect(employeeToSelectValue); // Trigger report loading in App.js
            } else if (!employeeToSelectValue && lastLoadedEmployeeRef.current) {
                // If no employee is selected now, but one was previously loaded, clear it
                lastLoadedEmployeeRef.current = null;
                onEmployeeSelect(null); // Clear reports
            }

        } else {
            // When modal closes, reset all local states
            setSelectedEmployee(null);
            setCurrentPage(1);
            setSearchQuery('');
            setSelectedReportKeys([]);
            lastLoadedEmployeeRef.current = null;
        }
    }, [
        show,
        currentCoronerEmployee,
        currentPhmcEmployee,
        employeeOptions,
        onEmployeeSelect, // This is a useCallback, so it's stable
        preselectedEmployeeType,
        selectedEmployee // Include selectedEmployee to react to its internal changes and prevent re-setting
    ]);

    // Filter employee options based on preselectedEmployeeType (still useful for internal logic)
    const filteredEmployeeOptions = useMemo(() => {
        if (preselectedEmployeeType === 'PHMC') {
            return employeeOptions.filter(group => group.label === 'PHMC Staff');
        }
        return employeeOptions;
    }, [employeeOptions, preselectedEmployeeType]);

    // Sort reports whenever reportsForSelectedUser changes
    const sortedReports = useMemo(() => {
        return [...(reportsForSelectedUser || [])].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    }, [reportsForSelectedUser]);

    // Filter reports based on bbCodeVersions and search query
    const searchedAndFilteredReports = useMemo(() => {
        let reports = sortedReports;
        if (filterByBbCodeVersions && filterByBbCodeVersions.length > 0) {
            reports = reports.filter(report => filterByBbCodeVersions.includes(report.bbCodeVersion));
        }
        if (searchQuery) {
            reports = reports.filter(report =>
                report.originalKey.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }
        return reports;
    }, [sortedReports, filterByBbCodeVersions, searchQuery]);

    // Reset pagination and selection when the underlying filtered reports change
    useEffect(() => {
        setCurrentPage(1);
        setSelectedReportKeys([]);
    }, [searchedAndFilteredReports]); // Depend on the memoized filtered list

    const totalPages = Math.ceil(searchedAndFilteredReports.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentReportsOnPage = searchedAndFilteredReports.slice(startIndex, endIndex);

    const handleCheckboxChange = (reportKey, checked) => {
        setSelectedReportKeys(prev =>
            checked ? [...prev, reportKey] : prev.filter(k => k !== reportKey)
        );
    };

    const handleSelectAllChange = (checked) => {
        if (checked) {
            setSelectedReportKeys(prev => [...new Set([...prev, ...currentReportsOnPage.map(r => r.key)])]);
        } else {
            const currentPageKeysSet = new Set(currentReportsOnPage.map(r => r.key));
            setSelectedReportKeys(prev => prev.filter(k => !currentPageKeysSet.has(k)));
        }
    };

    const handleLoadSelected = async () => {
        if (selectedReportKeys.length === 0 || !selectedEmployee?.value) {
            showNotification('No reports selected or no employee identified.', 'warning');
            return;
        }
        if (isLoadingMultiple) return;

        setIsLoadingMultiple(true);
        const numToLoad = selectedReportKeys.length;
        const calculatedDuration = numToLoad > 1 ? ((numToLoad - 1) * LOAD_DELAY_MS) + 500 : 3000;
        showNotification(`Loading ${numToLoad} report(s)...`, 'info-circle', calculatedDuration);

        const reportsToLoad = sortedReports
            .filter(r => selectedReportKeys.includes(r.key))
            .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

        for (let i = 0; i < reportsToLoad.length; i++) {
            const report = reportsToLoad[i];
            try {
                if (onReportSelectedForAttachment) {
                    await onReportSelectedForAttachment(report.key, selectedEmployee.value);
                } else {
                    await loadReportForUser(report.key, selectedEmployee.value);
                }
                if (i < reportsToLoad.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, LOAD_DELAY_MS));
                }
            } catch (error) {
                console.error(`Error loading report ${report.originalKey}:`, error);
                showNotification(`Error loading report ${report.originalKey}.`, 'error');
            }
        }
        showNotification(`Finished loading ${reportsToLoad.length} report(s).`, 'check-circle');
        setIsLoadingMultiple(false);
        setSelectedReportKeys([]);
    };

    const handleDeleteSelected = () => {
        if (selectedReportKeys.length === 0 || !selectedEmployee?.value) {
            showNotification('No reports selected or no employee identified.', 'warning');
            return;
        }
        if (!window.confirm(`Are you sure you want to delete ${selectedReportKeys.length} selected report(s)? This action cannot be undone.`)) {
            return;
        }
        selectedReportKeys.forEach(reportKey => {
            deleteReportForUser(reportKey, selectedEmployee.value);
        });
        showNotification(`${selectedReportKeys.length} report(s) deleted.`, 'trash');
        setSelectedReportKeys([]);
    };

    const handleCopySelectedBBCode = async () => {
        if (selectedReportKeys.length === 0) {
            showNotification('No reports selected to copy.', 'warning');
            return;
        }
        let combinedBbCode = '';
        let copyCount = 0;
        const separator = '\n\n[hr][/hr]\n\n';

        for (const reportKey of selectedReportKeys) {
            const report = sortedReports.find(r => r.key === reportKey);
            if (report && report.bbCode) {
                if (combinedBbCode) combinedBbCode += separator;
                combinedBbCode += report.bbCode;
                copyCount++;
            }
        }
        if (combinedBbCode) {
            await copyToClipboard(combinedBbCode, showNotification, `BBCode for ${copyCount} report(s) copied!`);
        } else {
            showNotification('No valid BBCode found in selected reports.', 'warning');
        }
    };

    const handleCopyBBCode = async (reportKey) => {
        const report = sortedReports.find(r => r.key === reportKey);
        if (report && report.bbCode) {
            // --- MODIFICATION: Use the helper function ---
            await copyToClipboard(report.bbCode, showNotification, 'BBCode copied!');
        } else {
            showNotification('No BBCode found for this report.', 'warning');
        }
    };

    const goToPreviousPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));
    const goToNextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));

    const isAllCurrentPageSelected = currentReportsOnPage.length > 0 &&
        currentReportsOnPage.every(report => selectedReportKeys.includes(report.key));

    const canSwitchEmployee = currentPhmcEmployee && currentCoronerEmployee && currentPhmcEmployee !== currentCoronerEmployee;
    let otherEmployeeName = '';
    if (canSwitchEmployee) {
        otherEmployeeName = selectedEmployee?.value === currentCoronerEmployee ? currentPhmcEmployee : currentCoronerEmployee;
    }

    if (!show) return null;

    return ReactDOM.createPortal(
        <div style={modalStyle} onClick={onClose}>
            <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
                <div style={modalHeaderStyle}>
                    <h5 style={{ margin: 0 }}>Saved Reports</h5>
                    <button onClick={onClose} style={closeButtonStyle} aria-label="Close modal">&times;</button>
                </div>

                {/* Removed the "Select Employee to View Reports" Form.Group */}

                <div style={controlsContainerStyle}>
                    <input
                        type="text"
                        placeholder="Search reports by name/identifier..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        style={searchInputStyle}
                        disabled={!selectedEmployee || isLoadingReports}
                    />
                    {canSwitchEmployee && !preselectedEmployeeType && (
                        <Button
                            onClick={() => {
                                const newEmployeeValue = selectedEmployee?.value === currentCoronerEmployee ? currentPhmcEmployee : currentCoronerEmployee;
                                const newEmployeeOption = employeeOptions.flatMap(g => g.options).find(o => o.value === newEmployeeValue);
                                if (newEmployeeOption) {
                                    setSelectedEmployee(newEmployeeOption);
                                    onEmployeeSelect(newEmployeeOption.value);
                                    setSearchQuery('');
                                    setCurrentPage(1);
                                    showNotification(`Switched to reports for ${newEmployeeOption.value}`, 'exchange-alt');
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

                <div style={modalHeaderStyle}>
                    <h5 style={{ margin: 0 }}>
                        Saved Reports {selectedEmployee ? `for ${selectedEmployee.value}` : '(No Employee Selected)'}
                        {selectedEmployee && ` (${searchedAndFilteredReports.length} total)`}
                    </h5>
                </div>

                {isLoadingReports && selectedEmployee && <p style={{ textAlign: 'center', flexShrink: 0 }}>Loading reports for {selectedEmployee.value}...</p>}

                <div style={tableContainerStyle}>
                    {!isLoadingReports && selectedEmployee && searchedAndFilteredReports.length > 0 ? (
                        <table style={tableStyle}>
                            <thead>
                                <tr>
                                    <th style={thCheckboxStyle}>
                                        <Form.Check type="checkbox" id="selectAllCheckbox" checked={isAllCurrentPageSelected} onChange={(e) => handleSelectAllChange(e.target.checked)} title="Select/Deselect all on this page" />
                                    </th>
                                    <th style={thStyle}>Name / Identifier</th>
                                    <th style={thStyle}>Saved Date & Time</th>
                                    <th style={thStyle}>Version</th>
                                    <th style={thStyle}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentReportsOnPage.map(report => {
                                    const isSelected = selectedReportKeys.includes(report.key);
                                    return (
                                        <tr key={report.key} style={isSelected ? { backgroundColor: '#161b22' } : {}}>
                                            <td style={tdCheckboxStyle}><Form.Check type="checkbox" id={`select-${report.key}`} checked={isSelected} onChange={(e) => handleCheckboxChange(report.key, e.target.checked)} /></td>
                                            <td style={tdStyle} title={report.originalKey}>{report.originalKey}</td>
                                            {/* Changed date formatting */}
                                            <td style={tdStyle}>{new Date(report.timestamp).toLocaleString()}</td>
                                            <td style={tdStyle}>{report.bbCodeVersion}</td>
                                            <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                                                <Button
                                                    variant="primary"
                                                    size="sm"
                                                    className="me-2"
                                                    onClick={() => {
                                                        if (onReportSelectedForAttachment) {
                                                            onReportSelectedForAttachment(report.key, selectedEmployee.value);
                                                        } else {
                                                            loadReportForUser(report.key, selectedEmployee.value);
                                                        }
                                                    }}
                                                    disabled={isLoadingReports || !selectedEmployee}
                                                >
                                                    {onReportSelectedForAttachment ? 'Attach' : 'Load'}
                                                </Button>
                                                <Button
                                                    variant="danger"
                                                    size="sm"
                                                    onClick={() => {
                                                        if (window.confirm('Are you sure you want to delete this report?')) {
                                                            deleteReportForUser(report.key, selectedEmployee.value);
                                                        }
                                                    }}
                                                    disabled={isLoadingReports || !selectedEmployee}
                                                >
                                                    Delete
                                                </Button>
                                                <Button onClick={() => handleCopyBBCode(report.key)} style={copyButtonStyle} title="Copy BBCode">Copy BBCode</Button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    ) : (
                        !isLoadingReports && selectedEmployee && (
                            <p style={{ textAlign: 'center', marginTop: '20px' }}>
                                {searchQuery ? `No reports match your search for ${selectedEmployee.value}.` : `No reports saved for ${selectedEmployee.value}.`}
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
                        <Button onClick={handleDeleteSelected} style={deleteButtonStyle} disabled={selectedReportKeys.length === 0}>Delete Selected ({selectedReportKeys.length})</Button>
                        <Button onClick={handleCopySelectedBBCode} style={copyButtonStyle} disabled={selectedReportKeys.length === 0}>Copy Selected BBCode ({selectedReportKeys.length})</Button>
                        <Button style={actionButtonStyle} disabled={selectedReportKeys.length === 0 || isLoadingMultiple} onClick={handleLoadSelected}>
                            {isLoadingMultiple ? <><i className="fas fa-spinner fa-spin" style={{ marginRight: '5px' }}></i>Loading...</> : `Load Selected (${selectedReportKeys.length})`}
                        </Button>
                    </div>
                )}

                {totalPages > 1 && !isLoadingReports && selectedEmployee && (
                    <div style={paginationStyle}>
                        <Button onClick={goToPreviousPage} disabled={currentPage === 1} style={actionButtonStyle}>Previous</Button>
                        <span>Page {currentPage} of {totalPages}</span>
                        <Button onClick={goToNextPage} disabled={currentPage === totalPages} style={actionButtonStyle}>Next</Button>
                    </div>
                )}
            </div>
        </div>,
        document.getElementById('modal-root') // Assuming you have a div with id="modal-root" in your index.html
    );
};

export default SavedReportsModal;
