/**
 * Log Channel — sends startup, error, and crash messages to a dedicated Discord channel.
 * Uses the bot's own client (not a webhook) so the messages appear as the bot.
 */

import { EmbedBuilder, MessageFlags } from 'discord.js';
import { isDevTestActive, devLogChannelId } from './devRouting.js';

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
    // DEV TEST mode redirects routine log messages to the dev channel (resolved
    // per-send so a runtime /enable-dev-autopsy toggle applies immediately).
    // No DEV_LOG_CHANNEL_ID configured => dropped, never sent to the live channel.
    const channelId = isDevTestActive() ? devLogChannelId() : _channelId;
    if (!channelId || !_client) return;

    const SEND_TIMEOUT_MS = 10000;
    // Timeout wrapper so a stalled Discord fetch/send can NEVER hang the caller.
    // A stuck channel.send() used to freeze the autopsy monitor mid-run (blocking
    // step 3 — acks + crossposts) because nothing bounded it. Now it degrades to a
    // warn and lets the pipeline continue.
    const withTimeout = (promise, label) => Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${SEND_TIMEOUT_MS}ms`)), SEND_TIMEOUT_MS)),
    ]);

    const payload = {};
    if (content) {
        payload.content = crash ? `@here ${content}` : content;
    }
    if (embed) {
        payload.embeds = [embed];
    }
    // Explicitly allow user/role pings in the content (so <@id> notifications
    // reliably tag staff). @here is only allowed for crash reports, never for
    // routine notifications.
    payload.allowedMentions = { parse: crash ? ['users', 'roles', 'here'] : ['users', 'roles'] };

    const ok = await deliverTo(channelId, payload, withTimeout);
    if (!ok) {
        // Don't use the logger here to avoid potential infinite loops
        console.warn(`[LOG] [WARN] Failed to send log message: delivery failed`);
    }
}

/**
 * Shared Discord delivery core: fetch channel, send payload, all bounded by
 * the caller's timeout wrapper. Returns true on success, false on any failure.
 */
async function deliverTo(channelId, payload, withTimeout) {
    try {
        const channel = await withTimeout(_client.channels.fetch(channelId), 'channel fetch');
        if (!channel?.isTextBased()) {
            console.warn(`[LOG] [WARN] Channel ${channelId} is not a text channel`);
            return false;
        }
        await withTimeout(channel.send(payload), 'channel send');
        return true;
    } catch (err) {
        console.warn(`[LOG] [WARN] Delivery to ${channelId} failed: ${err.message}`);
        return false;
    }
}

/**
 * Send Components-V2 payload to the log channel (same routing/timeout as
 * sendLogMessage). No pings — status posts must never notify anyone.
 * Returns true on success, false otherwise (callers fall back as needed).
 */
export async function sendLogV2(components) {
    const channelId = isDevTestActive() ? devLogChannelId() : _channelId;
    if (!channelId || !_client) return false;

    const SEND_TIMEOUT_MS = 10000;
    const withTimeout = (promise, label) => Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${SEND_TIMEOUT_MS}ms`)), SEND_TIMEOUT_MS)),
    ]);

    const ok = await deliverTo(channelId, {
        flags: MessageFlags.IsComponentsV2,
        components: components || [],
        allowedMentions: { parse: [] },
    }, withTimeout);
    if (!ok) {
        console.warn(`[LOG] [WARN] Failed to send log V2 message: delivery failed`);
    }
    return ok;
}

/**
 * Send plain text to an explicit channel (used by the audit batch sender for
 * the dedicated audit channel). No dev-routing redirect, no pings — audit
 * lines must never notify anyone. Returns true on success.
 */
export async function sendToChannel(channelId, content) {
    if (!channelId || !_client) return false;
    const SEND_TIMEOUT_MS = 10000;
    const withTimeout = (promise, label) => Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${SEND_TIMEOUT_MS}ms`)), SEND_TIMEOUT_MS)),
    ]);
    return deliverTo(channelId, {
        content,
        allowedMentions: { parse: [] },
    }, withTimeout);
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

/**
 * Cooldown-gated send: at most one post per `key` per `cooldownMs`.
 * If `Date.now() - lastSent < cooldownMs`, skips silently (returns false).
 * Otherwise builds the payload via `payloadBuilder` (called ONLY on send, so
 * timestamps stay fresh), sends it through sendLogMessage, records the
 * timestamp, and returns true. Never throws outward.
 *
 * @param {string} key — dedupe key (e.g. `slow:<reportKey>`)
 * @param {number} cooldownMs — minimum ms between sends for this key
 * @param {Function} payloadBuilder — () => ({ content?, embed?, options? }) or promise thereof
 * @returns {Promise<boolean>} true if sent, false if skipped/failed
 */
const _notifyOnceLastSent = new Map();

export async function notifyOnce(key, cooldownMs, payloadBuilder) {
    try {
        const now = Date.now();
        const last = _notifyOnceLastSent.get(key) || 0;
        if (now - last < cooldownMs) return false;
        const payload = await payloadBuilder();
        if (!payload) return false;
        await sendLogMessage(payload.content ?? null, payload.embed ?? null, payload.options ?? {});
        _notifyOnceLastSent.set(key, Date.now());
        return true;
    } catch (err) {
        console.warn(`[LOG] ⚠️ notifyOnce failed for ${key}: ${err.message}`);
        return false;
    }
}
