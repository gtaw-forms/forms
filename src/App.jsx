import React, { useState, lazy, Suspense, useEffect } from 'react';
import { HashRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { useNotification } from './contexts/NotificationContext.jsx';
import { useAuth } from './contexts/AuthContext.jsx';
import { FormProvider } from './contexts/FormContext.jsx';
import * as Sentry from "@sentry/react";
import { sendDiscordErrorWebhook } from './utils/logging';
import { Spinner } from 'react-bootstrap';
import { database } from './firebase';
import { ref, onValue, onDisconnect, set, serverTimestamp } from 'firebase/database';

import { FormHandler } from './components/form-handler/FormHandler.jsx';
import ProtectedRoute from './components/Auth/ProtectedRoute.jsx';
import RequireAuth from './components/Auth/RequireAuth.jsx';
import Admin from './components/Admin/Admin.jsx';
import DiscordNameCheck from './components/Auth/DiscordNameCheck.jsx';

function SessionExpiredBanner() {
    const { sessionExpired, dismissSessionExpiry, logout } = useAuth();
    if (!sessionExpired) return null;
    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 99999,
            background: '#dc3545', color: '#fff', padding: '14px 24px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16,
            fontFamily: 'Arial, sans-serif', fontSize: '15px', fontWeight: 600,
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        }}>
            <i className="fas fa-exclamation-triangle" style={{ fontSize: 20 }}></i>
            Your session has expired — please reload the page to re-authenticate
            <button onClick={() => { dismissSessionExpiry(); logout(); window.location.reload(); }}
                style={{ background: '#fff', color: '#dc3545', border: 'none',
                    borderRadius: 6, padding: '8px 20px', fontWeight: 700, cursor: 'pointer', fontSize: '14px' }}>
                Reload Now
            </button>
            <button onClick={dismissSessionExpiry}
                style={{ background: 'transparent', color: '#ffc0c0', border: '1px solid #ffc0c0',
                    borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontSize: '14px' }}>
                Dismiss
            </button>
        </div>
    );
}

// Lazy load non-critical components
const GtaLogin = lazy(() => import('./components/Auth/GtaLogin.jsx'));
const GtaCallback = lazy(() => import('./components/Auth/GtaCallback.jsx'));
const EmsDashboard = lazy(() => import('./components/ems-dashboard/EmsDashboard.jsx'));
const MorgueLookup = lazy(() => import('./components/UI/MorgueLookup.jsx'));

