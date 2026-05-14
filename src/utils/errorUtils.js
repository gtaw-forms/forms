/**
 * Error handling utilities for Discord webhooks and global error reporting
 */

import * as Sentry from "@sentry/react";

// --- Error Categorization ---
const ErrorCategory = {
    CONNECTION: 'Connection Error',
    DATA_PROCESSING: 'Data Processing / Render Error',
    SENTRY_API: 'Sentry API Error',
    WEBHOOK: 'Webhook Error',
    UNKNOWN: 'Unknown Error',
};

/**
 * Analyzes an error message to categorize it and provide a debugging suggestion.
 * @param {string} message - The error message string.
 * @returns {{category: string, suggestion: string}}
 */
const categorizeError = (message) => {
    const lowerMessage = (message || '').toLowerCase();

    if (lowerMessage === 'script error.') {
        return {
            category: 'Cross-Origin / Masked Error',
            suggestion: "The browser suppressed the details of this error because it occurred in a script from a different origin (CORS). Possible causes: 1. A script from a CDN failing. 2. A browser extension injecting code. 3. A script loaded without 'crossorigin=\"anonymous\"'. Since this is an iPhone user, it could also be a failure in a WebKit-injected script."
        };
    }

    if (/\.map is not a function|\.find is not a function|\.filter is not a function|cannot read properties of undefined/.test(lowerMessage)) {
        return {
            category: ErrorCategory.DATA_PROCESSING,
            suggestion: "A component likely tried to render a list (e.g., using `.map`) but the data was `undefined` or not an array. Check context providers and data fetching logic to ensure defaults are always arrays (e.g., `myList || []`)."
        };
    }
    if (/failed to fetch|networkerror/.test(lowerMessage)) {
        return {
            category: ErrorCategory.CONNECTION,
            suggestion: "A network request failed. This could be a user's connection issue, a CORS problem, or the downstream service (e.g., Firebase, Discord webhook) being unavailable."
        };
    }
    if (/sentry.*error/.test(lowerMessage)) {
        return {
            category: ErrorCategory.SENTRY_API,
            suggestion: "The Sentry SDK itself threw an error. This might be a configuration issue or a problem with the Sentry service."
        };
    }

    return {
        category: ErrorCategory.UNKNOWN,
        suggestion: "The error type is not automatically recognized. Manual investigation of the stack trace and error message is required."
    };
};


// --- Global Error Handling Setup ---
let lastDiscordErrorMessage = '';
let lastDiscordErrorTimestamp = 0;
let lastInputInteraction = null; // Tracks recent input field interactions
let isProcessingDiscordQueue = false;
let discordErrorWebhookQueue = [];
let errorTimestamps = []; // Stores timestamps of recent errors for rate limiting (module-level)

/**
 * Records input field interaction for error context
 * Usage: Call this in input change handlers to track recent interactions
 * Example: const handleChange = (e) => { recordInputInteraction('text', e.target.name); ... };
 * @param {string} inputType - Type of input interaction (e.g., 'text', 'select', 'checkbox')
 * @param {string} fieldName - Name of the input field
 */
export const recordInputInteraction = (inputType, fieldName) => {
    const timestamp = Date.now();
    lastInputInteraction = {
        type: inputType,
        fieldName: fieldName,
        timestamp: timestamp
    };
    // Clear after 30 seconds
    setTimeout(() => {
        if (lastInputInteraction && lastInputInteraction.timestamp === timestamp) {
            lastInputInteraction = null;
        }
    }, 30000);
};

/**
 * Returns the last recorded input interaction
 * @returns {Object|null}
 */
export const getLastInputInteraction = () => lastInputInteraction;

// --- Console Interceptor ---
let isConsoleIntercepted = false;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

/**
 * Initializes interceptors for console.error and console.warn to redirect them to Discord
 * when Sentry is blocked or unreachable.
 */
export const initConsoleInterceptor = (isSentryBlockedProvider) => {
    if (isConsoleIntercepted) return;
    isConsoleIntercepted = true;

    // Add a custom 'critical' level to the console object
    console.critical = (...args) => {
        // Prepend [CRITICAL] to ensure it bypasses the Discord filter logic
        console.error('[CRITICAL]', ...args);
    };

    console.error = (...args) => {
        originalConsoleError.apply(console, args);
        
        const isSentryBlocked = typeof isSentryBlockedProvider === 'function' 
            ? isSentryBlockedProvider() 
            : isSentryBlockedProvider;

        // Only redirect to Discord if Sentry is blocked or if it's a critical PHMC error
        const message = args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');

        if (isSentryBlocked || message.includes('PHMC') || message.includes('CRITICAL')) {
            // Avoid infinite loops if sendDiscordErrorWebhook calls console.error
            if (message.includes('[Discord Error Webhook]')) return;

            const errorDetails = {
                message: `[Console Error] ${message}`,
                source: 'Console Interceptor',
                lineno: 0,
                colno: 0,
                stack: new Error().stack,
                currentFormType: getCurrentFormType(),
                lastInputInteraction: getLastInputInteraction(),
                url: window.location.href,
                navigationHistory: window.navigationHistory || [],
                isConsoleError: true
            };
            sendDiscordErrorWebhook(errorDetails, isSentryBlocked);
        }
    };

    console.warn = (...args) => {
        originalConsoleWarn.apply(console, args);

        const isSentryBlocked = typeof isSentryBlockedProvider === 'function' 
            ? isSentryBlockedProvider() 
            : isSentryBlockedProvider;

        const message = args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');

        // Only redirect warnings to Discord if they seem critical and Sentry is blocked
        if (isSentryBlocked && (message.includes('PHMC') || message.includes('CRITICAL') || message.includes('Security'))) {
            if (message.includes('[Discord Error Webhook]')) return;

            const errorDetails = {
                message: `[Console Warn] ${message}`,
                source: 'Console Interceptor',
                lineno: 0,
                colno: 0,
                currentFormType: getCurrentFormType(),
                lastInputInteraction: getLastInputInteraction(),
                url: window.location.href,
                navigationHistory: window.navigationHistory || [],
                isConsoleError: true
            };
            sendDiscordErrorWebhook(errorDetails, isSentryBlocked);
        }
    };
};

