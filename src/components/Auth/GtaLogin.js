import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';

const GtaLogin = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const { user } = useAuth();

    useEffect(() => {
        if (user) {
            navigate('/admin');
        }
    }, [user, navigate]);

    const handleLogin = (e) => {
        e.preventDefault();
        setError('');
        signInWithEmailAndPassword(auth, email, password)
            .catch((error) => {
                setError(error.message);
            });
    };

    const handleGtaWorldLogin = () => {
        // Replace with your actual client ID and callback URL
        const clientId = process.env.REACT_APP_GTAWORLD_CLIENT_ID || 'YOUR_CLIENT_ID';
        const redirectUri = encodeURIComponent(window.location.origin + '/#/auth/gta/callback');
        const authUrl = `https://ucp.gta.world/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}`;
        window.location.href = authUrl;
    };

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
                    <button type="button" onClick={handleGtaWorldLogin} style={{ flex: 1, padding: '10px', backgroundColor: '#ff8c00', color: 'white', border: 'none' }}>Login with GTA World OAuth</button>
                </div>
                <button type="button" onClick={() => navigate('/')} style={{ width: '100%', padding: '10px', backgroundColor: '#6c757d', color: 'white', border: 'none', marginTop: '10px' }}>Home</button>
            </form>
        </div>
    );
};

export default GtaLogin;
