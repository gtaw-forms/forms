import React, { useRef, useCallback } from 'react';
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
    onSuccess,
    disabled = false,
    role = "employee",
    ...props 
}) => {
    const { login, isLoading, error, isAuthenticated, user } = useGtaWorldAuth();
    const lastClickTimeRef = useRef(0);
    const clickDebounceMs = 500; // 500ms debounce for faster response

    const handleLogin = useCallback(() => {
        const now = Date.now();
        const timeSinceLastClick = now - lastClickTimeRef.current;
        
        // Prevent rapid clicks
        if (timeSinceLastClick < clickDebounceMs) {
            console.warn('[GTA Login Button] Click ignored - too soon after last click:', {
                timeSinceLastClick,
                debounceMs: clickDebounceMs,
                remainingMs: clickDebounceMs - timeSinceLastClick
            });
            return;
        }
        
        // Check if user is already authenticated from session data
        if (isAuthenticated && user) {
            console.info('[GTA Login Button] User already authenticated, calling onSuccess callback:', {
                username: user.username,
                characterId: user.id
            });
            // User is already logged in, call success callback instead of starting OAuth flow
            if (onSuccess) {
                onSuccess(user);
            }
            return;
        }
        
        lastClickTimeRef.current = now;
        console.log('[GTA Login Button] Initiating login...');

        if (onInitiate) {
            onInitiate();
        }

        login({
            returnPath,
            role,
            onSuccess: (userData, redirectPath) => {
                console.info('[GTA Login Button] Login successful:', userData);
                if (onSuccess) {
                    onSuccess(userData, redirectPath);
                }
            },
            onError: (errorMessage) => {
                console.error('[GTA Login Button] Login error:', errorMessage);
                if (onError) {
                    onError(errorMessage);
                }
            }
        });
    }, [login, returnPath, onError, onInitiate, onSuccess, clickDebounceMs, isAuthenticated, user]);

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