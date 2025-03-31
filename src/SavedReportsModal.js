import React, { useState, useEffect } from 'react';

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

const reportItemStyle = { // Style for each saved report item
    marginBottom: '5px', // Add some space between each report
    display: 'flex', // Use flexbox to align items
    alignItems: 'center', // Vertically align items in the center
    gap: '25px', // Add a gap between the text and the buttons
};

const itemsPerPage = 5; // Number of reports per page

const SavedReportsModal = ({ show, onClose, savedReports, loadReport, deleteReport }) => {
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
                    {currentReports.map(key => (
                        <div key={key} style={reportItemStyle}>
                            {key}
                            <button onClick={() => loadReport(key)} >Load</button>
                            <button onClick={() => deleteReport(key)}>Delete</button>
                        </div>
                    ))}
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