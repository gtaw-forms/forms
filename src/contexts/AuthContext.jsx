import React, { createContext, useState, useContext, useEffect } from 'react';
import { auth } from '../firebase';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(user => {
            if (user) {
                setUser(user);
                // Clear any lingering session storage from the old system
                sessionStorage.removeItem('user');
            } else {
                // If Firebase has no user, check session storage as a fallback
                try {
                    const storedUser = sessionStorage.getItem('user');
                    if (storedUser) {
                        setUser(JSON.parse(storedUser));
                    }
                } catch (error) {
                    console.error("Failed to parse user from session storage:", error);
                    sessionStorage.removeItem('user'); // Clear corrupted data
                }
            }
        });
        return unsubscribe;
    }, []);

    const login = (userData) => {
        // For non-Firebase login methods
        setUser(userData);
        sessionStorage.setItem('user', JSON.stringify(userData));
    };

    const logout = () => {
        auth.signOut(); // For Firebase logout
        setUser(null); // For both
        sessionStorage.removeItem('user'); // For non-Firebase logout
    };

    return (
        <AuthContext.Provider value={{ user, setUser, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
