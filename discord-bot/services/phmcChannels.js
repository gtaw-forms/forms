/**
 * phmcChannels.js — PHMC Discord channel map (post-webhook migration).
 *
 * Channel IDs are NOT secrets — anyone in the guild can see them — so they
 * are safe to commit. This is the whole point of the migration: unlike
 * webhook URLs (bearer tokens, see AGENTS.md hard rule), a channel ID is
 * useless without the bot token, which never leaves the VPS.
 *
 * Each entry reads `<KEY>_CHANNEL_ID` from env with the documented channel
 * as fallback. Nothing sends here yet — senders migrate off webhooks one by
 * one once the bot has joined the PHMC guild.
 */

export const PHMC_CHANNELS = {
    // PHMC Discord #autopsies (same channel the old Autopsy Bot webhook lived in)
    autopsies: process.env.AUTOPSIES_CHANNEL_ID || '1367217501137797252',
};

/** Resolve a mapped channel id by name ('' when unknown). */
export function getChannelId(name) {
    return PHMC_CHANNELS[name] || '';
}

/**
 * Send a webhook-style payload to a guild channel via the bot client.
 * Accepts the same { content, embeds, components, allowed_mentions } shape
 * the webhook senders build, so migration is a transport swap. Link buttons
 * (style 5) render fine on bot-authored channel messages.
 *
 * Fail-closed like the webhook senders: no client / no channel / send error
 * logs a warning and returns false, never throws to the caller.
 *
 * @param {object} client — logged-in discord.js Client
 * @param {string} channelId — destination channel id
 * @param {object} payload — { content?, embeds?, components?, allowed_mentions? }
 * @returns {Promise<boolean>} true when sent
 */
export async function sendChannelMessage(client, channelId, payload = {}) {
    if (!client) {
        console.warn('[PHMC-CHANNEL] No client — dropping message');
        return false;
    }
    if (!channelId) {
        console.warn('[PHMC-CHANNEL] No channel id — dropping message');
        return false;
    }
    try {
        const channel = await client.channels.fetch(channelId);
        if (!channel || typeof channel.send !== 'function') {
            console.warn(`[PHMC-CHANNEL] Channel ${channelId} is not sendable`);
            return false;
        }
        const { content, embeds, components, allowed_mentions } = payload;
        await channel.send({ content, embeds, components, allowed_mentions });
        return true;
    } catch (err) {
        console.warn(`[PHMC-CHANNEL] Send to ${channelId} failed: ${err.message}`);
        return false;
    }
}
