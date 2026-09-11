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
    // Dedicated PHMC status dashboard (simplified: all sections except VPS stats)
    dashboard: process.env.PHMC_DASHBOARD_CHANNEL_ID || '1456793208125264014',
};

/** Resolve a mapped channel id by name ('' when unknown). */
export function getChannelId(name) {
    return PHMC_CHANNELS[name] || '';
}

/**
 * Migration safety gate — READ-ONLY until verified.
 * Channel sends are dropped (logged, never thrown) unless the VPS operator
 * explicitly sets PHMC_CHANNEL_SEND_ENABLED=true in .env. This lets the bot
 * join the PHMC guild, read/fetch channels, and prove the mapping resolves,
 * without ever posting a message until every sender is verified.
 */
export function channelSendEnabled() {
    return String(process.env.PHMC_CHANNEL_SEND_ENABLED || '').toLowerCase() === 'true';
}

// ── Bot client holder (registered once from index.js, like setLogClient) ──
let _client = null;
export function setPhmcClient(client) {
    _client = client;
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
    if (!channelSendEnabled()) {
        console.log(`[PHMC-CHANNEL] Suppressed send to ${channelId} (read-only mode — set PHMC_CHANNEL_SEND_ENABLED=true to post)`);
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

/**
 * Post an ME assignment notice to the PHMC #autopsies channel via the bot
 * client. Gated by PHMC_CHANNEL_SEND_ENABLED and never fires in DEV TEST
 * mode (test autopsies must not ping the live PHMC Discord). On success an
 * audit line goes to the audit channel — every PHMC post gets its trail.
 *
 * @param {object} payload — { content?, embeds?, components?, allowed_mentions? }
 * @param {string} auditDetail — token-free detail for the audit line
 * @returns {Promise<boolean>} true when posted
 */
export async function postAutopsyNotice(payload, auditDetail = '') {
    if (!channelSendEnabled()) return false;
    try {
        const { isDevTestActive } = await import('./devRouting.js');
        if (isDevTestActive()) {
            console.log('[PHMC-CHANNEL] Suppressed autopsies post (DEV TEST mode)');
            return false;
        }
    } catch { /* devRouting unavailable — proceed to gate decision */ }
    const ok = await sendChannelMessage(_client, getChannelId('autopsies'), payload || {});
    if (ok) {
        try {
            const { sendToChannel } = await import('./logChannel.js');
            const auditId = process.env.AUDIT_CHANNEL_ID || null;
            if (auditId) {
                sendToChannel(
                    auditId,
                    `[AUDIT] POST autopsies-bot | ${String(auditDetail || '').slice(0, 400)}`
                ).catch(() => {});
            }
        } catch { /* audit must never break sending */ }
    }
    return ok;
}
