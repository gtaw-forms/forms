import { db } from './firebase.js';
import { getConfigValue } from './config.js';

// P2 (i) cost plan: secretsExist + sendWebhookWithFile removed — zero callers
// repo-wide (verified). sendWebhook below is the only live helper.

export const sendWebhook = async (payload, urlOverride = null) => {
    // Priority: urlOverride -> DISCORD_WEBHOOK_FUNCTIONS -> ADMIN_ACTION_WEBHOOK_URL
    const webhookURL = urlOverride || getConfigValue("DISCORD_WEBHOOK_FUNCTIONS") || getConfigValue("ADMIN_ACTION_WEBHOOK_URL");

    if (!webhookURL) {
        console.error("FATAL: Webhook URL is not set. Webhook cannot be sent.");
        return false;
    }

    console.log(`Webhook URL is configured. Length: ${webhookURL.length}. Sending payload.`);

    try {
        // P1 (b) cost plan: 15s cap — a stalled Discord POST previously held the
        // instance for the remainder of the caller's timeout (up to 1200s).
        const response = await fetch(webhookURL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Error sending webhook. Status: ${response.status} ${response.statusText}. Response: ${errorText}`);
            return false;
        } else {
            console.log("Webhook sent successfully.");
            return true;
        }
    } catch (error) {
        console.error("Error sending webhook from Cloud Function:", error);
        return false;
    }
};
