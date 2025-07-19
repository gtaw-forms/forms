// src/components/Admin/ReviewPhraseRequestsModal.js
import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Button, ListGroup, Spinner } from 'react-bootstrap';
import { database } from '../../firebase';
import { ref, get, update, set, remove } from 'firebase/database'; // Import remove
import * as Sentry from "@sentry/react";

const BINGO_TYPES = [
    { id: 'er', name: 'Emergency Room', path: 'ER' },
    { id: 'ems', name: 'EMS', path: 'EMS' },
    { id: 'coroner', name: 'Coroner', path: 'Coroner' }
];

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
                let pendingRequests = Object.entries(data)
                    .map(([key, value]) => ({ id: key, ...value }))
                    .filter(req => req.status === 'pending')
                    .sort((a, b) => a.timestamp - b.timestamp);

                // Schedule deletion for processed requests
                Object.entries(data).forEach(([key, value]) => {
                    const request = { id: key, ...value };
                    if (request.status !== 'pending' && request.processedAt) {
                        scheduleDeletion(request);
                    }
                });

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

    const scheduleDeletion = (request) => {
        const processedAt = new Date(request.processedAt);
        const now = new Date();
        const timeDiff = now.getTime() - processedAt.getTime();
        const daysDiff = Math.floor(timeDiff / (1000 * 3600 * 24));

        let delay = 0;
        if (request.status.startsWith('Denied')) {
            delay = (2 - daysDiff) * (1000 * 3600 * 24); // 2 days for denied
        } else if (request.status === 'approved') {
            delay = (1 - daysDiff) * (1000 * 3600 * 24); // 1 day for approved
        }

        if (delay > 0) {
            setTimeout(() => {
                deleteRequest(request.id);
            }, delay);
        } else if (delay <= 0 && (request.status.startsWith('Denied') && daysDiff >= 2) || (request.status === 'approved' && daysDiff >= 1)) {
            deleteRequest(request.id);
        }
    };

    const deleteRequest = async (requestId) => {
        const requestRef = ref(database, `bingo/phraseRequests/${requestId}`);
        try {
            // 1. Get the request data BEFORE deleting it (for webhook info)
            const snapshot = await get(requestRef);
            const requestData = snapshot.val();  // Store the data to use in the webhook

            // 2. Delete the request
            await remove(requestRef);
            console.log(`Deleted request ${requestId}`);

            // 3. Send the webhook notification AFTER successful deletion
            if (sendAdminActionWebhook && requestData) { // Check if webhook function exists and we have data
                sendAdminActionWebhook(
                    adminUserEmail,
                    "Scheduled Bingo Phrase Request Deleted", // New Action Name
                    `Request ID: ${requestId}\nPhrase: "${requestData.phrase}"\nStatus: ${requestData.status}\nRequested by: ${requestData.requestedBy}\nBingo Type: ${requestData.bingoType || 'General'}`,
                    "Bingo Phrase Requests (Cleanup)" // New Category or adjust as needed
                );
            }

            // 4. Optionally, refresh the requests list after deletion
            fetchRequests(); 
        } catch (error) {
            console.error(`Error deleting request ${requestId}:`, error);
            Sentry.captureException(error, { extra: { context: 'ReviewPhraseRequestsModal Delete' } });
        }
    };


    useEffect(() => {
        if (show) {
            fetchRequests();
        }
    }, [show, fetchRequests]);

    const handleApprove = async (request) => {
        setIsProcessing(request.id);

        const bingoTypeObject = BINGO_TYPES.find(type => type.name === request.bingoType);

        if (!bingoTypeObject) {
            showNotification(`Error: Unknown Bingo Type "${request.bingoType}" for phrase approval.`, 'error');
            console.error(`Could not find a matching bingo type for name: ${request.bingoType}`);
            await handleDeny(request, 'Denied (Invalid Type)');
            setIsProcessing(null);
            return;
        }

        const masterPhrasesRef = ref(database, `bingo/phrases/${bingoTypeObject.path}`);
        const requestRef = ref(database, `bingo/phraseRequests/${request.id}`);

        try {
            const masterSnapshot = await get(masterPhrasesRef);
            const masterPhrasesData = masterSnapshot.val();
            const currentPhrases = masterSnapshot.exists()
                ? (Array.isArray(masterPhrasesData)
                    ? masterPhrasesData
                    : (typeof masterPhrasesData === 'object' && masterPhrasesData !== null)
                        ? Object.values(masterPhrasesData).map(p => (typeof p === 'object' ? p.phrase : p)).filter(Boolean)
                        : [])
                : [];

            // Split the phrase into multiple phrases by line breaks
            const phrasesToApprove = request.phrase.split('\n').map(phrase => phrase.trim()).filter(phrase => phrase);

            // Check for duplicates before adding any phrases
            for (const phrase of phrasesToApprove) {
                if (currentPhrases.some(p => p.toLowerCase() === phrase.toLowerCase())) {
                    showNotification(`Phrase "${phrase}" already exists in ${bingoTypeObject.name} list. Denying request.`, 'warning');
                    await handleDeny(request, 'Denied (Duplicate)');
                    return;
                }
            }


        let updatedPhrases = [...currentPhrases, ...phrasesToApprove];
        updatedPhrases = updatedPhrases.filter(phrase => phrase !== undefined && phrase !== null && phrase !== ""); // CRITICAL FIX

        await set(masterPhrasesRef, updatedPhrases);


            await update(requestRef, { status: 'approved', processedBy: adminUserEmail, processedAt: new Date().toISOString() });

            showNotification(`Phrase(s) added to ${bingoTypeObject.name} list!`, 'check-circle');

            if (sendAdminActionWebhook) {
                const phraseList = phrasesToApprove.map(phrase => `"${phrase}"`).join('\n'); // Create a list of phrases
                sendAdminActionWebhook(
                    adminUserEmail,
                    "Approved Bingo Phrase Request",
                    `Phrases:\n${phraseList}\nRequested by: ${request.requestedBy}\nFor Bingo: ${request.bingoType || 'General'}`,
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
            showNotification(`Request for phrase(s) has been denied.`, 'info-circle');

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
            <Modal.Body style={{ overflowY: 'auto' }}> {/* ADDED SCROLL BAR */}
                {isLoading ? (
                    <div className="text-center"><Spinner animation="border" /> Loading requests...</div>
                ) : requests.length > 0 ? (
                    <ListGroup variant="flush">
                        {requests.map(req => (
                            <ListGroup.Item key={req.id} className="d-flex justify-content-between align-items-center bg-transparent text-light">
                                <div>
                                    <p className="mb-0"><strong>Phrase(s):</strong></p>
                                    {req.phrase.split('\n').map((phrase, index) => (
                                        <p key={index} className="mb-1">
                                            "{phrase.trim()}"
                                        </p>
                                    ))}
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
