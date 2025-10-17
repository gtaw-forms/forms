import React from 'react';
import { Button } from 'react-bootstrap';
import useGtaWorldAuth from '../../hooks/useGtaWorldAuth';

/**
 * Unified GTA World Login Component
 * Simple component that can be used anywhere to initiate GTA World login
 */
const GtaWorldLoginButton = ({ 
    variant = "primary", 
    size = "md", 
    className = "", 
    children,
    returnPath,
    onError,
    onInitiate,
    disabled = false,
    ...props 
}) => {
    const { login, isLoading, error } = useGtaWorldAuth();

    const handleLogin = () => {
        if (onInitiate) {
            onInitiate();
        }

        login({
            returnPath,
            onError: (errorMessage) => {
                console.error('[GTA Login Button] Login error:', errorMessage);
                if (onError) {
                    onError(errorMessage);
                }
            }
        });
    };

    return (
        <Button
            variant={variant}
            size={size}
            className={className}
            onClick={handleLogin}
            disabled={disabled || isLoading}
            {...props}
        >
            {isLoading ? (
                <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Connecting...
                </>
            ) : (
                children || (
                    <>
                        <i className="fas fa-sign-in-alt me-2"></i>
                        Login with GTA World
                    </>
                )
            )}
        </Button>
    );
};

export default GtaWorldLoginButton;