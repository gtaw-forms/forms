// src/index.js

import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import * as Sentry from "@sentry/react";

// --- START: Fallback Error Reporting ---

// A lightweight, Sentry-independent webhook sender.
// It includes a simple queue and rate-limiting to prevent spamming Discord.
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
        // At this point, even our fallback failed. Log it to the console.
        console.error("CRITICAL: Failed to send fallback error webhook.", e);
    } finally {
        // Wait a moment before processing the next item to avoid Discord rate limits
        setTimeout(() => {
            isProcessingFallbackQueue = false;
            // Check if there's more in the queue
            if (fallbackWebhookQueue.length > 0) {
                processFallbackQueue(webhookURL);
            }
        }, 2000); // 2-second delay
    }
};

const sendFallbackErrorWebhook = (errorDetails) => {
    // Use your primary or a specific fallback webhook URL
    const webhookURL = process.env.REACT_APP_DISCORD_WEBHOOK_URL; 
    if (!webhookURL) {
        console.error("Fallback Webhook: URL is not configured. Cannot send error report.");
        return;
    }

    const embed = {
        title: "🚨 Sentry Blocked - Fallback Error Report 🚨",
        description: "An error occurred, but Sentry's SDK failed to initialize (likely blocked by an ad-blocker or network issue). This is a fallback report.",
        color: 0xFFA500, // Orange for warning
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


try {
  Sentry.init({
    dsn: "https://5dfa5683e8dc9adbc7f30e44757995c7@o4509126124765184.ingest.de.sentry.io/4509126125813840",
    // If you implement tunneling, add the tunnel property here.
    // tunnel: "/sentry-tunnel",
  });
  console.log("Sentry initialized successfully.");
} catch (error) {
    console.error("Sentry initialization failed. This may be due to an ad-blocker or network issue. Setting up fallback error reporting.", error);
    
    // Sentry is blocked or failed to load. Set up our own global error handler.
    window.onerror = (message, source, lineno, colno, errorObject) => {
        // You can add checks here to avoid reporting certain trivial errors
        if (typeof message === 'string' && message.includes("ResizeObserver loop limit exceeded")) {
            return true; // Don't report this common, non-critical browser error
        }

        sendFallbackErrorWebhook({
            message: message,
            source: source,
            lineno: lineno,
            colno: colno,
            error: errorObject
        });

        // Return false to allow the default browser error handling to continue.
        // Return true to suppress the error from being shown in the browser console.
        return false;
    };
}


const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
      <App />
  </React.StrictMode>
);

reportWebVitals();
