// src/components/Admin/ReviewPhraseRequestsModal.js
import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Button, ListGroup, Spinner } from 'react-bootstrap';
import { database } from '../../firebase';
import { ref, get, update, set } from 'firebase/database';
import * as Sentry from "@sentry/react";

const ReviewPhraseRequestsModal = ({ show, onHide, showNotification, sendAdminActionWebhook, adminUserEmail }) => {
    const [requests, setRequests] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(null);

    const fetchRequests = useCallback(async () => {
        setIsLoading(true);
        const requestsRef = ref(database, 'bingo/phraseRequests');
        try {
            const snapshot = await get(requestsRef);
            if (snapshot.exists()) {
                const data = snapshot.val();
                const pendingRequests = Object.entries(data)
                    .map(([key, value]) => ({ id: key, ...value }))
                    .filter(req => req.status === 'pending')
                    .sort((a, b) => a.timestamp - b.timestamp);
                setRequests(pendingRequests);
            } else {
                setRequests([]);
            }
        } catch (error) {
            console.error("Error fetching phrase requests:", error);
            showNotification("Failed to load phrase requests.", "error");
            Sentry.captureException(error, { extra: { context: 'ReviewPhraseRequestsModal Fetch' } });
        } finally {
            setIsLoading(false);
        }
    }, [showNotification]);

    useEffect(() => {
        if (show) {
            fetchRequests();
        }
    }, [show, fetchRequests]);

    const handleApprove = async (request) => {
        setIsProcessing(request.id);
        const masterPhrasesRef = ref(database, 'bingo/phrases');
        const requestRef = ref(database, `bingo/phraseRequests/${request.id}`);

        try {
            const masterSnapshot = await get(masterPhrasesRef);
            const currentPhrases = masterSnapshot.exists() && Array.isArray(masterSnapshot.val()) ? masterSnapshot.val() : [];

            if (currentPhrases.some(p => p.toLowerCase() === request.phrase.toLowerCase())) {
                showNotification(`Phrase "${request.phrase}" already exists. Denying request.`, 'warning');
                await handleDeny(request, 'Denied (Duplicate)');
                return;
            }

            const updatedPhrases = [...currentPhrases, request.phrase];
            await set(masterPhrasesRef, updatedPhrases);

            await update(requestRef, { status: 'approved', processedBy: adminUserEmail, processedAt: new Date().toISOString() });

            showNotification(`Phrase "${request.phrase}" approved and added!`, 'check-circle');

            if (sendAdminActionWebhook) {
                sendAdminActionWebhook(
                    adminUserEmail,
                    "Approved Bingo Phrase Request",
                    `Phrase: "${request.phrase}"\nRequested by: ${request.requestedBy}\nFor Bingo: ${request.bingoType || 'General'}`,
                    "Bingo Phrase Requests"
                );
            }
            fetchRequests();
        } catch (error) {
            console.error("Error approving phrase:", error);
            showNotification("Failed to approve phrase.", "error");
            Sentry.captureException(error, { extra: { context: 'ReviewPhraseRequestsModal Approve' } });
        } finally {
            setIsProcessing(null);
        }
    };

    const handleDeny = async (request, reason = 'Denied') => {
        setIsProcessing(request.id);
        const requestRef = ref(database, `bingo/phraseRequests/${request.id}`);
        try {
            await update(requestRef, { status: reason, processedBy: adminUserEmail, processedAt: new Date().toISOString() });
            showNotification(`Request for "${request.phrase}" has been denied.`, 'info-circle');

            // FIX: Corrected the typo from sendAdminActionwebhook to sendAdminActionWebhook
            if (sendAdminActionWebhook) {
                sendAdminActionWebhook(
                    adminUserEmail,
                    "Denied Bingo Phrase Request",
                    `Phrase: "${request.phrase}"\nRequested by: ${request.requestedBy}\nFor Bingo: ${request.bingoType || 'General'}\nReason: ${reason}`,
                    "Bingo Phrase Requests"
                );
            }
            fetchRequests();
        } catch (error) {
            console.error("Error denying phrase:", error);
            showNotification("Failed to deny phrase.", "error");
            Sentry.captureException(error, { extra: { context: 'ReviewPhraseRequestsModal Deny' } });
        } finally {
            setIsProcessing(null);
        }
    };

    return (
        <Modal show={show} onHide={onHide} size="lg" dialogClassName="bingo-modal-dialog">
            <Modal.Header closeButton closeVariant="white">
                <Modal.Title>Review Pending Bingo Phrases</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {isLoading ? (
                    <div className="text-center"><Spinner animation="border" /> Loading requests...</div>
                ) : requests.length > 0 ? (
                    <ListGroup variant="flush">
                        {requests.map(req => (
                            <ListGroup.Item key={req.id} className="d-flex justify-content-between align-items-center bg-transparent text-light">
                                <div>
                                    <p className="mb-0"><strong>Phrase:</strong> "{req.phrase}"</p>
                                    {req.bingoType && (
                                        <p className="mb-1" style={{ color: '#0dcaf0' }}>
                                            <small>For: <strong>{req.bingoType} Bingo</strong></small>
                                        </p>
                                    )}
                                    <small className="text-muted">
                                        Requested by: {req.requestedBy} on {new Date(req.timestamp).toLocaleString()}
                                    </small>
                                </div>
                                <div>
                                    {isProcessing === req.id ? (
                                        <Spinner animation="border" size="sm" />
                                    ) : (
                                        <>
                                            <Button variant="outline-success" size="sm" className="me-2" onClick={() => handleApprove(req)}>
                                                Approve
                                            </Button>
                                            <Button variant="outline-danger" size="sm" onClick={() => handleDeny(req)}>
                                                Deny
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </ListGroup.Item>
                        ))}
                    </ListGroup>
                ) : (
                    <p className="text-center text-muted">No pending phrase requests.</p>
                )}
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={onHide}>
                    Close
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default ReviewPhraseRequestsModal;
