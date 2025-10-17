import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import useGtaWorldAuth from '../../hooks/useGtaWorldAuth';
import * as Sentry from "@sentry/react";

/**
 * Unified GTA World OAuth Callback Component
 * Handles all OAuth callback scenarios including admin login and token exchange
 */
const UnifiedGtaCallback = () => {
    const [status, setStatus] = useState('processing');
    const [error, setError] = useState(null);
    const [message, setMessage] = useState('Processing authentication...');
    
    const location = useLocation();
    const navigate = useNavigate();
    const { login: authLogin } = useAuth();
    const { processCallback, user } = useGtaWorldAuth();

    useEffect(() => {
        const handleCallback = async () => {
            try {
                setStatus('processing');
                setMessage('Processing authentication...');

                // Extract parameters from URL
                const searchParams = new URLSearchParams(location.search);
                const code = searchParams.get('code');
                const state = searchParams.get('state');
                const error = searchParams.get('error');
                const errorDescription = searchParams.get('error_description');

                // Handle OAuth errors
                if (error) {
                    const errorMsg = errorDescription || error;
                    console.error('[Unified Callback] OAuth Error:', error, errorDescription);
                    Sentry.captureMessage('OAuth Authorization Error', {
                        level: 'error',
                        extra: { error, errorDescription }
                    });
                    
                    setStatus('error');
                    setError(errorMsg);
                    setMessage('Authentication failed');
                    return;
                }

                // Handle missing authorization code
                if (!code) {
                    const errorMsg = 'No authorization code received';
                    console.error('[Unified Callback]', errorMsg);
                    Sentry.captureMessage(errorMsg, { level: 'error' });
                    
                    setStatus('error');
                    setError(errorMsg);
                    setMessage('Authentication failed');
                    return;
                }

                console.log('[Unified Callback] Processing OAuth code:', code.substring(0, 10) + '...');

                // Check if this is a token exchange test (for admin OAuth modal)
                const isExchangeInProgress = sessionStorage.getItem('oauth-exchange-in-progress');
                if (isExchangeInProgress) {
                    console.log('[Unified Callback] Token exchange in progress, storing code');
                    sessionStorage.removeItem('oauth-exchange-in-progress');
                    sessionStorage.setItem('oauth-exchange-code', code);
                    
                    setStatus('success');
                    setMessage('Authorization code received. Redirecting...');
                    
                    // Short delay before redirect to show success message
                    setTimeout(() => {
                        navigate('/admin');
                    }, 1500);
                    return;
                }

                // Handle actual authentication flow
                setMessage('Exchanging authorization code...');
                
                try {
                    // Use the unified auth service to process the callback
                    await processCallback(code, state);
                    
                    // If we get here, authentication was successful
                    if (user) {
                        console.log('[Unified Callback] Authentication successful for user:', user.username);
                        
                        // Update the main auth context for admin access
                        authLogin(user);
                        
                        setStatus('success');
                        setMessage(`Welcome, ${user.username}! Redirecting to admin panel...`);
                        
                        // Redirect to admin panel after success
                        setTimeout(() => {
                            navigate('/admin');
                        }, 2000);
                    } else {
                        throw new Error('Authentication succeeded but no user data received');
                    }
                    
                } catch (authError) {
                    console.error('[Unified Callback] Authentication error:', authError);
                    
                    let errorMessage = 'Authentication failed';
                    if (authError.message.includes('invalid-argument')) {
                        errorMessage = 'Invalid request parameters. Please try again.';
                    } else if (authError.message.includes('internal')) {
                        errorMessage = 'Server configuration error. Please contact support.';
                    } else if (authError.message) {
                        errorMessage = authError.message;
                    }
                    
                    setStatus('error');
                    setError(errorMessage);
                    setMessage('Authentication failed');
                }

            } catch (error) {
                console.error('[Unified Callback] Unexpected error:', error);
                Sentry.captureException(error, {
                    extra: { context: 'Unified OAuth Callback Handler' }
                });
                
                setStatus('error');
                setError(error.message || 'An unexpected error occurred');
                setMessage('Authentication failed');
            }
        };

        handleCallback();
    }, [location, navigate, authLogin, processCallback, user]);

    // Render based on current status
    if (status === 'processing') {
        return (
            <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
                <div className="text-center">
                    <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
                        <span className="visually-hidden">Processing...</span>
                    </div>
                    <h4 className="mt-3">GTA World Authentication</h4>
                    <p className="text-muted">{message}</p>
                </div>
            </div>
        );
    }

    if (status === 'success') {
        return (
            <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
                <div className="text-center">
                    <div className="text-success mb-3">
                        <i className="fas fa-check-circle" style={{ fontSize: '4rem' }}></i>
                    </div>
                    <h4 className="text-success">Authentication Successful!</h4>
                    <p className="text-muted">{message}</p>
                    <div className="spinner-border spinner-border-sm text-primary mt-2">
                        <span className="visually-hidden">Redirecting...</span>
                    </div>
                </div>
            </div>
        );
    }

    if (status === 'error') {
        return (
            <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
                <div className="text-center">
                    <div className="alert alert-danger" role="alert" style={{ maxWidth: '500px' }}>
                        <h4 className="alert-heading">
                            <i className="fas fa-exclamation-triangle me-2"></i>
                            Authentication Error
                        </h4>
                        <p className="mb-3">{error}</p>
                        <hr />
                        <div className="d-flex gap-2 justify-content-center">
                            <button 
                                className="btn btn-primary" 
                                onClick={() => navigate('/admin')}
                            >
                                <i className="fas fa-arrow-left me-2"></i>
                                Return to Admin Panel
                            </button>
                            <button 
                                className="btn btn-outline-secondary" 
                                onClick={() => window.location.reload()}
                            >
                                <i className="fas fa-redo me-2"></i>
                                Try Again
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Fallback (should not reach here)
    return (
        <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
            <div className="text-center">
                <h4>Processing...</h4>
                <p>Please wait while we process your authentication.</p>
            </div>
        </div>
    );
};

export default UnifiedGtaCallback;