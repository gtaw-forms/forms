import * as Sentry from "@sentry/react";
import { ref, set, push } from 'firebase/database';
import { database } from '../../firebase';
import { sendDiscordWebhook } from '../../utils/webhookUtils';

/**
 * Modernized Notification Service
 * Handles clipboard operations, Discord notifications, and Firebase logging.
 * Removed legacy Form Interaction and Recruitment logic.
 */

const FORM_GENERATOR_URL = "https://phmc-tools.gta.world/";
const ALTERNATIVE_FORM_GENERATOR_URL = "https://gtaw-forms.github.io/forms/";

/**
 * Identifies the current environment for logging.
 */
const getGeneratorName = () => {
    const { hostname, href } = window.location;
    if (href.startsWith(ALTERNATIVE_FORM_GENERATOR_URL)) return "Alternative Form Generator";
    if (href.startsWith(FORM_GENERATOR_URL)) return "Form Generator";
    
    const isLocal = hostname === 'localhost' || 
                    hostname === '127.0.0.1' || 
                    hostname.startsWith('192.168.') || 
                    hostname.startsWith('10.');
                    
    return isLocal ? "Dev/Local" : "Unknown Source";
};

/**
 * Logs a webhook event to Firebase for audit purposes.
 */
const logWebhookToFirebase = async (type, payload) => {
    try {
        const logsRef = ref(database, 'webhook_logs');
        const newLogRef = push(logsRef);
        await set(newLogRef, {
            type,
            payload,
            timestamp: Date.now(),
            source: getGeneratorName()
        });
    } catch (error) {
        console.error("Failed to log webhook to Firebase:", error);
    }
};

/**
 * Copies text to the clipboard with user feedback.
 */
export const copyToClipboard = async (text, showNotification, successMessage = "Copied to clipboard!") => {
    if (!navigator.clipboard || !window.isSecureContext) {
        showNotification('Clipboard API not available or site not secure (HTTPS).', 'error');
        return false;
    }

    try {
        await navigator.clipboard.writeText(text);
        showNotification(successMessage, 'check-circle');
        return true;
    } catch (err) {
        console.error('Failed to copy text:', err);
        Sentry.captureException(err, { extra: { context: 'copyToClipboard' } });
        showNotification('Failed to copy text. Please try again or copy manually.', 'error');
        return false;
    }
};

/**
 * Internal helper to send formatted Discord embeds.
 */
const sendDiscordEmbed = async (webhookUrl, embedData, contentMessage = "") => {
    if (!webhookUrl) return false;

    const embed = {
        color: 0x7289DA, // Default Blurple
        timestamp: new Date().toISOString(),
        ...embedData,
        fields: [
            ...(embedData.fields || []),
            { name: "Source", value: getGeneratorName(), inline: true }
        ],
        footer: {
            text: embedData.footer?.text || "PHMC Tools Notification"
        }
    };

    try {
        await sendDiscordWebhook(webhookUrl, {
            ...(contentMessage && { content: contentMessage }),
            embeds: [embed]
        });
        await logWebhookToFirebase(embed.title, { embeds: [embed] });
        return true;
    } catch (error) {
        console.error('Error sending Discord embed:', error);
        return false;
    }
};

/**
 * Sends a notification for Bingo events.
 */
export const sendBingoNotification = async ({ scorer, bingoType, phrase, lineName, marked }) => {
    const webhookUrl = import.meta.env.VITE_BINGO_DISCORD_WEBHOOK_URL || import.meta.env.VITE_DEV_WEBHOOK;
    
    const embedData = marked ? {
        title: `📌 Marker Placed: ${scorer || 'A player'}`,
        description: `A marker was placed on the ${bingoType || 'Unknown'} board.`,
        color: 0x3498db, // Blue
        fields: [{ name: "Phrase", value: phrase || 'Unknown', inline: true }]
    } : {
        title: "🎉 BINGO SCORED! 🎉",
        description: `**${scorer || 'A player'}** has completed a line!`,
        color: 0xffd700, // Gold
        fields: [
            { name: "Game", value: bingoType || 'Unknown', inline: true },
            { name: "Line", value: lineName || 'Unknown', inline: true }
        ]
    };

    return sendDiscordEmbed(webhookUrl, embedData);
};

/**
 * Sends a request for a new Bingo phrase.
 */
export const sendPhraseRequestNotification = async ({ requester, phrase, bingoType }) => {
    const webhookUrl = import.meta.env.VITE_BINGO_DISCORD_WEBHOOK_URL || import.meta.env.VITE_DEV_WEBHOOK;
    
    const embedData = {
        title: "📈 New Bingo Phrase Request",
        description: "A new phrase has been requested for review.",
        color: 0x9b59b6, // Purple
        fields: [
            { name: "Requested Phrase", value: phrase || 'N/A', inline: false },
            { name: "Game Type", value: bingoType || 'Unknown', inline: true },
            { name: "Requester", value: requester || 'Anonymous', inline: true }
        ]
    };

    return sendDiscordEmbed(webhookUrl, embedData);
};
