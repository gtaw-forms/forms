// src/components/PhraseRequestModal.js
import React, { useState } from 'react';
import { Modal, Button, Form, Spinner } from 'react-bootstrap';
import { database } from '../firebase';
import { ref, push, serverTimestamp } from 'firebase/database';
import * as Sentry from "@sentry/react";

const PhraseRequestModal = ({ show, onHide, showNotification, selectedEmployee, selectedBingoType }) => {
    const [phraseText, setPhraseText] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async () => {
        setError('');
        if (!phraseText.trim()) {
            setError('Phrase cannot be empty.');
            showNotification('Phrase cannot be empty.', 'warning');
            return;
        }

        // Check if a bingo type is selected before allowing a request
        if (!selectedBingoType) {
            setError('You must be in a specific Bingo game (e.g., EMS, Coroner) to request a phrase.');
            showNotification('Please select a Bingo type first.', 'warning');
            return;
        }

        setIsSubmitting(true);
        const phraseRequestsRef = ref(database, 'bingo/phraseRequests');

        try {
            await push(phraseRequestsRef, {
                phrase: phraseText.trim(),
                requestedBy: selectedEmployee ? selectedEmployee.value : 'Anonymous',
                timestamp: serverTimestamp(),
                status: 'pending',
                bingoType: selectedBingoType.name || 'Unknown' // Add the bingo type to the request
            });
            showNotification('Phrase request submitted successfully!', 'check-circle');
            setPhraseText('');
            onHide();
        } catch (err) {
            console.error("Error submitting phrase request:", err);
            setError("Failed to submit request: " + err.message);
            showNotification('Failed to submit phrase request.', 'error');
            Sentry.captureException(err, { extra: { context: 'PhraseRequestModal Submit' } });
        } finally {
            setIsSubmitting(false);
        }
    };

    React.useEffect(() => {
        if (!show) {
            setPhraseText('');
            setIsSubmitting(false);
            setError('');
        }
    }, [show]);

    return (
        <Modal
            show={show}
            onHide={onHide}
            size="md"
            dialogClassName="bingo-modal-dialog"
        >
            <Modal.Header closeButton closeVariant="white">
                <Modal.Title>Request a New Bingo Phrase</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                    <Form.Group className="mb-3">
                        <Form.Label>Your Phrase Idea:</Form.Label>
                        <Form.Control
                            as="textarea"
                            rows={3}
                            value={phraseText}
                            onChange={(e) => setPhraseText(e.target.value)}
                            placeholder="Enter your phrase idea here (e.g., 'Patient asks for a ride to the store')"
                            disabled={isSubmitting}
                            className="bingo-phrases-textarea"
                        />
                        <Form.Text className="text-muted">
                            This phrase will be reviewed by an admin before being added to the master list.
                            {selectedBingoType && ` It will be considered for the ${selectedBingoType.name} Bingo.`}
                        </Form.Text>
                    </Form.Group>
                    {error && <p className="text-danger">{error}</p>}
                </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={onHide} disabled={isSubmitting}>
                    Cancel
                </Button>
                <Button variant="primary" onClick={handleSubmit} disabled={isSubmitting || !phraseText.trim()}>
                    {isSubmitting ? <Spinner as="span" animation="border" size="sm" /> : 'Submit Request'}
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default PhraseRequestModal;
