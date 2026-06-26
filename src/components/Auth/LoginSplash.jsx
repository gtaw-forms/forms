import React from 'react';
import GtaWorldLoginButton from './GtaWorldLoginButton';
import useGtaWorldAuth from '../../hooks/useGtaWorldAuth';
import phmcLogo from '../../assets/phmc.png';

const hasStoredSession = !!(
    localStorage.getItem('gta-user-data') ||
    sessionStorage.getItem('gta-user-data')
);

const LoginSplash = ({ title, message, returnPath }) => {
    const { isLoading } = useGtaWorldAuth();

    if (isLoading && hasStoredSession) {
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

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            backgroundColor: '#0d1117',
            color: '#c9d1d9',
            padding: '2rem',
            textAlign: 'center'
        }}>
            <img src={phmcLogo} alt="PHMC Logo" style={{ height: '120px', marginBottom: '1.5rem', opacity: 0.8 }} />
            <h3 style={{ color: '#880a03ff', fontWeight: 'bold', marginBottom: '1rem' }}>
                {title || 'Authentication Required'}
            </h3>
            <p style={{ fontSize: '1.1rem', marginBottom: '2rem', maxWidth: '500px' }}>
                {message || 'Users must login to access this app.'}
            </p>
            <GtaWorldLoginButton variant="primary" size="lg" returnPath={returnPath} />
        </div>
    );
};

export default LoginSplash;
