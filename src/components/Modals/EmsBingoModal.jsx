import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Button, Spinner } from 'react-bootstrap';
import useGtaWorldAuth from '../../hooks/useGtaWorldAuth';
import './EmsBingoModal.css';
import phmcLogo from '../../assets/phmc.png';
import { database } from '../../firebase';
import { ref, onValue, off, serverTimestamp, get, push } from 'firebase/database';
import PhraseRequestModal from './PhraseRequestModal';
import EmployeeCredentialsSection from './EmployeeCredentialsSection';
import BaseModal from './BaseModal';
import { useUserMetrics } from '../../hooks/useUserMetrics';

const EMPLOYEE_COLORS = [
    '#3fb950', '#58a6ff', '#e3b341', '#f85149', '#8957e5', '#00b4ab', '#ff7b72', '#d2a8ff', '#79c0ff', '#a3d8b0', '#f0883e', '#6a737d'
];

const BINGO_TYPES = [
    { id: 'er', name: 'Emergency Room', path: 'ER', employeeGroup: 'PHMC', employeeFilter: [] },
    { id: 'ems', name: 'EMS', path: 'EMS', employeeGroup: 'PHMC', employeeFilter: ['Emergency Medical Services'] },
    { id: 'coroner', name: 'Coroner', path: 'Coroner', employeeGroup: 'Coroner', employeeFilter: [] }
];

