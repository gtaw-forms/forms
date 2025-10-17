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

    // Immediate URL logging when component mounts
    useEffect(() => {
        console.log('[Unified Callback] Component mounted - immediate URL analysis:', {
            fullUrl: window.location.href,
            pathname: window.location.pathname,
            search: window.location.search,
            hash: window.location.hash,
            searchParams: Object.fromEntries(new URLSearchParams(window.location.search)),
            hashParams: Object.fromEntries(new URLSearchParams(window.location.hash.split('?')[1] || '')),
            locationSearch: location.search,
            locationHash: location.hash,
            timestamp: new Date().toISOString()
        });
    }, []); // Empty dependency array - runs once on mount

    useEffect(() => {
        const handleCallback = async () => {
            try {
                setStatus('processing');
                setMessage('Processing authentication...');

                // Extract parameters from URL - comprehensive approach
                const searchParams = new URLSearchParams(location.search);
                const hashParams = new URLSearchParams(location.hash.split('?')[1] || '');
                const windowSearchParams = new URLSearchParams(window.location.search);
                const windowHashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
                
                // Get parameters from all possible locations
                const code = searchParams.get('code') || hashParams.get('code') || 
                            windowSearchParams.get('code') || windowHashParams.get('code');
                let state = searchParams.get('state') || hashParams.get('state') || 
                           windowSearchParams.get('state') || windowHashParams.get('state');
                const error = searchParams.get('error') || hashParams.get('error') || 
                             windowSearchParams.get('error') || windowHashParams.get('error');

                // Debug state extraction
                console.log('[Unified Callback] State extraction debug:', {
                    fromSearchParams: searchParams.get('state'),
                    fromHashParams: hashParams.get('state'),
                    fromWindowSearch: windowSearchParams.get('state'),
                    fromWindowHash: windowHashParams.get('state'),
                    finalState: state,
                    stateLength: state?.length
                });

                // Sometimes state gets URL encoded, let's try to decode it
                if (state) {
                    try {
                        const decodedState = decodeURIComponent(state);
                        if (decodedState !== state) {
                            console.log('[Unified Callback] State was URL encoded, using decoded version:', {
                                original: state,
                                decoded: decodedState
                            });
                            state = decodedState;
                        }
                    } catch (e) {
                        console.warn('[Unified Callback] Failed to decode state parameter:', e);
                    }
                }

                console.log('[Unified Callback] URL parameter extraction (comprehensive):', {
                    fullUrl: window.location.href,
                    locationSearch: location.search,
                    locationHash: location.hash,
                    windowSearch: window.location.search,
                    windowHash: window.location.hash,
                    searchParams: Object.fromEntries(searchParams),
                    hashParams: Object.fromEntries(hashParams),
                    windowSearchParams: Object.fromEntries(windowSearchParams),
                    windowHashParams: Object.fromEntries(windowHashParams),
                    extractedCode: code ? `${code.substring(0, 10)}...` : 'NOT_FOUND',
                    extractedState: state ? `${state.substring(0, 10)}...` : 'NOT_FOUND',
                    extractedError: error,
                    codeSource: code ? (searchParams.get('code') ? 'location.search' : 
                                       hashParams.get('code') ? 'location.hash' : 
                                       windowSearchParams.get('code') ? 'window.search' : 'window.hash') : 'none'
                });
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
                        const isGithubPages = window.location.hostname.includes('github.io');
                        const basePath = isGithubPages ? '/forms' : '';
                        navigate(`${basePath}/admin`);
                    }, 1500);
                    return;
                }

                // Handle actual authentication flow
                setMessage('Exchanging authorization code...');
                
                try {
                    // Use the unified auth service to process the callback
                    const authResult = await processCallback(code, state);
                    
                    // Wait a brief moment for state to update
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                    // Log the full authentication result for debugging
                    console.log('[Unified Callback] Full authentication result:', {
                        authResult: authResult,
                        user: user,
                        userType: typeof user,
                        userKeys: user ? Object.keys(user) : 'no user object',
                        authResultType: typeof authResult,
                        authResultKeys: authResult ? Object.keys(authResult) : 'no auth result',
                        timestamp: new Date().toISOString()
                    });
                    
                    // Get user data from authResult or current user state
                    const userData = authResult?.userData || user;
                    
                    // Check if authentication data exists in sessionStorage as backup
                    let fallbackUserData = null;
                    try {
                        const storedUserData = sessionStorage.getItem('gta-user-data');
                        if (storedUserData) {
                            fallbackUserData = JSON.parse(storedUserData);
                            console.log('[Unified Callback] Found fallback user data in sessionStorage:', fallbackUserData);
                        }
                    } catch (e) {
                        console.warn('[Unified Callback] Could not parse stored user data:', e);
                    }
                    
                    const finalUserData = userData || fallbackUserData;
                    
                    // If we get here, authentication was successful
                    if (finalUserData) {
                        console.log('[Unified Callback] Authentication successful, user data:', {
                            hasUser: !!finalUserData,
                            userId: finalUserData.id,
                            username: finalUserData.username || finalUserData.name,
                            source: userData ? 'callback' : 'sessionStorage'
                        });
                        
                        // Update the main auth context for admin access
                        authLogin(finalUserData);
                        
                        setStatus('success');
                        const displayName = finalUserData.username || finalUserData.name || finalUserData.id || 'User';
                        setMessage(`Welcome, ${displayName}! Redirecting to admin panel...`);
                        
                        // Redirect to admin panel after success
                        setTimeout(() => {
                            // Get the correct base path for GitHub Pages
                            const isGithubPages = window.location.hostname.includes('github.io');
                            const basePath = isGithubPages ? '/forms' : '';
                            navigate(`${basePath}/admin`);
                        }, 2000);
                    } else {
                        console.warn('[Unified Callback] No user data available, forcing reload');
                        setStatus('success');
                        setMessage('Authentication successful! Reloading page...');
                        
                        // Force page reload to ensure authentication state is loaded
                        setTimeout(() => {
                            const isGithubPages = window.location.hostname.includes('github.io');
                            const basePath = isGithubPages ? '/forms' : '';
                            window.location.href = window.location.origin + `${basePath}/#/admin`;
                        }, 1500);
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