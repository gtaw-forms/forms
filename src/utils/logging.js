import * as Sentry from "@sentry/react";
import { triggerWebhookProxy } from '../services/firebaseFunctions';

// ---------------------------------------------------------------------------
// IndexedDB Cascade Error Filtering
// ---------------------------------------------------------------------------
// When a user's browser/disk can't open IndexedDB (quota/disk full), Firebase
// internals keep firing idb-get/idb-set against the dead connection and every
// aborted transaction surfaces as an unhandled AbortError. These are all the
// SAME root cause — filter them so only the one tagged event survives.
const IDB_CASCADE_PATTERNS = [
    /The transaction was aborted,?/i,
    /database connection is closing/i,
    /Encountered full disk while opening backing store/i,
    /Failed to execute 'transaction' on 'IDBDatabase'/i,
    /app\/idb-(get|set)/i,
];

export const isIndexedDBCascadeError = (error) => {
    const message = String(error?.message ?? error ?? '');
    return IDB_CASCADE_PATTERNS.some(re => re.test(message));
};

// ---------------------------------------------------------------------------
// User Context Helpers
// ---------------------------------------------------------------------------

export const getUserContext = () => {
    const userAgent = navigator.userAgent || "N/A";
    let timeZone = "N/A";
    try {
        timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (e) {
        console.warn("Could not determine user timezone:", e);
    }
    return { userAgent, timeZone };
};

export const getUserOAuthIdentity = () => {
    try {
        const userData = localStorage.getItem('gta-user-data');
        if (!userData) return null;

        const user = JSON.parse(userData);
        if (!user) return null;

        const username = user.username || null;
        const faction = user.faction;
        const characterName = faction?.characterName || user.activeCharacter?.characterName || user.allFactionCharacters?.[0]?.character?.characterName || user.allFactionCharacters?.[0]?.characterName || null;
        const characterId = faction?.characterId || user.activeCharacter?.characterId || user.allFactionCharacters?.[0]?.character?.characterId || user.allFactionCharacters?.[0]?.id || null;

        return {
            username,
            characterName,
            characterId,
            // The server `faction` object only carries characterName/characterId/
            // rank/scriptRank (no factionName/name), so deriving the label from
            // factionName/name always rendered "Unknown". Fall back to the
            // membership flag so the report is truthful when faction exists.
            faction: faction?.factionName || faction?.name || (user.isFactionMember ? 'PHMC' : null)
        };
    } catch (error) {
        console.warn('Failed to get user OAuth identity:', error);
        return null;
    }
};

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

// ---------------------------------------------------------------------------
// Admin Action Logger
// ---------------------------------------------------------------------------

export const logAdminAction = async (adminEmail, action, details, context = null, userAgent = null, timeZone = null, gtaAuthUsername = null, characterData = null) => {
    const userIdentifier = gtaAuthUsername ? `${gtaAuthUsername} (${adminEmail})` : (adminEmail || "Unknown");

    let description = context
        ? `**Action:** ${action || "Unknown Action"}\n**Admin:** ${userIdentifier}\n**Category:** ${context}`
        : `**Action:** ${action || "Unknown Action"}\n**Admin:** ${userIdentifier}`;

    if (characterData && characterData.debugInfo) {
        const { debugInfo } = characterData;
        if (debugInfo.foundMember && debugInfo.charactersChecked?.length > 0) {
            const primaryCharacter = characterData.faction;
            description += `\n**Primary Character:** ${primaryCharacter?.characterName || 'Unknown'} (ID: ${primaryCharacter?.characterId || 'N/A'}) - Rank ${primaryCharacter?.scriptRank || 'N/A'}`;

            if (debugInfo.charactersChecked.length > 1) {
                description += `\n**All Characters:** ${debugInfo.charactersChecked.length} total`;
            }
        }
    }

    const fields = [
        { name: "Details", value: `\`\`\`${details ? String(details).substring(0, 1000) : 'N/A'}\`\`\``, inline: false }
    ];

    if (characterData && characterData.debugInfo?.charactersChecked?.length > 0) {
        const characterDetails = characterData.debugInfo.charactersChecked.map((char, index) => {
            return `${index + 1}. ${char.name || 'Unknown'} (ID: ${char.id || 'N/A'})`;
        }).join('\n');

        const factionMembers = characterData.debugInfo.charactersChecked.filter(char =>
            characterData.faction && char.id === characterData.faction.characterId
        );

        let characterField = `**All Characters (${characterData.debugInfo.charactersChecked.length}):**\n${characterDetails}`;

        if (characterData.debugInfo.foundMember) {
            characterField += `\n\n**PHMC Member:** ${characterData.faction?.characterName || 'Unknown'} (Rank ${characterData.faction?.scriptRank || 'N/A'})`;
            characterField += `\n**Access Level:** ${characterData.accessLevel || 'none'}`;
        } else {
            characterField += `\n\n**PHMC Status:** Not a faction member`;
        }

        fields.push({
            name: "Character Information",
            value: characterField.substring(0, 1024),
            inline: false
        });
    }

    const embed = {
        title: "Admin Action Logged",
        color: 0xFFA500,
        description: description,
        fields: fields,
        timestamp: new Date().toISOString(),
        footer: { text: `PHMC Tools | ${timeZone}` }
    };

    try {
        await triggerWebhookProxy('admin', { embeds: [embed] });
        console.log(`Admin action logged to Discord: ${action}`);
    } catch (error) {
        console.error('Error sending admin action webhook:', error);
        Sentry.captureException(error, {
            extra: {
                context: 'Admin Action Webhook via Proxy',
            }
        });
    }
};

// ---------------------------------------------------------------------------
// Auth Logger
// ---------------------------------------------------------------------------

export const logAuthErrorToDiscord = async (error, context) => {
  try {
    const embed = {
      title: 'Authentication Error',
      description: `An error occurred during: **${context}**`,
      color: 15158332,
      fields: [
        {
          name: 'Error Message',
          value: clampField(`\n\n${error.message || 'No message'}\n\n`),
        },
        {
          name: 'Stack Trace',
          value: clampField(`\n\n${error.stack || 'No stack trace'}\n\n`),
        },
      ],
      timestamp: new Date().toISOString(),
      footer: {
        text: 'PHMC Forms - Auth Error Logger',
      },
    };

    const payload = {
      username: 'Auth Error Bot',
      embeds: [embed],
    };

    await triggerWebhookProxy('auth', payload);
  } catch (loggingError) {
    console.error('Failed to log auth error to Discord:', loggingError);
  }
};

// ---------------------------------------------------------------------------
// Identity Refresh Logger
// ---------------------------------------------------------------------------

let lastIdentityRefreshLog = { username: '', at: 0 };
const IDENTITY_REFRESH_LOG_COOLDOWN_MS = 60 * 1000;

/**
 * Log a background identity profile refresh to the Discord admin webhook.
 * Fired on each attempt so the sequence is traceable; deduped per user (60s)
 * so a page-load loop can't flood the channel.
 */
export const logIdentityRefresh = async ({ username, characterName, trigger, attempt, maxAttempts, matchedBy, success, promptedReauth = false }) => {
  const now = Date.now();
  if (username && lastIdentityRefreshLog.username === username && (now - lastIdentityRefreshLog.at) < IDENTITY_REFRESH_LOG_COOLDOWN_MS) {
    return;
  }
  lastIdentityRefreshLog = { username: username || '', at: now };

  try {
    const embed = {
      title: 'Identity Refresh',
      color: success ? 0x2ecc71 : 0xffc107,
      description: `**User:** ${username || 'Unknown'}\n**Character:** ${characterName || 'N/A'}\n\nVisited site, previously authenticated, refreshing profile.`,
      fields: [
        { name: 'Trigger', value: trigger || 'unknown', inline: true },
        { name: 'Attempt', value: `${attempt}/${maxAttempts}`, inline: true },
        { name: 'Matched by', value: matchedBy || 'none', inline: true },
        { name: 'Success', value: success ? 'yes' : 'no', inline: true },
        ...(promptedReauth ? [{ name: 'Prompt', value: 'Re-auth notification shown to user', inline: false }] : []),
      ],
      timestamp: new Date().toISOString(),
      footer: { text: 'PHMC Forms - Identity Refresh' },
    };

    await triggerWebhookProxy('admin', { embeds: [embed] });
  } catch (err) {
    console.warn('[IdentityRefresh] Failed to log to Discord:', err?.message || err);
  }
};

// ---------------------------------------------------------------------------
// Global Error Handling — Input Interaction Tracking
// ---------------------------------------------------------------------------

let lastInputInteraction = null;

export const recordInputInteraction = (inputType, fieldName) => {
    const timestamp = Date.now();
    lastInputInteraction = {
        type: inputType,
        fieldName: fieldName,
        timestamp: timestamp
    };
    setTimeout(() => {
        if (lastInputInteraction && lastInputInteraction.timestamp === timestamp) {
            lastInputInteraction = null;
        }
    }, 30000);
};

export const getLastInputInteraction = () => lastInputInteraction;

// ---------------------------------------------------------------------------
// Global Error Handling — Console Interceptor
// ---------------------------------------------------------------------------

let isConsoleIntercepted = false;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

export const initConsoleInterceptor = (isSentryBlockedProvider) => {
    if (isConsoleIntercepted) return;
    isConsoleIntercepted = true;

    console.critical = (...args) => {
        console.error('[CRITICAL]', ...args);
    };

    console.error = (...args) => {
        originalConsoleError.apply(console, args);

        const isSentryBlocked = typeof isSentryBlockedProvider === 'function'
            ? isSentryBlockedProvider()
            : isSentryBlockedProvider;

        const message = args.map(arg =>
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');

        if (isSentryBlocked || message.includes('PHMC') || message.includes('CRITICAL')) {
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

// ---------------------------------------------------------------------------
// Global Error Handling — Discord Webhook Queue
// ---------------------------------------------------------------------------

let lastDiscordErrorMessage = '';
let lastDiscordErrorTimestamp = 0;
const recentDiscordErrors = new Map(); // message -> last-sent timestamp (dedupes alternating/repeated errors)
let lastDiscordErrorStack = '';
let isProcessingDiscordQueue = false;
let discordErrorWebhookQueue = [];
let errorTimestamps = [];

// Discord embed field values cap at 1024 chars; names at 256. Oversized fields
// get rejected with HTTP 400 `{"embeds": ["0"]}` — the cause of webhook-send
// failures on long navigation histories / client info / stacks.
const clampField = (value, max = 1024) => {
    const s = String(value ?? '');
    return s.length > max ? s.slice(0, max - 3) + '...' : s;
};

const processDiscordErrorQueue = async () => {
    if (isProcessingDiscordQueue || discordErrorWebhookQueue.length === 0) return;

    isProcessingDiscordQueue = true;
    const payload = discordErrorWebhookQueue.shift();
    try {
        await triggerWebhookProxy('error', payload);
    } catch (e) {
        // Marked so the console interceptor does NOT re-forward this as another
        // "unhandled error" (which would recurse: report failure → report the
        // failure → ...).
        console.error("[Discord Error Webhook] CRITICAL: Failed to send Discord error webhook.", e);
    } finally {
        setTimeout(() => {
            isProcessingDiscordQueue = false;
            processDiscordErrorQueue();
        }, 2000);
    }
};

export const sendDiscordErrorWebhook = (errorDetails, sentryBlocked = false) => {
    const ERROR_RATE_LIMIT_WINDOW = 5 * 60 * 1000;
    const MAX_ERRORS_PER_WINDOW = 10;
    const RATE_LIMIT_DURATION = 60 * 1000;

    const now = Date.now();

    errorTimestamps = errorTimestamps.filter(timestamp => (now - timestamp) < RATE_LIMIT_DURATION);

    if (errorTimestamps.length >= MAX_ERRORS_PER_WINDOW) {
        console.warn(`[Discord Error Webhook] Rate limit exceeded. Suppressing error:`, errorDetails.message);
        return;
    }

    const errorMessage = String(errorDetails.message || '').substring(0, 1000);
    const errorStack = String(errorDetails.stack || '').substring(0, 1000);

    // Suppress the Firebase IndexedDB cascade (same root cause every time) —
    // the startup probe reports it once as a tagged event instead.
    if (isIndexedDBCascadeError(errorMessage)) {
        console.warn('[Discord Error Webhook] Suppressing IndexedDB cascade error:', errorMessage);
        return;
    }

    const normalizeErrorMessage = (msg) => {
        return msg.replace(/^(TypeError|ReferenceError|SyntaxError|RangeError|URIError|EvalError|InternalError):\s*/i, '');
    };
    const normalizedErrorMessage = normalizeErrorMessage(errorMessage);

    if (
        normalizedErrorMessage === normalizeErrorMessage(lastDiscordErrorMessage) &&
        (now - lastDiscordErrorTimestamp) < ERROR_RATE_LIMIT_WINDOW
    ) {
        console.warn('[Discord Error Webhook] Duplicate error suppressed:', errorMessage);
        return;
    }

    // Message-keyed dedup — collapses retry bursts that ALTERNATE between two
    // messages (e.g. a callable wrapper + its DataContext catch), which the
    // last-only check above can't catch. One report per distinct message per window.
    const dedupKey = normalizedErrorMessage || errorMessage;
    const lastSentForMessage = recentDiscordErrors.get(dedupKey) || 0;
    if (now - lastSentForMessage < ERROR_RATE_LIMIT_WINDOW) {
        console.warn('[Discord Error Webhook] Repeated error suppressed (dedup):', errorMessage);
        return;
    }
    recentDiscordErrors.set(dedupKey, now);
    if (recentDiscordErrors.size > 50) {
        for (const [k, v] of recentDiscordErrors) {
            if (now - v >= ERROR_RATE_LIMIT_WINDOW) recentDiscordErrors.delete(k);
        }
    }

    errorTimestamps.push(now);

    lastDiscordErrorMessage = errorMessage;
    lastDiscordErrorStack = errorStack;
    lastDiscordErrorTimestamp = now;

    let sentryEventId = null;
    if (window.Sentry && window.Sentry.lastEventId) {
        sentryEventId = window.Sentry.lastEventId();
    } else if (Sentry && Sentry.lastEventId) {
        sentryEventId = Sentry.lastEventId();
    }

    const userIdentity = getUserOAuthIdentity();

    const embed = {
        title: errorDetails.isButtonClickError ? "Button Click Error" : errorDetails.isLogicalError ? "Logical Inconsistency Detected" : "Unhandled Application Error",
        description: errorDetails.isLogicalError ? "A logical error or data inconsistency was detected by the application." : "An unhandled error was caught by the global error handler.",
        color: errorDetails.isLogicalError ? 0x3498db : (sentryBlocked ? 0xFFA500 : 0xDE354C),
        fields: [
            { name: "Error Type", value: clampField(errorDetails.isLogicalError ? "Logical/Data" : (errorDetails.isButtonClickError ? "UI Button Interaction" : (errorDetails.isInputFieldError ? "Input Field Interaction" : "General"))), inline: true },
            userIdentity ? { name: "User Identity", value: clampField(`**Username:** \`${userIdentity.username || 'Unknown'}\`\n**Character:** \`${userIdentity.characterName || 'Unknown'}\`\n**Character ID:** \`${userIdentity.characterId || 'Unknown'}\`\n**Faction:** \`${userIdentity.faction || 'Unknown'}\``), inline: false } : null,
            { name: "Error Message", value: clampField(`\`${errorMessage}\``), inline: false },
            { name: "Context / Location", value: clampField(`**${errorDetails.context || errorDetails.source || "Unknown Location"}**`), inline: true },
            !errorDetails.isLogicalError ? { name: "Line/Col", value: clampField(`L${errorDetails.lineno || "N/A"}:C${errorDetails.colno || "N/A"}`), inline: true } : null,
            { name: "User Agent", value: clampField(`\`${navigator.userAgent}\``), inline: false },
            sentryEventId ? { name: "Sentry Trace/Event ID", value: clampField(`\`${sentryEventId}\``), inline: false } : null,
            errorDetails.navigationHistory && errorDetails.navigationHistory.length > 0 ? {
                name: "Navigation History (Last 15)",
                value: clampField(`\`\`\`\n${errorDetails.navigationHistory.map(h => `[${h.timestamp}] (${h.type}) ${h.path}`).join('\n')}\n\`\`\``),
                inline: false
            } : null,
            errorDetails.clientInfo ? { name: "Client Info", value: clampField(`\`\`\`json\n${JSON.stringify(errorDetails.clientInfo, null, 2)}\n\`\`\``), inline: false } : null,
        ].filter(Boolean),
        timestamp: new Date().toISOString(),
        footer: { text: `PHMC Tools - Global Error Handler` }
    };
    discordErrorWebhookQueue.push({ content: '<@228306972204597248>', embeds: [embed] });
    processDiscordErrorQueue();
};

export const reportLogicalError = (title, message, context = {}) => {
    const timestamp = new Date().toISOString();

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

    sendDiscordErrorWebhook(errorDetails);
};

/**
 * Log a Firebase data version bump to the admin webhook.
 * Call this right after bumping a version node to track what triggered it.
 *
 * @param {string} versionPath — Firebase path like "appMetadata/formsDataVersion"
 * @param {string} source — component or function name that triggered it
 * @param {string} [detail] — optional context like "Form: ER Protocol"
 */
export const logDataVersionBump = (versionPath, source, detail = '') => {
    const embed = {
        title: 'Data Version Bumped',
        description: [
            '**Path:** `' + versionPath + '`',
            '**Source:** ' + source,
            detail ? '**Detail:** ' + detail : null,
        ].filter(Boolean).join('\n'),
        color: 0x6366f1,
        footer: { text: 'Version Bump Tracker' },
        timestamp: new Date().toISOString(),
    };
    return triggerWebhookProxy('admin', { embeds: [embed] }).catch(() => {});
};
