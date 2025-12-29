// c:\Users\cross\Documents\GitHub\phmc-forms\src\components\Admin\EditBingoPhrasesModal.js
import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Button, Form, Spinner } from 'react-bootstrap';
import { database } from '../../firebase';
import { ref, get, set } from 'firebase/database';
import * as Sentry from "@sentry/react";

const EditBingoPhrasesModal = ({ show, onHide, showNotification, commitInfo, logAdminAction, adminUserEmail, bingoType }) => {
    const [phrasesText, setPhrasesText] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    const fetchPhrases = useCallback(async () => {
        if (!bingoType?.path) {
            console.error("[EditBingoPhrasesModal] fetchPhrases: No bingoType or path provided.");
            setError("Cannot load phrases: No Bingo Type selected.");
            setIsLoading(false);
            return;
        }
        const masterPhrasesRef = ref(database, `bingo/phrases/${bingoType.path}`);

        console.log(`[EditBingoPhrasesModal] fetchPhrases: Starting fetch for ${bingoType.name}...`);
        setIsLoading(true);
        setError('');
        try {
            const snapshot = await get(masterPhrasesRef);
            console.log(`[EditBingoPhrasesModal] fetchPhrases: Firebase get() call resolved for ${bingoType.name}.`);

            if (snapshot.exists()) {
                const phrasesFromDb = snapshot.val();
                console.log(`[EditBingoPhrasesModal] fetchPhrases: Data exists for ${bingoType.name}.`, phrasesFromDb);

                const phraseArray = Array.isArray(phrasesFromDb)
                    ? phrasesFromDb
                    : (typeof phrasesFromDb === 'object' && phrasesFromDb !== null)
                        ? Object.values(phrasesFromDb).map(p => (typeof p === 'object' ? p.phrase : p)).filter(Boolean)
                        : [];

                setPhrasesText(phraseArray.filter(p => p).join('\n'));
                console.log(`[EditBingoPhrasesModal] fetchPhrases: Phrases set for ${bingoType.name}.`);
            } else {
                setPhrasesText('');
                showNotification(`No master phrases found for ${bingoType.name}. You can add them here.`, "info-circle");
                console.log(`[EditBingoPhrasesModal] fetchPhrases: No data found for ${bingoType.name}.`);
            }
        } catch (err) {
            console.error(`[EditBingoPhrasesModal] fetchPhrases: Error during fetch for ${bingoType.name}:`, err);
            setError("Failed to load phrases: " + err.message);
            showNotification("Failed to load phrases.", "error");
            Sentry.captureException(err, { extra: { context: `EditBingoPhrasesModal Fetch for ${bingoType?.name}` } });
        } finally {
            setIsLoading(false);
            console.log(`[EditBingoPhrasesModal] fetchPhrases: Finished fetch for ${bingoType.name}. isLoading set to false.`);
        }
    }, [bingoType, showNotification]);

    // MODIFIED: This useEffect hook is now corrected.
    // It will re-run and fetch phrases whenever the modal is shown OR when the bingoType prop changes.
    useEffect(() => {
        if (show && bingoType) {
            fetchPhrases();
        } else if (!show) {
            // When the modal is hidden, reset its state for the next time it opens.
            setIsLoading(true);
            setPhrasesText('');
            setError('');
            setIsSaving(false);
        }
    }, [show, bingoType, fetchPhrases]); // Dependencies ensure this runs at the right times.

    const handleSavePhrases = async () => {
        if (!bingoType?.path) {
            setError("Cannot save phrases: No Bingo Type selected.");
            showNotification("Cannot save: No Bingo Type selected.", "error");
            return;
        }
        const masterPhrasesRef = ref(database, `bingo/phrases/${bingoType.path}`);

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
            showNotification(`Master ${bingoType.name} phrases updated successfully!`, "check-circle");
            
            if (logAdminAction && adminUserEmail) {
                logAdminAction(
                    adminUserEmail,
                    `Edited Master ${bingoType.name} Bingo Phrases`,
                    `Updated ${newPhrasesArray.length} phrases.`,
                    `Bingo Master Phrases (${bingoType.name})`
                );
            }
            onHide();
        } catch (err) {
            console.error("Error saving master phrases:", err);
            setError("Failed to save phrases: " + err.message);
            showNotification("Failed to save phrases.", "error");
            Sentry.captureException(err, { extra: { context: `EditBingoPhrasesModal Save for ${bingoType?.name}` } });
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
                <Modal.Title>Edit Master {bingoType?.name || ''} Bingo Phrases</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {isLoading ? (
                    <div className="text-center"><Spinner animation="border" /> Loading phrases...</div>
                ) : (
                    <Form>
                        <Form.Group className="mb-3">
                            <Form.Label>One phrase per line. Minimum 24 phrases required.</Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={15}
                                value={phrasesText}
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
