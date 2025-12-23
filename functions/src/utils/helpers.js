import fetch from 'node-fetch';
import { db } from './firebase.js';

// Helper to safely check if secrets exist during deployment
export const secretsExist = (secretNames) => {
    try {
        return secretNames.every(name => process.env[name] !== undefined);
    } catch {
        return false;
    }
};

export const getShuffledPhrases = (phrases) => {
    if (!Array.isArray(phrases) || phrases.length === 0) return [];
    const array = [...phrases];
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};

export const sendWebhook = async (payload) => {
    // Use process.env for secrets in Firebase Functions v2
    const webhookURL = process.env.ADMIN_ACTION_WEBHOOK_URL;
    if (!webhookURL) {
        console.error("FATAL: ADMIN_ACTION_WEBHOOK_URL secret is not set or not accessible. Webhook cannot be sent.");
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

export const scheduleDeletion = async (request) => {
    const requestId = request.id;
    let processedAt;

    try {
        // Safely parse the processedAt timestamp
        if (request.processedAt && typeof request.processedAt === 'number') {
            processedAt = new Date(request.processedAt);
        } else if (request.processedAt && typeof request.processedAt === 'string') {
            processedAt = new Date(request.processedAt);
        } else {
            console.warn(`Invalid processedAt for request ${requestId}:`, request.processedAt);
            return; // Skip this request if timestamp is invalid
        }

        // Check if the date is valid
        if (isNaN(processedAt.getTime())) {
            console.warn(`Invalid date created for request ${requestId}:`, request.processedAt);
            return; // Skip this request if date is invalid
        }
    } catch (error) {
        console.error(`Error parsing processedAt for request ${requestId}:`, error);
        return; // Skip this request if parsing fails
    }

    const now = new Date();
    const timeDiff = now.getTime() - processedAt.getTime();
    const daysDiff = Math.floor(timeDiff / (1000 * 3600 * 24));

    let isDeletable = false;

    if (request.status.startsWith('Denied') && daysDiff >= 2) {
        isDeletable = true;
    } else if (request.status === 'approved' && daysDiff >= 1) {
        isDeletable = true;
    }

    if (isDeletable) {
        const requestRef = db.ref(`bingo/phraseRequests/${requestId}`);
        try {
            await requestRef.remove();
            console.log(`Successfully deleted request ${requestId}`);

             const embed = {
                 title: "Bingo Phrase Request Deleted (Scheduled)",
                 description: `Request ID: ${requestId} automatically deleted.`, 
                 fields: [
                     { name: "Status", value: request.status, inline: true },
                     { name: "Requested By", value: request.requestedBy, inline: true },
                     { name: "Phrase", value: request.phrase, inline: false },
                 ],
                 footer: { text: "PHMC Tools - Scheduled Cleanup" }
              };
             await sendWebhook({ embeds: [embed] });

        } catch (error) {
            console.error(`Error deleting request ${requestId}:`, error);
            // Consider logging this error to Sentry
        }
    }
};
