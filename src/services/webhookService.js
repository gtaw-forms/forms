// src/services/webhookService.js
import { VITE_DEV_DISCORD_WEBHOOK_URL } from '../config';

export const sendDiscordWebhook = async (message, embed) => {
  const webhookUrl = VITE_DEV_DISCORD_WEBHOOK_URL;

  if (!webhookUrl || webhookUrl === 'YOUR_DISCORD_WEBHOOK_URL_HERE') {
    console.warn('Discord Webhook URL is not configured. Skipping notification.');
    return;
  }

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: message,
        embeds: embed ? [embed] : [],
      }),
    });
  } catch (error) {
    console.error('Failed to send Discord webhook:', error);
  }
};
