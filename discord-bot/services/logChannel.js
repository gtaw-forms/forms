/**
 * Log Channel — sends startup, error, and crash messages to a dedicated Discord channel.
 * Uses the bot's own client (not a webhook) so the messages appear as the bot.
 */

import { EmbedBuilder } from 'discord.js';

let _client = null;
let _channelId = null;

/**
 * Register the bot client and read the target channel from .env.
 * Called once from index.js on startup.
 */
export function setLogClient(client) {
    _client = client;
    _channelId = process.env.BOT_LOG_CHANNEL_ID || null;
    if (_channelId) {
        console.log(`[LOG] ✅ Log channel registered (${_channelId})`);
    } else {
        console.log('[LOG] ℹ️ No BOT_LOG_CHANNEL_ID set — log messages will only go to the log file');
    }
}

/**
 * Send a message to the configured log channel.
 * Gracefully does nothing if no channel is configured or the client isn't ready.
 *
 * @param {string} content - Plain text message (optional if embed provided)
 * @param {object} [embed] - Discord embed object (optional)
 * @param {object} [options] - Additional options
 * @param {boolean} [options.crash] - If true, also pings @here in the message
 */
export async function sendLogMessage(content, embed, { crash = false } = {}) {
    if (!_channelId || !_client) return;

    try {
        const channel = await _client.channels.fetch(_channelId);
        if (!channel?.isTextBased()) {
            console.warn(`[LOG] ⚠️ Channel ${_channelId} is not a text channel`);
            return;
        }

        const payload = {};
        if (content) {
            payload.content = crash ? `@here ${content}` : content;
        }
        if (embed) {
            payload.embeds = [embed];
        }

        await channel.send(payload);
    } catch (err) {
        // Don't use the logger here to avoid potential infinite loops
        console.warn(`[LOG] ⚠️ Failed to send log message: ${err.message}`);
    }
}

/**
 * Send a crash notification to the log channel with full stack trace.
 */
export async function sendCrashReport(type, error) {
    const stackTrace = (error?.stack || error?.message || String(error)).slice(0, 3500);

    const embed = new EmbedBuilder()
        .setColor(0xdc3545)
        .setTitle(`CRASH: ${type}`)
        .setDescription(`\`\`\`\n${stackTrace}\n\`\`\``)
        .setFooter({ text: `Bot may have restarted` })
        .setTimestamp();

    await sendLogMessage(null, embed, { crash: true });
}
