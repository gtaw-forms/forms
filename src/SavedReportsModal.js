import React, { useState, useEffect } from 'react';
import Notification from './components/Notification';

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
    padding: '20px',
    borderRadius: '5px',
    width: '50%',
    maxWidth: '600px',
    position: 'relative',
};

const modalHeaderStyle = {
    fontSize: '1.2em',
    fontWeight: 'bold',
    marginBottom: '15px',
    textAlign: 'center',
};

const closeButtonStyle = {
    position: 'absolute',
    top: '10px',
    right: '10px',
    background: 'none',
    border: 'none',
    color: 'red',
    fontSize: '20px',
    cursor: 'pointer',
    gap: '10px',
};

const reportItemStyle = {
    marginBottom: '5px',
    display: 'grid', // Use grid for better column layout
    gridTemplateColumns: '1fr 1fr', // Two equal-width columns
    alignItems: 'center',
    gap: '5px',
    border: '1px solid #ccc', // Add a border for better visual separation
    padding: '5px', // Add padding for better spacing
};

const itemsPerPage = 5; // Number of reports per page

const SavedReportsModal = ({ show, onClose, savedReports, loadReport, deleteReport, getBBCodeContent, showNotification }) => { // Added showNotification prop
    const [currentPage, setCurrentPage] = useState(1);
    const [sortedReports, setSortedReports] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        // Sort the savedReports array based on the timestamp stored in localStorage
        const sorted = [...savedReports].sort((a, b) => {
            const reportA = localStorage.getItem(a);
            const reportB = localStorage.getItem(b);

            if (reportA && reportB) {
                try {
                    const parsedA = JSON.parse(reportA);
                    const parsedB = JSON.parse(reportB);
                    return parsedB.timestamp - parsedA.timestamp; // Sort in descending order (most recent first)
                } catch (error) {
                    console.error("Error parsing report data:", error);
                    return 0; // In case of parsing errors, maintain the original order
                }
            } else {
                return 0; // If report data is missing, maintain the original order
            }
        });
        setSortedReports(sorted);
    }, [savedReports]);

    if (!show) {
        return null;
    }

    const totalPages = Math.ceil(sortedReports.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;

    // Filter reports based on search query
    const filteredReports = sortedReports.filter(key => {
        if (searchQuery === '') {
            return true; // Include all reports when search query is empty
        }
        const reportData = localStorage.getItem(key);
        if (reportData) {
            try {
                const parsedData = JSON.parse(reportData);
                // Assuming 'decedentName' is a field in your report data
                if (parsedData?.data?.decedentOOC) {
                    const decedentOOC = parsedData.data.decedentOOC;
                    if (decedentOOC && typeof decedentOOC === 'string') {
                        return decedentOOC.toLowerCase().includes(searchQuery.toLowerCase());
                    }
                }
            } catch (error) {
                console.error("Error parsing report data:", error);
                return false; // Don't include if there's an error
            }
        }
        return false; // Don't include if no report data
    });    
    const currentReports = filteredReports.slice(startIndex, endIndex);

    const copyToClipboard = async (text) => {
        try {
            await navigator.clipboard.writeText(text);
            showNotification('BBCode copied to clipboard!'); // Use the prop here
        } catch (err) {
            console.error('Failed to copy: ', err);
            showNotification('Failed to copy BBCode to clipboard.', 'exclamation-circle'); // Use the prop here
        }
    };
    
    const handleCopyBBCode = (key) => {
        const reportData = localStorage.getItem(key);
        if (reportData) {
            try {
                const parsedData = JSON.parse(reportData);
                const bbcode = parsedData.bbCode; // Access the saved BBCode directly
                copyToClipboard(bbcode);
            } catch (error) {
                console.error("Error parsing report data:", error);
                showNotification('Failed to copy BBCode.  Report data may be corrupted.', 'exclamation-circle');
            }
        } else {
            console.error(`Report data not found for key: ${key}`);
            showNotification ('Failed to copy BBCode. Report not found.');
        }
    };
        
    const goToPreviousPage = () => {
        setCurrentPage(currentPage - 1);
    };

    const goToNextPage = () => {
        setCurrentPage(currentPage + 1);
    };

    return (
        <div>
            <div style={modalStyle}>
                <div style={modalContentStyle}>
                <div style={modalHeaderStyle}>Manage Your Reports (Beta)</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <input
                            type="text"
                            placeholder="Search Decedent Name"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            style={{
                                padding: '5px',
                                borderRadius: '5px',
                                border: '1px solid #ccc',
                                width: '60%', // Adjust the width as needed
                            }}
                                                    
                        />
                        <button onClick={onClose} style={closeButtonStyle}>
                            &#x2715;
                        </button>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>Decedent OOC Name</th>
                                <th>Date & Time</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentReports.map(key => {
                                const reportData = localStorage.getItem(key);
                                let name = key;
                                let dateTime = '';

                                if (reportData) {
                                    try {
                                        const parsedData = JSON.parse(reportData);
                                        name = parsedData.data.decedentName || key; // Use decedentName if available, otherwise use key
                                        const timestamp = new Date(parsedData.timestamp);
                                        dateTime = timestamp.toLocaleString();
                                    } catch (error) {
                                        console.error("Error parsing report data:", error);
                                    }
                                }

                                return (
                                    <tr key={key}>
                                        <td>{name}</td>
                                        <td>{dateTime}</td>
                                        <td>
                                            <button onClick={() => loadReport(key)}>Load</button>
                                            <button onClick={() => deleteReport(key)}>Delete</button>
                                            <button onClick={() => handleCopyBBCode(key)}>Copy BBCode</button>
                                        </td>
                                    </tr>
                                );
                            })}
                                                    </tbody>
                    </table>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <button onClick={goToPreviousPage} disabled={currentPage === 1}>
                            Previous
                        </button>
                        <span>Page {currentPage} of {totalPages}</span>
                        <button onClick={goToNextPage} disabled={currentPage === totalPages}>
                            Next
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SavedReportsModal;