/**
 * Automatically determines the current form type from localStorage.
 * @returns {string} The form name or 'Unknown' if not found
 */
export const getCurrentFormType = () => {
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

/**
 * Processes the queue of Discord error messages one by one with a delay.
 * This acts as a rate-limiter to prevent spamming the webhook.
 */
const processDiscordErrorQueue = async () => {
    if (isProcessingDiscordQueue || discordErrorWebhookQueue.length === 0) return;

    const webhookURL = import.meta.env.VITE_DISCORD_WEBHOOK_ERRORS || import.meta.env.VITE_ERROR_DISCORD_WEBHOOK_URL || import.meta.env.VITE_DEV_WEBHOOK;
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
export const sendDiscordErrorWebhook = (errorDetails, sentryBlocked = false) => {
    // --- Enhanced Rate Limiting for Discord Error Webhook ---
    const ERROR_RATE_LIMIT_WINDOW = 5 * 60 * 1000; // 5 minutes for duplicate check
    const MAX_ERRORS_PER_WINDOW = 10; // Max errors in the rolling window
    const RATE_LIMIT_DURATION = 60 * 1000; // 1 minute rolling window
    let lastDiscordErrorStack = '';

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

    const { category, suggestion } = categorizeError(errorMessage);

    const embed = {
        title: errorDetails.isButtonClickError ? "🚨 Button Click Error 🚨" : errorDetails.isLogicalError ? "🧪 Logical Inconsistency Detected 🧪" : "🚨 Unhandled Application Error 🚨",
        description: errorDetails.isLogicalError ? "A logical error or data inconsistency was detected by the application." : "An unhandled error was caught by the global error handler.",
        color: errorDetails.isLogicalError ? 0x3498db : (sentryBlocked ? 0xFFA500 : 0xDE354C), // Blue for logical, Orange if Sentry blocked, Red otherwise
        fields: [
            { name: "Error Type", value: errorDetails.isLogicalError ? "Logical/Data" : (errorDetails.isButtonClickError ? "UI Button Interaction" : (errorDetails.isInputFieldError ? "Input Field Interaction" : "General")), inline: true },
            { name: "Sentry Status", value: sentryBlocked ? "⚠️ Blocked / Unreachable" : "✅ Active", inline: true },
            { name: "Form Type", value: `\`${errorDetails.currentFormType || getCurrentFormType()}\``, inline: true },
            { name: "Error Message", value: `\`${errorMessage}\``, inline: false },
            { name: "Context / Location", value: `**${errorDetails.context || errorDetails.source || "Unknown Location"}**`, inline: true },
            !errorDetails.isLogicalError ? { name: "Line/Col", value: `L${errorDetails.lineno || "N/A"}:C${errorDetails.colno || "N/A"}`, inline: true } : null,
            { name: "Debugging Suggestion", value: suggestion || "Check the provided context and logs.", inline: false },
            { name: "User Agent", value: `\`${navigator.userAgent}\``, inline: false },
            sentryEventId ? { name: "Sentry Trace/Event ID", value: `\`${sentryEventId}\``, inline: false } : null,
            errorDetails.navigationHistory && errorDetails.navigationHistory.length > 0 ? { 
                name: "Navigation History (Last 15)", 
                value: `\`\`\`\n${errorDetails.navigationHistory.map(h => `[${h.timestamp}] (${h.type}) ${h.path}`).join('\n')}\n\`\`\``, 
                inline: false 
            } : null,
            errorDetails.clientInfo ? { name: "Client Info", value: `\`\`\`json\n${JSON.stringify(errorDetails.clientInfo, null, 2)}\n\`\`\``, inline: false } : null,
        ].filter(Boolean),
        timestamp: new Date().toISOString(),
        footer: { text: `PHMC Tools - Global Error Handler | ` }
    };
    discordErrorWebhookQueue.push({ content: '<@228306972204597248>', embeds: [embed] });
    processDiscordErrorQueue(); // Start processing the queue if it's not already running
};

/**
 * Reports a logical error or data inconsistency that doesn't cause a crash but needs attention.
 * This is useful for catching rare bugs like the 'GTAW User' author name issue.
 * @param {string} title - Brief title of the issue
 * @param {string} message - Detailed description
 * @param {Object} context - Relevant data context for debugging
 */
export const reportLogicalError = (title, message, context = {}) => {
    const timestamp = new Date().toISOString();
    
    // 1. Log to Sentry
    Sentry.captureMessage(`[Logical Error] ${title}`, {
        level: "warning",
        tags: {
            errorType: 'logical_inconsistency',
            formType: getCurrentFormType()
        },
        extra: {
            description: message,
            ...context,
            navigationHistory: window.visitedForms || [],
            timestamp
        }
    });

    // 2. Queue for Discord
    const errorDetails = {
        message: `${title}: ${message}`,
        context: "Logical Error Handler",
        currentFormType: getCurrentFormType(),
        isLogicalError: true,
        userInfo: context.userInfo || null,
        clientInfo: {
            timestamp,
            ...context
        }
    };
    
    // We reuse the existing Discord error webhook logic
    sendDiscordErrorWebhook(errorDetails);
};
