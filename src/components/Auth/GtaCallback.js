import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getFunctions, httpsCallable } from 'firebase/functions';

const GtaCallback = () => {
    const [error, setError] = useState(null);
    const location = useLocation();
    const navigate = useNavigate();
    const { login } = useAuth();

    useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        const code = searchParams.get('code');

        if (code) {
            const isExchangeInProgress = sessionStorage.getItem('oauth-exchange-in-progress');
            if (isExchangeInProgress) {
                sessionStorage.removeItem('oauth-exchange-in-progress');
                sessionStorage.setItem('oauth-exchange-code', code);
                navigate('/admin');
            } else {
                const functions = getFunctions();
                const exchangeAuthCodeForToken = httpsCallable(functions, 'exchangeAuthCodeForToken');
                exchangeAuthCodeForToken({ code, redirectUri: window.location.origin + '/auth/gta/callback' })
                    .then((result) => {
                        const userData = result.data;
                        login(userData);
                        navigate('/admin');
                    })
                    .catch((error) => {
                        setError(error.message);
                    });
            }
        } else {
            setError('No authorization code found.');
        }
    }, [location, login, navigate]);

    return (
        <div>
            {error ? <p>Error: {error}</p> : <p>Processing...</p>}
        </div>
    );
};

export default GtaCallback;