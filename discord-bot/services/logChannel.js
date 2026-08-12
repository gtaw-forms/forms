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

    const SEND_TIMEOUT_MS = 10000;
    // Timeout wrapper so a stalled Discord fetch/send can NEVER hang the caller.
    // A stuck channel.send() used to freeze the autopsy monitor mid-run (blocking
    // step 3 — acks + crossposts) because nothing bounded it. Now it degrades to a
    // warn and lets the pipeline continue.
    const withTimeout = (promise, label) => Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${SEND_TIMEOUT_MS}ms`)), SEND_TIMEOUT_MS)),
    ]);

    try {
        const channel = await withTimeout(_client.channels.fetch(_channelId), 'channel fetch');
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

        await withTimeout(channel.send(payload), 'channel send');
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

/**
 * Post a concise "SELF HEALING - <topic> / <reason> / <info>" message to the log
 * channel when a recovery action fires. Shared by all recovery sweeps so failures
 * and repairs are uniformly visible. Uses sendLogMessage (10s timeout) so a slow
 * Discord send can never block a sweep.
 */
export async function notifySelfHeal(topicId, reason, info) {
    try {
        await sendLogMessage(`SELF HEALING - ${topicId} / ${reason} / ${info}`);
    } catch (err) {
        console.warn(`[LOG] ⚠️ Self-heal notify failed for ${topicId}: ${err.message}`);
    }
}
