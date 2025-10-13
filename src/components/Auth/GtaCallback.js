import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import * as Sentry from "@sentry/react";

const GtaCallback = () => {
    const [error, setError] = useState(null);
    const [isProcessing, setIsProcessing] = useState(true);
    const location = useLocation();
    const navigate = useNavigate();
    const { login } = useAuth();

    useEffect(() => {
        const handleCallback = async () => {
            try {
                const searchParams = new URLSearchParams(location.search);
                const code = searchParams.get('code');
                const error = searchParams.get('error');
                const error_description = searchParams.get('error_description');

                // Handle OAuth errors
                if (error) {
                    const errorMsg = error_description || error;
                    console.error('OAuth Error:', error, error_description);
                    Sentry.captureMessage('OAuth Authorization Error', {
                        level: 'error',
                        extra: { error, error_description }
                    });
                    setError(errorMsg);
                    setIsProcessing(false);
                    return;
                }

                // Handle missing code
                if (!code) {
                    const errorMsg = 'No authorization code received';
                    console.error(errorMsg);
                    Sentry.captureMessage(errorMsg, { level: 'error' });
                    setError(errorMsg);
                    setIsProcessing(false);
                    return;
                }

                // Check if this is a token exchange test
                const isExchangeInProgress = sessionStorage.getItem('oauth-exchange-in-progress');
                if (isExchangeInProgress) {
                    sessionStorage.removeItem('oauth-exchange-in-progress');
                    sessionStorage.setItem('oauth-exchange-code', code);
                    navigate('/admin');
                    return;
                }

                // Handle actual authentication
                try {
                    const clientId = process.env.REACT_APP_GTAWORLD_CLIENT_ID;
                    const clientSecret = process.env.REACT_APP_GTAWORLD_CLIENT_SECRET;
                    const tokenUrl = 'https://ucp.gta.world/oauth/token';
                    const redirectUri = window.location.origin + '/auth/gta/callback';

                    if (!clientId || !clientSecret) {
                        throw new Error("Client ID or Client Secret is not configured in your environment variables.");
                    }

                    // Step 1: Exchange authorization code for an access token
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
                        throw new Error(tokenData.message || 'Failed to fetch access token');
                    }
                    
                    const accessToken = tokenData.access_token;

                    // Step 2: Use the access token to get user data
                    const userApiUrl = 'https://ucp.gta.world/api/user';
                    const userResponse = await fetch(userApiUrl, {
                        headers: {
                            'Authorization': `Bearer ${accessToken}`
                        }
                    });

                    const userDataResponse = await userResponse.json();

                    if (!userResponse.ok) {
                        throw new Error(userDataResponse.message || 'Failed to fetch user data');
                    }
                    
                    if (userDataResponse) {
                        await login(userDataResponse);
                        navigate('/admin');
                    } else {
                        throw new Error('No user data received from token exchange');
                    }

                } catch (error) {
                    console.error('Token exchange error:', error);
                    Sentry.captureException(error, {
                        extra: { context: 'OAuth Token Exchange' }
                    });
                    setError(error.message || 'Authentication failed');
                    setIsProcessing(false);
                }
            } catch (error) {
                console.error('OAuth callback error:', error);
                Sentry.captureException(error, {
                    extra: { context: 'OAuth Callback Handler' }
                });
                setError(error.message || 'An unexpected error occurred');
                setIsProcessing(false);
            }
        };

        handleCallback();
    }, [location, login, navigate]);

    if (error) {
        return (
            <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
                <div className="text-center">
                    <div className="alert alert-danger" role="alert">
                        <h4 className="alert-heading">Authentication Error</h4>
                        <p>{error}</p>
                        <hr />
                        <button 
                            className="btn btn-primary" 
                            onClick={() => navigate('/admin')}
                        >
                            Return to Admin Panel
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
            <div className="text-center">
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Processing authentication...</span>
                </div>
                <p className="mt-3">Processing authentication, please wait...</p>
            </div>
        </div>
    );
};

export default GtaCallback;