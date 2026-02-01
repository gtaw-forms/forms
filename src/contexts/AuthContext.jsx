import React, { createContext, useState, useContext, useEffect } from 'react';
import { auth } from '../firebase';
import { getIdTokenResult } from 'firebase/auth';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [claims, setClaims] = useState({});
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
            setIsLoading(true);
            if (firebaseUser) {
                try {
                    const tokenResult = await getIdTokenResult(firebaseUser);
                    console.log('[JWT Migration] Auth state change detected. User:', firebaseUser.uid);
                    console.debug('[JWT Migration] Claims received:', tokenResult.claims);
                    
                    setClaims(tokenResult.claims);
                    setUser(firebaseUser);
                } catch (err) {
                    console.error('[JWT Migration] Failed to fetch token claims:', err);
                    setClaims({});
                    setUser(firebaseUser);
                }
            } else {
                console.log('[JWT Migration] Auth state change: No user');
                setUser(null);
                setClaims({});
            }
            setIsLoading(false);
        });
        return unsubscribe;
    }, []);

    const logout = () => {
        auth.signOut();
        setUser(null);
        setClaims({});
    };

    return (
        <AuthContext.Provider value={{ 
            user, 
            claims, 
            isLoading, 
            logout,
            isPhmcMember: !!claims.isFactionMember || !!user?.email?.endsWith('@gmail.com'), // Gmail users are treated as members
            accessLevel: claims.accessLevel || (user?.email?.endsWith('@gmail.com') ? 'superadmin' : 'none'),
            permissions: claims.permissions || [],
            displayName: user?.displayName || claims.gtawUsername || user?.email || 'Unknown User',
            email: user?.email || (claims.gtawUsername ? `${claims.gtawUsername}@gta.world` : null)
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
