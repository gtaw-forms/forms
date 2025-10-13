import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Spinner, Alert } from 'react-bootstrap';
import * as Sentry from "@sentry/react";

const OAuthTokenExchangeModal = ({ show, onHide, showNotification, sendAdminActionWebhook, adminUserEmail, onUserDataReceived }) => {
    const [tokenUrl, setTokenUrl] = useState('https://ucp.gta.world/oauth/token');
    const [clientId, setClientId] = useState(process.env.REACT_APP_GTAWORLD_CLIENT_ID || '');
    const [clientSecret, setClientSecret] = useState('');
    const [redirectUri, setRedirectUri] = useState(() => {
        const isGithubPages = window.location.hostname.includes('github.io');
        // Always use hash-based routing for GitHub Pages and local development
        return isGithubPages 
            ? 'https://gtaw-forms.github.io/forms/#/auth/gta/callback'
            : `${window.location.origin}/#/auth/gta/callback`;
    });
    const [code, setCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [response, setResponse] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (show) {
            console.info('[OAuth] Initializing OAuth modal');
            
            // Handle OAuth callback
            if (window.location.hash.includes('/auth/gta/callback')) {
                const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
                const codeFromHash = urlParams.get('code');
                const stateFromHash = urlParams.get('state');
                
                // Retrieve stored OAuth state
                const storedOAuthData = JSON.parse(sessionStorage.getItem('oauth-state') || '{}');
                
                console.debug('[OAuth] Validating OAuth state:', {
                    received: stateFromHash,
                    stored: storedOAuthData.state,
                    isValid: stateFromHash === storedOAuthData.state
                });
                
                if (codeFromHash && stateFromHash === storedOAuthData.state) {
                
                    console.debug('[OAuth] Valid OAuth state, restoring session');
                    
                    // Restore the OAuth modal state
                    setClientId(storedOAuthData.clientId || '');
                    setClientSecret(storedOAuthData.clientSecret || '');
                    setRedirectUri(storedOAuthData.redirectUri || redirectUri);
                    setCode(codeFromHash);
                    
                    // Store code for processing
                    sessionStorage.setItem('oauth-exchange-code', codeFromHash);
                    
                    // Clean up
                    sessionStorage.removeItem('oauth-state');
                    
                    // Redirect back to original location
                    window.location.replace(window.location.origin + storedOAuthData.returnPath);
                    return;
                } else {
                    console.error('[OAuth] Invalid or expired OAuth state');
                    setError({
                        error: 'Invalid OAuth State',
                        error_description: 'The OAuth flow was interrupted. Please try again.'
                    });
                }
            }
            
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
        
        // Generate a unique state for this OAuth request
        const oauthState = Math.random().toString(36).substring(2);
        
        // Store OAuth state and modal state
        const oauthData = {
            state: oauthState,
            returnPath: window.location.hash || '#/',
            clientId,
            clientSecret,
            redirectUri,
            timestamp: Date.now(),
            inProgress: true
        };
        
        // Store in sessionStorage
        sessionStorage.setItem('oauth-state', JSON.stringify(oauthData));
        
        console.debug('[OAuth] Stored OAuth state:', { oauthState, returnPath: oauthData.returnPath });
        
        // Include state parameter in OAuth request
        const authUrl = `https://ucp.gta.world/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${oauthState}`;
        window.location.href = authUrl;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        console.info('[OAuth] Starting token exchange submission');
        setIsLoading(true);
        setResponse(null);
        setError(null);

        try {
            // Step 1: Exchange authorization code for an access token
            console.debug('[OAuth] Sending token exchange request to:', tokenUrl);
            const tokenParams = new URLSearchParams();
            tokenParams.append('grant_type', 'authorization_code');
            tokenParams.append('client_id', clientId);
            tokenParams.append('client_secret', clientSecret);
            tokenParams.append('redirect_uri', redirectUri);
            tokenParams.append('code', code);

            const tokenResponse = await fetch(tokenUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: tokenParams,
            });

            const tokenData = await tokenResponse.json();

            if (!tokenResponse.ok) {
                setError(tokenData);
                showNotification(`OAuth Token Exchange failed: ${tokenData.error || tokenResponse.statusText}`, 'error');
                sendAdminActionWebhook(
                    adminUserEmail,
                    'OAuth Token Exchange Failure',
                    `Error: ${JSON.stringify(tokenData, null, 2)}`,
                    'Developer Tools'
                );
                Sentry.captureMessage(`OAuth Token Exchange failed: ${tokenUrl}`, {
                    level: 'error',
                    extra: {
                        redirectUri,
                        response: tokenData,
                        status: tokenResponse.status,
                    }
                });
                return;
            }
            
            const accessToken = tokenData.access_token;
            setResponse(tokenData); // Show token in the modal

            // Step 2: Use the access token to get user data
            const userApiUrl = 'https://ucp.gta.world/api/user';
            console.debug('[OAuth] Fetching user data from:', userApiUrl);
            const userResponse = await fetch(userApiUrl, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            const userData = await userResponse.json();

            if (!userResponse.ok) {
                // Assuming error format is similar or just use message
                const userErrorData = userData || { error: 'Failed to fetch user data', error_description: userResponse.statusText };
                setError(userErrorData);
                showNotification(`Failed to fetch user data: ${userErrorData.error || userResponse.statusText}`, 'error');
                sendAdminActionWebhook(
                    adminUserEmail,
                    'User Data Fetch Failure',
                    `Error: ${JSON.stringify(userErrorData, null, 2)}`,
                    'Developer Tools'
                );
                Sentry.captureMessage(`User Data fetch failed: ${userApiUrl}`, {
                    level: 'error',
                    extra: {
                        response: userErrorData,
                        status: userResponse.status,
                    }
                });
                return;
            }

            console.info('[OAuth] Token exchange and user data fetch successful');
            console.debug('[OAuth] Received user data:', { username: userData.user?.username });

            if (userData.user) {
                onUserDataReceived(userData.user);
                showNotification(`OAuth Token Exchange successful! Welcome ${userData.user.username}`, 'check-circle');
            }
            
            sendAdminActionWebhook(
                adminUserEmail,
                'OAuth Token Exchange Success',
                `Success: Token and user data received for ${userData.user?.username}`,
                'Developer Tools'
            );

        } catch (err) {
            console.error('Network error during OAuth Token Exchange:', err);
            const errorPayload = { error: 'Network Error', error_description: err.message };
            setError(errorPayload);
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
                    tokenUrl,
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