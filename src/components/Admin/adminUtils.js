import * as Sentry from "@sentry/react";

export const sendDiscordNotification = async (webhookURL, payload, context, notifyFunc) => {
    if (!webhookURL) {
        console.error(`Discord webhook URL not configured for ${context}.`);
        Sentry.captureMessage(`Discord webhook URL is missing for ${context} submission.`, 'error');
        if (notifyFunc) notifyFunc('Configuration error: Unable to send message.', 'exclamation-triangle');
        return false;
    }

    try {
        const response = await fetch(webhookURL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Failed to send ${context} webhook embed. Status: ${response.status} ${response.statusText}`, errorText);
            Sentry.captureMessage(`Discord webhook embed failed for ${context}: ${response.status}`, {
                level: 'error',
                extra: { statusText: response.statusText, responseBody: errorText }
            });
            if (notifyFunc) notifyFunc(`Failed to send embed to ${context}. Status: ${response.status}`, 'exclamation-triangle');
            return false;
        } else {
            if (notifyFunc) notifyFunc('Discord notification sent successfully!', 'check-circle');
            return true;
        }
    } catch (error) {
        console.error(`Error sending ${context} webhook embed:`, error);
        Sentry.captureException(error, { extra: { context: `${context} Webhook Embed Submission Fetch` } });
        if (notifyFunc) notifyFunc(`A network error occurred sending to ${context}. Please try again.`, 'exclamation-triangle');
        return false;
    }
};