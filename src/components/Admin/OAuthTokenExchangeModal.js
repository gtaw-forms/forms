import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Spinner, Alert } from 'react-bootstrap';
import * as Sentry from "@sentry/react";

const OAuthTokenExchangeModal = ({ show, onHide, showNotification, sendAdminActionWebhook, adminUserEmail, onUserDataReceived }) => {
    const [tokenUrl, setTokenUrl] = useState('https://ucp.gta.world/oauth/token');
    const [clientId, setClientId] = useState(process.env.REACT_APP_GTAWORLD_CLIENT_ID || '');
    const [clientSecret, setClientSecret] = useState('');
    const [redirectUri, setRedirectUri] = useState(() => {
        const isGithubPages = window.location.hostname.includes('github.io');
        if (isGithubPages) {
            // For GitHub Pages, use the hash-based routing
            return 'https://gtaw-forms.github.io/forms/#/auth/gta/callback';
        }
        // For local development
        return `${window.location.origin}/#/auth/gta/callback`;
    });
    const [code, setCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [response, setResponse] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (show) {
            console.info('[OAuth] Initializing OAuth modal');
            // Check for code in URL params first (direct callback)
            const urlParams = new URLSearchParams(window.location.search);
            const codeFromUrl = urlParams.get('code');
            console.debug('[OAuth] Checking URL parameters for code');
            if (codeFromUrl) {
                setCode(codeFromUrl);
                // Clean up the URL
                const cleanUrl = window.location.href.split('?')[0];
                window.history.replaceState({}, document.title, cleanUrl);
                return;
            }
            
            // Fallback to session storage
            const storedCode = sessionStorage.getItem('oauth-exchange-code');
            if (storedCode) {
                setCode(storedCode);
                sessionStorage.removeItem('oauth-exchange-code');
            }
        }
    }, [show]);

    const handleGetCode = () => {
        console.info('[OAuth] Initiating authorization code request');
        console.debug('[OAuth] Authorization parameters:', { clientId, redirectUri });
        sessionStorage.setItem('oauth-exchange-in-progress', 'true');
        const authUrl = `https://ucp.gta.world/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}`;
        window.location.href = authUrl;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        console.info('[OAuth] Starting token exchange submission');
        setIsLoading(true);
        setResponse(null);
        setError(null);

        const functionUrl = 'https://us-central1-gtaw-forms.cloudfunctions.net/exchangeAuthCodeForToken';
        console.debug('[OAuth] Using function URL:', functionUrl);
        
        try {
            console.debug('[OAuth] Sending token exchange request to:', functionUrl);
            const response = await fetch(functionUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ code, redirectUri }),
            });
            console.debug('[OAuth] Token exchange response status:', response.status);

            const data = await response.json();

            if (response.ok) {
                console.info('[OAuth] Token exchange successful');
                console.debug('[OAuth] Received user data:', { username: data.user?.username });
                setResponse(data.token);
                if (data.user) {
                    onUserDataReceived(data.user);
                    showNotification(`OAuth Token Exchange successful! Welcome ${data.user.username}`, 'check-circle');
                }
                sendAdminActionWebhook(
                    adminUserEmail,
                    'OAuth Token Exchange Success',
                    `Success: Token and user data received`,
                    'Developer Tools'
                );
            } else {
                const errorData = data;
                setError(errorData);
                showNotification(`OAuth Token Exchange failed: ${errorData.error || response.statusText}`, 'error');
                sendAdminActionWebhook(
                    adminUserEmail,
                    'OAuth Token Exchange Failure',
                    `Error: ${JSON.stringify(errorData, null, 2)}`,
                    'Developer Tools'
                );
                Sentry.captureMessage(`OAuth Token Exchange failed: ${functionUrl}`, {
                    level: 'error',
                    extra: {
                        redirectUri,
                        response: errorData,
                        status: response.status,
                    }
                });
            }
        } catch (err) {
            console.error('Network error during OAuth Token Exchange:', err);
            setError({ error: 'Network Error', error_description: err.message });
            showNotification(`Network error: ${err.message}`, 'error');
            sendAdminActionWebhook(
                adminUserEmail,
                'OAuth Token Exchange Network Error',
                `Network Error: ${err.message}`,
                'Developer Tools'
            );
            Sentry.captureException(err, {
                extra: {
                    context: 'OAuth Token Exchange Network Error',
                    functionUrl,
                    redirectUri,
                }
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal show={show} onHide={onHide} size="lg" centered>
            <Modal.Header closeButton>
                <Modal.Title>OAuth Token Exchange</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <Form onSubmit={handleSubmit}>
                    <Form.Group className="mb-3">
                        <Form.Label>Token Endpoint URL</Form.Label>
                        <Form.Control
                            type="url"
                            value={tokenUrl}
                            onChange={(e) => setTokenUrl(e.target.value)}
                            placeholder="e.g., https://ucp.gta.world/oauth/token"
                            required
                        />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>Client ID</Form.Label>
                        <Form.Control
                            type="text"
                            value={clientId}
                            onChange={(e) => setClientId(e.target.value)}
                            placeholder="Your OAuth Client ID"
                            required
                        />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>Client Secret</Form.Label>
                        <Form.Control
                            type="password"
                            value={clientSecret}
                            onChange={(e) => setClientSecret(e.target.value)}
                            placeholder="Your OAuth Client Secret"
                            required
                        />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>Redirect URI</Form.Label>
                        <Form.Control
                            type="url"
                            value={redirectUri}
                            onChange={(e) => setRedirectUri(e.target.value)}
                            placeholder="Your registered Redirect URI"
                            required
                        />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>Authorization Code</Form.Label>
                        <div className="d-flex">
                            <Form.Control
                                type="text"
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                placeholder="Click button to get code ->"
                                required
                            />
                            <Button variant="outline-secondary" onClick={handleGetCode} className="ms-2">Get Code</Button>
                        </div>
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
                            <strong>Success!</strong> Token received.
                            <pre className="mt-2">{JSON.stringify(response, null, 2)}</pre>
                        </Alert>
                    )}

                    <Button variant="primary" type="submit" disabled={isLoading}>
                        {isLoading ? <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> : <i className="fas fa-paper-plane me-2"></i>}
                        {isLoading ? 'Exchanging Code...' : 'Exchange Code for Token'}
                    </Button>
                </Form>
            </Modal.Body>
        </Modal>
    );
};

export default OAuthTokenExchangeModal;