function App() {
    const [formData, setFormData] = useState({});
    const [lastWebhookIdentifier, setLastWebhookIdentifier] = useState(null);
    const { showNotification, removeNotification } = useNotification();

    // GLOBAL SECURITY KILL-SWITCH LISTENER
    useEffect(() => {
        const killSwitchRef = ref(database, 'appMetadata/globalKillSwitch');
        
        // Use a ref to store the initial value to avoid purging on first load
        let isInitialLoad = true;

        const unsubscribe = onValue(killSwitchRef, (snapshot) => {
            const serverTimestamp = snapshot.val();
            if (!serverTimestamp) return;

            if (isInitialLoad) {
                isInitialLoad = false;
                // If the kill-switch was triggered in the last 60 seconds, purge anyway (handles offline -> online)
                const now = Date.now();
                if (now - serverTimestamp > 60000) {
                    return;
                }
            }

            console.warn('!!! [App] GLOBAL KILL-SWITCH DETECTED !!! PURGING ALL STORAGE...');
            
            // Wipe everything
            localStorage.clear();
            sessionStorage.clear();

            // Sentry Breadcrumb
            Sentry.addBreadcrumb({
                category: 'security',
                message: 'Global Kill-Switch Triggered',
                level: 'fatal'
            });

            // Force reload after a short delay
            setTimeout(() => {
                window.location.href = window.location.origin + window.location.pathname;
            }, 1500);
        });

        return () => unsubscribe();
    }, []);

    // SERVICE WORKER KILL-SWITCH MESSAGE LISTENER
    useEffect(() => {
        if (!('serviceWorker' in navigator)) return;

        const handler = (event) => {
            if (event.data && event.data.type === 'KILL_SWITCH_ACTIVE') {
                console.warn('!!! [App] KILL-SWITCH DETECTED VIA SERVICE WORKER !!! PURGING...');
                localStorage.clear();
                sessionStorage.clear();
                Sentry.addBreadcrumb({
                    category: 'security',
                    message: 'Global Kill-Switch Triggered (via SW)',
                    level: 'fatal'
                });
                setTimeout(() => {
                    window.location.href = window.location.origin + window.location.pathname;
                }, 1500);
            }
        };

        navigator.serviceWorker.addEventListener('message', handler);
        return () => navigator.serviceWorker.removeEventListener('message', handler);
    }, []);

    // PRESENCE TRACKING — active user count via onDisconnect (skipped on localhost, no auth)
    useEffect(() => {
        if (window.location.hostname === 'localhost') return;
        const sessionId = crypto.randomUUID();
        const connectedRef = ref(database, '.info/connected');
        const presenceRef = ref(database, `presence/${sessionId}`);

        const unsub = onValue(connectedRef, (snap) => {
            if (snap.val() === true) {
                onDisconnect(presenceRef).remove();
                set(presenceRef, {
                    active: true,
                    timestamp: serverTimestamp()
                });
            }
        });

        return () => unsub();
    }, []);

    // DAILY VISITOR TRACKING — persists after tab close for admin counts (skipped on localhost, no auth)
    useEffect(() => {
        if (window.location.hostname === 'localhost') return;
        const today = new Date().toISOString().split('T')[0];
        const sessionId = crypto.randomUUID();
        const visitorRef = ref(database, `analytics/visitors/${today}/${sessionId}`);
        set(visitorRef, serverTimestamp());
    }, []);

    const LoadingFallback = () => (
        <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh', backgroundColor: '#0d1117' }}>
            <Spinner animation="border" variant="primary" />
        </div>
    );

    return (
        <Sentry.ErrorBoundary
            fallback={({ error, componentStack }) => (
                <div style={{ padding: '20px', fontFamily: 'monospace' }}>
                    <h2>An unexpected fatal error occurred</h2>
                    <p><strong>Please post this error information in the PHMC Discord server:</strong></p>
                    <div style={{ 
                        backgroundColor: '#114170ff', 
                        border: '1px solid #dee2e6', 
                        borderRadius: '4px', 
                        padding: '15px', 
                        marginTop: '10px',
                        whiteSpace: 'pre-wrap',
                        fontSize: '12px',
                        maxHeight: '400px',
                        overflow: 'auto'
                    }}>
                        <strong>Error:</strong> {error?.message || 'Unknown error'}
                        {error?.stack && (
                            <>
                                <br/><br/>
                                <strong>Stack Trace:</strong><br/>
                                {error.stack}
                            </>
                        )}
                        {componentStack && (
                            <>
                                <br/><br/>
                                <strong>Component Stack:</strong><br/>
                                {componentStack}
                            </>
                        )}
                    </div>
                    <button 
                        onClick={() => window.location.reload()} 
                        style={{
                            marginTop: '15px',
                            padding: '10px 20px',
                            backgroundColor: '#007bff',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        Reload Page
                    </button>
                </div>
            )}
            onError={(error, componentStack) => {
                sendDiscordErrorWebhook({
                    message: error.message,
                    stack: componentStack,
                    source: 'React ErrorBoundary',
                    isButtonClickError: false,
                });
            }}
        >
            <FormProvider formData={formData} setFormData={setFormData} setLastWebhookIdentifier={setLastWebhookIdentifier} showNotification={showNotification}>
                <SessionExpiredBanner />
                <Router>
                    <DiscordNameCheck>
                            <Suspense fallback={<LoadingFallback />}>
                                <Routes>
                                    <Route path="/" element={<RequireAuth><FormHandler formData={formData} setFormData={setFormData} lastWebhookIdentifier={lastWebhookIdentifier} setLastWebhookIdentifier={setLastWebhookIdentifier} showNotification={showNotification} removeNotification={removeNotification} /></RequireAuth>} />
                                    <Route path="/login" element={<GtaLogin />} />
                                    <Route path="/auth/gta/callback" element={<GtaCallback />} />
                                    <Route path="/admin" element={<ProtectedRoute><Admin formData={formData} setFormData={setFormData} showNotification={showNotification} /></ProtectedRoute>} />
                                    <Route path="/ems-dashboard" element={<EmsDashboard />} />
                                    <Route path="/morgue" element={<RequireAuth><MorgueLookup /></RequireAuth>} />
                                    <Route path="/form-handler" element={<ProtectedRoute><FormHandler /></ProtectedRoute>} />
                                    <Route path="*" element={<Navigate to="/" replace />} />
                                </Routes>
                            </Suspense>
                    </DiscordNameCheck>
                </Router>
            </FormProvider>
        </Sentry.ErrorBoundary>
    );
}

export default App;
