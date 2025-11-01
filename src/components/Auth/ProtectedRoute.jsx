import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import useGtaWorldAuth from '../../hooks/useGtaWorldAuth';

const ProtectedRoute = ({ children }) => {
    const { user } = useAuth(); // Firebase authentication
    const { isAuthenticated: isGtaAuthenticated } = useGtaWorldAuth(); // GTA World authentication

    // Allow access if user is authenticated via either Firebase or GTA World OAuth
    if (!user && !isGtaAuthenticated) {
        return <Navigate to="/login" />;
    }

    return children;
};

export default ProtectedRoute;
