import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import GtaWorldLoginButton from './GtaWorldLoginButton';
import useGtaWorldAuth from '../../hooks/useGtaWorldAuth';

const GtaLogin = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loginRole, setLoginRole] = useState('employee');
    const navigate = useNavigate();
    const { user } = useAuth();
    const { isAuthenticated: isGtaAuthenticated, user: gtaUser, isLoading: isGtaLoading, sessionLostReason } = useGtaWorldAuth();

    useEffect(() => {
        if (sessionLostReason) {
            setError(sessionLostReason);
        }
    }, [sessionLostReason]);

    useEffect(() => {
        // Check for both Firebase and GTA World authentication
        if (user) {
            console.log('[GtaLogin] Firebase user authenticated, redirecting to admin:', user.email);
            navigate('/forms');
        } else if (isGtaAuthenticated && gtaUser) {
            console.log('[GtaLogin] GTA World user authenticated, redirecting to home:', {
                username: gtaUser.username,
                characterId: gtaUser.id
            });
            navigate('/forms');
        }
    }, [user, isGtaAuthenticated, gtaUser, navigate]);

    // Show loading while checking authentication state
    if (isGtaLoading) {
        return (
            <div style={{ maxWidth: '400px', margin: 'auto', paddingTop: '50px', textAlign: 'center' }}>
                <div style={{ padding: '20px' }}>
                    <div className="spinner-border" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                    <p style={{ marginTop: '10px' }}>Checking authentication...</p>
                </div>
            </div>
        );
    }

    const handleLogin = (e) => {
        e.preventDefault();
        setError('');
        signInWithEmailAndPassword(auth, email, password)
            .catch((error) => {
                setError(error.message);
            });
    };

    // GTA World login is now handled by the unified authentication service

    return (
        <div style={{ maxWidth: '400px', margin: 'auto', paddingTop: '50px' }}>
            <form onSubmit={handleLogin}>
                <button type="button" onClick={() => navigate('/')} style={{ width: '25%', padding: '10px', backgroundColor: '#6c757d', color: 'white', border: 'pink', marginTop: '10px' }}>Home</button>
                <h2>Login</h2>
                {error && <p style={{ color: 'red' }}>{error}</p>}
                <div style={{ marginBottom: '10px' }}>
                    <label>Email</label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        style={{ width: '100%', padding: '8px' }}
                    />
                </div>
                <div style={{ marginBottom: '10px' }}>
                    <label>Password</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        style={{ width: '100%', padding: '8px' }}
                    />
                </div>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                    <button type="submit" style={{ flex: 1, padding: '10px', backgroundColor: 'blue', color: 'white', border: 'none' }}>Login</button>
                    <GtaWorldLoginButton 
                        returnPath="/"
                        role={loginRole}
                        style={{ flex: 1, padding: '10px', backgroundColor: '#ff8c00', color: 'white', border: 'none' }}
                        onError={(error) => setError(`GTA World Login Error: ${error}`)}
                        onInitiate={() => setError('')}
                        onSuccess={(userData) => {
                            console.log('[GtaLogin] GTA World login successful:', userData);
                            navigate('/');
                        }}
                    >
                        Login with GTA World OAuth
                    </GtaWorldLoginButton>
                </div>

                {/* Role selector for GTA World login */}
                <div style={{ display: 'flex', gap: 0, marginBottom: '10px', borderRadius: 6, overflow: 'hidden', border: '1px solid #ff8c00' }}>
                    <button type="button"
                        onClick={() => setLoginRole('employee')}
                        style={{
                            flex: 1, padding: '8px', border: 'none', cursor: 'pointer',
                            backgroundColor: loginRole === 'employee' ? '#ff8c00' : 'transparent',
                            color: loginRole === 'employee' ? '#fff' : '#ff8c00',
                            fontWeight: 600, fontSize: '0.85rem',
                        }}>
                        <i className="fas fa-user-md"></i> PHMC Employee
                    </button>
                    <button type="button"
                        onClick={() => setLoginRole('non-employee')}
                        style={{
                            flex: 1, padding: '8px', border: 'none', cursor: 'pointer', borderLeft: '1px solid #ff8c00',
                            backgroundColor: loginRole === 'non-employee' ? '#ff8c00' : 'transparent',
                            color: loginRole === 'non-employee' ? '#fff' : '#ff8c00',
                            fontWeight: 600, fontSize: '0.85rem',
                        }}>
                        <i className="fas fa-user"></i> Non Employee
                    </button>
                </div>
                <button type="button" onClick={() => navigate('/')} style={{ width: '100%', padding: '10px', backgroundColor: '#6c757d', color: 'white', border: 'none', marginTop: '10px' }}>Home</button>
            </form>
        </div>
    );
};

export default GtaLogin;
