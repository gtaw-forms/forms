import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { init, getClient } from "@sentry/react";
import { AuthProvider } from './contexts/AuthContext.jsx';
import { NotificationProvider } from './contexts/NotificationContext.jsx';
import { GtaWorldAuthProvider } from './contexts/GtaWorldAuthContext.jsx';
import { DataProvider } from './contexts/DataContext.jsx';
import { ModalProvider } from './contexts/ModalProvider.jsx';
import { useNotification } from './contexts/NotificationContext';
import * as Sentry from "@sentry/react";
import ErrorBoundary from './components/UI/ErrorBoundary';
import { sendDiscordErrorWebhook, getLastInputInteraction, getCurrentFormType } from './utils/errorUtils';

// --- Navigation Tracking ---
const navigationHistory = [];
const recordNavigation = (url, type = 'push') => {
    try {
        const path = url || window.location.pathname + window.location.search;
        // Don't record duplicate paths if they are the last entry
        if (navigationHistory.length > 0 && navigationHistory[0].path === path) return;
        
        const entry = {
            path: path,
            type,
            timestamp: new Date().toLocaleTimeString(),
        };
        navigationHistory.unshift(entry);
        if (navigationHistory.length > 15) navigationHistory.pop();
    } catch (e) {
        // Silent fail for navigation tracking
    }
};

// Monkey-patch history methods to track navigation
const originalPushState = window.history.pushState;
const originalReplaceState = window.history.replaceState;

window.history.pushState = function (...args) {
    originalPushState.apply(this, args);
    recordNavigation(args[2], 'push');
};

window.history.replaceState = function (...args) {
    originalReplaceState.apply(this, args);
    recordNavigation(args[2], 'replace');
};

window.addEventListener('popstate', () => recordNavigation(window.location.pathname + window.location.search, 'pop'));
recordNavigation(window.location.pathname + window.location.search, 'initial');

// --- START: Chunk Loading Error Handler ---
const chunkRetryMap = new Map();
const MAX_CHUNK_RETRIES = 2;

const handleChunkError = (error) => {
    const chunkFailedMessage = /Loading chunk [\d]+ failed/;
    const isChunkError = error?.message && chunkFailedMessage.test(error.message);
    
    if (isChunkError) {
        const chunkId = error.message.match(/Loading chunk ([\d]+) failed/)?.[1];
        const retryCount = chunkRetryMap.get(chunkId) || 0;
        
        if (retryCount < MAX_CHUNK_RETRIES) {
            chunkRetryMap.set(chunkId, retryCount + 1);
            setTimeout(() => {
                window.location.reload();
            }, 1000);
            return true;
        } else {
            chunkRetryMap.delete(chunkId);
            if (window.confirm('Unable to load part of the application. Reload?')) {
                window.location.reload(true);
            }
            return true;
        }
    }
    return false;
};

window.addEventListener('unhandledrejection', (event) => {
    if (handleChunkError(event.reason)) {
        event.preventDefault();
    }
});

let isSentryBlocked = false;
const appStartTime = Date.now();

init({
  dsn: "https://5dfa5683e8dc9adbc7f30e44757995c7@o4509126124765184.ingest.de.sentry.io/4509126125813840",
  sendDefaultPii: true,
  environment: import.meta.env.MODE,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  tracePropagationTargets: ["localhost", "https://forms.phmc.io", /^\//],
  beforeSend(event) {
    if (event.exception) {
      event.tags = {
        ...event.tags,
        form_type: getCurrentFormType(),
        sentry_blocked: isSentryBlocked,
      };
      event.extra = {
          ...event.extra,
          navigation_history: navigationHistory,
          time_since_start: `${Math.round((Date.now() - appStartTime) / 1000)}s`
      };
    }
    return event;
  },
});

window.onerror = (message, source, lineno, colno, errorObject) => {
    if (typeof message === 'string') {
        if (message.includes("ResizeObserver loop limit exceeded")) return true;
        if (message.includes("Loading chunk") && message.includes("failed")) return true;
    }

    const lastInputInteraction = getLastInputInteraction();
    const errorDetails = {
        message, source, lineno, colno, error: errorObject,
        stack: errorObject ? errorObject.stack : 'N/A',
        currentFormType: getCurrentFormType(),
        lastInputInteraction,
        url: window.location.href,
        navigationHistory,
        timeSinceStart: `${Math.round((Date.now() - appStartTime) / 1000)}s`
    };
    sendDiscordErrorWebhook(errorDetails, isSentryBlocked);
    return false;
};

const Root = () => {
    const { showNotification, removeNotification } = useNotification();

    useEffect(() => {
        const checkSentryConnectivity = async () => {
            await new Promise(resolve => setTimeout(resolve, 100));
            const client = getClient();
            if (!client || !client.getDsn()) {
                isSentryBlocked = true;
                return;
            }
            const dsn = client.getDsn();
            const ingestUrl = `${dsn.protocol}://${dsn.host}/api/${dsn.projectId}/envelope/`;

            try {
                await fetch(ingestUrl, { method: 'HEAD', mode: 'no-cors' });
                isSentryBlocked = false;
            } catch (error) {
                isSentryBlocked = true;
                const adblockNotificationId = showNotification(
                    'Adblocker detected. Please consider disabling it to help us track bugs!',
                    'exclamation-triangle',
                    0,
                    [{
                        label: 'Dismiss',
                        handler: () => removeNotification(adblockNotificationId)
                    }]
                );
            }
        };
        checkSentryConnectivity();
    }, [showNotification, removeNotification]);

    return <App />;
};

const container = document.getElementById('root');
const root = ReactDOM.createRoot(container);
root.render(
      <ErrorBoundary>
        <AuthProvider>
          <NotificationProvider>
            <GtaWorldAuthProvider>
              <DataProvider>
                <ModalProvider>
                      <Root />
                </ModalProvider>
              </DataProvider>
            </GtaWorldAuthProvider>
          </NotificationProvider>
        </AuthProvider>
      </ErrorBoundary>
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swUrl = `${import.meta.env.BASE_URL}sw.js`;
    navigator.serviceWorker.register(swUrl).catch(() => {});
  });
}
