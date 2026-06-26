import React from 'react';
import useGtaWorldAuth from '../../hooks/useGtaWorldAuth';
import LoginSplash from './LoginSplash';
import phmcLogo from '../../assets/phmc.png';

const isLocalhost = window.location.hostname === 'localhost';

const RequireAuth = ({ children }) => {
    const { isAuthenticated, isLoading } = useGtaWorldAuth();
    const returnPath = window.location.hash.replace('#', '') || '/';

    if (isLocalhost) {
        return children;
    }

    if (isLoading) {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh',
                backgroundColor: '#0d1117',
                color: '#c9d1d9',
                gap: '1.5rem'
            }}>
                <img src={phmcLogo} alt="PHMC Logo" style={{ height: '100px', opacity: 0.6 }} />
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
                <p style={{ fontSize: '0.9rem', opacity: 0.6 }}>Restoring session...</p>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <LoginSplash returnPath={returnPath} />;
    }

    return children;
};

export default RequireAuth;
