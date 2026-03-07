import React, { useState } from 'react';
import { Button, Form, Spinner } from 'react-bootstrap';
import { database } from '../../firebase';
import { ref, push, serverTimestamp } from 'firebase/database';
import * as Sentry from "@sentry/react";
import BaseModal from './BaseModal';

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

        if (!selectedBingoType) {
            setError('You must be in a specific Bingo game to request a phrase.');
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

    return (
        <BaseModal
            isOpen={show}
            onClose={onHide}
            title="Request a Phrase"
            modalSize="medium"
            variant="info"
            footer={
                <>
                    <Button variant="secondary" onClick={onHide} disabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={handleSubmit} disabled={isSubmitting || !phraseText.trim()} style={{ marginLeft: '10px' }}>
                        {isSubmitting ? <Spinner as="span" animation="border" size="sm" /> : 'Submit Request'}
                    </Button>
                </>
            }
        >
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
                        style={{ backgroundColor: '#161b22', color: '#e6edf3', borderColor: '#30363d' }}
                        autoFocus
                    />
                    <Form.Text className="text-muted" style={{ marginTop: '0.8rem', display: 'block', color: '#8b949e' }}>
                        This phrase will be reviewed by an admin before being added to the master list.
                        {selectedBingoType && ` It will be considered for the ${selectedBingoType.name} Bingo.`}
                    </Form.Text>
                </Form.Group>
                {error && <p className="text-danger mt-2">{error}</p>}
            </Form>
        </BaseModal>
    );
};

export default PhraseRequestModal;