const EmsBingoModal = ({ show, onHide, allEmployeeGroupedOptions, showNotification, isAdmin, sendPhraseRequestWebhook }) => {
    const { trackMetric } = useUserMetrics();
    const { characterName, isAuthenticated: isGtaAuthenticated, triggerFactionSync } = useGtaWorldAuth();
    const [phrases, setPhrases] = useState([]);
    const [isLoadingPhrases, setIsLoadingPhrases] = useState(true);
    const [markedSquaresLocal, setMarkedSquaresLocal] = useState(new Map());
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [bingoActivityLog, setBingoActivityLog] = useState([]);
    const [selectedBingoType, setSelectedBingoType] = useState(null);
    const [showPhraseRequestModal, setShowPhraseRequestModal] = useState(false);

    const activityLogRef = useRef(null);
    const employeeColorMapRef = useRef(new Map());
    const colorIndexRef = useRef(0);

    const getEmployeeColor = useCallback((name) => {
        if (!employeeColorMapRef.current.has(name)) {
            employeeColorMapRef.current.set(name, EMPLOYEE_COLORS[colorIndexRef.current % EMPLOYEE_COLORS.length]);
            colorIndexRef.current++;
        }
        return employeeColorMapRef.current.get(name);
    }, []);

    useEffect(() => {
        if (show && selectedBingoType) {
            const currentCardRef = ref(database, `bingo/cards/${selectedBingoType.path}/phrases`);
            setIsLoadingPhrases(true);
            get(currentCardRef).then(snap => {
                const cardPhrases = snap.val();
                if (cardPhrases?.length === 24) {
                    setPhrases(cardPhrases);
                } else {
                    setPhrases([]);
                }
                setIsLoadingPhrases(false);
            });
            trackMetric('bingo', `view_${selectedBingoType.id}`);
        } else {
            setPhrases([]);
            setMarkedSquaresLocal(new Map());
        }
    }, [show, selectedBingoType, trackMetric]);

    // Activity Log & Marker Sync
    useEffect(() => {
        if (show && selectedBingoType && phrases.length > 0) {
            const logRef = ref(database, `bingo/logs/${selectedBingoType.path}/activityLog`);
            const handleLogChange = (snapshot) => {
                const data = snapshot.val();
                if (data) {
                    const logs = Object.entries(data).map(([id, log]) => ({ id, ...log }));
                    logs.sort((a, b) => {
                        const timeA = typeof a.timestamp === 'number' ? a.timestamp : 0;
                        const timeB = typeof b.timestamp === 'number' ? b.timestamp : 0;
                        return timeB - timeA;
                    });
                    setBingoActivityLog(logs);

                    const newMarks = new Map();

                    const sortedLogs = [...logs].sort((a, b) => {
                        const timeA = typeof a.timestamp === 'number' ? a.timestamp : 0;
                        const timeB = typeof b.timestamp === 'number' ? b.timestamp : 0;
                        return timeA - timeB;
                    });
                    
                    sortedLogs.forEach(log => {
                        let idx = -1;
                        if (log.phrase === 'FREE') idx = 12;
                        else {
                            const pIdx = phrases.indexOf(log.phrase);
                            if (pIdx !== -1) idx = pIdx < 12 ? pIdx : pIdx + 1;
                        }

                        if (idx !== -1) {
                            if (!newMarks.has(idx)) newMarks.set(idx, new Map());
                            if (log.type === 'unmarked') {
                                newMarks.get(idx).delete(log.employee);
                            } else {
                                newMarks.get(idx).set(log.employee, getEmployeeColor(log.employee));
                            }
                        }
                    });
                    setMarkedSquaresLocal(newMarks);
                }
            };
            onValue(logRef, handleLogChange);
            return () => off(logRef, 'value', handleLogChange);
        }
    }, [show, selectedBingoType, phrases, getEmployeeColor]);

    useEffect(() => {
        if (activityLogRef.current) {
            activityLogRef.current.scrollTop = 0;
        }
    }, [bingoActivityLog]);

    const handleSquareClick = async (index, phrase) => {
        const employeeName = selectedEmployee?.value || (isGtaAuthenticated ? characterName : null);
        
        if (!employeeName || !selectedBingoType) {
            return showNotification("Please select your name first!", "warning");
        }
        
        const logRef = ref(database, `bingo/logs/${selectedBingoType.path}/activityLog`);
        
        const squareMarks = markedSquaresLocal.get(index);
        const isAlreadyMarkedByMe = squareMarks?.has(employeeName);
        
        const actionType = isAlreadyMarkedByMe ? 'unmarked' : 'marked';
        await push(logRef, { 
            employee: employeeName, 
            phrase, 
            timestamp: serverTimestamp(), 
            type: actionType
        });

        trackMetric('bingo', `${actionType}_square_${selectedBingoType.id}`);
    };

    return (
        <BaseModal
            isOpen={show}
            onClose={onHide}
            title={selectedBingoType ? `${selectedBingoType.name} Bingo` : "Select Bingo Type"}
            modalSize="xl"
            variant="info"
            className="bingo-modal-dialog"
            noPadding={true}
            footer={
                <>
                    {selectedBingoType && (
                        <Button variant="outline-secondary" className="bingo-back-button" onClick={() => setSelectedBingoType(null)} style={{ position: 'relative', transform: 'none', top: 'auto', left: 'auto', marginRight: 'auto' }}>Back to Selection</Button>
                    )}
                    <Button variant="info" onClick={() => setShowPhraseRequestModal(true)}>Request Phrase</Button>
                    {isAdmin && selectedBingoType && <Button variant="danger" style={{ marginLeft: '10px' }}>Generate New Card</Button>}
                    <Button variant="secondary" onClick={onHide} style={{ marginLeft: '10px' }}>Close</Button>
                </>
            }
        >
            <div className="bingo-content-wrapper">
                <div className="bingo-main-section">
                    {!selectedBingoType ? (
                        <div className="bingo-type-selection">
                            <p>Select a Bingo category to start playing!</p>
                            <div className="bingo-type-buttons">
                                {BINGO_TYPES.map(type => (
                                    <Button key={type.id} className="bingo-type-button" onClick={() => setSelectedBingoType(type)}>
                                        {type.name}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="bingo-grid">
                            {isLoadingPhrases ? (
                                <div className="bingo-loading"><Spinner animation="border" /><span>Syncing Board...</span></div>
                            ) : (
                                Array.from({ length: 25 }).map((_, i) => {
                                    const isFree = i === 12;
                                    const phrase = isFree ? "FREE" : phrases[i < 12 ? i : i - 1];
                                    const markersForSquare = markedSquaresLocal.get(i) || new Map();

                                    return (
                                        <div 
                                            key={i} 
                                            onClick={() => !isFree && handleSquareClick(i, phrase)} 
                                            className={`bingo-square ${isFree ? 'free-space' : ''}`}
                                        >
                                            {isFree ? (
                                                <>
                                                    <img src={phmcLogo} alt="PHMC Logo" />
                                                    <span className="free-space-text">FREE</span>
                                                </>
                                            ) : phrase}

                                            {markersForSquare.size > 0 && (
                                                <div className="bingo-markers-container">
                                                    {Array.from(markersForSquare.entries()).map(([name, color]) => (
                                                        <div 
                                                            key={name} 
                                                            className="bingo-marker" 
                                                            style={{ backgroundColor: color }} 
                                                            title={name}
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}
                </div>
                
                <div className="bingo-sidebar">
                    <EmployeeCredentialsSection 
                        selectedEmployee={selectedEmployee}
                        setSelectedEmployee={setSelectedEmployee}
                        groupedOptions={allEmployeeGroupedOptions}
                        employeeType="player"
                        triggerFactionSync={triggerFactionSync}
                    />
                    
                    {selectedBingoType && (
                        <>
                            <hr style={{ borderColor: '#30363d', margin: '15px 0' }} />
                            <h5>Activity Log</h5>
                            <div className="activity-log" ref={activityLogRef}>
                                {bingoActivityLog.map(log => (
                                    <div key={log.id} className="activity-item">
                                        <strong>{log.employee}</strong> {log.type === 'unmarked' ? 'removed mark from' : 'marked'}
                                        <div style={{ color: '#e2e8f0', marginTop: '4px', fontWeight: 'bold' }}>{log.phrase}</div>
                                        <span className="timestamp">{log.timestamp && typeof log.timestamp === 'number' ? new Date(log.timestamp).toLocaleTimeString() : 'Just now...'}</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
            <PhraseRequestModal 
                show={showPhraseRequestModal} 
                onHide={() => setShowPhraseRequestModal(false)} 
                showNotification={showNotification}
                selectedEmployee={selectedEmployee}
                selectedBingoType={selectedBingoType}
                sendPhraseRequestWebhook={sendPhraseRequestWebhook}
            />
        </BaseModal>
    );
};

export default EmsBingoModal;
