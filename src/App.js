import React, { useState } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider, useNotification } from './contexts/NotificationContext';
import { FormProvider } from './contexts/FormContext';
import { DataProvider } from './contexts/DataContext';
import * as Sentry from "@sentry/react";

import MainApp from './MainApp';
import GtaLogin from './components/Auth/GtaLogin';
import GtaCallback from './components/Auth/GtaCallback';
import Admin from './components/Admin/Admin';
import ProtectedRoute from './components/Auth/ProtectedRoute';

function App() {
    const [formData, setFormData] = useState({});
    const [lastWebhookIdentifier, setLastWebhookIdentifier] = useState(null);
    const [showAdblockNotification, setShowAdblockNotification] = useState(false);

    const { showNotification, removeNotification, NotificationContainer } = useNotification();

    const initialFormData = {
        // Your initial form data
    };

    return (
        <Sentry.ErrorBoundary fallback={<p>An error has occurred</p>}>
            <DataProvider>
                <FormProvider initialFormData={initialFormData} setFormData={setFormData} setLastWebhookIdentifier={setLastWebhookIdentifier} showNotification={showNotification}>
                    <NotificationProvider>
                        <AuthProvider>
                            <Router basename={window.location.hostname === 'fr0styjs.github.io' && window.location.pathname.startsWith('/phmc-code-archive') ? '/' : '/'}>
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
