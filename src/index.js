import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { init, getClient } from "@sentry/react";
import { NotificationProvider } from './contexts/NotificationContext';
import { DataProvider } from './contexts/DataContext';
import { useNotification } from './contexts/NotificationContext';
import * as Sentry from "@sentry/react";
import { app, analytics } from './firebase';
import { logEvent } from "firebase/analytics";
import { Provider as RollbarProvider } from '@rollbar/react';
import ErrorBoundary from './components/ErrorBoundary';

// --- START: Fallback Error Reporting ---
const discordErrorWebhookQueue = [];
let isProcessingDiscordQueue = false;
let isSentryBlocked = false; // Flag to track if Sentry connectivity failed
let lastDiscordErrorMessage = '';
let lastDiscordErrorTimestamp = 0;

/**
 * Processes the queue of Discord error messages one by one with a delay.
 * This acts as a rate-limiter to prevent spamming the webhook.
 */
const processDiscordErrorQueue = async () => {
    if (isProcessingDiscordQueue || discordErrorWebhookQueue.length === 0) return;

    const webhookURL = process.env.REACT_APP_DEV_WEBHOOK;
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
const sendDiscordErrorWebhook = (errorDetails) => {
    const now = Date.now();
    if (errorDetails.message === lastDiscordErrorMessage && now - lastDiscordErrorTimestamp < 5000) {
        console.log("Skipping duplicate Discord error message.");
        return;
    }
    lastDiscordErrorMessage = errorDetails.message;
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
            { name: "Error Type", value: errorDetails.isButtonClickError ? "UI Button Interaction" : "General", inline: true },
            { name: "Sentry Status", value: isSentryBlocked ? "⚠️ Blocked / Unreachable" : "✅ Active", inline: true },
            { name: "Error Message", value: `\`${String(errorDetails.message).substring(0, 1000)}\``, inline: false },
            { name: "Source File", value: errorDetails.source || "N/A", inline: true },
            { name: "Line", value: errorDetails.lineno || "N/A", inline: true },
            { name: "Column", value: errorDetails.colno || "N/A", inline: true },
            { name: "User Agent", value: `\`${navigator.userAgent}\``, inline: false },
            { name: "Stack Trace", value: `\`${String(errorDetails.stack).substring(0, 1000)}\``, inline: false },
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
    if (typeof message === 'string' && message.includes("ResizeObserver loop limit exceeded")) {
        return true; // Suppress this error from being processed further.
    }

    // --- Button Error Detection ---
    let isButtonClickError = false;
    if (errorObject && typeof errorObject.stack === 'string') {
        // Check for common patterns of event handlers in stack traces
        if (errorObject.stack.includes('onClick') || errorObject.stack.includes('handleClick')) {
            isButtonClickError = true;
        }
    }
    // --- End Button Error Detection ---

    // Log the error to Firebase Analytics
    logEvent(analytics, 'exception', {
        description: message,
        fatal: true,
        is_button_error: isButtonClickError,
        error_message: String(message).substring(0, 100),
        stack: errorObject && errorObject.stack ? String(errorObject.stack).substring(0, 100) : undefined,
        source: source || undefined,
        lineno: lineno || undefined,
        colno: colno || undefined
    });

    // Queue the error for reporting to Discord.
    const errorDetails = {
        message,
        source,
        lineno,
        colno,
        error: errorObject,
        stack: errorObject ? errorObject.stack : 'N/A',
        isButtonClickError // Pass the flag to the webhook function
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

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
      <ErrorBoundary>
        <NotificationProvider>
          <DataProvider>
            <Root />
          </DataProvider>
        </NotificationProvider>
      </ErrorBoundary>
);

reportWebVitals();