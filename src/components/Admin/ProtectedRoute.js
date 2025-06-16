// src/components/Admin/ProtectedRoute.js
import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { auth } from '../../firebase'; // Adjust path if your firebase.js is elsewhere
import { onAuthStateChanged } from "firebase/auth";

const ProtectedRoute = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                try {
                    // Force refresh to get latest claims.
                    // Custom claims are part of the ID token.
                    await currentUser.getIdToken(true);
                    const idTokenResult = await currentUser.getIdTokenResult();
                    
                    // Check for the admin claim
                    if (idTokenResult.claims.admin === true) {
                        setIsAdmin(true);
                    } else {
                        setIsAdmin(false);
                        console.warn("User is authenticated but not an admin. Claims:", idTokenResult.claims);
                    }
                    setUser(currentUser);
                } catch (error) {
                    console.error("Error fetching token claims:", error);
                    setUser(null); // Treat as unauthenticated on error
                    setIsAdmin(false);
                }
            } else {
                setUser(null);
                setIsAdmin(false);
            }
            setLoading(false);
        });
        return () => unsubscribe(); // Cleanup subscription
    }, []);

    if (loading) {
        return <div>Loading authentication status...</div>; // Or a spinner
    }

    if (!user) { // Not authenticated at all
        return <Navigate to="/admin/login" replace />;
    }

    if (!isAdmin) { // Authenticated but not an admin
        console.log("Redirecting: User authenticated but not an admin.");
        return <Navigate to="/admin/login" state={{ message: "Access Denied: You are not authorized." }} replace />;
    }

    // User is authenticated AND is an admin
    return children;
};

export default ProtectedRoute;
