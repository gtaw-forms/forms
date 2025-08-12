import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Modal, Button, Form, Spinner } from 'react-bootstrap';
import Select from 'react-select';
import './EmsBingoModal.css';
import phmcLogo from '../assets/phmc.png';
import { database } from '../firebase';
import { ref, set, onValue, off, serverTimestamp, get, remove, push } from 'firebase/database';
import PhraseRequestModal from './PhraseRequestModal';
import emsBingoBackground from '../assets/EMMafia_Pride.png';

// Function to shuffle an array (used by admin to generate new card)
const getShuffledPhrases = (phrases) => {
    if (!phrases || phrases.length === 0) return [];
    return [...phrases].sort(() => 0.5 - Math.random());
};

// Define a set of distinct colors for employees
const EMPLOYEE_COLORS = [
    '#3fb950', // Green
    '#58a6ff', // Blue
    '#e3b341', // Yellow/Orange
    '#f85149', // Red
    '#8957e5', // Purple
    '#00b4ab', // Teal
    '#ff7b72', // Light Red
    '#d2a8ff', // Light Purple
    '#79c0ff', // Light Blue
    '#a3d8b0', // Light Green
    '#f0883e', // Orange
    '#6a737d', // Grey
];

const BINGO_TYPES = [
    {
        id: 'er',
        name: 'Emergency Room',
        path: 'ER', // Firebase path segment
        employeeGroup: 'PHMC',
        employeeFilter: ['Leadership', 'Hospital Supervisor', 'Chief Resident', 'Physician', 'Resident Physician', 'Physician Assistant', 'Psychiatrist', 'Psychologist', 'Dentist', 'Nursing', 'Emergency Medical Services', 'Attending Physician', 'Uncategorized'] // All PHMC
    },
    {
        id: 'ems',
        name: 'EMS',
        path: 'EMS',
        employeeGroup: 'PHMC',
        employeeFilter: ['Emergency Medical Services'] // Only EMS staff
    },
    {
        id: 'coroner',
        name: 'Coroner',
        path: 'Coroner',
        employeeGroup: 'Coroner',
        employeeFilter: [] // No specific filter needed, use all coronerGroupedOptions
    }
];

const BINGO_LINES = [
    [0, 1, 2, 3, 4], [5, 6, 7, 8, 9], [10, 11, 12, 13, 14], [15, 16, 17, 18, 19], [20, 21, 22, 23, 24], // Rows
    [0, 5, 10, 15, 20], [1, 6, 11, 16, 21], [2, 7, 12, 17, 22], [3, 8, 13, 18, 23], [4, 9, 14, 19, 24], // Columns
    [0, 6, 12, 18, 24], [4, 8, 12, 16, 20]  // Diagonals
];

const BINGO_LINE_NAMES = [
    "Row 1", "Row 2", "Row 3", "Row 4", "Row 5",
    "Column 1", "Column 2", "Column 3", "Column 4", "Column 5",
    "Four Corners"
];

