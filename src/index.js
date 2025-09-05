import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { H } from 'highlight.run';
import { NotificationProvider } from './contexts/NotificationContext';
import { DataProvider } from './contexts/DataContext';
import { app, analytics } from './firebase';
import { logEvent } from "firebase/analytics";
import Rollbar from 'rollbar';
import { Provider as RollbarProvider } from '@rollbar/react';
import ErrorBoundary from './components/ErrorBoundary';

// --- START: Fallback Error Reporting ---
const discordErrorWebhookQueue = [];
let isProcessingDiscordQueue = false;
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

    const embed = {
        
        title: errorDetails.isButtonClickError ? "🚨 Button Click Error 🚨" : "🚨 Unhandled Application Error 🚨",
        description: "An unhandled error was caught by the global error handler.",
        color: 0xDE354C,
        fields: [
            { name: "Error Type", value: errorDetails.isButtonClickError ? "UI Button Interaction" : "General", inline: true },
            { name: "Error Message", value: `\`${String(errorDetails.message).substring(0, 1000)}\``, inline: false },
            { name: "Source File", value: errorDetails.source || "N/A", inline: true },
            { name: "Line", value: errorDetails.lineno || "N/A", inline: true },
            { name: "Column", value: errorDetails.colno || "N/A", inline: true },
            { name: "User Agent", value: `\`${navigator.userAgent}\``, inline: false },
            { name: "Stack Trace", value: `\`${String(errorDetails.stack).substring(0, 1000)}\``, inline: false },
        ].filter(Boolean),
        timestamp: new Date().toISOString(),
        footer: { text: "PHMC Forms - Global Error Handler" }
    };
    discordErrorWebhookQueue.push({ content: '<@228306972204597248>', embeds: [embed] });
    processDiscordErrorQueue(); // Start processing the queue if it's not already running
};

H.init('6gl53qme', {
	serviceName: "frontend-app",
	tracingOrigins: true,
	networkRecording: {
		enabled: true,
		recordHeadersAndBody: true,
		urlBlocklist: [
			// insert full or partial urls that you don't want to record here
			// Out of the box, Highlight will not record these URLs (they can be safely removed):
			"https://www.googleapis.com/identitytoolkit",
			"https://securetoken.googleapis.com",
		],
	},
});

const rollbarConfig = {
    accessToken: process.env.REACT_APP_ROLLBAR_ACCESS_TOKEN,
    environment: 'testenv',
    captureUncaught: true,
    captureUnhandledRejections: true,
};
const rollbar = new Rollbar(rollbarConfig);

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
        is_button_error: isButtonClickError // Custom parameter
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

    // Return false to ensure the error is still processed by other handlers
    // and the default browser console output.
    return false;
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <RollbarProvider instance={rollbar}>
      <ErrorBoundary>
        <NotificationProvider>
          <DataProvider>
            <App />
          </DataProvider>
        </NotificationProvider>
      </ErrorBoundary>
    </RollbarProvider>
);

reportWebVitals();
