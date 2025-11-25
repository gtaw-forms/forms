import { useState, Suspense } from 'react';
import { HashRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext.jsx';
import { NotificationProvider, useNotification } from './contexts/NotificationContext.jsx';
import { FormProvider } from './contexts/FormContext.jsx';
import { DataProvider } from './contexts/DataContext.jsx';
import * as Sentry from "@sentry/react";
import { sendDiscordErrorWebhook } from './utils/errorUtils';
import LoadingSpinner from './components/LoadingSpinner.jsx';

import GtaLogin from './components/Auth/GtaLogin.jsx';
import UnifiedGtaCallback from './components/Auth/UnifiedGtaCallback.jsx';
import OAuthUrlDiagnostic from './components/Auth/OAuthUrlDiagnostic.jsx';
import ProtectedRoute from './components/Auth/ProtectedRoute.jsx';
import PaymentCallback from './components/PaymentCallback.jsx';

import MainApp from './MainApp.jsx';
import Admin from './components/Admin/Admin.jsx';
import EmsDashboard from './components/ems-dashboard/EmsDashboard.jsx';
import FormHandler from './components/form-handler/FormHandler.jsx';
function App() {
    const [formData, setFormData] = useState({});
    const [lastWebhookIdentifier, setLastWebhookIdentifier] = useState(null);
    const [setShowAdblockNotification] = useState(false);

    const { showNotification, removeNotification } = useNotification();

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
            <DataProvider>
                <FormProvider formData={formData} setFormData={setFormData} setLastWebhookIdentifier={setLastWebhookIdentifier} showNotification={showNotification}>
                    <NotificationProvider>
                        <AuthProvider>
                            <Router>
                                <Suspense fallback={<LoadingSpinner />}>
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
                            </Router>
                        </AuthProvider>
                    </NotificationProvider>
                </FormProvider>
            </DataProvider>
        </Sentry.ErrorBoundary>
    );
}

export default App;
