import * as Sentry from "@sentry/react";
import { ref, set, push } from 'firebase/database';
import { database } from '../../firebase';
import { triggerWebhookProxy } from '../../services/firebaseFunctions';

/**
 * Modernized Notification Service
 * Handles clipboard operations, Discord notifications, and Firebase logging.
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
 * Sends a notification for Bingo events.
 */
export const sendBingoNotification = async ({ scorer, bingoType, phrase, lineName, marked }) => {
    const embed = {
        title: marked
            ? `📌 Marker Placed: ${scorer || 'A player'}`
            : "🎉 BINGO SCORED! 🎉",
        description: marked
            ? `A marker was placed on the ${bingoType || 'Unknown'} board.`
            : `**${scorer || 'A player'}** has completed a line!`,
        color: marked ? 0x3498db : 0xffd700,
        timestamp: new Date().toISOString(),
        fields: [
            ...(marked
                ? [{ name: "Phrase", value: phrase || 'Unknown', inline: true }]
                : [
                    { name: "Game", value: bingoType || 'Unknown', inline: true },
                    { name: "Line", value: lineName || 'Unknown', inline: true }
                  ]),
            { name: "Source", value: getGeneratorName(), inline: true }
        ],
        footer: { text: "PHMC Tools Notification" }
    };

    try {
        await triggerWebhookProxy('bingo', { embeds: [embed] });
        await logWebhookToFirebase(embed.title, { embeds: [embed] });
        return true;
    } catch (error) {
        console.error('Error sending Bingo notification:', error);
        return false;
    }
};

/**
 * Sends a request for a new Bingo phrase.
 */
export const sendPhraseRequestNotification = async ({ requester, phrase, bingoType }) => {
    const embed = {
        title: "📈 New Bingo Phrase Request",
        description: "A new phrase has been requested for review.",
        color: 0x9b59b6,
        timestamp: new Date().toISOString(),
        fields: [
            { name: "Requested Phrase", value: phrase || 'N/A', inline: false },
            { name: "Game Type", value: bingoType || 'Unknown', inline: true },
            { name: "Requester", value: requester || 'Anonymous', inline: true },
            { name: "Source", value: getGeneratorName(), inline: true }
        ],
        footer: { text: "PHMC Tools Notification" }
    };

    try {
        await triggerWebhookProxy('admin', { embeds: [embed] });
        await logWebhookToFirebase(embed.title, { embeds: [embed] });
        return true;
    } catch (error) {
        console.error('Error sending phrase request notification:', error);
        return false;
    }
};
