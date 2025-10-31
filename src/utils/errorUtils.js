/**
 * Error handling utilities for Discord webhooks and global error reporting
 */

import * as Sentry from "@sentry/react";

// --- Global Error Handling Setup ---
let lastDiscordErrorMessage = '';
let lastDiscordErrorTimestamp = 0;
let lastInputInteraction = null; // Tracks recent input field interactions

// --- Discord Error Webhook Queue ---
const discordErrorWebhookQueue = [];
let isProcessingDiscordQueue = false;

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
export const sendDiscordErrorWebhook = (errorDetails, sentryBlocked = false) => {
    // --- Enhanced Rate Limiting for Discord Error Webhook ---
    const ERROR_RATE_LIMIT_WINDOW = 5 * 60 * 1000; // 5 minutes for duplicate check
    const MAX_ERRORS_PER_WINDOW = 10; // Max errors in the rolling window
    const RATE_LIMIT_DURATION = 60 * 1000; // 1 minute rolling window
    let lastDiscordErrorStack = '';
    let errorTimestamps = []; // Stores timestamps of recent errors for rate limiting

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
        color: sentryBlocked ? 0xFFA500 : 0xDE354C, // Orange if Sentry is blocked, Red otherwise
        fields: [
            { name: "Error Type", value: errorDetails.isButtonClickError ? "UI Button Interaction" : errorDetails.isInputFieldError ? "Input Field Interaction" : "General", inline: true },
            { name: "Sentry Status", value: sentryBlocked ? "⚠️ Blocked / Unreachable" : "✅ Active", inline: true },
            { name: "Form Type", value: `\`${errorDetails.currentFormType || getCurrentFormType()}\``, inline: true },
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