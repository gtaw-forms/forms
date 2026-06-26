import { db } from './firebase.js';
import { getConfigValue } from './config.js';

// Helper to safely check if secrets exist during deployment
export const secretsExist = (secretNames) => {
    try {
        return secretNames.every(name => getConfigValue(name) !== undefined);
    } catch {
        return false;
    }
};

export const sendWebhook = async (payload, urlOverride = null) => {
    // Priority: urlOverride -> DISCORD_WEBHOOK_FUNCTIONS -> ADMIN_ACTION_WEBHOOK_URL
    const webhookURL = urlOverride || getConfigValue("DISCORD_WEBHOOK_FUNCTIONS") || getConfigValue("ADMIN_ACTION_WEBHOOK_URL");

    if (!webhookURL) {
        console.error("FATAL: Webhook URL is not set. Webhook cannot be sent.");
        return false;
    }

    console.log(`Webhook URL is configured. Length: ${webhookURL.length}. Sending payload.`);

    try {
        const response = await fetch(webhookURL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
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

export const sendWebhookWithFile = async (content, filename, messagePayload = {}) => {
    const webhookURL = getConfigValue("DISCORD_WEBHOOK_FUNCTIONS") || getConfigValue("ADMIN_ACTION_WEBHOOK_URL");
    if (!webhookURL) return false;

    try {
        const form = new FormData();
        form.append('file', new Blob([content]), filename);
        
        if (Object.keys(messagePayload).length > 0) {
            form.append('payload_json', JSON.stringify(messagePayload));
        }

        const response = await fetch(webhookURL, {
            method: 'POST',
            body: form,
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Error sending webhook with file. Status: ${response.status}. Response: ${errorText}`);
            return false;
        }

        return true;
    } catch (error) {
        console.error("Error sending webhook with file:", error);
        return false;
    }
};
