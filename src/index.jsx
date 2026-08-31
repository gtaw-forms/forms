import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import './App.css';
import './buttons.css';
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
import { sendDiscordErrorWebhook, getLastInputInteraction, getCurrentFormType, initConsoleInterceptor, getUserOAuthIdentity, isIndexedDBCascadeError } from './utils/logging';
import { checkIndexedDBAvailability, clearSiteData } from './utils/idbCache';

// --- Navigation Tracking ---
const navigationHistory = [];
window.navigationHistory = navigationHistory; // Expose for error reporting
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

let isSentryBlocked = false;
const appStartTime = Date.now();

// Initialize console interceptor to redirect to Discord when Sentry is blocked
initConsoleInterceptor(() => isSentryBlocked);

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
      // Drop the Firebase IndexedDB cascade (quota/disk-full fallout). The
      // startup probe reports the root cause once as a tagged event instead.
      const excValue = event.exception.values?.[0]?.value || '';
      if (isIndexedDBCascadeError(excValue)) return null;

      const userIdentity = getUserOAuthIdentity();
      event.tags = {
        ...event.tags,
        form_type: getCurrentFormType(),
        sentry_blocked: isSentryBlocked,
      };
      event.extra = {
          ...event.extra,
          navigation_history: navigationHistory,
          time_since_start: `${Math.round((Date.now() - appStartTime) / 1000)}s`,
          user_identity: userIdentity || 'Not authenticated'
      };
    }
    return event;
  },
});

// Use addEventListener to avoid overwriting Sentry's handlers
window.addEventListener('error', (event) => {
    const { message, filename, lineno, colno, error } = event;
    
    if (typeof message === 'string') {
        if (message.includes("ResizeObserver loop limit exceeded")) return;
        if (message.includes("Loading chunk") && message.includes("failed")) return;
    }

    const lastInputInteraction = getLastInputInteraction();
    const errorDetails = {
        message, 
        source: filename, 
        lineno, 
        colno, 
        error: error,
        stack: error ? error.stack : 'N/A',
        currentFormType: getCurrentFormType(),
        lastInputInteraction,
        url: window.location.href,
        navigationHistory,
        timeSinceStart: `${Math.round((Date.now() - appStartTime) / 1000)}s`
    };
    sendDiscordErrorWebhook(errorDetails, isSentryBlocked);
});

window.addEventListener('unhandledrejection', (event) => {
    // Handle chunk errors specifically
    if (handleChunkError(event.reason)) {
        event.preventDefault();
        return;
    }

    const lastInputInteraction = getLastInputInteraction();
    const errorDetails = {
        message: event.reason?.message || String(event.reason),
        source: 'Promise Rejection',
        lineno: 0,
        colno: 0,
        error: event.reason,
        stack: event.reason?.stack || 'N/A',
        currentFormType: getCurrentFormType(),
        lastInputInteraction,
        url: window.location.href,
        navigationHistory,
        timeSinceStart: `${Math.round((Date.now() - appStartTime) / 1000)}s`
    };
    sendDiscordErrorWebhook(errorDetails, isSentryBlocked);
});

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

    useEffect(() => {
        let cancelled = false;

        checkIndexedDBAvailability().then(({ available, error }) => {
            if (cancelled || available) return;
            // Dismissed once this session — don't nag on every reload.
            if (sessionStorage.getItem('idbWarningDismissed')) return;

            const id = showNotification(
                "Your browser storage appears to be full or unavailable. Offline caches and auto-login may not work until it's fixed. Free up disk space, or clear this site's cached data.",
                'warning',
                0,
                {
                    key: 'idb-unavailable',
                    actions: [
                        {
                            label: 'Clear site data',
                            handler: async () => {
                                try {
                                    await clearSiteData();
                                } catch (clearError) {
                                    console.warn('[Storage] Failed to clear site data:', clearError);
                                }
                                window.location.reload();
                            },
                        },
                        {
                            label: 'Dismiss',
                            handler: () => {
                                sessionStorage.setItem('idbWarningDismissed', '1');
                                removeNotification(id);
                            },
                        },
                    ],
                }
            );

            // Single, tagged root-cause event (the cascade is filtered in beforeSend).
            Sentry.captureMessage('[Storage] IndexedDB unavailable', {
                level: 'warning',
                tags: { storage: 'idb_unavailable' },
                extra: {
                    error: error?.message || String(error),
                    action_offered: 'clear_site_data',
                },
            });
        }).catch(() => {});

        return () => { cancelled = true; };
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
    navigator.serviceWorker.register(swUrl).then((registration) => {
      const sendConfig = (worker) => {
        if (worker) {
          worker.postMessage({
            type: 'SET_FIREBASE_CONFIG',
            databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL
          });
        }
      };
      const worker = registration.active || registration.installing;
      if (worker) {
        sendConfig(worker);
      }
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'activated') {
              sendConfig(newWorker);
            }
          });
        }
      });
    }).catch(() => {});
  });
}
