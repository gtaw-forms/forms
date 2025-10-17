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
    const navigate = useNavigate();
    const { user } = useAuth(); // Firebase authentication
    const { isAuthenticated: isGtaAuthenticated, user: gtaUser, isLoading: isGtaLoading } = useGtaWorldAuth(); // GTA World authentication

    useEffect(() => {
        // Check for both Firebase and GTA World authentication
        if (user) {
            console.log('[GtaLogin] Firebase user authenticated, redirecting to admin:', user.email);
            navigate('/admin');
        } else if (isGtaAuthenticated && gtaUser) {
            console.log('[GtaLogin] GTA World user authenticated, redirecting to admin:', {
                username: gtaUser.username,
                characterId: gtaUser.id
            });
            navigate('/admin');
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
                        returnPath="/admin"
                        style={{ flex: 1, padding: '10px', backgroundColor: '#ff8c00', color: 'white', border: 'none' }}
                        onError={(error) => setError(`GTA World Login Error: ${error}`)}
                        onInitiate={() => setError('')}
                        onSuccess={(userData) => {
                            console.log('[GtaLogin] GTA World login successful:', userData);
                            navigate('/admin');
                        }}
                    >
                        Login with GTA World OAuth
                    </GtaWorldLoginButton>
                </div>
                <button type="button" onClick={() => navigate('/')} style={{ width: '100%', padding: '10px', backgroundColor: '#6c757d', color: 'white', border: 'none', marginTop: '10px' }}>Home</button>
            </form>
        </div>
    );
};

export default GtaLogin;
