import React, { useState, useEffect } from 'react';
import { Button, Form } from 'react-bootstrap'; // Added Form for checkbox

// --- Styles (keep as they are) ---
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
    backgroundColor: '#0d1117', // Dark background
    color: '#c9d1d9', // Light text
    padding: '20px',
    borderRadius: '5px',
    width: '90%', // Increased width further
    maxWidth: '1000px', // Increased max-width further for more space
    maxHeight: '85vh', // Limit height and allow scrolling
    overflowY: 'auto', // Enable vertical scrolling if content exceeds height
    position: 'relative',
    border: '1px solid #30363d', // Subtle border
};

const modalHeaderStyle = {
    fontSize: '1.3em', // Slightly larger header
    fontWeight: 'bold',
    marginBottom: '20px', // Increased margin
    textAlign: 'center',
    borderBottom: '1px solid #30363d', // Separator line
    paddingBottom: '10px', // Spacing below header
};

const closeButtonStyle = {
    position: 'absolute',
    top: '10px', // Adjusted position
    right: '15px', // Adjusted position
    background: 'none',
    border: 'none',
    color: '#f85149', // Brighter red for visibility
    fontSize: '24px', // Slightly larger icon
    cursor: 'pointer',
    lineHeight: '1', // Ensure Button doesn't affect layout height
};

const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse', // Cleaner table lines
    marginTop: '15px',
};

const thStyle = {
    backgroundColor: '#161b22', // Darker header background
    border: '1px solid #30363d',
    padding: '10px',
    textAlign: 'left',
    fontWeight: '600', // Bolder header text
};
// Style for the checkbox column header/cell

const tdStyle = {
    border: '1px solid #30363d',
    padding: '8px 10px', // Adjusted padding
    verticalAlign: 'middle', // Align content vertically
    maxWidth: '250px', // Prevent overly wide columns
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
};
const thCheckboxStyle = { ...thStyle, width: '40px', textAlign: 'center' }; // Narrower for checkbox
const tdCheckboxStyle = { ...tdStyle, textAlign: 'center' }; // Center checkbox

const actionButtonStyle = {
    backgroundColor: '#238636', // Green Button
    color: 'white',
    border: 'none',
    padding: '5px 10px',
    borderRadius: '4px',
    cursor: 'pointer',
    marginRight: '5px',
    fontSize: '0.9em',
    whiteSpace: 'nowrap', // Prevent button text wrapping
};

const deleteButtonStyle = {
    ...actionButtonStyle,
    backgroundColor: '#da3633', // Red Button
};

const copyButtonStyle = {
    ...actionButtonStyle,
    backgroundColor: '#2f81f7', // Blue Button
};
// Style for bulk action buttons container
const bulkActionsContainerStyle = {
    display: 'flex',
    gap: '10px',
    marginTop: '15px',
    paddingTop: '10px',
    borderTop: '1px solid #30363d',
};

const paginationStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: '20px', // Increased margin
    paddingTop: '10px', // Spacing above pagination
    borderTop: '1px solid #30363d', // Separator line
};

const searchInputStyle = {
    padding: '8px 10px', // Adjusted padding
    borderRadius: '5px',
    border: '1px solid #30363d',
    backgroundColor: '#0d1117', // Match background
    color: '#c9d1d9', // Light text
    width: '60%', // Adjust width as needed
    marginRight: '10px', // Space between search and close Button
};
// --- End Styles ---

const itemsPerPage = 10; // Increased items per page

