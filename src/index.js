import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { init, getClient } from "@sentry/react";
import { NotificationProvider } from './contexts/NotificationContext';
import { DataProvider } from './contexts/DataContext';
// --- MODIFICATION END ---
import * as Sentry from "@sentry/react";

// --- START: Fallback Error Reporting (This logic is excellent, no changes needed) ---
const discordErrorWebhookQueue = [];
let isProcessingDiscordQueue = false;
let isSentryBlocked = false; // Flag to track if Sentry connectivity failed

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
    const embed = {
        title: "🚨 Unhandled Application Error 🚨",
        description: "An unhandled error was caught by the global error handler.",
        color: isSentryBlocked ? 0xFFA500 : 0xDE354C, // Orange if Sentry is blocked, Red otherwise
        fields: [
            { name: "Sentry Status", value: isSentryBlocked ? "⚠️ Blocked / Unreachable" : "✅ Active", inline: false },
            { name: "Error Message", value: `\`\`\`${String(errorDetails.message).substring(0, 1000)}\`\`\``, inline: false },
            { name: "Source File", value: errorDetails.source || "N/A", inline: true },
            { name: "Line", value: errorDetails.lineno || "N/A", inline: true },
            { name: "Column", value: errorDetails.colno || "N/A", inline: true },
            { name: "User Agent", value: `\`\`\`${navigator.userAgent}\`\`\``, inline: false },
        ],
        timestamp: new Date().toISOString(),
        footer: { text: "PHMC Forms - Global Error Handler" }
    };
    discordErrorWebhookQueue.push({ embeds: [embed] });
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
});console.log("Sentry has been initialized.");

// --- Global Error Handling Setup ---
// This custom handler will report errors to Discord and then allow Sentry's default handler to run.
window.onerror = (message, source, lineno, colno, errorObject) => {
    // Ignore common, non-critical errors that can create a lot of noise.
    if (typeof message === 'string' && message.includes("ResizeObserver loop limit exceeded")) {
        return true; // Suppress this error from being processed further.
    }

    // Queue the error for reporting to Discord.
    sendDiscordErrorWebhook({ message, source, lineno, colno, error: errorObject });

    // Return false to ensure the error is still processed by other handlers (like Sentry's)
    // and the default browser console output.
    return false;
};

// 2. Asynchronously check Sentry connectivity to provide more context in Discord alerts.
(async () => {
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
        console.warn("Sentry connectivity check failed. Sentry may be blocked. Discord reports will reflect this.", error);
        isSentryBlocked = true; // Set the flag
    }
})();


const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <NotificationProvider>
      <DataProvider>
        <App />
      </DataProvider>
    </NotificationProvider>
  </React.StrictMode>
);

reportWebVitals();
