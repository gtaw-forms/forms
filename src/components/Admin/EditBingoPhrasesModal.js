// c:\Users\cross\Documents\GitHub\phmc-forms\src\components\Admin\EditBingoPhrasesModal.js
import React, { useState, useEffect, useCallback, useRef } from 'react'; // Added useRef
import { Modal, Button, Form, Spinner } from 'react-bootstrap';
import { database } from '../../firebase';
import { ref, get, set } from 'firebase/database';
import * as Sentry from "@sentry/react";

const EditBingoPhrasesModal = ({ show, onHide, showNotification, commitInfo, sendAdminActionWebhook, adminUserEmail }) => {
    // NEW: Log component rendering and show prop
    console.log('[EditBingoPhrasesModal] Component Rendered. show prop:', show);

    const [phrasesText, setPhrasesText] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    // NEW: Ref to track if fetch has been initiated for the current 'show' cycle
    const fetchInitiatedRef = useRef(false);

    const masterPhrasesRef = ref(database, 'bingo/phrases');

    const fetchPhrases = useCallback(async () => {
        console.log('[EditBingoPhrasesModal] fetchPhrases: Starting fetch...'); // LOG 1
        setIsLoading(true); // Ensure loading state is true at start of fetch
        setError('');
        try {
            const snapshot = await get(masterPhrasesRef);
            console.log('[EditBingoPhrasesModal] fetchPhrases: Firebase get() call resolved.'); // LOG 2

            if (snapshot.exists()) {
                const phrasesFromDb = snapshot.val();
                console.log('[EditBingoPhrasesModal] fetchPhrases: Data exists.', phrasesFromDb); // LOG 3

                if (Array.isArray(phrasesFromDb)) {
                    setPhrasesText(phrasesFromDb.filter(p => p).join('\n'));
                    console.log('[EditBingoPhrasesModal] fetchPhrases: Phrases set from array.'); // LOG 4
                } else {
                    setPhrasesText('');
                    showNotification("Master phrases are not in expected array format.", "warning");
                    console.warn('[EditBingoPhrasesModal] fetchPhrases: Phrases data is not an array.'); // LOG 5
                }
            } else {
                setPhrasesText('');
                showNotification("No master bingo phrases found in Firebase.", "info-circle");
                console.log('[EditBingoPhrasesModal] fetchPhrases: No data found at path.'); // LOG 6
            }
        } catch (err) {
            console.error("[EditBingoPhrasesModal] fetchPhrases: Error during fetch:", err); // LOG 7
            setError("Failed to load phrases: " + err.message);
            showNotification("Failed to load phrases.", "error");
            Sentry.captureException(err, { extra: { context: 'EditBingoPhrasesModal Fetch' } });
        } finally {
            setIsLoading(false); // Always set to false when fetch attempt finishes
            console.log('[EditBingoPhrasesModal] fetchPhrases: Finished fetch. isLoading set to false.'); // LOG 8
        }
    }, [masterPhrasesRef, showNotification]); // fetchPhrases is stable due to useCallback

    // NEW: Main useEffect for modal visibility and data fetching
    useEffect(() => {
        if (show) {
            // Only fetch if the modal is shown AND we haven't initiated a fetch yet for this 'show' cycle
            if (!fetchInitiatedRef.current) {
                console.log('[EditBingoPhrasesModal] useEffect: Modal is shown, triggering fetchPhrases.'); // LOG 9
                fetchInitiatedRef.current = true; // Mark as initiated for this cycle
                fetchPhrases();
            } else {
                console.log('[EditBingoPhrasesModal] useEffect: Modal is shown, but fetch already initiated for this cycle.');
            }
        } else {
            // When modal is hidden, reset fetchInitiatedRef and loading state for next time it opens
            console.log('[EditBingoPhrasesModal] useEffect: Modal is hidden. Resetting state for next open.');
            fetchInitiatedRef.current = false;
            setIsLoading(true); // Reset to true so it shows spinner next time
            setPhrasesText(''); // Clear text
            setError(''); // Clear error
            setIsSaving(false); // Reset saving state
        }
    }, [show, fetchPhrases]); // fetchPhrases is a dependency, but it's stable due to useCallback

    // NEW: Effect to log isLoading state changes
    useEffect(() => {
        console.log('[EditBingoPhrasesModal] isLoading state changed to:', isLoading);
    }, [isLoading]);

    // NEW: Effect to log component mount/unmount
    useEffect(() => {
        console.log('[EditBingoPhrasesModal] Component mounted.');
        return () => {
            console.log('[EditBingoPhrasesModal] Component unmounted.');
        };
    }, []); // Empty dependency array means this runs only on mount and unmount


    const handleSavePhrases = async () => {
        setIsSaving(true);
        setError('');
        try {
            const newPhrasesArray = phrasesText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
            
            if (newPhrasesArray.length < 24) {
                setError("You need at least 24 unique phrases for a full bingo card.");
                showNotification("Not enough phrases (min 24 required).", "warning");
                setIsSaving(false);
                return;
            }

            await set(masterPhrasesRef, newPhrasesArray);
            showNotification("Master bingo phrases updated successfully!", "check-circle");
            
            if (sendAdminActionWebhook && adminUserEmail) {
                sendAdminActionWebhook(
                    adminUserEmail,
                    "Edited Master Bingo Phrases",
                    `Updated ${newPhrasesArray.length} phrases.`,
                    "Bingo Master Phrases"
                );
            }
            onHide();
        } catch (err) {
            console.error("Error saving master phrases:", err);
            setError("Failed to save phrases: " + err.message);
            showNotification("Failed to save phrases.", "error");
            Sentry.captureException(err, { extra: { context: 'EditBingoPhrasesModal Save' } });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal
            show={show}
            onHide={onHide}
            size="lg"
            dialogClassName="bingo-modal-dialog"
        >
            <Modal.Header closeButton closeVariant="white">
                <Modal.Title>Edit Master Bingo Phrases</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {isLoading ? ( // This condition controls what's displayed
                    <div className="text-center"><Spinner animation="border" /> Loading phrases...</div>
                ) : (
                    <Form>
                        <Form.Group className="mb-3">
                            <Form.Label>One phrase per line. Minimum 24 phrases required.</Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={15}
                                value={phrasesText} // This is bound to phrasesText state
                                onChange={(e) => setPhrasesText(e.target.value)}
                                placeholder="Enter your bingo phrases here, one per line."
                                disabled={isSaving}
                                className="bingo-phrases-textarea"
                            />
                        </Form.Group>
                        {error && <p className="text-danger">{error}</p>}
                    </Form>
                )}
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={onHide} disabled={isSaving}>
                    Cancel
                </Button>
                <Button variant="primary" onClick={handleSavePhrases} disabled={isSaving || isLoading}>
                    {isSaving ? <Spinner as="span" animation="border" size="sm" /> : 'Save Phrases'}
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default EditBingoPhrasesModal;
