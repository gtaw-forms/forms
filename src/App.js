import { useState } from 'react';
import { HashRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider, useNotification } from './contexts/NotificationContext';
import { FormProvider } from './contexts/FormContext';
import { DataProvider } from './contexts/DataContext';
import * as Sentry from "@sentry/react";
import { sendDiscordErrorWebhook } from './index';

import MainApp from './MainApp';
import GtaLogin from './components/Auth/GtaLogin';
import GtaCallback from './components/Auth/GtaCallback';
import Admin from './components/Admin/Admin';
import ProtectedRoute from './components/Auth/ProtectedRoute';

function App() {
    const [formData, setFormData] = useState({});
    const [lastWebhookIdentifier, setLastWebhookIdentifier] = useState(null);
    const [setShowAdblockNotification] = useState(false);

    const { showNotification, removeNotification } = useNotification();

    const initialFormData = {
        // Your initial form data
    };

    return (
        <Sentry.ErrorBoundary
            fallback={<p>An unexpected fatal error occurred. Please inform the developer in the PHMC Discord server.</p>}
            onError={(error, componentStack) => {
                sendDiscordErrorWebhook({
                    message: error.message,
                    stack: componentStack,
                    source: 'React ErrorBoundary',
                    isButtonClickError: false, // In a React Error Boundary, we may not be able to determine this easily.
                });
            }}
        >
            <DataProvider>
                <FormProvider initialFormData={initialFormData} setFormData={setFormData} setLastWebhookIdentifier={setLastWebhookIdentifier} showNotification={showNotification}>
                    <NotificationProvider>
                        <AuthProvider>
                            <Router>
                                <Routes>
                                    <Route path="/" element={<MainApp formData={formData} setFormData={setFormData} lastWebhookIdentifier={lastWebhookIdentifier} setLastWebhookIdentifier={setLastWebhookIdentifier} initialFormData={initialFormData} showNotification={showNotification} removeNotification={removeNotification} setShowAdblockNotification={setShowAdblockNotification} />} />
                                    <Route path="/login" element={<GtaLogin />} />
                                    <Route path="/auth/gta/callback" element={<GtaCallback />} />
                                    <Route path="/admin" element={<ProtectedRoute><Admin formData={formData} setFormData={setFormData} showNotification={showNotification} /></ProtectedRoute>} />
                                    <Route path="*" element={<Navigate to="/" replace />} />
                                </Routes>
                            </Router>
                        </AuthProvider>
                    </NotificationProvider>
                </FormProvider>
            </DataProvider>
        </Sentry.ErrorBoundary>
    );
}

export default App;