const SavedReportsModal = ({ show, onClose, savedReports, loadReport, deleteReport, showNotification }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [sortedReports, setSortedReports] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [savedReportCount, setSavedReportCount] = useState(0);
    const [selectedReportKeys, setSelectedReportKeys] = useState([]);
    const [isLoadingMultiple, setIsLoadingMultiple] = useState(false); // State to track multi-load

    // --- Effect to get and set the saved report count ---
    useEffect(() => {
        const countStr = localStorage.getItem('SavedReportCount') || '0';
        let count = parseInt(countStr, 10);
        if (isNaN(count)) {
            console.warn("Invalid 'SavedReportCount' in localStorage, resetting to 0.");
            count = 0;
            localStorage.setItem('SavedReportCount', '0'); // Correct invalid value
        }
        setSavedReportCount(count);
    }, [savedReports]); // Re-run if savedReports changes (e.g., after delete)
    // --- End Effect ---
    const itemsPerPage = 7;
    const LOAD_DELAY_MS = 3000; // 3 seconds delay
    
    useEffect(() => {
        const sorted = [...savedReports].sort((a, b) => {
            const reportA = localStorage.getItem(a);
            const reportB = localStorage.getItem(b);

            if (reportA && reportB) {
                try {
                    const parsedA = JSON.parse(reportA);
                    const parsedB = JSON.parse(reportB);
                    return (parsedB.timestamp || 0) - (parsedA.timestamp || 0); // Descending, handle missing timestamp
                } catch (error) {
                    console.error("Error parsing report data for sorting:", error);
                    return 0;
                }
            } else {
                return 0;
            }
        });
        setSortedReports(sorted);
        setCurrentPage(1); // Reset to first page when reports change or search query changes
        setSelectedReportKeys([]); // Clear selection when reports/search changes
    }, [savedReports, searchQuery]); // Add searchQuery dependency

    // Filter reports based on search query (case-insensitive)
    const filteredReports = sortedReports.filter(key =>
        key.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const totalPages = Math.ceil(filteredReports.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentReports = filteredReports.slice(startIndex, endIndex);

    // --- Selection Handlers ---
    const handleCheckboxChange = (key, checked) => {
        setSelectedReportKeys(prev =>
            checked ? [...prev, key] : prev.filter(k => k !== key)
        );
    };

    const handleSelectAllChange = (checked) => {
        if (checked) {
            // Select all keys *currently visible on this page*
            setSelectedReportKeys(prev => [...new Set([...prev, ...currentReports])]);
        } else {
            // Deselect all keys *currently visible on this page*
            const currentKeysSet = new Set(currentReports);
            setSelectedReportKeys(prev => prev.filter(k => !currentKeysSet.has(k)));
        }
    };
    // --- End Selection Handlers ---
    const handleLoadSelected = async () => {
        const numberOfReports = selectedReportKeys.length; // Get count first

        if (numberOfReports === 0) {
            showNotification('No reports selected to load.', 'warning');
            return;
        }
        if (isLoadingMultiple) {
            showNotification('Already loading reports...', 'info-circle');
            return;
        }

        setIsLoadingMultiple(true);

        // --- Calculate total duration ---
        // (N-1) delays + a small buffer (e.g., 500ms) to ensure it stays slightly longer
        const calculatedDuration = numberOfReports > 1
            ? ((numberOfReports - 1) * LOAD_DELAY_MS) + 500
            : 3000; // Use default if only one report

        // Show the initial notification with the calculated duration
        showNotification(
            `Loading ${numberOfReports} report(s)... Please wait.`,
            'info-circle',
            calculatedDuration // Pass the calculated duration
        );
        // --- End Duration Calculation & Initial Notification ---

        // Sort selected keys (keep sorting logic)
        const sortedSelectedKeys = [...selectedReportKeys].sort((aKey, bKey) => {
            // ... sorting logic ...
             const reportA = localStorage.getItem(aKey);
            const reportB = localStorage.getItem(bKey);
            try {
                const parsedA = reportA ? JSON.parse(reportA) : { timestamp: 0 };
                const parsedB = reportB ? JSON.parse(reportB) : { timestamp: 0 };
                return (parsedA.timestamp || 0) - (parsedB.timestamp || 0); // Ascending order
            } catch {
                return 0;
            }
        });

        // --- Loading Loop (Keep as is) ---
        for (let i = 0; i < sortedSelectedKeys.length; i++) {
            const key = sortedSelectedKeys[i];
            try {
                loadReport(key);
                if (i < sortedSelectedKeys.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, LOAD_DELAY_MS));
                }
            } catch (error) {
                console.error(`Error loading report ${key}:`, error);
                // Show error notification (uses default duration)
                showNotification(`Error loading report ${key}. Check console.`, 'error');
                // break; // Optional: Stop on error
            }
        }
        // --- End Loading Loop ---

        // Show the final completion notification (uses default duration)
        showNotification(`Finished loading ${sortedSelectedKeys.length} report(s).`, 'check-circle');
        setIsLoadingMultiple(false);
        setSelectedReportKeys([]);
        // onClose(); // Optional: Close modal
    };

    // --- Bulk Action Handlers ---
    const handleDeleteSelected = () => {
        if (selectedReportKeys.length === 0) {
            showNotification('No reports selected to delete.', 'warning');
            return;
        }
        // Optional: Add a confirmation dialog here
        selectedReportKeys.forEach(key => {
            deleteReport(key); // Call the delete function passed from App.js
        });
        showNotification(`${selectedReportKeys.length} report(s) deleted.`, 'trash');
        setSelectedReportKeys([]); // Clear selection after deletion
    };

    const handleCopySelectedBBCode = async () => {
        if (selectedReportKeys.length === 0) {
            showNotification('No reports selected to copy.', 'warning');
            return;
        }

        let combinedBbCode = '';
        let copyCount = 0;
        const separator = '\n\n[hr][/hr]\n\n'; // Separator between reports

        for (const key of selectedReportKeys) {
            const reportData = localStorage.getItem(key);
            if (reportData) {
                try {
                    const parsedData = JSON.parse(reportData);
                    const bbcode = parsedData.bbCode;
                    if (bbcode) {
                        if (combinedBbCode) { // Add separator if not the first report
                            combinedBbCode += separator;
                        }
                        combinedBbCode += bbcode;
                        copyCount++;
                    }
                } catch (error) {
                    console.error(`Error parsing report data for copy (key: ${key}):`, error);
                    // Optionally notify about specific failures
                }
            }
        }

        if (combinedBbCode) {
            try {
                await navigator.clipboard.writeText(combinedBbCode);
                showNotification(`BBCode for ${copyCount} report(s) copied!`, 'clipboard');
            } catch (err) {
                console.error('Failed to copy combined BBCode: ', err);
                showNotification('Failed to copy combined BBCode.', 'error');
            }
        } else {
            showNotification('No valid BBCode found in selected reports.', 'warning');
        }
    };
    // --- End Bulk Action Handlers ---


    const copyToClipboard = async (text) => {
        if (!text) {
            showNotification('Nothing to copy.', 'warning');
            return;
        }
        try {
            await navigator.clipboard.writeText(text);
            showNotification('BBCode copied to clipboard!', 'clipboard');
        } catch (err) {
            console.error('Failed to copy BBCode: ', err);
            showNotification('Failed to copy BBCode.', 'error');
        }
    };

    const handleCopyBBCode = (key) => {
        const reportData = localStorage.getItem(key);
        if (reportData) {
            try {
                const parsedData = JSON.parse(reportData);
                const bbcode = parsedData.bbCode;
                if (bbcode) {
                    copyToClipboard(bbcode);
                } else {
                    showNotification('No BBCode found in this saved report.', 'warning');
                }
            } catch (error) {
                console.error("Error parsing report data for copy:", error);
                showNotification('Failed to read BBCode. Report data might be corrupted.', 'error');
            }
        } else {
            console.error(`Report data not found for key: ${key}`);
            showNotification('Failed to copy BBCode. Report not found.', 'error');
        }
    };

    const goToPreviousPage = () => {
        setCurrentPage(prev => Math.max(prev - 1, 1));
    };

    const goToNextPage = () => {
        setCurrentPage(prev => Math.min(prev + 1, totalPages));
    };

    // Function to safely parse and extract data for display
    const getReportDisplayData = (key) => {
        const reportData = localStorage.getItem(key);
        let displayKey = key; // Default to the key itself
        let dateTime = 'N/A';
        let version = 'N/A';

        if (reportData) {
            try {
                const parsedData = JSON.parse(reportData);
                // Try to construct a more meaningful name based on version
                version = parsedData.bbCodeVersion || 'N/A';
                const data = parsedData.data || {};
                if (version === 1 && data.decedentOOC && data.dateTime) {
                    displayKey = `${data.decedentOOC} - ${data.dateTime}`;
                } else if (version >= 3 && version <= 7 && data.patientID && data.patientName && data.date) {
                    displayKey = `${data.patientID} - ${data.patientName} - ${data.date}`;
                } else if (version === 19 && data.patientID && data.lastName && data.date) {
                    displayKey = `${data.patientID} - ${data.lastName} - ${data.date}`;
                } // Add more conditions for other versions if needed

                if (parsedData.timestamp) {
                    const timestamp = new Date(parsedData.timestamp);
                    dateTime = timestamp.toLocaleString(); // Format timestamp nicely
                }
            } catch (error) {
                console.error(`Error parsing report data for display (key: ${key}):`, error);
                dateTime = 'Error Loading'; // Indicate error
            }
        }
        return { displayKey, dateTime, version };
    };

    // Determine if the "Select All" checkbox should be checked
    const isAllCurrentPageSelected = currentReports.length > 0 && currentReports.every(key => selectedReportKeys.includes(key));

    if (!show) {
        return null;
    }

    return (
        <div style={modalStyle}>
            <div style={modalContentStyle}>
                <Button onClick={onClose} style={closeButtonStyle} aria-label="Close modal">
                    &times;
                </Button>

                <div style={modalHeaderStyle}>
                    Manage Saved Reports ({savedReportCount} total)
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    {/* Search Input */}
                    <input
                        type="text"
                        placeholder="Search reports by key..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        style={searchInputStyle}
                    />
                </div>

                {filteredReports.length > 0 ? (
                    <>
                        {/* Table */}
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
                                    <th style={thStyle}>Version</th>
                                    <th style={thStyle}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentReports.map(key => {
                                    const { displayKey, dateTime, version } = getReportDisplayData(key);
                                    const isSelected = selectedReportKeys.includes(key);
                                    return (
                                        <tr key={key} style={isSelected ? { backgroundColor: '#161b22' } : {}}>
                                            <td style={tdCheckboxStyle}>
                                                <Form.Check
                                                    type="checkbox"
                                                    id={`select-${key}`}
                                                    checked={isSelected}
                                                    onChange={(e) => handleCheckboxChange(key, e.target.checked)}
                                                />
                                            </td>
                                            <td style={tdStyle} title={displayKey}>{displayKey}</td>
                                            <td style={tdStyle}>{dateTime}</td>
                                            <td style={tdStyle}>{version}</td>
                                            <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                                                {/* Single Load Button */}
                                                <Button onClick={() => loadReport(key)} style={actionButtonStyle} title="Load this report">Load</Button>
                                                {/* Single Delete Button */}
                                                <Button onClick={() => deleteReport(key)} style={deleteButtonStyle} title="Delete this report">Delete</Button>
                                                {/* Single Copy Button */}
                                                <Button onClick={() => handleCopyBBCode(key)} style={copyButtonStyle} title="Copy BBCode for this report">Copy BBCode</Button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        {/* Bulk Actions */}
                        <div style={bulkActionsContainerStyle}>
                            {/* Bulk Delete Button */}
                            <Button
                                onClick={handleDeleteSelected}
                                style={deleteButtonStyle}
                                disabled={selectedReportKeys.length === 0}
                                title="Delete all selected reports"
                            >
                                Delete Selected ({selectedReportKeys.length})
                            </Button>
                            {/* Bulk Copy Button */}
                            <Button
                                onClick={handleCopySelectedBBCode}
                                style={copyButtonStyle}
                                disabled={selectedReportKeys.length === 0}
                                title="Copy BBCode for all selected reports"
                            >
                                Copy Selected BBCode ({selectedReportKeys.length})
                            </Button>
                            {/* *** MODIFIED: Bulk Load Button *** */}
                            <Button
                                style={actionButtonStyle}
                                // Only disable if nothing is selected OR if multi-load is in progress
                                disabled={selectedReportKeys.length === 0 || isLoadingMultiple}
                                onClick={handleLoadSelected} // Use the new handler
                                title={isLoadingMultiple ? "Loading reports..." : "Load selected reports with a delay"}
                            >
                                {isLoadingMultiple ? (
                                    <>
                                        <i className="fas fa-spinner fa-spin" style={{ marginRight: '5px' }}></i>
                                        Loading...
                                    </>
                                ) : (
                                    `Load Selected (${selectedReportKeys.length})`
                                )}
                            </Button>
                            {/* *** END MODIFIED *** */}
                        </div>
                    </>
                ) : (
                    <p style={{ textAlign: 'center', marginTop: '20px' }}>
                        {searchQuery ? 'No reports match your search.' : 'No reports saved yet.'}
                    </p>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div style={paginationStyle}>
                        <Button onClick={goToPreviousPage} disabled={currentPage === 1} style={actionButtonStyle}>
                            Previous
                        </Button>
                        <span>Page {currentPage} of {totalPages}</span>
                        <Button onClick={goToNextPage} disabled={currentPage === totalPages} style={actionButtonStyle}>
                            Next
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SavedReportsModal;
