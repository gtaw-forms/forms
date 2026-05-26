import React, { useEffect } from 'react';
import { Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import phmcLogo from '../../assets/phmc.png';

/**
 * Reusable loading indicator for GTA World Auth processes.
 * Can be used in both the full-page callback and the sidebar.
 */
export const GtaAuthLoading = ({ isMini = false }) => {
    if (isMini) {
        return (
            <div style={{ padding: '1.5rem', background: '#0f172a', borderRadius: '12px', textAlign: 'center', border: '1px solid #334155' }}>
                <div className="spinner-border text-primary mb-3" role="status" style={{ width: '2rem', height: '2rem' }}>
                    <span className="visually-hidden">Loading...</span>
                </div>
                <h5 style={{ color: '#f8fafc', fontWeight: 600 }}>One moment...</h5>
                <p style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Finalizing your secure session</p>
            </div>
        );
    }

    return (
        <div className="d-flex flex-column justify-content-center align-items-center" style={{ height: '100vh', backgroundColor: '#0d1117', color: 'white' }}>
            <img src={phmcLogo} alt="PHMC Logo" className="mb-4" style={{ maxWidth: '100px' }} />
            <Spinner animation="border" variant="primary" className="mb-3" />
            <h4 style={{ fontWeight: 600 }}>Finalizing Authentication</h4>
            <p className="text-muted">One moment while we secure your session...</p>
        </div>
    );
};

const GtaCallback = () => {
    const navigate = useNavigate();

    useEffect(() => {
        // Stealth redirect: Immediately move to the user's original page.
        // The GtaWorldAuthProvider at the root level will continue processing 
        // the auth params in the background while the user sees the main app.
        const storedData = JSON.parse(sessionStorage.getItem('gta-oauth-state') || '{}');
        const returnPath = storedData.returnPath || '/';
        const destination = returnPath.startsWith('#') ? returnPath.slice(1) : returnPath;
        navigate(destination || '/', { replace: true });
    }, [navigate]);

    // Show the full loader for the split second before the navigate takes effect
    return <GtaAuthLoading />;
};

export default GtaCallback;
