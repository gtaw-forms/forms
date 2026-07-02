import React, { useState } from 'react';
import GtaWorldLoginButton from './GtaWorldLoginButton';
import useGtaWorldAuth from '../../hooks/useGtaWorldAuth';
import phmcLogo from '../../assets/phmc.png';

const LoginSplash = ({ title, message, returnPath }) => {
    const { isLoading } = useGtaWorldAuth();
    const [loginRole, setLoginRole] = useState('employee');

    // Re-evaluates on each render so it catches session data stored by OAuth callback
    const hasStoredSession = !!(
        localStorage.getItem('gta-user-data') ||
        sessionStorage.getItem('gta-user-data')
    );

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
                <p style={{ fontSize: '0.9rem', opacity: 0.6 }}>Restoring session.....</p>
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

            <div style={{ marginBottom: '1.5rem' }}>
                <div style={{
                    display: 'flex',
                    borderRadius: 8,
                    overflow: 'hidden',
                    border: '1px solid #ff8c00',
                }}>
                    <button type="button"
                        onClick={() => setLoginRole('employee')}
                        style={{
                            padding: '10px 24px',
                            border: 'none',
                            cursor: 'pointer',
                            backgroundColor: loginRole === 'employee' ? '#ff8c00' : 'transparent',
                            color: loginRole === 'employee' ? '#fff' : '#ff8c00',
                            fontWeight: 600,
                            fontSize: '0.9rem',
                            transition: 'all 0.2s',
                        }}>
                        <i className="fas fa-user-md"></i> PHMC Employee
                    </button>
                    <button type="button"
                        onClick={() => setLoginRole('non-employee')}
                        style={{
                            padding: '10px 24px',
                            border: 'none',
                            cursor: 'pointer',
                            borderLeft: '1px solid #ff8c00',
                            backgroundColor: loginRole === 'non-employee' ? '#ff8c00' : 'transparent',
                            color: loginRole === 'non-employee' ? '#fff' : '#ff8c00',
                            fontWeight: 600,
                            fontSize: '0.9rem',
                            transition: 'all 0.2s',
                        }}>
                        <i className="fas fa-user"></i> Non Employee
                    </button>
                </div>
                <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '6px' }}>
                    {loginRole === 'employee'
                        ? 'Verifies PHMC faction membership — grants full access.'
                        : 'Skips faction check — faster login, limited functionality.'}
                </p>
            </div>

            <GtaWorldLoginButton variant="primary" size="lg" returnPath={returnPath} role={loginRole} />
        </div>
    );
};

export default LoginSplash;
