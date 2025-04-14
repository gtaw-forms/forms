// filepath: src/SavedReportsModal.js
import React, { useState, useEffect } from 'react';
import Notification from './components/Notification'; // Assuming Notification component exists

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
    width: '80%', // Increased width for better layout
    maxWidth: '800px', // Increased max-width
    maxHeight: '80vh', // Limit height and allow scrolling
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
    top: '15px', // Adjusted position
    right: '15px', // Adjusted position
    background: 'none',
    border: 'none',
    color: '#f85149', // Brighter red for visibility
    fontSize: '24px', // Slightly larger icon
    cursor: 'pointer',
    lineHeight: '1', // Ensure button doesn't affect layout height
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

const tdStyle = {
    border: '1px solid #30363d',
    padding: '8px 10px', // Adjusted padding
    verticalAlign: 'middle', // Align content vertically
};

const actionButtonStyle = {
    backgroundColor: '#238636', // Green button
    color: 'white',
    border: 'none',
    padding: '5px 10px',
    borderRadius: '4px',
    cursor: 'pointer',
    marginRight: '5px',
    fontSize: '0.9em',
};

const deleteButtonStyle = {
    ...actionButtonStyle,
    backgroundColor: '#da3633', // Red button
};

const copyButtonStyle = {
    ...actionButtonStyle,
    backgroundColor: '#2f81f7', // Blue button
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
    marginRight: '10px', // Space between search and close button
};
// --- End Styles ---

const itemsPerPage = 5; // Number of reports per page

const SavedReportsModal = ({ show, onClose, savedReports, loadReport, deleteReport, showNotification }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [sortedReports, setSortedReports] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [savedReportCount, setSavedReportCount] = useState(0); // State for the count

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
    }, [savedReports, searchQuery]); // Add searchQuery dependency

    if (!show) {
        return null;
    }

    // Filter reports based on search query (case-insensitive)
    const filteredReports = sortedReports.filter(key =>
        key.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const totalPages = Math.ceil(filteredReports.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentReports = filteredReports.slice(startIndex, endIndex);

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


    return (
        <div style={modalStyle}>
            <div style={modalContentStyle}>
                {/* Updated Header */}
                <div style={modalHeaderStyle}>
                    Manage Saved Reports ({savedReportCount} total)
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <input
                        type="text"
                        placeholder="Search reports by key..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        style={searchInputStyle}
                    />
                    <button onClick={onClose} style={closeButtonStyle} aria-label="Close modal">
                        &times;
                    </button>
                </div>

                {filteredReports.length > 0 ? (
                    <table style={tableStyle}>
                        <thead>
                            <tr>
                                <th style={thStyle}>Name / Timestamp</th>
                                <th style={thStyle}>Saved Date & Time</th>
                                <th style={thStyle}>Version</th>
                                <th style={thStyle}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentReports.map(key => {
                                const { displayKey, dateTime, version } = getReportDisplayData(key);
                                return (
                                    <tr key={key}>
                                        <td style={tdStyle}>{displayKey}</td>
                                        <td style={tdStyle}>{dateTime}</td>
                                        <td style={tdStyle}>{version}</td>
                                        <td style={tdStyle}>
                                            <button onClick={() => loadReport(key)} style={actionButtonStyle}>Load</button>
                                            <button onClick={() => deleteReport(key)} style={deleteButtonStyle}>Delete</button>
                                            <button onClick={() => handleCopyBBCode(key)} style={copyButtonStyle}>Copy BBCode</button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                ) : (
                    <p style={{ textAlign: 'center', marginTop: '20px' }}>
                        {searchQuery ? 'No reports match your search.' : 'No reports saved yet.'}
                    </p>
                )}

                {totalPages > 1 && (
                    <div style={paginationStyle}>
                        <button onClick={goToPreviousPage} disabled={currentPage === 1} style={actionButtonStyle}>
                            Previous
                        </button>
                        <span>Page {currentPage} of {totalPages}</span>
                        <button onClick={goToNextPage} disabled={currentPage === totalPages} style={actionButtonStyle}>
                            Next
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SavedReportsModal;
