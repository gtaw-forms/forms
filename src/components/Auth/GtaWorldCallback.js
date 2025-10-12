import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Sentry from "@sentry/react";

const GtaWorldCallback = () => {
    const navigate = useNavigate();

    useEffect(() => {
        const handleCallback = () => {
            try {
                // Get the authorization code from URL parameters
                const urlParams = new URLSearchParams(window.location.search);
                const code = urlParams.get('code');
                const error = urlParams.get('error');
                const error_description = urlParams.get('error_description');

                if (error) {
                    console.error('OAuth Error:', error, error_description);
                    Sentry.captureMessage('OAuth Authorization Error', {
                        level: 'error',
                        extra: { error, error_description }
                    });
                    sessionStorage.removeItem('oauth-exchange-in-progress');
                    navigate('/admin?error=' + encodeURIComponent(error_description || error));
                    return;
                }

                if (!code) {
                    console.error('No authorization code received');
                    Sentry.captureMessage('No OAuth code received', { level: 'error' });
                    sessionStorage.removeItem('oauth-exchange-in-progress');
                    navigate('/admin?error=No authorization code received');
                    return;
                }

                // Store the code in sessionStorage for the exchange modal
                sessionStorage.setItem('oauth-exchange-code', code);
                
                // Navigate back to admin panel
                navigate('/admin');
            } catch (err) {
                console.error('Error processing OAuth callback:', err);
                Sentry.captureException(err);
                sessionStorage.removeItem('oauth-exchange-in-progress');
                navigate('/admin?error=' + encodeURIComponent(err.message));
            }
        };

        handleCallback();
    }, [navigate]);

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

export default GtaWorldCallback;