// MODIFIED: Add isAdmin, sendBingoWebhook, and sendPhraseRequestWebhook props
const EmsBingoModal = ({ show, onHide, phmcGroupedOptions, coronerGroupedOptions, currentPhmcEmployee, showNotification, setShowMissingEmployeeModal, isAdmin, sendBingoWebhook, sendPhraseRequestWebhook }) => {
    const [phrases, setPhrases] = useState([]);
    const [masterPhraseList, setMasterPhraseList] = useState([]);
    const [isLoadingPhrases, setIsLoadingPhrases] = useState(true);
    const [markedSquaresLocal, setMarkedSquaresLocal] = useState(new Map());
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [bingoActivityLog, setBingoActivityLog] = useState([]);

    const activityLogRef = useRef(null);
    const [showNewMessagesIndicator, setShowNewMessagesIndicator] = useState(false);
    const [lastSeenLogId, setLastSeenLogId] = useState(null);
    const [highlightedMessageId, setHighlightedMessageId] = useState(null);
    const highlightTimerRef = useRef(null);

    const employeeColorMapRef = useRef(new Map());
    const colorIndexRef = useRef(0);

    const [completedBingoLines, setCompletedBingoLines] = useState(new Set());
    const [selectedBingoType, setSelectedBingoType] = useState(null);

    const announcingBingoLinesRef = useRef(new Set());

    const [showPhraseRequestModal, setShowPhraseRequestModal] = useState(false);
    const isEmsBingoActive = selectedBingoType?.id === 'ems';

    const getEmployeeColor = useCallback((employeeName) => {
        if (!employeeColorMapRef.current.has(employeeName)) {
            const color = EMPLOYEE_COLORS[colorIndexRef.current % EMPLOYEE_COLORS.length];
            employeeColorMapRef.current.set(employeeName, color);
            colorIndexRef.current++;
        }
        return employeeColorMapRef.current.get(employeeName);
    }, []);

const checkForBingo = useCallback((currentMarkedSquares, currentPhrases, previouslyCompletedLines) => {
    if (currentPhrases.length === 0) return { newlyCompletedLineIndices: [], allCurrentlyCompleteLineIndices: new Set() };

    const allCurrentlyCompleteLineIndices = new Set();
    const newlyCompletedLineIndices = [];

        BINGO_LINES.forEach((line, lineIndex) => {
            const isLineComplete = line.every(index =>
                currentMarkedSquares.has(index) && currentMarkedSquares.get(index).size > 0
            );
            if (isLineComplete) {
                allCurrentlyCompleteLineIndices.add(lineIndex);
                if (!previouslyCompletedLines.has(lineIndex)) {
                    newlyCompletedLineIndices.push(lineIndex);
                }
            }
        });

    return { newlyCompletedLineIndices, allCurrentlyCompleteLineIndices };
}, []);

    // MODIFIED: Effect to fetch master list of phrases from Firebase based on selected type
    useEffect(() => {
        // This effect now fetches the master list of phrases specific to the selected bingo type.
        // This is crucial for the admin "Generate New Card" feature to pull from the correct pool of phrases.
        if (show && selectedBingoType) {
            // We assume the master phrases for each type are stored under a path corresponding to the bingo type's 'path' property.
            // e.g., 'bingo/phrases/EMS', 'bingo/phrases/Coroner', etc.
            const masterPhrasesRef = ref(database, `bingo/phrases/${selectedBingoType.path}`);
            
            get(masterPhrasesRef).then((snapshot) => {
                if (snapshot.exists()) {
                    const phrasesFromDb = snapshot.val();
                    
                    // The data could be an array or an object with keys. We convert it to a simple array of strings.
                    const phraseArray = Array.isArray(phrasesFromDb)
                        ? phrasesFromDb
                        : (typeof phrasesFromDb === 'object' && phrasesFromDb !== null)
                            ? Object.values(phrasesFromDb).map(p => (typeof p === 'object' ? p.phrase : p)).filter(Boolean)
                            : [];

                    setMasterPhraseList(phraseArray.filter(p => typeof p === 'string' && p.trim() !== ''));
                } else {
                    // If no specific list is found, we clear the master list and log a warning.
                    // This prevents accidentally generating a card from a stale or incorrect master list.
                    console.warn(`No master phrase list found for ${selectedBingoType.name} at 'bingo/phrases/${selectedBingoType.path}'. Admin card generation will be disabled.`);
                    setMasterPhraseList([]);
                }
            }).catch(error => {
                console.error(`Error fetching master bingo phrases for ${selectedBingoType.name}:`, error);
                setMasterPhraseList([]);
            });
        } else if (!selectedBingoType) {
            // When no bingo type is selected (e.g., on initial view or after backing out), clear the list.
            setMasterPhraseList([]);
        }
    }, [show, selectedBingoType]);

    // Listen for the current card layout from Firebase (now type-specific)
useEffect(() => {
    if (!show || !selectedBingoType) return;

    setIsLoadingPhrases(true);
    const currentCardRef = ref(database, `bingo/cards/${selectedBingoType.path}/phrases`);

    get(currentCardRef).then((snapshot) => { // ADDED: get here
        const cardPhrases = snapshot.val();
        if (cardPhrases && Array.isArray(cardPhrases) && cardPhrases.length === 24) {
            setPhrases(cardPhrases);
            setMarkedSquaresLocal(new Map([[12, new Map([['Free Space', '#FFFFFF']])]]));
            setLastSeenLogId(null);
            setShowNewMessagesIndicator(false);
            setCompletedBingoLines(new Set());
            showNotification(`New ${selectedBingoType.name} Bingo card loaded!`, "info-circle");
        } else {
            setPhrases([]);
            showNotification(`No active ${selectedBingoType.name} Bingo card. Admin needs to generate one.`, "warning");
        }
        setIsLoadingPhrases(false);
    }).catch((error) => {
        console.error("Error listening to current bingo card:", error);
        setIsLoadingPhrases(false);
        setPhrases([]);
        showNotification("Error loading Bingo card. Please try again.", "error");
    });

    return () => {
        off(currentCardRef, 'value');
    };
}, [show, selectedBingoType, showNotification]);

    // Effect to set up selected employee when modal is shown or type changes
    useEffect(() => {
        if (show && selectedBingoType) {
            let initialEmployee = null;
            let storedEmployee = null;

            if (selectedBingoType.id === 'er' || selectedBingoType.id === 'ems') {
                storedEmployee = localStorage.getItem('phmcEmployee');
            } else if (selectedBingoType.id === 'coroner') {
                storedEmployee = localStorage.getItem('coronerEmployee');
            }


            if (storedEmployee && phmcGroupedOptions && selectedBingoType.employeeGroup === 'PHMC') {
                const employeeOption = phmcGroupedOptions.flatMap(group => group.options)
                    .find(option => option.value === storedEmployee);
                if (employeeOption) {
                    initialEmployee = employeeOption;
                }
            } else if (storedEmployee && coronerGroupedOptions && selectedBingoType.employeeGroup === 'Coroner') {
                const employeeOption = coronerGroupedOptions.flatMap(group => group.options)
                    .find(option => option.value === storedEmployee);
                if (employeeOption) {
                    initialEmployee = employeeOption;
                }
            }
            setSelectedEmployee(initialEmployee);

        } else if (!show) {
            setSelectedEmployee(null);
            setLastSeenLogId(null);
            announcingBingoLinesRef.current.clear();
            employeeColorMapRef.current.clear();
            colorIndexRef.current = 0;
            setCompletedBingoLines(new Set());
            setSelectedBingoType(null);
        }
    }, [show, selectedBingoType, phmcGroupedOptions, coronerGroupedOptions]);

    // Effect to listen for Firebase activity log updates and sync marked squares
useEffect(() => {
    if (!show || !selectedBingoType || phrases.length === 0 || isLoadingPhrases) {
        return;
    }

    const bingoLogRef = ref(database, `bingo/logs/${selectedBingoType.path}/activityLog`);
    const unsubscribeLog = onValue(bingoLogRef, (snapshot) => {
        const data = snapshot.val();
        const tempMarkedSquares = new Map();
        tempMarkedSquares.set(12, new Map([['Free Space', '#FFFFFF']]));

        let currentLatestMessageId = null;
        let logEntries = [];

        if (data) {
            logEntries = Object.keys(data).map(key => ({ id: key, ...data[key] }))
                                          .sort((a, b) => b.timestamp - a.timestamp);

            setBingoActivityLog(logEntries.slice(0, 20));

            if (logEntries.length > 0) {
                currentLatestMessageId = logEntries[0].id;
            }

            const phraseToIndexMap = new Map(phrases.map((p, i) => [p, i]));
            const activeMarkers = new Map();
            const reversedLogEntries = [...logEntries].reverse();

            reversedLogEntries.forEach(entry => {
                const phraseIndex = phraseToIndexMap.get(entry.phrase);
                if (phraseIndex === undefined) return;

                const gridIndex = phraseIndex < 12 ? phraseIndex : phraseIndex + 1;
                if (gridIndex === 12) return;

                if (!activeMarkers.has(gridIndex)) {
                    activeMarkers.set(gridIndex, new Map());
                }
                const squareMarkers = activeMarkers.get(gridIndex);

                if (entry.type === 'marked') {
                    squareMarkers.set(entry.employee, true);
                } else if (entry.type === 'unmarked') {
                    squareMarkers.delete(entry.employee);
                }
            });

            activeMarkers.forEach((employeesMap, gridIndex) => {
                if (employeesMap.size > 0) {
                    const squareMarkedBy = new Map();
                    employeesMap.forEach((_, employeeName) => {
                        squareMarkedBy.set(employeeName, getEmployeeColor(employeeName));
                    });
                    tempMarkedSquares.set(gridIndex, squareMarkedBy);
                }
            });

        } else {
            setBingoActivityLog([]);
        }

        setMarkedSquaresLocal(tempMarkedSquares);

        //  *MODIFIED SECTION*
setCompletedBingoLines(prevCompletedLines => {
            const { newlyCompletedLineIndices, allCurrentlyCompleteLineIndices } = checkForBingo(tempMarkedSquares, phrases, prevCompletedLines);

            // Convert the sets to arrays for comparison
            const newlyCompletedLineIndicesArray = Array.from(newlyCompletedLineIndices);

            // Filter out bingo messages where line is no longer complete
            const filteredLogEntries = logEntries.filter(entry => {
                if (entry.type === 'bingo') {
                    const lineIndex = entry.lineIndex;
                    return allCurrentlyCompleteLineIndices.has(lineIndex);
                }
                return true;
            });

            setBingoActivityLog(filteredLogEntries.slice(0, 20)); // Set the filtered log entries

            const scorer = selectedEmployee?.value || 'A Player'; // Get the player who made the last move
            newlyCompletedLineIndicesArray.forEach(lineIndex => {
                const bingoMessageAlreadyPosted = logEntries.some(entry =>
                    entry.type === 'bingo' && entry.lineIndex === lineIndex
                );

                const isAlreadyAnnouncing = announcingBingoLinesRef.current.has(lineIndex);

                if (!bingoMessageAlreadyPosted && !isAlreadyAnnouncing) {
                    announcingBingoLinesRef.current.add(lineIndex);

                    const lineName = BINGO_LINE_NAMES[lineIndex] || `Line ${lineIndex + 1}`;

                    // Call the webhook for the bingo score (BINGO event)
                    if (sendBingoWebhook) {
                        sendBingoWebhook({
                            scorer: scorer,
                            bingoType: selectedBingoType.name,
                            lineName: lineName,
                            marked: false, // BINGO event
                            phrase: '', // Not relevant for BINGO event
                            commitInfo: window.commitInfo || {}
                        });
                    }

                    push(bingoLogRef, {
                        employee: "SYSTEM_ADMIN",
                        phrase: `BINGO!!! (${lineName}) - Scorer: ${scorer}`,
                        timestamp: serverTimestamp(),
                        type: 'bingo',
                        lineIndex: lineIndex
                    }).catch(error => {
                        console.error("Error writing bingo message to Firebase:", error);
                    }).finally(() => {
                        announcingBingoLinesRef.current.delete(lineIndex);
                    });
                }
            });

            return allCurrentlyCompleteLineIndices;
        });

        if (currentLatestMessageId && lastSeenLogId && currentLatestMessageId !== lastSeenLogId) {
            setHighlightedMessageId(currentLatestMessageId);

            if (highlightTimerRef.current) {
                clearTimeout(highlightTimerRef.current);
            }
            highlightTimerRef.current = setTimeout(() => {
                setHighlightedMessageId(null);
                highlightTimerRef.current = null;
            }, 3000);

            if (activityLogRef.current) {
                const { scrollHeight, scrollTop, clientHeight } = activityLogRef.current;
                 // MODIFIED: Check if already at the top before showing the indicator
                if (scrollTop > 5) {
                    setShowNewMessagesIndicator(true);
                }
            }
        }
        setLastSeenLogId(currentLatestMessageId);
    });

    return () => {
        off(bingoLogRef, 'value', unsubscribeLog);
        if (highlightTimerRef.current) {
            clearTimeout(highlightTimerRef.current);
            highlightTimerRef.current = null;
        }
    };
}, [show, selectedBingoType, phrases, isLoadingPhrases, getEmployeeColor, checkForBingo, sendBingoWebhook]);
    
    // Scroll listener for the "New Messages" indicator
    useEffect(() => {
        const currentActivityLogRef = activityLogRef.current;
        if (!currentActivityLogRef) return;

        const handleScroll = () => {
            const { scrollHeight, scrollTop, clientHeight } = currentActivityLogRef;
            if (scrollTop + clientHeight >= scrollHeight - 5) {
                setShowNewMessagesIndicator(false);
            }
        };

        currentActivityLogRef.addEventListener('scroll', handleScroll);

        return () => {
            currentActivityLogRef.removeEventListener('scroll', handleScroll);
        };
    }, [show]);

    const scrollToBottom = () => {
        if (activityLogRef.current) {
            activityLogRef.current.scrollTop = 0; // Changed from scrollHeight to 0
            setShowNewMessagesIndicator(false);
        }
    };

    const handleSquareClick = useCallback(async (index, phrase) => {
        if (!selectedEmployee) {
            showNotification('Please select your name from the dropdown before marking a square!', 'warning');
            return;
        }
        if (!selectedBingoType) {
            showNotification('Please select a Bingo type first!', 'warning');
            return;
        }

        const employeeName = selectedEmployee.value;
        const bingoLogRef = ref(database, `bingo/logs/${selectedBingoType.path}/activityLog`);

        const isMarkedByThisEmployee = markedSquaresLocal.has(index) && markedSquaresLocal.get(index).has(employeeName);

        if (isMarkedByThisEmployee) {
            const mostRecentMarkedEntry = bingoActivityLog.find(entry =>
                entry.employee === employeeName && entry.phrase === phrase && entry.type === 'marked'
            );

            if (mostRecentMarkedEntry) {
                try {
                    await remove(ref(database, `bingo/logs/${selectedBingoType.path}/activityLog/${mostRecentMarkedEntry.id}`));
                    await push(bingoLogRef, {
                        employee: employeeName,
                        phrase: phrase,
                        timestamp: serverTimestamp(),
                        type: 'unmarked'
                    });
                } catch (error) {
                    console.error("Error unmarking square in Firebase:", error);
                    showNotification("Failed to unmark square. Please try again.", "error");
                }
            }
        } else {
            setMarkedSquaresLocal(prev => {
                const newMap = new Map(prev);
                if (!newMap.has(index)) {
                    newMap.set(index, new Map());
                }
                newMap.get(index).set(employeeName, getEmployeeColor(employeeName));
                return newMap;
            });

            // Send Discord webhook for marker placement
            if (sendBingoWebhook) {
                sendBingoWebhook({
                    scorer: employeeName,
                    bingoType: selectedBingoType.name,
                    phrase: phrase,
                    marked: true,
                    lineName: '', // Not relevant for marker placement
                    commitInfo: window.commitInfo || {}
                });
            }

            try {
                await push(bingoLogRef, {
                    employee: employeeName,
                    phrase: phrase,
                    timestamp: serverTimestamp(),
                    type: 'marked'
                });
            } catch (error) {
                console.error("Error writing 'marked' log to Firebase:", error);
                setMarkedSquaresLocal(prev => {
                    const newMap = new Map(prev);
                    if (newMap.has(index)) {
                        newMap.get(index).delete(employeeName);
                        if (newMap.get(index).size === 0) {
                            newMap.delete(index);
                        }
                    }
                    return newMap;
                });
            }
        }
    }, [selectedEmployee, markedSquaresLocal, bingoActivityLog, getEmployeeColor, selectedBingoType, showNotification]);

    // NEW: Admin function to generate a new card
    const handleGenerateNewCard = async () => {
        console.log("[Admin] handleGenerateNewCard initiated.");
        if (!isAdmin) {
            console.log("[Admin] User is not admin. Aborting card generation.");
            showNotification("You are not authorized to perform this action.", "error");
            return;
        }
        if (!selectedBingoType) {
            console.log("[Admin] No bingo type selected. Aborting card generation.");
            showNotification("Please select a bingo type to generate a card for.", "warning");
            return;
        }
        if (masterPhraseList.length < 24) {
            console.log(`[Admin] Not enough phrases in master list for ${selectedBingoType.name}. Found: ${masterPhraseList.length}, Needed: 24. Aborting.`);
            showNotification(`Not enough phrases in the master list for ${selectedBingoType.name} to generate a new card (found ${masterPhraseList.length}, need 24).`, "error");
            return;
        }

        if (!window.confirm(`Are you sure you want to generate a new ${selectedBingoType.name} Bingo card? This will clear the current card and all progress.`)) {
            console.log("[Admin] User cancelled card generation.");
            return;
        }

        console.log(`[Admin] Generating new card for ${selectedBingoType.name}.`);
        const shuffled = getShuffledPhrases(masterPhraseList);
        const newCardPhrases = shuffled.slice(0, 24);
        console.log("[Admin] New card phrases selected:", newCardPhrases);

        const cardPhrasesRef = ref(database, `bingo/cards/${selectedBingoType.path}/phrases`);
        const logRef = ref(database, `bingo/logs/${selectedBingoType.path}/activityLog`);

        try {
            console.log("[Admin] Clearing old activity log...");
            await remove(logRef);
            console.log("[Admin] Setting new card phrases...");
            await set(cardPhrasesRef, newCardPhrases);
            
            console.log(`[Admin] New ${selectedBingoType.name} Bingo card generated successfully!`);
            showNotification(`New ${selectedBingoType.name} Bingo card generated successfully!`, 'check-circle');
        } catch (error) {
            console.error("[Admin] Error generating new card:", error);
            showNotification("Failed to generate new card. See console for details.", "error");
        }
    };

    const renderGrid = () => {
        if (isLoadingPhrases) {
            return <div className="bingo-loading"><Spinner animation="border" /> Loading Bingo Card...</div>;
        }
        if (phrases.length === 0) {
            return <div className="bingo-loading">No active bingo card found for this type. An admin needs to generate one.</div>;
        }

        const grid = [];
        let phraseIndex = 0;
        for (let i = 0; i < 25; i++) {
            const isFreeSpace = i === 12;
            const currentPhrase = isFreeSpace ? "FREE SPACE" : phrases[phraseIndex++];
            const markersForSquare = markedSquaresLocal.get(i);
            const isMarked = markersForSquare && markersForSquare.size > 0;

            let hoverTitle = currentPhrase;
            if (isMarked && !isFreeSpace) {
                const employeeNames = Array.from(markersForSquare.keys()).join(', ');
                hoverTitle += `\nMarked by: ${employeeNames}`;
            }

            grid.push(
                <div
                    key={i}
                    className={`bingo-square ${isFreeSpace ? 'free-space' : ''}`}
                    onClick={isFreeSpace ? null : () => handleSquareClick(i, currentPhrase)}
                    style={{ cursor: isFreeSpace ? 'default' : 'pointer' }}
                    title={hoverTitle}
                >
                    {isFreeSpace ? (
                        <>
                            <img src={phmcLogo} alt="Free Space" />
                            <div className="free-space-text">{currentPhrase}</div>
                        </>
                    ) : (
                        <>
                            {currentPhrase}
                            {isMarked && (
                                <div className="bingo-markers-container">
                                    {Array.from(markersForSquare.entries()).map(([employeeName, color]) => (
                                        <div
                                            key={employeeName}
                                            className="bingo-marker"
                                            style={{ backgroundColor: color }}
                                            title={employeeName}
                                        ></div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            );
        }
        return grid;
    };

    const handleEmployeeSelect = (option) => {
        setSelectedEmployee(option);
    };
    const [formData, setFormData] = useState({});

    const filteredEmployeeOptions = useMemo(() => {
        if (!selectedBingoType) return [];

        let employeeValue = null;
        if (selectedBingoType.employeeGroup === 'PHMC') {
            employeeValue = formData.phmcEmployee;
        } else if (selectedBingoType.employeeGroup === 'Coroner') {
            employeeValue = formData.coronerEmployee;
        }

        if (selectedBingoType.employeeGroup === 'PHMC') {
            if (selectedBingoType.employeeFilter.length > 0) {
                return phmcGroupedOptions.filter(group => selectedBingoType.employeeFilter.includes(group.label));
            }
            return phmcGroupedOptions;
        } else if (selectedBingoType.employeeGroup === 'Coroner') {
            return coronerGroupedOptions;
        }
        return [];
    }, [selectedBingoType, phmcGroupedOptions, coronerGroupedOptions, formData.phmcEmployee, formData.coronerEmployee]);

    const handleSelectBingoType = (type) => {
        setSelectedBingoType(type);
    };

    const handleBackToSelection = () => {
        setSelectedBingoType(null);
        setPhrases([]);
        setMarkedSquaresLocal(new Map([[12, new Map([['Free Space', '#FFFFFF']])]]));
        setBingoActivityLog([]);
        setSelectedEmployee(null);
        setCompletedBingoLines(new Set());
        setLastSeenLogId(null);
        setShowNewMessagesIndicator(false);
        announcingBingoLinesRef.current.clear();
        employeeColorMapRef.current.clear();
        colorIndexRef.current = 0;
    };

    const handleOpenMissingEmployeeModal = () => {
        setShowMissingEmployeeModal(true);
        onHide();
    };

    return (
        <Modal show={show} onHide={onHide} size="xl" centered dialogClassName="bingo-modal-dialog">
            <Modal.Header closeVariant="white">
                {selectedBingoType && (
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleBackToSelection}
                        className="bingo-back-button"
                    >
                        <i className="fas fa-arrow-left"></i> Back
                    </Button>
                )}
                <Modal.Title className="bingo-title w-100 text-center">
                    {selectedBingoType ? `${selectedBingoType.name} Bingo!` : "Select Bingo Type"}
                </Modal.Title>
            </Modal.Header>
            <Modal.Body className={isEmsBingoActive ? 'ems-bingo-body-background' : ''}>
                {selectedBingoType ? (
                    <div className="bingo-content-wrapper">
                        <div className="bingo-main-section">
                            <div className="bingo-grid">
                                {renderGrid()}
                            </div>
                        </div>
                        <div className="bingo-sidebar">
                            {selectedEmployee && (
                                <h5 className="welcome-message">Welcome {selectedEmployee.value}!</h5>
                            )}
                            {!selectedEmployee && (
                                <Form.Group className="mb-3">
                                    <Form.Label>Select Your Name to Play:</Form.Label>
                                    <Select
                                        name="phmcEmployeeBingo"
                                        value={selectedEmployee}
                                        onChange={handleEmployeeSelect}
                                        options={filteredEmployeeOptions}
                                        isClearable
                                        placeholder="Select your name..."
                                        className="react-select-container"
                                        classNamePrefix="react-select"
                                        styles={{
                                            control: (base) => ({ ...base, backgroundColor: '#16202c', color: '#eeeeeeb0', borderColor: '#30363d', '&:hover': { borderColor: '#30363d' } }),
                                            menu: (base) => ({ ...base, backgroundColor: '#16202c', zIndex: 1000 }),
                                            option: (base, state) => ({ ...base, backgroundColor: state.isFocused ? 'Grey' : '#16202c', color: '#eeeeeeb0' }),
                                            singleValue: (base) => ({ ...base, color: '#eeeeeeb0' }),
                                            input: (base) => ({ ...base, color: '#eeeeeeb0' }),
                                            placeholder: (base) => ({ ...base, color: '#eeeeeeb0' })
                                        }}
                                    />
                                    <small className="form-text text-muted mt-1">
                                        <span
                                            onClick={handleOpenMissingEmployeeModal}
                                            style={{ cursor: 'pointer', textDecoration: 'underline' }}
                                        >
                                            Missing Name?
                                        </span>
                                    </small>
                                </Form.Group>
                            )}
                            <h5>Recent Activity</h5>
                            <div className="activity-log" ref={activityLogRef}>
                                {bingoActivityLog.length > 0 ? (
                                    bingoActivityLog.map(entry => (
                                        <div
                                            key={entry.id}
                                            className={`activity-item ${entry.id === highlightedMessageId ? 'highlight-new' : ''} ${entry.type === 'bingo' ? 'bingo-message' : ''}`}
                                        >
                                            {entry.type === 'bingo' ? (
                                                <span className="bingo-text">
                                                    {entry.employee} - {entry.phrase}
                                                </span>
                                            ) : (
                                                <>
                                                    <strong>{entry.employee}</strong>{' '}
                                                    {entry.type === 'unmarked' ? (
                                                        <span className="unmarked-text">unmarked</span>
                                                    ) : (
                                                        <span>marked</span>
                                                    )}{' '}
                                                    "{entry.phrase}"
                                                </>
                                            )}
                                            <span className="timestamp">
                                                {entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : '...'}
                                            </span>
                                        </div>
                                    ))
                                ) : (
                                    <p>No activity yet. Be the first to mark a square!</p>
                                )}
                            </div>
                            {showNewMessagesIndicator && (
                                <button className="new-messages-indicator show" onClick={scrollToBottom}>
                                    New Messages
                                </button>
                            )}
                            {/* Removed Admin Controls Section from sidebar */}
                        </div>
                    </div>
                ) : (
                    <div className="bingo-type-selection">
                        <p>Please select a Bingo type to start:</p>
                        <div className="bingo-type-buttons">
                            {BINGO_TYPES.map(type => (
                                <Button
                                    key={type.id}
                                    variant="primary"
                                    onClick={() => handleSelectBingoType(type)}
                                    className="bingo-type-button"
                                >
                                    {type.name} Bingo
                                </Button>
                            ))}
                        </div>
                    </div>
                )}
            </Modal.Body>
            <Modal.Footer>
                <Button variant="info" onClick={() => setShowPhraseRequestModal(true)} className="me-auto">
                    Request a Phrase
                </Button>
                {/* Re-instated isAdmin check for security */}
                {isAdmin && selectedBingoType && (
                    <Button
                        variant="danger"
                        onClick={handleGenerateNewCard}
                        disabled={masterPhraseList.length < 24}
                        className="ms-2"
                        title={
                            masterPhraseList.length < 24
                                ? `Need ${24 - masterPhraseList.length} more phrases in master list for ${selectedBingoType?.name || 'this Bingo type'}.`
                                : `Generate a new ${selectedBingoType?.name || 'Bingo'} Card.`
                        }
                    >
                        Generate New {selectedBingoType?.name || 'Bingo'} Card
                    </Button>
                )}
                <Button variant="secondary" onClick={onHide} className="ms-2">
                    Close
                </Button>
            </Modal.Footer>

            <PhraseRequestModal
                show={showPhraseRequestModal}
                onHide={() => setShowPhraseRequestModal(false)}
                showNotification={showNotification}
                selectedEmployee={selectedEmployee}
                selectedBingoType={selectedBingoType}
                sendPhraseRequestWebhook={sendPhraseRequestWebhook}
            />
        </Modal>
    );
};

export default EmsBingoModal;
