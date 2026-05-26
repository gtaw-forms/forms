import React, { useState, lazy, Suspense, useEffect } from 'react';
import { HashRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { useNotification } from './contexts/NotificationContext.jsx';
import { FormProvider } from './contexts/FormContext.jsx';
import * as Sentry from "@sentry/react";
import { sendDiscordErrorWebhook } from './utils/errorUtils';
import { Spinner } from 'react-bootstrap';
import { database } from './firebase';
import { ref, onValue } from 'firebase/database';

import { FormHandler } from './components/form-handler/FormHandler.jsx';
import ProtectedRoute from './components/Auth/ProtectedRoute.jsx';
import Admin from './components/Admin/Admin.jsx';
import DiscordNameCheck from './components/Auth/DiscordNameCheck.jsx';

// Lazy load non-critical components
const GtaLogin = lazy(() => import('./components/Auth/GtaLogin.jsx'));
const GtaCallback = lazy(() => import('./components/Auth/GtaCallback.jsx'));
const OAuthUrlDiagnostic = lazy(() => import('./components/Auth/OAuthUrlDiagnostic.jsx'));
const EmsDashboard = lazy(() => import('./components/ems-dashboard/EmsDashboard.jsx'));
const ShopDashboard = lazy(() => import('./components/Shop/ShopDashboard.jsx'));
const MorgueLookup = lazy(() => import('./components/UI/MorgueLookup.jsx'));
const PRDashboard = lazy(() => import('./components/PR/PRDashboard.jsx'));

function App() {
    const [formData, setFormData] = useState({});
    const [lastWebhookIdentifier, setLastWebhookIdentifier] = useState(null);
    const [setShowAdblockNotification] = useState(false);

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
                <Router>
                    <DiscordNameCheck>
                            <Suspense fallback={<LoadingFallback />}>
                                <Routes>
                                    <Route path="/" element={<FormHandler formData={formData} setFormData={setFormData} lastWebhookIdentifier={lastWebhookIdentifier} setLastWebhookIdentifier={setLastWebhookIdentifier} showNotification={showNotification} removeNotification={removeNotification} setShowAdblockNotification={setShowAdblockNotification} />} />
                                    <Route path="/login" element={<GtaLogin />} />
                                    <Route path="/auth/gta/callback" element={<GtaCallback />} />
                                    <Route path="/auth/gta/diagnostic" element={<OAuthUrlDiagnostic />} />
                                    <Route path="/admin" element={<ProtectedRoute><Admin formData={formData} setFormData={setFormData} showNotification={showNotification} /></ProtectedRoute>} />
                                    <Route path="/ems-dashboard" element={<EmsDashboard />} />
                                    <Route path="/shop" element={<ShopDashboard />} />
                                    <Route path="/morgue" element={<MorgueLookup />} />
                                    <Route path="/pr" element={<ProtectedRoute><PRDashboard /></ProtectedRoute>} />
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
