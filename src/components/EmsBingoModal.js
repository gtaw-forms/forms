import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Button, Form, Spinner } from 'react-bootstrap';
import Select from 'react-select';
import './EmsBingoModal.css';
import phmcLogo from '../assets/phmc.png';
import { database } from '../firebase';
import { ref, push, onValue, off, serverTimestamp, get, remove } from 'firebase/database'; // Added 'remove'

// Function to shuffle an array
const getShuffledPhrases = (phrases) => {
    if (!phrases || phrases.length === 0) return [];
    return [...phrases].sort(() => 0.5 - Math.random());
};

const EmsBingoModal = ({ show, onHide, phmcGroupedOptions, currentPhmcEmployee }) => {
    const [phrases, setPhrases] = useState([]); // For the current shuffled card
    const [masterPhraseList, setMasterPhraseList] = useState([]); // For phrases from Firebase
    const [isLoadingPhrases, setIsLoadingPhrases] = useState(true);
    const [markedSquaresLocal, setMarkedSquaresLocal] = useState(new Set());
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [bingoActivityLog, setBingoActivityLog] = useState([]);

    // Effect to fetch master list of phrases from Firebase
    useEffect(() => {
        if (show && masterPhraseList.length === 0) {
            setIsLoadingPhrases(true);
            const phrasesRef = ref(database, 'bingo/phrases');
            get(phrasesRef).then((snapshot) => {
                if (snapshot.exists()) {
                    const phrasesFromDb = snapshot.val();
                    if (Array.isArray(phrasesFromDb)) {
                        setMasterPhraseList(phrasesFromDb.filter(p => p));
                    }
                } else {
                    console.warn("Bingo phrases not found in Firebase at 'bingo/phrases'.");
                }
            }).catch(error => {
                console.error("Error fetching bingo phrases:", error);
            }).finally(() => {
                setIsLoadingPhrases(false);
            });
        }
    }, [show, masterPhraseList.length]);

    // Effect to set up the card when the modal is shown or master list updates
    useEffect(() => {
        if (show) {
            if (masterPhraseList.length > 0) {
                setPhrases(getShuffledPhrases(masterPhraseList));
            }
            // Always mark the free space (index 12) initially.
            setMarkedSquaresLocal(new Set([12]));

            if (currentPhmcEmployee && phmcGroupedOptions) {
                const employeeOption = phmcGroupedOptions.flatMap(group => group.options)
                                                        .find(option => option.value === currentPhmcEmployee);
                if (employeeOption) {
                    setSelectedEmployee(employeeOption);
                }
            }
        } else {
            setSelectedEmployee(null);
        }
    }, [show, masterPhraseList, currentPhmcEmployee, phmcGroupedOptions]);

    // Effect to listen for Firebase activity log updates AND sync marked squares
    useEffect(() => {
        if (!show || phrases.length === 0) {
            return;
        }

        const bingoLogRef = ref(database, 'bingo/activityLog');
        const unsubscribe = onValue(bingoLogRef, (snapshot) => {
            const data = snapshot.val();
            const newMarkedSquares = new Set([12]); // Always start with the free space marked

            if (data) {
                const logEntries = Object.keys(data).map(key => ({ id: key, ...data[key] }))
                                                    .sort((a, b) => b.timestamp - a.timestamp);
                
                setBingoActivityLog(logEntries.slice(0, 20));

                const phraseToIndexMap = new Map(phrases.map((p, i) => [p, i]));

                logEntries.forEach(entry => {
                    if (phraseToIndexMap.has(entry.phrase)) {
                        const phraseIndex = phraseToIndexMap.get(entry.phrase);
                        const gridIndex = phraseIndex < 12 ? phraseIndex : phraseIndex + 1;
                        newMarkedSquares.add(gridIndex);
                    }
                });
                
            } else {
                setBingoActivityLog([]);
            }

            setMarkedSquaresLocal(newMarkedSquares);
        });

        return () => {
            off(bingoLogRef, 'value', unsubscribe);
        };
    }, [show, phrases]);

    // MODIFIED: handleSquareClick to allow unmarking
    const handleSquareClick = useCallback((index, phrase) => {
        if (!selectedEmployee) {
            alert('Please select your name from the dropdown before marking a square!');
            return;
        }

        if (markedSquaresLocal.has(index)) {
            // Attempt to unmark: Find the specific log entry by phrase and employee
            const entryToUnmark = bingoActivityLog.find(entry =>
                entry.employee === selectedEmployee.value && entry.phrase === phrase
            );

            if (entryToUnmark) {
                // Remove the entry from Firebase
                const entryRef = ref(database, `bingo/activityLog/${entryToUnmark.id}`);
                remove(entryRef)
                    .then(() => {
                        console.log("Square unmarked in Firebase:", entryToUnmark);
                        // The `onValue` listener will automatically update `markedSquaresLocal`
                    })
                    .catch(error => {
                        console.error("Error unmarking square in Firebase:", error);
                        alert("Failed to unmark square. Please try again.");
                    });
            } else {
                // This case can happen if the square is marked locally but the corresponding
                // log entry is not found (e.g., marked by another user, or log was cleared).
                // For now, we'll just log a warning and remove it locally for consistency.
                console.warn("Attempted to unmark a square, but no matching log entry found for current user/phrase. Removing locally.");
                setMarkedSquaresLocal(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(index);
                    return newSet;
                });
            }
        } else {
            // Mark: Optimistic update for immediate visual feedback
            setMarkedSquaresLocal(prev => new Set(prev).add(index));

            // Push the new marking event to Firebase
            const bingoLogRef = ref(database, 'bingo/activityLog');
            push(bingoLogRef, {
                employee: selectedEmployee.value,
                phrase: phrase,
                timestamp: serverTimestamp()
            }).catch(error => {
                console.error("Error writing bingo log to Firebase:", error);
                alert("Failed to log bingo square. Please check your internet connection or Firebase rules.");
                // Revert optimistic update on failure
                setMarkedSquaresLocal(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(index);
                    return newSet;
                });
            });
        }
    }, [selectedEmployee, markedSquaresLocal, bingoActivityLog]); // Added bingoActivityLog to dependencies

    // Renders the 5x5 bingo grid
    const renderGrid = () => {
        if (isLoadingPhrases) {
            return <div className="bingo-loading"><Spinner animation="border" /> Loading Bingo Card...</div>;
        }
        if (phrases.length === 0) {
            return <div className="bingo-loading">Error: Could not load bingo phrases. Check Firebase configuration.</div>;
        }

        const grid = [];
        let phraseIndex = 0;
        for (let i = 0; i < 25; i++) {
            const isFreeSpace = i === 12;
            // Pass the exact phrase from the `phrases` array to `handleSquareClick`
            const currentPhrase = isFreeSpace ? "FREE SPACE" : phrases[phraseIndex++];
            const isMarked = markedSquaresLocal.has(i);

            grid.push(
                <div
                    key={i}
                    className={`bingo-square ${isFreeSpace ? 'free-space' : ''} ${isMarked ? 'marked' : ''}`}
                    onClick={isFreeSpace ? null : () => handleSquareClick(i, currentPhrase)} // Pass currentPhrase
                    style={{ cursor: isFreeSpace ? 'default' : 'pointer' }}
                >
                    {isFreeSpace ? (
                        <>
                            <img src={phmcLogo} alt="Free Space" />
                            <span>{currentPhrase}</span>
                        </>
                    ) : (
                        currentPhrase
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
            <Modal.Header closeButton>
                <Modal.Title className="bingo-title w-100 text-center">TITLE_STRING_HERE</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <div className="bingo-content-wrapper">
                    <div className="bingo-main-section">
                        <div className="bingo-grid">
                            {renderGrid()}
                        </div>
                    </div>
                    <div className="bingo-sidebar">
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
                        <div className="activity-log">
                            {bingoActivityLog.length > 0 ? (
                                bingoActivityLog.map(entry => (
                                    <div key={entry.id} className="activity-item">
                                        <strong>{entry.employee}</strong> marked "{entry.phrase}"
                                        <span className="timestamp">
                                            {entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : '...'}
                                        </span>
                                    </div>
                                ))
                            ) : (
                                <p>No activity yet. Be the first to mark a square!</p>
                            )}
                        </div>
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
