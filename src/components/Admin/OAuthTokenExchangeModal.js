import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Spinner, Alert } from 'react-bootstrap';
import * as Sentry from "@sentry/react";

const OAuthTokenExchangeModal = ({ show, onHide, showNotification, sendAdminActionWebhook, adminUserEmail, onUserDataReceived }) => {
    const [tokenUrl, setTokenUrl] = useState('https://ucp.gta.world/oauth/token');
    const [clientId, setClientId] = useState(process.env.REACT_APP_GTAWORLD_CLIENT_ID || '');
    const [clientSecret, setClientSecret] = useState('');
    const [redirectUri, setRedirectUri] = useState(() => {
        // Handle GitHub Pages base path
        const baseUrl = window.location.origin;
        const basePath = window.location.pathname.split('/')[1]; // Get 'forms' from /forms/...
        return baseUrl + (basePath ? `/${basePath}` : '') + '/auth/gta/callback';
    });
    const [code, setCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [response, setResponse] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (show) {
            // Check for code in URL params first (direct callback)
            const urlParams = new URLSearchParams(window.location.search);
            const codeFromUrl = urlParams.get('code');
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
        sessionStorage.setItem('oauth-exchange-in-progress', 'true');
        const authUrl = `https://ucp.gta.world/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}`;
        window.location.href = authUrl;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setResponse(null);
        setError(null);

        const params = new URLSearchParams();
        params.append('grant_type', 'authorization_code');
        params.append('client_id', clientId);
        params.append('client_secret', clientSecret);
        params.append('redirect_uri', redirectUri);
        params.append('code', code);

        try {
            const res = await fetch(tokenUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: params.toString(),
            });

            const data = await res.json();

            if (res.ok) {
                setResponse(data);
                
                // Fetch user data with the received token
                try {
                    const userRes = await fetch('https://ucp.gta.world/api/user', {
                        headers: {
                            'Authorization': `Bearer ${data.access_token}`
                        }
                    });
                    const userData = await userRes.json();
                    if (userRes.ok && userData.user) {
                        onUserDataReceived(userData.user);
                        showNotification(`OAuth Token Exchange successful! Welcome ${userData.user.username}`, 'check-circle');
                    } else {
                        throw new Error('Failed to fetch user data');
                    }
                } catch (userErr) {
                    console.error('Error fetching user data:', userErr);
                    showNotification('Token exchange successful but failed to fetch user data', 'warning');
                    Sentry.captureException(userErr, {
                        extra: {
                            context: 'OAuth User Data Fetch Error',
                            tokenUrl,
                            clientId
                        }
                    });
                }
                sendAdminActionWebhook(
                    adminUserEmail,
                    'OAuth Token Exchange Success',
                    `URL: ${tokenUrl}\nClient ID: ${clientId}\nResponse: ${JSON.stringify(data, null, 2)}`,
                    'Developer Tools'
                );
            } else {
                setError(data);
                showNotification(`OAuth Token Exchange failed: ${data.error_description || data.error || res.statusText}`, 'error');
                sendAdminActionWebhook(
                    adminUserEmail,
                    'OAuth Token Exchange Failure',
                    `URL: ${tokenUrl}\nClient ID: ${clientId}\nError: ${JSON.stringify(data, null, 2)}`,
                    'Developer Tools'
                );
                Sentry.captureMessage(`OAuth Token Exchange failed: ${tokenUrl}`, {
                    level: 'error',
                    extra: {
                        clientId,
                        redirectUri,
                        response: data,
                        status: res.status,
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
                `URL: ${tokenUrl}\nClient ID: ${clientId}\nError: ${err.message}`,
                'Developer Tools'
            );
            Sentry.captureException(err, {
                extra: {
                    context: 'OAuth Token Exchange Network Error',
                    tokenUrl,
                    clientId,
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