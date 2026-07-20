import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import useGtaWorldAuth from '../../hooks/useGtaWorldAuth';

const isLocalhost = window.location.hostname === 'localhost';

const ProtectedRoute = ({ children }) => {
    const { user } = useAuth(); // Firebase authentication
    const { isAuthenticated: isGtaAuthenticated } = useGtaWorldAuth(); // GTA World authentication

    // Allow localhost dev access without auth
    if (isLocalhost) {
        return children;
    }

    // Allow access if user is authenticated via either Firebase or GTA World OAuth
    if (!user && !isGtaAuthenticated) {
        return <Navigate to="/login" />;
    }

    return children;
};

export default ProtectedRoute;
