import React, { useState } from 'react';
import { Modal, Button, Form, Spinner, Alert } from 'react-bootstrap';
import * as Sentry from "@sentry/react";

const UserDataExchangeModal = ({ show, onHide, showNotification, sendAdminActionWebhook, adminUserEmail }) => {
    const [requestUrl, setRequestUrl] = useState('');
    const [bearerToken, setBearerToken] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [response, setResponse] = useState(null);
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setResponse(null);
        setError(null);

        try {
            const res = await fetch(requestUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${bearerToken}`,
                    'Content-Type': 'application/json',
                },
            });

            const data = await res.json();

            if (res.ok) {
                setResponse(data);
                showNotification('User Data Exchange successful!', 'check-circle');
                sendAdminActionWebhook(
                    adminUserEmail,
                    'User Data Exchange Success',
                    `URL: ${requestUrl}\nResponse: ${JSON.stringify(data, null, 2)}`,
                    'Developer Tools'
                );
            } else {
                setError(data);
                showNotification(`User Data Exchange failed: ${data.error_description || data.error || res.statusText}`, 'error');
                sendAdminActionWebhook(
                    adminUserEmail,
                    'User Data Exchange Failure',
                    `URL: ${requestUrl}\nError: ${JSON.stringify(data, null, 2)}`,
                    'Developer Tools'
                );
                Sentry.captureMessage(`User Data Exchange failed: ${requestUrl}`, {
                    level: 'error',
                    extra: {
                        response: data,
                        status: res.status,
                    }
                });
            }
        } catch (err) {
            console.error('Network error during User Data Exchange:', err);
            setError({ error: 'Network Error', error_description: err.message });
            showNotification(`Network error: ${err.message}`, 'error');
            sendAdminActionWebhook(
                adminUserEmail,
                'User Data Exchange Network Error',
                `URL: ${requestUrl}\nError: ${err.message}`,
                'Developer Tools'
            );
            Sentry.captureException(err, {
                extra: {
                    context: 'User Data Exchange Network Error',
                    requestUrl,
                }
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal show={show} onHide={onHide} size="lg" centered>
            <Modal.Header closeButton>
                <Modal.Title>User Data Exchange</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <Form onSubmit={handleSubmit}>
                    <Form.Group className="mb-3">
                        <Form.Label>Request URL</Form.Label>
                        <Form.Control
                            type="url"
                            value={requestUrl}
                            onChange={(e) => setRequestUrl(e.target.value)}
                            placeholder="e.g., https://api.example.com/user"
                            required
                        />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>Authorization Bearer Token</Form.Label>
                        <Form.Control
                            type="password"
                            value={bearerToken}
                            onChange={(e) => setBearerToken(e.target.value)}
                            placeholder="Your Authorization Bearer Token"
                            required
                        />
                    </Form.Group>

                    {error && (
                        <Alert variant="danger">
                            <strong>Error:</strong> {error.error || 'Unknown Error'}
                            {error.error_description && `: ${error.error_description}`}
                            {error.message && `: ${error.message}`}
                            <pre className="mt-2">{JSON.stringify(error, null, 2)}</pre>
                        </Alert>
                    )}

                    {response && (
                        <Alert variant="success">
                            <strong>Success!</strong> Data received.
                            <pre className="mt-2">{JSON.stringify(response, null, 2)}</pre>
                        </Alert>
                    )}

                    <Button variant="primary" type="submit" disabled={isLoading}>
                        {isLoading ? <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> : <i className="fas fa-paper-plane me-2"></i>}
                        {isLoading ? 'Fetching Data...' : 'Get User Data'}
                    </Button>
                </Form>
            </Modal.Body>
        </Modal>
    );
};

export default UserDataExchangeModal;
