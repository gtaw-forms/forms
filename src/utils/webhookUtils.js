import * as Sentry from "@sentry/react";

/**
 * Sends a message to a Discord webhook.
 * @param {string} webhookUrl - The URL of the Discord webhook.
 * @param {object} payload - The payload to send. Can be a simple message or an embed object.
 */
export const sendDiscordWebhook = async (webhookUrl, payload) => {
  if (!webhookUrl) {
    console.error("Discord webhook URL is not defined. Skipping notification.");
    Sentry.captureMessage("Discord webhook URL is not defined.", "warning");
    return;
  }

  const isFormData = payload instanceof FormData;

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: isFormData ? {} : { "Content-Type": "application/json" },
      body: isFormData ? payload : JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Discord webhook request failed with status ${response.status}:`, errorBody);
      throw new Error(`Discord webhook request failed with status ${response.status}`);
    }
  } catch (error) {
    console.error("Failed to send Discord webhook notification:", error);
    Sentry.captureException(error, { extra: { context: 'sendDiscordWebhook' } });
    // Re-throw the error so the calling component can handle it
    throw error;
  }
};
