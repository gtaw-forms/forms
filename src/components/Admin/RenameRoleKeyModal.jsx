// src/components/Admin/RenameRoleKeyModal.js
import React, { useState, useEffect } from 'react';
import { Modal as BootstrapModal, Button, Form, Spinner } from 'react-bootstrap';
import { database } from '../../firebase';
import { ref, get, set, remove } from "firebase/database";
import * as Sentry from "@sentry/react";

// Modal Styles (can be shared or defined per modal)
const modalOverlayStyle = { /* ... (same as RoleModal) ... */ };
const modalContentStyle = { /* ... (same as RoleModal) ... */ };
const modalHeaderStyle = { /* ... (same as RoleModal) ... */ };
const modalTitleStyle = { /* ... (same as RoleModal) ... */ };
const modalBodyStyle = { /* ... (same as RoleModal) ... */ };
const modalFooterStyle = { /* ... (same as RoleModal) ... */ };
const closeButtonStyle = { /* ... (same as RoleModal) ... */ };


const RenameRoleKeyModal = ({
    show,
    onHide,
    categoryConfig, // Contains { displayName, path }
    currentRoleKey,
    currentRoleData,
    showInAppNotification,
    onKeyRenamed, // Callback to refresh data in parent
    sendAdminActionWebhook, // Function to log admin actions
    adminUserEmail
}) => {
    const [newKey, setNewKey] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (show) {
            setNewKey(''); // Reset new key input when modal opens
            setError('');
        }
    }, [show]);

    const handleNewKeyChange = (e) => {
        // Basic sanitization: replace spaces with underscores, remove Firebase invalid chars
        let sanitizedValue = e.target.value.replace(/\s+/g, '_');
        sanitizedValue = sanitizedValue.replace(/[.#$[\]/]/g, '');
        setNewKey(sanitizedValue);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!newKey.trim()) {
            setError('New key cannot be empty.');
            if (showInAppNotification) showInAppNotification('New key cannot be empty.', 'warning');
            return;
        }
        if (newKey === currentRoleKey) {
            setError('New key cannot be the same as the current key.');
            if (showInAppNotification) showInAppNotification('New key is the same as the current one.', 'info');
            return;
        }

        setIsProcessing(true);

        const basePath = categoryConfig.path;
        const oldPath = `${basePath}/${currentRoleKey}`;
        const newPath = `${basePath}/${newKey}`;

        try {
            // 1. Check if the new key already exists
            const newKeyRef = ref(database, newPath);
            const snapshot = await get(newKeyRef);
            if (snapshot.exists()) {
                setError(`The key "${newKey}" already exists in this category. Please choose a different key.`);
                if (showInAppNotification) showInAppNotification(`Key "${newKey}" already exists.`, 'error');
                setIsProcessing(false);
                return;
            }

            // 2. Copy data to the new key
            await set(ref(database, newPath), currentRoleData);

            // 3. Delete the old key
            await remove(ref(database, oldPath));

            if (showInAppNotification) showInAppNotification(`Role key "${currentRoleKey}" successfully renamed to "${newKey}".`, 'check-circle');

            if (sendAdminActionWebhook && adminUserEmail) {
                sendAdminActionWebhook(
                    adminUserEmail,
                    "Renamed Role Key",
                    `Category: ${categoryConfig.displayName}\nOld Key: ${currentRoleKey}\nNew Key: ${newKey}\nRole Display Name: ${currentRoleData.displayName || 'N/A'}`,
                    categoryConfig.displayName
                );
            }

            if (onKeyRenamed) {
                onKeyRenamed(); // Trigger data refresh in parent
            }
            onHide(); // Close modal
        } catch (dbError) {
            setError(`Failed to rename key: ${dbError.message}`);
            if (showInAppNotification) showInAppNotification(`Failed to rename key. ${dbError.message}`, "error");
            Sentry.captureException(dbError, {
                extra: { context: 'RenameRoleKeyModal Firebase Ops', oldPath, newPath }
            });
        } finally {
            setIsProcessing(false);
        }
    };

    if (!show) return null;

    return (
        <div style={modalOverlayStyle} onClick={onHide}>
            <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
                <BootstrapModal.Header style={modalHeaderStyle} closeButton={false}> {/* Remove default closeButton if using custom */}
                    <BootstrapModal.Title style={modalTitleStyle}>Rename Role Key: {currentRoleData?.displayName || currentRoleKey}</BootstrapModal.Title>
                    <button onClick={onHide} style={closeButtonStyle} aria-label="Close modal">&times;</button>
                </BootstrapModal.Header>
                <BootstrapModal.Body style={modalBodyStyle}>
                    <p>Current Key: <strong>{currentRoleKey}</strong></p>
                    <p className="text-warning small">
                        Warning: Renaming the key changes its identifier in the database.
                        This is a technical change and does not affect the &quot;Display Name&quot; shown to users unless you also edit the role.
                        Ensure the new key is unique and does not contain spaces or Firebase-invalid characters (e.g., ., $, #, [, ], /).
                    </p>
                    <Form onSubmit={handleSubmit}>
                        <Form.Group className="mb-3">
                            <Form.Label>New Role Key *</Form.Label>
                            <Form.Control
                                type="text"
                                value={newKey}
                                onChange={handleNewKeyChange}
                                required
                                placeholder="Enter new unique key (no spaces/invalid chars)"
                                disabled={isProcessing}
                            />
                            <Form.Text className="text-muted">
                                Spaces will be replaced with underscores. Invalid characters will be removed.
                            </Form.Text>
                        </Form.Group>
                        {error && <p className="text-danger mt-2 mb-0">{error}</p>}
                    </Form>
                </BootstrapModal.Body>
                <BootstrapModal.Footer style={modalFooterStyle}>
                    <Button variant="secondary" onClick={onHide} disabled={isProcessing}>
                        Cancel
                    </Button>
                    <Button
                        variant="warning" // Use warning color for potentially impactful action
                        onClick={handleSubmit}
                        disabled={isProcessing || !newKey.trim() || newKey === currentRoleKey}
                    >
                        {isProcessing ? <Spinner as="span" animation="border" size="sm" /> : 'Rename Key'}
                    </Button>
                </BootstrapModal.Footer>
            </div>
        </div>
    );
};

export default RenameRoleKeyModal;
