import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Modal, Button, Form, Spinner } from 'react-bootstrap';
import Select from 'react-select';
import './EmsBingoModal.css';
import phmcLogo from '../assets/phmc.png';
import { database } from '../firebase';
import { ref, push, onValue, off, serverTimestamp, get, remove } from 'firebase/database';

// Function to shuffle an array (still used by admin to generate new card)
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

// --- MODIFIED: New winning line definitions ---
const BINGO_LINES = [
    // Horizontal Rows
    [0, 1, 2, 3, 4], [5, 6, 7, 8, 9], [10, 11, 12, 13, 14], [15, 16, 17, 18, 19], [20, 21, 22, 23, 24],
    // Vertical Columns
    [0, 5, 10, 15, 20], [1, 6, 11, 16, 21], [2, 7, 12, 17, 22], [3, 8, 13, 18, 23], [4, 9, 14, 19, 24],
    // Four Corners
    [0, 4, 20, 24]
];

const BINGO_LINE_NAMES = [
    "Row 1", "Row 2", "Row 3", "Row 4", "Row 5",
    "Column 1", "Column 2", "Column 3", "Column 4", "Column 5",
    "Four Corners"
];
// --- END MODIFICATION ---

const EmsBingoModal = ({ show, onHide, phmcGroupedOptions, currentPhmcEmployee, showNotification }) => {
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

    const getEmployeeColor = useCallback((employeeName) => {
        if (!employeeColorMapRef.current.has(employeeName)) {
            const color = EMPLOYEE_COLORS[colorIndexRef.current % EMPLOYEE_COLORS.length];
            employeeColorMapRef.current.set(employeeName, color);
            colorIndexRef.current++;
        }
        return employeeColorMapRef.current.get(employeeName);
    }, []);

    // MODIFIED: This function now uses the new BINGO_LINES constant
    const checkForBingo = useCallback((currentMarkedSquares, currentPhrases, previouslyCompletedLines) => {
        if (currentPhrases.length === 0) return { newlyCompletedLineIndices: [], allCompletedLines: new Set(previouslyCompletedLines) };

        const newlyCompletedLineIndices = [];
        const currentCompletedLines = new Set(previouslyCompletedLines);

        BINGO_LINES.forEach((line, lineIndex) => {
            if (!currentCompletedLines.has(lineIndex)) {
                const isLineComplete = line.every(index =>
                    currentMarkedSquares.has(index) && currentMarkedSquares.get(index).size > 0
                );
                if (isLineComplete) {
                    newlyCompletedLineIndices.push(lineIndex);
                    currentCompletedLines.add(lineIndex);
                }
            }
        });

        return { newlyCompletedLineIndices, allCompletedLines: currentCompletedLines };
    }, []);

    // Effect to fetch master list of phrases from Firebase
    useEffect(() => {
        if (show && masterPhraseList.length === 0) {
            const phrasesRef = ref(database, 'bingo/phrases');
            get(phrasesRef).then((snapshot) => {
                if (snapshot.exists()) {
                    const phrasesFromDb = snapshot.val();
                    if (Array.isArray(phrasesFromDb)) {
                        setMasterPhraseList(phrasesFromDb.filter(p => p));
                    }
                }
            }).catch(error => {
                console.error("Error fetching master bingo phrases:", error);
            });
        }
    }, [show, masterPhraseList.length]);

    // Listen for the current card layout from Firebase
    useEffect(() => {
        if (!show) return;

        setIsLoadingPhrases(true);
        const currentCardRef = ref(database, 'bingo/currentCard');
        const unsubscribeCard = onValue(currentCardRef, (snapshot) => {
            const cardPhrases = snapshot.val();
            if (cardPhrases && Array.isArray(cardPhrases) && cardPhrases.length === 24) {
                setPhrases(cardPhrases);
                setMarkedSquaresLocal(new Map([[12, new Map([['Free Space', '#FFFFFF']])]]));
                setLastSeenLogId(null);
                setShowNewMessagesIndicator(false);
                setCompletedBingoLines(new Set());
                showNotification("New Bingo card loaded!", "info-circle");
            } else {
                setPhrases([]);
                showNotification("No active Bingo card. Admin needs to generate one.", "warning");
            }
            setIsLoadingPhrases(false);
        }, (error) => {
            console.error("Error listening to current bingo card:", error);
            setIsLoadingPhrases(false);
            setPhrases([]);
            showNotification("Error loading Bingo card. Please try again.", "error");
        });

        return () => {
            off(currentCardRef, 'value', unsubscribeCard);
        };
    }, [show, showNotification]);

    // Effect to set up selected employee when modal is shown
    useEffect(() => {
        if (show) {
            if (currentPhmcEmployee && phmcGroupedOptions) {
                const employeeOption = phmcGroupedOptions.flatMap(group => group.options)
                                                        .find(option => option.value === currentPhmcEmployee);
                if (employeeOption) {
                    setSelectedEmployee(employeeOption);
                }
            }
        } else {
            setSelectedEmployee(null);
            setLastSeenLogId(null);
            employeeColorMapRef.current.clear();
            colorIndexRef.current = 0;
            setCompletedBingoLines(new Set());
        }
    }, [show, currentPhmcEmployee, phmcGroupedOptions]);

    // Effect to listen for Firebase activity log updates and sync marked squares
    useEffect(() => {
        if (!show || phrases.length === 0 || isLoadingPhrases) {
            return;
        }

        const bingoLogRef = ref(database, 'bingo/activityLog');
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

            setCompletedBingoLines(prevCompletedLines => {
                const { newlyCompletedLineIndices, allCompletedLines } = checkForBingo(tempMarkedSquares, phrases, prevCompletedLines);

                if (newlyCompletedLineIndices.length > 0) {
                    newlyCompletedLineIndices.forEach(lineIndex => {
                        const bingoMessageAlreadyPosted = logEntries.some(entry =>
                            entry.type === 'bingo' && entry.lineIndex === lineIndex
                        );

                        if (!bingoMessageAlreadyPosted) {
                            // MODIFIED: Use BINGO_LINE_NAMES for a descriptive message
                            const lineName = BINGO_LINE_NAMES[lineIndex] || `Line ${lineIndex + 1}`;
                            push(bingoLogRef, {
                                employee: "SYSTEM_ADMIN",
                                phrase: `BINGO!!! (${lineName})`,
                                timestamp: serverTimestamp(),
                                type: 'bingo',
                                lineIndex: lineIndex
                            }).catch(error => {
                                console.error("Error writing bingo message to Firebase:", error);
                            });
                        }
                    });
                }
                return allCompletedLines;
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
                    if (scrollHeight - scrollTop > clientHeight + 5) {
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
    }, [show, phrases, isLoadingPhrases, getEmployeeColor, checkForBingo]);

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
            activityLogRef.current.scrollTop = activityLogRef.current.scrollHeight;
            setShowNewMessagesIndicator(false);
        }
    };

    const handleSquareClick = useCallback(async (index, phrase) => {
        if (!selectedEmployee) {
            alert('Please select your name from the dropdown before marking a square!');
            return;
        }

        const employeeName = selectedEmployee.value;
        const bingoLogRef = ref(database, 'bingo/activityLog');

        const isMarkedByThisEmployee = markedSquaresLocal.has(index) && markedSquaresLocal.get(index).has(employeeName);

        if (isMarkedByThisEmployee) {
            const mostRecentMarkedEntry = bingoActivityLog.find(entry =>
                entry.employee === employeeName && entry.phrase === phrase && entry.type === 'marked'
            );

            if (mostRecentMarkedEntry) {
                try {
                    await remove(ref(database, `bingo/activityLog/${mostRecentMarkedEntry.id}`));
                    await push(bingoLogRef, {
                        employee: employeeName,
                        phrase: phrase,
                        timestamp: serverTimestamp(),
                        type: 'unmarked'
                    });
                } catch (error) {
                    console.error("Error unmarking square in Firebase:", error);
                    alert("Failed to unmark square. Please try again.");
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
    }, [selectedEmployee, markedSquaresLocal, bingoActivityLog, getEmployeeColor]);

    const renderGrid = () => {
        if (isLoadingPhrases) {
            return <div className="bingo-loading"><Spinner animation="border" /> Loading Bingo Card...</div>;
        }
        if (phrases.length === 0) {
            return <div className="bingo-loading">Error: No active Bingo card. Admin needs to generate one.</div>;
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

    return (
        <Modal show={show} onHide={onHide} size="xl" centered dialogClassName="bingo-modal-dialog">
            <Modal.Header closeVariant="white">
                <Modal.Title className="bingo-title w-100 text-center">EMS Bingo!</Modal.Title>
            </Modal.Header>
            <Modal.Body>
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
                                    options={phmcGroupedOptions}
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
                    </div>
                </div>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={onHide}>
                    Close
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default EmsBingoModal;
