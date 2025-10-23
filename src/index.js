import  {useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { init, getClient } from "@sentry/react";
import { NotificationProvider } from './contexts/NotificationContext';
import { DataProvider } from './contexts/DataContext';
import { ModalProvider } from './contexts/ModalProvider';
import { SettingsProvider } from './contexts/SettingsProvider';
import { LockdownProvider } from './contexts/LockdownContext';
import { useNotification } from './contexts/NotificationContext';
import * as Sentry from "@sentry/react";
import { analytics } from './firebase';
import { logEvent } from "firebase/analytics";
import ErrorBoundary from './components/ErrorBoundary';

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

// --- START: Fallback Error Reporting ---
const discordErrorWebhookQueue = [];
let isProcessingDiscordQueue = false;
let isSentryBlocked = false; // Flag to track if Sentry connectivity failed
let lastDiscordErrorMessage = '';
let lastDiscordErrorTimestamp = 0;

// --- Global Context Tracking for Error Reporting ---
let lastInputInteraction = null; // Tracks recent input field interactions

/**
 * Automatically determines the current form type from bbCodeVersion stored in localStorage
 * @returns {string} The form name or 'Unknown' if not found
 */
const getCurrentFormType = () => {
    try {
        const bbCodeVersion = localStorage.getItem('bbCodeVersion');
        if (!bbCodeVersion) return 'Unknown';

        const version = parseInt(bbCodeVersion, 10);
        const versionNames = {
            1: "Death Report",
            2: "Coroner Email",
            3: "Patient File - Advanced",
            4: "Autopsy Report",
            5: "Surgery Report",
            6: "Physical Evaluation (PHMC)",
            7: "Physical Evaluation (PBC)",
            8: "Death Certificate",
            9: "Obs Main File",
            10: "Obs Follow Up",
            11: "Mass Fatality Report",
            12: "Gynecology - Main File",
            13: "Gynecology - Add Reply",
            14: "Mental Health - PHMC",
            16: "Mental Health | PBC",
            18: "Agency Feedback",
            19: "Emergency Room Protocols",
            20: "Consultation Notes (PHMC)",
            21: "Consultation Notes (PBC)",
            22: "Commentary Note (PHMC)",
            23: "Commentary Note (PBC)",
            24: "Medical Record Release",
            25: "Patient File - Basic",
            26: "Medical Record Update",
            27: "Email Forms",
            28: "Psychological Evaluation PHMC",
            29: "Psychological Evaluation PBC",
            35: "PHMC - Email Generator",
            50: "PHMC - Physician Careers",
            51: "PHMC - Psych Careers",
            52: "PHMC - Admin Careers",
            53: "PHMC - Nursing Careers",
            54: "PHMC - Coroner Careers",
            55: "PHMC - EMS Careers"
        };

        return versionNames[version] || `Form v${version}`;
    } catch (error) {
        console.warn('Error determining form type:', error);
        return 'Unknown';
    }
};

/**
 * Records input field interaction for error context
 * Usage: Call this in input change handlers to track recent interactions
 * Example: const handleChange = (e) => { recordInputInteraction('text', e.target.name); ... };
 * @param {string} inputType - Type of input interaction (e.g., 'text', 'select', 'checkbox')
 * @param {string} fieldName - Name of the input field
 */
export const recordInputInteraction = (inputType, fieldName) => {
    lastInputInteraction = {
        type: inputType,
        fieldName: fieldName,
        timestamp: Date.now()
    };
    // Clear after 30 seconds
    setTimeout(() => {
        if (lastInputInteraction && lastInputInteraction.timestamp === lastInputInteraction.timestamp) {
            lastInputInteraction = null;
        }
    }, 30000);
};

/**
 * Processes the queue of Discord error messages one by one with a delay.
 * This acts as a rate-limiter to prevent spamming the webhook.
 */
const processDiscordErrorQueue = async () => {
    if (isProcessingDiscordQueue || discordErrorWebhookQueue.length === 0) return;

    const webhookURL = process.env.REACT_APP_ERROR_DISCORD_WEBHOOK_URL || process.env.REACT_APP_DEV_WEBHOOK;
    if (!webhookURL) {
        console.error("Discord Error Webhook: URL is not configured. Cannot process queue.");
        discordErrorWebhookQueue.length = 0; // Clear queue if no URL
        return;
    }

    isProcessingDiscordQueue = true;
    const payload = discordErrorWebhookQueue.shift();
    try {
        await fetch(webhookURL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (e) {
        console.error("CRITICAL: Failed to send Discord error webhook.", e);
    } finally {
        // Rate limit: wait 2 seconds before processing the next item.
        setTimeout(() => {
            isProcessingDiscordQueue = false;
            processDiscordErrorQueue(); // Process next item
        }, 2000);
    }
};

/**
 * Creates and queues a Discord embed for an unhandled error.
 * @param {object} errorDetails - Details about the caught error.
 */
// --- Enhanced Rate Limiting for Discord Error Webhook ---
const ERROR_RATE_LIMIT_WINDOW = 5 * 60 * 1000; // 5 minutes for duplicate check
const MAX_ERRORS_PER_WINDOW = 10; // Max errors in the rolling window
const RATE_LIMIT_DURATION = 60 * 1000; // 1 minute rolling window
let lastDiscordErrorStack = '';
let errorTimestamps = []; // Stores timestamps of recent errors for rate limiting

export const sendDiscordErrorWebhook = (errorDetails) => {
    const now = Date.now();

    // Filter timestamps to the current window
    errorTimestamps = errorTimestamps.filter(timestamp => (now - timestamp) < RATE_LIMIT_DURATION);

    // Check if the rate limit is exceeded
    if (errorTimestamps.length >= MAX_ERRORS_PER_WINDOW) {
        console.warn(`[Discord Error Webhook] Rate limit exceeded. Suppressing error:`, errorDetails.message);
        return;
    }

    const errorMessage = String(errorDetails.message || '').substring(0, 1000);
    const errorStack = String(errorDetails.stack || '').substring(0, 1000);

    // Normalize error message by removing common prefixes like "TypeError:", "ReferenceError:", etc.
    const normalizeErrorMessage = (msg) => {
        return msg.replace(/^(TypeError|ReferenceError|SyntaxError|RangeError|URIError|EvalError|InternalError):\s*/i, '');
    };
    const normalizedErrorMessage = normalizeErrorMessage(errorMessage);

    // If the normalized error message is identical to the last sent, and within the window, skip sending
    if (
        normalizedErrorMessage === normalizeErrorMessage(lastDiscordErrorMessage) &&
        (now - lastDiscordErrorTimestamp) < ERROR_RATE_LIMIT_WINDOW
    ) {
        // Optionally, log to console for debugging
        console.warn('[Discord Error Webhook] Duplicate error suppressed:', errorMessage);
        return;
    }

    // Add new error timestamp
    errorTimestamps.push(now);

    lastDiscordErrorMessage = errorMessage;
    lastDiscordErrorStack = errorStack;
    lastDiscordErrorTimestamp = now;

    // Try to get the Sentry event ID if available
    let sentryEventId = null;
    if (window.Sentry && window.Sentry.lastEventId) {
        sentryEventId = window.Sentry.lastEventId();
    } else if (Sentry && Sentry.lastEventId) {
        sentryEventId = Sentry.lastEventId();
    }

    const embed = {
        title: errorDetails.isButtonClickError ? "🚨 Button Click Error 🚨" : "🚨 Unhandled Application Error 🚨",
        description: "An unhandled error was caught by the global error handler.",
        color: isSentryBlocked ? 0xFFA500 : 0xDE354C, // Orange if Sentry is blocked, Red otherwise
        fields: [
            { name: "Error Type", value: errorDetails.isButtonClickError ? "UI Button Interaction" : errorDetails.isInputFieldError ? "Input Field Interaction" : "General", inline: true },
            { name: "Sentry Status", value: isSentryBlocked ? "⚠️ Blocked / Unreachable" : "✅ Active", inline: true },
            { name: "Form Type", value: `\`${errorDetails.currentFormType || 'Unknown'}\``, inline: true },
            { name: "Error Message", value: `\`${errorMessage}\``, inline: false },
            { name: "Source File", value: errorDetails.source || "N/A", inline: true },
            { name: "Line", value: errorDetails.lineno || "N/A", inline: true },
            { name: "Column", value: errorDetails.colno || "N/A", inline: true },
            { name: "User Agent", value: `\`${navigator.userAgent}\``, inline: false },
            errorDetails.isInputFieldError ? { name: "Input Field Type", value: `\`${errorDetails.inputFieldType}\``, inline: true } : null,
            errorDetails.lastInputInteraction ? { name: "Last Input Interaction", value: `\`${errorDetails.lastInputInteraction.type} - ${errorDetails.lastInputInteraction.fieldName}\``, inline: true } : null,
            { name: "Stack Trace", value: `\`${errorStack}\``, inline: false },
            sentryEventId ? { name: "Sentry Trace/Event ID", value: `\`${sentryEventId}\``, inline: false } : null,
        ].filter(Boolean),
        timestamp: new Date().toISOString(),
        footer: { text: "PHMC Tools - Global Error Handler" }
    };
    discordErrorWebhookQueue.push({ content: '<@228306972204597248>', embeds: [embed] });
    processDiscordErrorQueue(); // Start processing the queue if it's not already running
};



init({
  dsn: "https://5dfa5683e8dc9adbc7f30e44757995c7@o4509126124765184.ingest.de.sentry.io/4509126125813840",
  sendDefaultPii: true,
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
        lastInputInteraction
    };
    sendDiscordErrorWebhook(errorDetails);

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