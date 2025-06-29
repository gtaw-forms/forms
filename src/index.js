import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
// --- MODIFICATION START ---
// 1. Use `import` to make functions available in this file.
// 2. Use the modern `getClient` instead of the deprecated `getCurrentHub`.
import { init, getClient } from "@sentry/react";
// --- MODIFICATION END ---
import * as Sentry from "@sentry/react";

// --- START: Fallback Error Reporting (This logic is excellent, no changes needed) ---
const fallbackWebhookQueue = [];
let isProcessingFallbackQueue = false;

const processFallbackQueue = async (webhookURL) => {
    if (isProcessingFallbackQueue || fallbackWebhookQueue.length === 0) return;
    isProcessingFallbackQueue = true;
    const payload = fallbackWebhookQueue.shift();
    try {
        await fetch(webhookURL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (e) {
        console.error("CRITICAL: Failed to send fallback error webhook.", e);
    } finally {
        setTimeout(() => {
            isProcessingFallbackQueue = false;
            if (fallbackWebhookQueue.length > 0) {
                processFallbackQueue(webhookURL);
            }
        }, 2000);
    }
};

const sendFallbackErrorWebhook = (errorDetails) => {
    const webhookURL = process.env.REACT_APP_DISCORD_WEBHOOK_URL; 
    if (!webhookURL) {
        console.error("Fallback Webhook: URL is not configured. Cannot send error report.");
        return;
    }
    const embed = {
        title: "🚨 Sentry Blocked - Fallback Error Report 🚨",
        description: "An error occurred, but Sentry's SDK seems to be blocked. This is a fallback report.",
        color: 0xFFA500, // Orange
        fields: [
            { name: "Error Message", value: `\`\`\`${String(errorDetails.message).substring(0, 1000)}\`\`\``, inline: false },
            { name: "Source File", value: errorDetails.source || "N/A", inline: true },
            { name: "Line", value: errorDetails.lineno || "N/A", inline: true },
            { name: "Column", value: errorDetails.colno || "N/A", inline: true },
            { name: "User Agent", value: `\`\`\`${navigator.userAgent}\`\`\``, inline: false },
        ],
        timestamp: new Date().toISOString(),
        footer: { text: "PHMC Forms - Fallback Error Handler" }
    };
    fallbackWebhookQueue.push({ embeds: [embed] });
    processFallbackQueue(webhookURL);
};
// --- END: Fallback Error Reporting ---


// 1. Initialize Sentry.
// The `init` function is now correctly in scope and can be called.
init({
  dsn: "https://5dfa5683e8dc9adbc7f30e44757995c7@o4509126124765184.ingest.de.sentry.io/4509126125813840",
  sendDefaultPii: true,
  integrations: [
    Sentry.replayIntegration()
  ],
  // Session Replay
  replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
  replaysOnErrorSampleRate: 1.0 // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.
});
console.log("Sentry has been initialized. Now checking connectivity.");

// 2. Asynchronously check if Sentry is actually able to send data.
(async () => {
    // Wait a moment for Sentry's client to be fully available after init.
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // --- MODIFICATION START ---
    // Use the modern `getClient()` function, which is the direct replacement for `getCurrentHub().getClient()`.
    const client = getClient();
    // --- MODIFICATION END ---

    if (!client || !client.getDsn()) {
        console.error("Sentry client or DSN not found. Setting up fallback error reporting immediately.");
        window.onerror = (message, source, lineno, colno, errorObject) => {
            sendFallbackErrorWebhook({ message, source, lineno, colno, error: errorObject });
            return false;
        };
        return;
    }

    const dsn = client.getDsn();
    const ingestUrl = `${dsn.protocol}://${dsn.host}/api/${dsn.projectId}/envelope/`;

    try {
        await fetch(ingestUrl, { method: 'HEAD', mode: 'no-cors' });
        console.log("Sentry connectivity check successful. Fallback is not needed.");
    } catch (error) {
        console.warn("Sentry connectivity check failed. Setting up fallback error reporting.", error);
        
        window.onerror = (message, source, lineno, colno, errorObject) => {
            if (typeof message === 'string' && message.includes("ResizeObserver loop limit exceeded")) {
                return true;
            }
            sendFallbackErrorWebhook({ message, source, lineno, colno, error: errorObject });
            return false;
        };
    }
})();


const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
      <App />
  </React.StrictMode>
);

reportWebVitals();
