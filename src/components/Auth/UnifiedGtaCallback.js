import React, { useEffect, useState, useRef } from 'react';
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
    const [isProcessing, setIsProcessing] = useState(false);
    
    // Process tracking
    const processId = useRef(Date.now() + '-' + Math.random().toString(36).substr(2, 9));
    const componentMountTime = useRef(Date.now());
    const firebaseCalls = useRef([]);
    const processingStarted = useRef(false);
    const duplicateCallCount = useRef(0);
    
    const location = useLocation();
    const navigate = useNavigate();
    const { login: authLogin } = useAuth();
    const { processCallback, user } = useGtaWorldAuth();
    
    // Track Firebase Functions calls
    const trackFirebaseCall = (functionName, params, result, error, duration) => {
        const callInfo = {
            timestamp: Date.now(),
            processId: processId.current,
            functionName,
            params: typeof params === 'object' ? JSON.stringify(params) : String(params || 'none'),
            success: !error,
            error: error?.message || error,
            duration: duration || 0,
            timeSinceMount: Date.now() - componentMountTime.current,
            callIndex: firebaseCalls.current.length
        };
        firebaseCalls.current.push(callInfo);
        console.log(`🔥 Firebase Call [${processId.current}][${callInfo.callIndex}]:`, callInfo);
        
        // Check for suspicious patterns
        if (firebaseCalls.current.length > 1) {
            const recentCalls = firebaseCalls.current.slice(-2);
            const [prev, current] = recentCalls;
            if (prev.functionName === current.functionName && current.timestamp - prev.timestamp < 100) {
                console.warn(`⚠️ Potential duplicate Firebase call detected [${processId.current}]:`, {
                    function: functionName,
                    timeBetween: current.timestamp - prev.timestamp,
                    previousCall: prev,
                    currentCall: current
                });
            }
        }
    };

    // Immediate URL logging when component mounts
    useEffect(() => {
        console.log(`🚀 [Unified Callback] Component mounted [${processId.current}] - immediate URL analysis:`, {
            processId: processId.current,
            mountTime: componentMountTime.current,
            fullUrl: window.location.href,
            pathname: window.location.pathname,
            search: window.location.search,
            hash: window.location.hash,
            searchParams: Object.fromEntries(new URLSearchParams(window.location.search)),
            hashParams: Object.fromEntries(new URLSearchParams(window.location.hash.split('?')[1] || '')),
            locationSearch: location.search,
            locationHash: location.hash,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent.slice(0, 100)
        });
    }, []); // Empty dependency array - runs once on mount\n\n    useEffect(() => {

    useEffect(() => {
        const handleCallback = async () => {
            const currentProcessId = processId.current;
            const callTime = Date.now();
            
            // Check for interrupted process from previous component instance
            const interruptedProcess = sessionStorage.getItem('oauth-callback-interrupted');
            if (interruptedProcess) {
                const interrupted = JSON.parse(interruptedProcess);
                console.log(`🔄 [Unified Callback] Detected interrupted process [${currentProcessId}]:`, {
                    previousProcessId: interrupted.processId,
                    timeSinceInterruption: callTime - interrupted.timestamp,
                    wasProcessing: interrupted.wasProcessing,
                    previousFirebaseCalls: interrupted.firebaseCalls
                });
                sessionStorage.removeItem('oauth-callback-interrupted');
                
                // If interruption was recent (< 5 seconds), delay new processing
                if (callTime - interrupted.timestamp < 5000) {
                    console.log(`⏳ [Unified Callback] Delaying processing due to recent interruption [${currentProcessId}]`);
                    setTimeout(() => {
                        if (!processingStarted.current && !isProcessing) {
                            console.log(`🔄 [Unified Callback] Resuming after interruption delay [${currentProcessId}]`);
                            // Re-trigger the effect after delay
                            setIsProcessing(false); // Force re-render to trigger effect
                        }
                    }, 1000);
                    return;
                }
            }
            
            console.log(`🔄 [Unified Callback] Effect triggered [${currentProcessId}]:`, {
                processId: currentProcessId,
                isProcessing,
                processingStarted: processingStarted.current,
                duplicateCallCount: duplicateCallCount.current,
                timeSinceMount: callTime - componentMountTime.current,
                firebaseCallCount: firebaseCalls.current.length,
                locationTrigger: {
                    search: location.search,
                    hash: location.hash,
                    pathname: location.pathname
                },
                hadInterruptedProcess: !!interruptedProcess
            });
            
            // Prevent multiple simultaneous processing
            if (isProcessing || processingStarted.current) {
                duplicateCallCount.current++;
                console.warn(`⚠️ [Unified Callback] Duplicate processing attempt [${currentProcessId}]:`, {
                    duplicateCount: duplicateCallCount.current,
                    isProcessing,
                    processingStarted: processingStarted.current,
                    timeSinceMount: callTime - componentMountTime.current,
                    firebaseCallHistory: firebaseCalls.current
                });
                return;
            }
            
            processingStarted.current = true;
            setIsProcessing(true);
            
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
                        const targetUrl = window.location.origin + `${basePath}/#/admin`;
                        window.location.href = targetUrl;
                    }, 800);
                    return;
                }

                // Handle actual authentication flow
                setMessage('Handshaking with GTA World...');
                
                let callbackStartTime = Date.now(); // Define at broader scope
                
                try {
                    // Use the unified auth service to process the callback
                    callbackStartTime = Date.now();
                    console.log(`🔗 [Unified Callback] Calling processCallback [${currentProcessId}]:`, {
                        codeLength: code?.length,
                        stateLength: state?.length,
                        timestamp: callbackStartTime
                    });
                    
                    const authResult = await processCallback(code, state);
                    const callbackDuration = Date.now() - callbackStartTime;
                    
                    trackFirebaseCall('processCallback', 
                        { code: code ? 'present' : 'missing', state: state ? 'present' : 'missing' }, 
                        authResult, 
                        null, 
                        callbackDuration
                    );
                    
                    console.log(`✅ [Unified Callback] processCallback completed [${currentProcessId}]:`, {
                        duration: callbackDuration,
                        hasResult: !!authResult,
                        resultKeys: authResult ? Object.keys(authResult) : 'none'
                    });
                    
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
                        
                        // Get the returnPath from stored OAuth data
                        let targetPath = '#/admin'; // Default fallback
                        try {
                            const storedOAuthData = sessionStorage.getItem('gta-oauth-state');
                            if (storedOAuthData) {
                                const oauthData = JSON.parse(storedOAuthData);
                                targetPath = oauthData.returnPath || '#/admin';
                                console.log('🎯 [Unified Callback] Using stored returnPath:', targetPath);
                            }
                        } catch (e) {
                            console.warn('⚠️ [Unified Callback] Could not retrieve returnPath from OAuth state:', e);
                        }
                        
                        // Determine redirect message based on target
                        const isHomepage = targetPath === '#/' || targetPath === '#';
                        const redirectMessage = isHomepage ? 'homepage' : 'admin panel';
                        setMessage(`Welcome, ${displayName}! Redirecting to ${redirectMessage}...`);
                        
                        // Prepare navigation URL
                        const isGithubPages = window.location.hostname.includes('github.io');
                        const basePath = isGithubPages ? '/forms' : '';
                        const targetUrl = window.location.origin + `${basePath}/${targetPath}`;
                        
                        console.log(`🧭 [Unified Callback] Preparing navigation to ${redirectMessage} [${currentProcessId}]...`);
                        console.log(`🎯 [Unified Callback] Target navigation URL [${currentProcessId}]:`, targetUrl);
                        
                        // Clear OAuth state before navigation to prevent remount issues
                        sessionStorage.removeItem('gta-oauth-state');
                        
                        // Store navigation intent as backup in case component unmounts
                        sessionStorage.setItem('gta-pending-navigation', targetUrl);
                        
                        // Use window.location.href for more reliable navigation that won't be interrupted by component unmounting
                        setTimeout(() => {
                            console.log(`🚀 [Unified Callback] Executing navigation [${currentProcessId}]...`);
                            sessionStorage.removeItem('gta-pending-navigation'); // Clear backup
                            window.location.href = targetUrl;
                        }, 800); // Optimal timeout to show success message but prevent race conditions
                    } else {
                        console.warn('[Unified Callback] No user data available, forcing reload');
                        setStatus('success');
                        setMessage('Authentication successful! Reloading page...');
                        
                        // Force page reload to ensure authentication state is loaded
                        setTimeout(() => {
                            console.log('[Unified Callback] Using fallback navigation...');
                            
                            // Try to get returnPath from stored OAuth data for fallback too
                            let targetPath = '#/admin'; // Default fallback
                            try {
                                const storedOAuthData = sessionStorage.getItem('gta-oauth-state');
                                if (storedOAuthData) {
                                    const oauthData = JSON.parse(storedOAuthData);
                                    targetPath = oauthData.returnPath || '#/admin';
                                }
                            } catch (e) {
                                console.warn('⚠️ [Unified Callback] Fallback: Could not retrieve returnPath:', e);
                            }
                            
                            const isGithubPages = window.location.hostname.includes('github.io');
                            const basePath = isGithubPages ? '/forms' : '';
                            const targetUrl = window.location.origin + `${basePath}/${targetPath}`;
                            console.log('[Unified Callback] Fallback target URL:', targetUrl);
                            window.location.href = targetUrl;
                        }, 800); // Consistent timeout with main navigation
                    }
                    
                } catch (authError) {
                    const authErrorTime = Date.now();
                    const authErrorDuration = authErrorTime - (callbackStartTime || callTime);
                    
                    console.error(`❌ [Unified Callback] Authentication error [${currentProcessId}]:`, {
                        error: authError.message,
                        duration: authErrorDuration,
                        errorType: authError.name,
                        firebaseCallsAtError: firebaseCalls.current.length
                    });
                    
                    trackFirebaseCall('processCallback_error', 
                        { code: 'present', state: state ? 'present' : 'missing' }, 
                        null, 
                        authError, 
                        authErrorDuration
                    );
                    
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
                const errorTime = Date.now();
                const processingDuration = errorTime - callTime;
                
                console.error(`❌ [Unified Callback] Unexpected error [${currentProcessId}]:`, {
                    error: error.message,
                    stack: error.stack,
                    processingDuration,
                    firebaseCallHistory: firebaseCalls.current,
                    duplicateAttempts: duplicateCallCount.current
                });
                
                trackFirebaseCall('callback_error', 
                    { error: error.message }, 
                    null, 
                    error, 
                    processingDuration
                );
                
                Sentry.captureException(error, {
                    tags: {
                        processId: currentProcessId,
                        component: 'UnifiedGtaCallback'
                    },
                    extra: { 
                        context: 'Unified OAuth Callback Handler',
                        firebaseCallHistory: firebaseCalls.current,
                        processingDuration,
                        duplicateAttempts: duplicateCallCount.current
                    }
                });
                
                setStatus('error');
                setError(error.message || 'An unexpected error occurred');
                setMessage('Authentication failed');
            } finally {
                const endTime = Date.now();
                const totalDuration = endTime - callTime;
                
                console.log(`🏁 [Unified Callback] Process completed [${currentProcessId}]:`, {
                    totalDuration,
                    firebaseCallCount: firebaseCalls.current.length,
                    duplicateAttempts: duplicateCallCount.current,
                    callHistory: firebaseCalls.current,
                    finalStatus: status,
                    hasError: !!error
                });
                
                setIsProcessing(false);
                processingStarted.current = false;
            }
        };

        handleCallback();
    }, [location.search, location.hash, navigate, authLogin, processCallback, user]); // Removed isProcessing to prevent loops

    // Component unmount tracking with process preservation
    useEffect(() => {
        return () => {
            const unmountTime = Date.now();
            console.log(`🗑️ [Unified Callback] Component unmounting [${processId.current}]:`, {
                processId: processId.current,
                wasProcessing: isProcessing,
                firebaseCallCount: firebaseCalls.current.length,
                duplicateAttempts: duplicateCallCount.current,
                totalLifetime: unmountTime - componentMountTime.current,
                finalCallHistory: firebaseCalls.current
            });
            
            // If component is unmounting while processing, mark it as interrupted
            if (isProcessing || processingStarted.current) {
                console.warn(`⚠️ [Unified Callback] Process interrupted by unmount [${processId.current}]`);
                sessionStorage.setItem('oauth-callback-interrupted', JSON.stringify({
                    processId: processId.current,
                    timestamp: unmountTime,
                    wasProcessing: isProcessing,
                    firebaseCalls: firebaseCalls.current.length
                }));
                
                // Check for pending navigation and execute it as backup
                const pendingNavigation = sessionStorage.getItem('gta-pending-navigation');
                if (pendingNavigation && status === 'success') {
                    console.log(`🔄 [Unified Callback] Executing backup navigation on unmount [${processId.current}]:`, pendingNavigation);
                    sessionStorage.removeItem('gta-pending-navigation');
                    // Use setTimeout to ensure unmount completes first
                    setTimeout(() => {
                        window.location.href = pendingNavigation;
                    }, 100);
                }
            }
        };
    }, [isProcessing]);

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