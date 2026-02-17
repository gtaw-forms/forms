import React, { useState } from 'react';
import { Button, Form, Spinner } from 'react-bootstrap';
import { database } from '../../firebase';
import { ref, push, serverTimestamp } from 'firebase/database';
import * as Sentry from "@sentry/react";
import './EmsBingoModal.css';

const PhraseRequestModal = ({ show, onHide, showNotification, selectedEmployee, selectedBingoType, sendPhraseRequestWebhook }) => {
    const [phraseText, setPhraseText] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
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
            const trimmedPhrase = phraseText.trim();
            const requesterName = selectedEmployee ? selectedEmployee.value : 'Anonymous';
            const bingoTypeName = selectedBingoType.name || 'Unknown';

            await push(phraseRequestsRef, {
                phrase: trimmedPhrase,
                requestedBy: requesterName,
                timestamp: serverTimestamp(),
                status: 'pending',
                bingoType: bingoTypeName
            });

            // NEW: Call the webhook for the phrase request
            if (sendPhraseRequestWebhook) {
                sendPhraseRequestWebhook({
                    requester: requesterName,
                    phrase: trimmedPhrase,
                    bingoType: bingoTypeName,
                });
            }

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

    if (!show) return null;

    return (
        <div className="modal-overlay" style={{ zIndex: 1100 }} onClick={onHide}>
            <div className="bingo-modal-dialog" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
                <div className="modal-header">
                    <h4 className="bingo-title w-100 text-center" style={{ fontSize: '1.8rem' }}>
                        Request a Phrase
                    </h4>
                    <button
                        type="button"
                        className="modal-close-btn"
                        onClick={onHide}
                        aria-label="Close"
                    >
                        <span aria-hidden="true">&times;</span>
                    </button>
                </div>
                <div className="modal-body" style={{ padding: '2rem' }}>
                    <Form onSubmit={handleSubmit}>
                        <Form.Group className="mb-3">
                            <Form.Label style={{ color: '#94a3b8', fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>
                                Your Phrase Idea:
                            </Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={3}
                                value={phraseText}
                                onChange={(e) => setPhraseText(e.target.value)}
                                placeholder="Enter your phrase idea here (e.g., 'Patient asks for a ride to the store')"
                                disabled={isSubmitting}
                                className="bingo-phrases-textarea"
                                autoFocus
                            />
                            <Form.Text className="text-muted" style={{ marginTop: '0.5rem', display: 'block', color: '#64748b' }}>
                                This phrase will be reviewed by an admin before being added to the master list.
                                {selectedBingoType && ` It will be considered for the ${selectedBingoType.name} Bingo.`}
                            </Form.Text>
                        </Form.Group>
                        {error && <p className="text-danger mt-2">{error}</p>}
                    </Form>
                </div>
                <div className="modal-footer" style={{ padding: '1.5rem', justifyContent: 'flex-end', display: 'flex', gap: '10px' }}>
                    <Button variant="secondary" onClick={onHide} disabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={handleSubmit} disabled={isSubmitting || !phraseText.trim()}>
                        {isSubmitting ? <Spinner as="span" animation="border" size="sm" /> : 'Submit Request'}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default PhraseRequestModal;
