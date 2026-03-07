import React, { useState, lazy, Suspense } from 'react';
import { HashRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { NotificationProvider, useNotification } from './contexts/NotificationContext.jsx';
import { FormProvider } from './contexts/FormContext.jsx';
import { SeasonalEffectsProvider } from './contexts/SeasonalEffectsContext';
import * as Sentry from "@sentry/react";
import { sendDiscordErrorWebhook } from './utils/errorUtils';
import { Spinner } from 'react-bootstrap';

import { FormHandler } from './components/form-handler/FormHandler.jsx';
import ProtectedRoute from './components/Auth/ProtectedRoute.jsx';
import Admin from './components/Admin/Admin.jsx';
import DiscordNameCheck from './components/Auth/DiscordNameCheck.jsx';

// Lazy load non-critical components
const GtaLogin = lazy(() => import('./components/Auth/GtaLogin.jsx'));
const UnifiedGtaCallback = lazy(() => import('./components/Auth/UnifiedGtaCallback.jsx'));
const OAuthUrlDiagnostic = lazy(() => import('./components/Auth/OAuthUrlDiagnostic.jsx'));
const PaymentCallback = lazy(() => import('./components/Common/PaymentCallback.jsx'));
const EmsDashboard = lazy(() => import('./components/ems-dashboard/EmsDashboard.jsx'));

function App() {
    const [formData, setFormData] = useState({});
    const [lastWebhookIdentifier, setLastWebhookIdentifier] = useState(null);
    const [setShowAdblockNotification] = useState(false);

    const { showNotification, removeNotification } = useNotification();

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
                <NotificationProvider>
                    <Router>
                        <DiscordNameCheck>
                            <SeasonalEffectsProvider> {/* Wrap Routes with SeasonalEffectsProvider */}
                                <Suspense fallback={<LoadingFallback />}>
                                    <Routes>
                                        <Route path="/" element={<FormHandler formData={formData} setFormData={setFormData} lastWebhookIdentifier={lastWebhookIdentifier} setLastWebhookIdentifier={setLastWebhookIdentifier} showNotification={showNotification} removeNotification={removeNotification} setShowAdblockNotification={setShowAdblockNotification} />} />
                                        <Route path="/login" element={<GtaLogin />} />
                                        <Route path="/auth/gta/callback" element={<UnifiedGtaCallback />} />
                                        <Route path="/auth/gta/diagnostic" element={<OAuthUrlDiagnostic />} />
                                        <Route path="/auth/gtapayment/callback/:token" element={<PaymentCallback />} />
                                        <Route path="/admin" element={<ProtectedRoute><Admin formData={formData} setFormData={setFormData} showNotification={showNotification} /></ProtectedRoute>} />
                                        <Route path="/ems-dashboard" element={<ProtectedRoute><EmsDashboard /></ProtectedRoute>} />
                                        <Route path="/form-handler" element={<ProtectedRoute><FormHandler /></ProtectedRoute>} />
                                        <Route path="*" element={<Navigate to="/" replace />} />
                                    </Routes>
                                </Suspense>
                            </SeasonalEffectsProvider>
                        </DiscordNameCheck>
                    </Router>
                </NotificationProvider>
            </FormProvider>
        </Sentry.ErrorBoundary>
    );
}

export default App;
