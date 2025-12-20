import  {useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { init, getClient } from "@sentry/react";
import { NotificationProvider } from './contexts/NotificationContext.jsx';
import { DataProvider } from './contexts/DataContext.jsx';
import { ModalProvider } from './contexts/ModalProvider.jsx';
import { SettingsProvider } from './contexts/SettingsProvider.jsx';
import { LockdownProvider } from './contexts/LockdownContext';
import { useNotification } from './contexts/NotificationContext';
import * as Sentry from "@sentry/react";
import { analytics } from './firebase';
import { logEvent } from "firebase/analytics";
import ErrorBoundary from './components/UI/ErrorBoundary';
import { sendDiscordErrorWebhook } from './utils/errorUtils';

// --- START: Chunk Loading Error Handler ---
/**
 * Handles "Loading chunk failed" errors with automatic retry logic
 * This prevents issues caused by stale caches, network problems, or deployment updates
 */
const chunkRetryMap = new Map(); // Track retry attempts per chunk
const MAX_CHUNK_RETRIES = 2;

const handleChunkError = (error) => {
    const chunkFailedMessage = /Loading chunk [\d]+ failed/;
    const isChunkError = error?.message && chunkFailedMessage.test(error.message);
    
    if (isChunkError) {
        const chunkId = error.message.match(/Loading chunk ([\d]+) failed/)?.[1];
        const retryCount = chunkRetryMap.get(chunkId) || 0;
        
        if (retryCount < MAX_CHUNK_RETRIES) {
            chunkRetryMap.set(chunkId, retryCount + 1);
            console.warn(`Chunk ${chunkId} failed to load. Retry attempt ${retryCount + 1}/${MAX_CHUNK_RETRIES}. Reloading page...`);
            
            // Add small delay before reload to avoid rapid reload loops
            setTimeout(() => {
                window.location.reload();
            }, 1000);
            
            return true; // Error handled
        } else {
            // Max retries exceeded - likely a real problem
            console.error(`Chunk ${chunkId} failed to load after ${MAX_CHUNK_RETRIES} retries. This may indicate a deployment issue or network problem.`);
            chunkRetryMap.delete(chunkId); // Clean up
            
            // Show user-friendly error
            if (window.confirm(
                'Unable to load part of the application. This might be due to a recent update.\n\n' +
                'Click OK to clear your cache and reload, or Cancel to continue (not recommended).'
            )) {
                // Clear cache and reload
                if ('caches' in window) {
                    caches.keys().then(names => {
                        names.forEach(name => caches.delete(name));
                    }).finally(() => {
                        window.location.reload(true);
                    });
                } else {
                    window.location.reload(true);
                }
            }
            
            return true; // Error handled
        }
    }
    
    return false; // Not a chunk error
};

// Listen for unhandled promise rejections (where chunk errors often appear)
window.addEventListener('unhandledrejection', (event) => {
    if (handleChunkError(event.reason)) {
        event.preventDefault(); // Prevent default error logging
    }
});

// --- Global Context Tracking for Error Reporting ---
let lastInputInteraction = null; // Tracks recent input field interactions
let isSentryBlocked = false; // Flag to track if Sentry connectivity failed

/**
 * Automatically determines the current form type from lastSelectedFormName stored in localStorage
 * @returns {string} The form name or 'Unknown' if not found
 */
const getCurrentFormType = () => {
    try {
        const lastSelectedFormName = localStorage.getItem('lastSelectedFormName');
        if (lastSelectedFormName) {
            return lastSelectedFormName;
        }
        return 'Unknown';
    } catch (error) {
        console.warn('Error determining form type:', error);
        return 'Unknown';
    }
};





init({
  dsn: "https://5dfa5683e8dc9adbc7f30e44757995c7@o4509126124765184.ingest.de.sentry.io/4509126125813840",
  sendDefaultPii: true,
  environment: import.meta.env.MODE, // Add environment context
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
  beforeSend(event, hint) {
    // Check if it's an error event to add context
    if (event.exception) {
      // Add custom tags for better filtering and analytics
      event.tags = {
        ...event.tags,
        form_type: getCurrentFormType(),
        sentry_blocked: isSentryBlocked,
      };

      // Add extra context data for deeper debugging
      if (lastInputInteraction) {
        event.extra = {
          ...event.extra,
          last_input_interaction: lastInputInteraction,
        };
      }
    }
    return event;
  },
});
console.log("Sentry has been initialized.");
// --- Global Error Handling Setup ---
window.onerror = (message, source, lineno, colno, errorObject) => {
    // Ignore common, non-critical errors that can create a lot of noise.
    if (typeof message === 'string') {
        if (message.includes("ResizeObserver loop limit exceeded")) {
            return true; // Suppress this error from being processed further.
        }
        
        // Ignore chunk loading errors - they're handled by handleChunkError
        if (message.includes("Loading chunk") && message.includes("failed")) {
            return true; // Already handled by unhandledrejection listener
        }
    }

    // --- Enhanced Error Context Detection ---
    let isButtonClickError = false;
    let isInputFieldError = false;
    let inputFieldType = 'Unknown';

    if (errorObject && typeof errorObject.stack === 'string') {
        const stack = errorObject.stack;

        // Check for button click patterns
        if (stack.includes('onClick') || stack.includes('handleClick')) {
            isButtonClickError = true;
        }

        // Check for input field interaction patterns
        if (stack.includes('onChange') || stack.includes('handleChange') ||
            stack.includes('onInput') || stack.includes('handleInput') ||
            stack.includes('onBlur') || stack.includes('handleBlur')) {
            isInputFieldError = true;

            // Try to determine input type from stack trace
            if (stack.includes('Select') || stack.includes('react-select')) {
                inputFieldType = 'Select/Dropdown';
            } else if (stack.includes('textarea') || stack.includes('Textarea')) {
                inputFieldType = 'Textarea';
            } else if (stack.includes('checkbox') || stack.includes('Checkbox')) {
                inputFieldType = 'Checkbox';
            } else if (stack.includes('radio') || stack.includes('Radio')) {
                inputFieldType = 'Radio';
            } else {
                inputFieldType = 'Text/Input';
            }
        }
    }
    // --- End Error Context Detection ---

    // Helper to safely get user info from storage
    const getUserInfoFromStorage = () => {
        try {
            const userKey = Object.keys(localStorage).find(k => k.includes('user'));
            if (userKey) {
                const user = JSON.parse(localStorage.getItem(userKey));
                return {
                    id: user?.uid || user?.id,
                    username: user?.displayName || user?.username,
                };
            }
            return null;
        } catch {
            return { error: 'Failed to parse user info from localStorage' };
        }
    };


    // Log the error to Firebase Analytics
    logEvent(analytics, 'exception', {
        description: message,
        fatal: true,
        is_button_error: isButtonClickError,
        is_input_error: isInputFieldError,
        error_message: String(message).substring(0, 100),
        stack: errorObject && errorObject.stack ? String(errorObject.stack).substring(0, 100) : undefined,
        source: source || undefined,
        lineno: lineno || undefined,
        colno: colno || undefined,
        form_type: getCurrentFormType(),
        input_field_type: inputFieldType
    });

    // Queue the error for reporting to Discord.
    const errorDetails = {
        message,
        source,
        lineno,
        colno,
        error: errorObject,
        stack: errorObject ? errorObject.stack : 'N/A',
        isButtonClickError,
        isInputFieldError,
        inputFieldType,
        currentFormType: getCurrentFormType(),
        lastInputInteraction,
        // --- Added Debug Data ---
        url: window.location.href,
        clientInfo: {
            viewport: `${window.innerWidth}x${window.innerHeight}`,
            platform: navigator.platform,
            language: navigator.language,
        },
        userInfo: getUserInfoFromStorage(),
    };
    sendDiscordErrorWebhook(errorDetails, isSentryBlocked);

    // Return false to ensure the error is still processed by other handlers (like Sentry's)
    // and the default browser console output.
    return false;
};

const Root = () => {
    const { showNotification, removeNotification } = useNotification();

    useEffect(() => {

            const checkSentryConnectivity = async () => {
            // Wait a moment for Sentry's client to be fully available after init.
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const client = getClient();

            if (!client || !client.getDsn()) {
                console.error("Sentry client or DSN not found. Sentry reporting will fail.");
                isSentryBlocked = true; // Set the flag
                return;
            }

            const dsn = client.getDsn();
            const ingestUrl = `${dsn.protocol}://${dsn.host}/api/${dsn.projectId}/envelope/`;

            try {
                // We use 'no-cors' because we don't need the response, just to see if the request can be made.
                // A successful request (even if opaque) suggests no network-level blocking (e.g., ad-blockers).
                await fetch(ingestUrl, { method: 'HEAD', mode: 'no-cors' });
                console.log("Sentry connectivity check successful. Discord reports will show Sentry as 'Active'.");
                isSentryBlocked = false;
            } catch (error) {
                console.warn("Sentry connectivity check failed. Sentry may be blocked. Discord reports will reflect this. Notification dispatched to User", error);
                isSentryBlocked = true; // Set the flag

                const adblockNotificationId = showNotification(
                    'It looks like you have an adblocker enabled. While we understand your preference, adblockers can sometimes interfere with the functionality of this site, especially with our error tracking tools. To help us track down bugs and improve the site, please consider disabling your adblocker for this domain. Your cooperation is greatly appreciated!',
                    'exclamation-triangle',
                    0, // Set duration to 0 for persistence
                    [{
                        label: 'Dismiss',
                        handler: () => removeNotification(adblockNotificationId)
                    }]
                );
            }
        };

        checkSentryConnectivity();
    }, []);

    return <App />;
};

const container = document.getElementById('root');
const root = ReactDOM.createRoot(container);
root.render(
      <ErrorBoundary>
        <NotificationProvider>
          <DataProvider>
            <ModalProvider>
              <SettingsProvider>
                <LockdownProvider>
                  <Root />
                </LockdownProvider>
              </SettingsProvider>
            </ModalProvider>
          </DataProvider>
        </NotificationProvider>
      </ErrorBoundary>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();