import React, { useState, useEffect } from 'react';
import { Button, Form } from 'react-bootstrap';

// --- Styles (Keep existing styles) ---
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
};
const closeButtonStyle = {
    position: 'absolute',
    top: '15px', // Adjusted for a bit more space from the very top edge of the modal content
    right: '15px', // Position from the right edge of the modal content
    background: 'transparent',
    border: 'none',
    color: '#f85149', // Existing color for the 'X'
    fontSize: '28px',  // Slightly larger for better visibility
    fontWeight: 'bold', // Make the 'X' more prominent
    lineHeight: '1',    // Ensures the 'X' is centered vertically
    padding: '0.25rem 0.5rem', // Adds some padding around the 'X' for easier clicking
    cursor: 'pointer',
    zIndex: 10 // Ensures the button is above other elements within the modal content
};
const controlsContainerStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '15px',
    flexShrink: 0,
    gap: '10px',
    paddingRight: '50px', // Add padding to prevent content from overlapping with the close button
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
    flexGrow: 1, // Allow search to take available space
    maxWidth: '450px', // ADD THIS LINE - Adjust the value (e.g., '400px', '50%') as needed
    // minWidth: '200px', // Optional: to ensure it doesn't get too small
};
const switchButtonStyle = { // Style for the new switch button
    ...actionButtonStyle,
    backgroundColor: '#1f6feb', // A different color for distinction
    marginRight: '10px', // Add some space to its right
    flexShrink: 0, // Prevent it from shrinking
};
const hrStyle = { borderColor: '#30363d', margin: '15px 0' };
// --- End Styles ---

const itemsPerPage = 7;
const LOAD_DELAY_MS = 1000;

const SavedReportsModal = ({
    show,
    onClose,
    reportsForSelectedUser,
    loadReportForUser,
    deleteReportForUser,
    onEmployeeSelect,
    showNotification,
    isLoadingReports,
    currentPhmcEmployee,
    currentCoronerEmployee,
}) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [sortedReports, setSortedReports] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedReportKeys, setSelectedReportKeys] = useState([]);
    const [isLoadingMultiple, setIsLoadingMultiple] = useState(false);
    const [activeEmployeeForModal, setActiveEmployeeForModal] = useState(null);

    useEffect(() => {
        if (show) {
            // Default to Coroner if both are present, otherwise pick the one available
            const initialAuthor = currentCoronerEmployee || currentPhmcEmployee || null;
            setActiveEmployeeForModal(initialAuthor);
            if (initialAuthor) {
                console.log(`[SavedReportsModal] Initial load for: ${initialAuthor}`);
                onEmployeeSelect(initialAuthor);
            } else {
                console.log('[SavedReportsModal] No employee specified in form, clearing reports.');
                onEmployeeSelect(null);
                setSortedReports([]);
            }
        } else {
            setActiveEmployeeForModal(null);
            setSearchQuery('');
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [show, currentCoronerEmployee, currentPhmcEmployee]); // Re-run if these props change while modal is open

    useEffect(() => {
        const sorted = [...(reportsForSelectedUser || [])].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        setSortedReports(sorted);
        setCurrentPage(1);
        setSelectedReportKeys([]);
    }, [reportsForSelectedUser]);

    const handleSwitchEmployee = () => {
        let newActiveEmployee = null;
        if (activeEmployeeForModal === currentCoronerEmployee && currentPhmcEmployee) {
            newActiveEmployee = currentPhmcEmployee;
        } else if (activeEmployeeForModal === currentPhmcEmployee && currentCoronerEmployee) {
            newActiveEmployee = currentCoronerEmployee;
        } else if (currentCoronerEmployee) { // Fallback if somehow activeEmployeeForModal is out of sync
            newActiveEmployee = currentCoronerEmployee;
        } else if (currentPhmcEmployee) {
            newActiveEmployee = currentPhmcEmployee;
        }


        if (newActiveEmployee && newActiveEmployee !== activeEmployeeForModal) {
            setActiveEmployeeForModal(newActiveEmployee);
            onEmployeeSelect(newActiveEmployee); // Load reports for the new employee
            setSearchQuery(''); // Reset search
            setCurrentPage(1); // Reset pagination
            showNotification(`Switched to reports for ${newActiveEmployee}`, 'exchange-alt');
        }
    };

    const filteredReports = sortedReports.filter(report =>
        report && typeof report.originalKey === 'string' &&
        report.originalKey.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const totalPages = Math.ceil(filteredReports.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentReportsOnPage = filteredReports.slice(startIndex, endIndex);

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
        if (selectedReportKeys.length === 0 || !activeEmployeeForModal) {
            showNotification('No reports selected or no employee identified.', 'warning');
            return;
        }
        if (isLoadingMultiple) return;

        setIsLoadingMultiple(true);
        const numToLoad = selectedReportKeys.length;
        const calculatedDuration = numToLoad > 1 ? ((numToLoad - 1) * LOAD_DELAY_MS) + 500 : 3000;
        showNotification(`Loading ${numToLoad} report(s)...`, 'info-circle', calculatedDuration);

        const reportsToLoad = reportsForSelectedUser
            .filter(r => selectedReportKeys.includes(r.key))
            .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

        for (let i = 0; i < reportsToLoad.length; i++) {
            const report = reportsToLoad[i];
            try {
                await loadReportForUser(report.key, activeEmployeeForModal);
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
        if (selectedReportKeys.length === 0 || !activeEmployeeForModal) {
            showNotification('No reports selected or no employee identified.', 'warning');
            return;
        }
        selectedReportKeys.forEach(reportKey => {
            deleteReportForUser(reportKey, activeEmployeeForModal);
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
            const report = reportsForSelectedUser.find(r => r.key === reportKey);
            if (report && report.bbCode) {
                if (combinedBbCode) combinedBbCode += separator;
                combinedBbCode += report.bbCode;
                copyCount++;
            }
        }
        if (combinedBbCode) {
            try {
                await navigator.clipboard.writeText(combinedBbCode);
                showNotification(`BBCode for ${copyCount} report(s) copied!`, 'clipboard');
            } catch (err) {
                showNotification('Failed to copy combined BBCode.', 'error');
            }
        } else {
            showNotification('No valid BBCode found in selected reports.', 'warning');
        }
    };

    const handleCopyBBCode = (reportKey) => {
        const report = reportsForSelectedUser.find(r => r.key === reportKey);
        if (report && report.bbCode) {
            navigator.clipboard.writeText(report.bbCode)
                .then(() => showNotification('BBCode copied!', 'clipboard'))
                .catch(() => showNotification('Failed to copy BBCode.', 'error'));
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
        otherEmployeeName = activeEmployeeForModal === currentCoronerEmployee ? currentPhmcEmployee : currentCoronerEmployee;
    }


    if (!show) return null;

    return (
        <div style={modalStyle}>
            <div style={modalContentStyle}>
                
                <div style={controlsContainerStyle}>
                    <input
                        type="text"
                        placeholder="Search reports by name/identifier..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        style={searchInputStyle}
                        disabled={!activeEmployeeForModal || isLoadingReports}
                    />
                    {/* Switch button is now second, will be pushed to the right by justifyContent */}
                    {canSwitchEmployee && (
                        <Button
                            onClick={handleSwitchEmployee}
                            style={switchButtonStyle}
                            title={`Switch to reports for ${otherEmployeeName}`}
                        >
                            <i className="fas fa-exchange-alt" style={{ marginRight: '5px' }}></i>
                            Switch to {otherEmployeeName}
                        </Button>
                    )}
                </div>
<Button onClick={onClose} style={closeButtonStyle} aria-label="Close modal">
    &times;
</Button>

                <hr style={hrStyle} />

                <div style={modalHeaderStyle}>
                    Manage Saved Reports {activeEmployeeForModal ? `for ${activeEmployeeForModal}` : '(No Employee Selected in Form)'}
                    {activeEmployeeForModal && ` (${reportsForSelectedUser?.length || 0} total)`}
                </div>

                {isLoadingReports && activeEmployeeForModal && <p style={{ textAlign: 'center', flexShrink: 0 }}>Loading reports for {activeEmployeeForModal}...</p>}

                <div style={tableContainerStyle}>
                    {!isLoadingReports && activeEmployeeForModal && filteredReports.length > 0 ? (
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
                                            <td style={tdStyle}>{new Date(report.timestamp).toLocaleString()}</td>
                                            <td style={tdStyle}>{report.bbCodeVersion}</td>
                                            <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                                                <Button onClick={() => loadReportForUser(report.key, activeEmployeeForModal)} style={actionButtonStyle} title="Load this report">Load</Button>
                                                <Button onClick={() => deleteReportForUser(report.key, activeEmployeeForModal)} style={deleteButtonStyle} title="Delete this report">Delete</Button>
                                                <Button onClick={() => handleCopyBBCode(report.key)} style={copyButtonStyle} title="Copy BBCode">Copy BBCode</Button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    ) : (
                        !isLoadingReports && activeEmployeeForModal && (
                            <p style={{ textAlign: 'center', marginTop: '20px' }}>
                                {searchQuery ? `No reports match your search for ${activeEmployeeForModal}.` : `No reports saved for ${activeEmployeeForModal}.`}
                            </p>
                        )
                    )}
                    {!isLoadingReports && !activeEmployeeForModal && (
                        <p style={{ textAlign: 'center', marginTop: '20px' }}>
                            Please select an employee in the main form to view their saved reports.
                        </p>
                    )}
                </div>

                {!isLoadingReports && activeEmployeeForModal && filteredReports.length > 0 && (
                    <div style={bulkActionsContainerStyle}>
                        <Button onClick={handleDeleteSelected} style={deleteButtonStyle} disabled={selectedReportKeys.length === 0}>Delete Selected ({selectedReportKeys.length})</Button>
                        <Button onClick={handleCopySelectedBBCode} style={copyButtonStyle} disabled={selectedReportKeys.length === 0}>Copy Selected BBCode ({selectedReportKeys.length})</Button>
                        <Button style={actionButtonStyle} disabled={selectedReportKeys.length === 0 || isLoadingMultiple} onClick={handleLoadSelected}>
                            {isLoadingMultiple ? <><i className="fas fa-spinner fa-spin" style={{ marginRight: '5px' }}></i>Loading...</> : `Load Selected (${selectedReportKeys.length})`}
                        </Button>
                    </div>
                )}

                {totalPages > 1 && !isLoadingReports && activeEmployeeForModal && (
                    <div style={paginationStyle}>
                        <Button onClick={goToPreviousPage} disabled={currentPage === 1} style={actionButtonStyle}>Previous</Button>
                        <span>Page {currentPage} of {totalPages}</span>
                        <Button onClick={goToNextPage} disabled={currentPage === totalPages} style={actionButtonStyle}>Next</Button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SavedReportsModal;
