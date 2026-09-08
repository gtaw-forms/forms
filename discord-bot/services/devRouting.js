/**
 * devRouting.js — route bot notifications to a DEV Discord while DEV TEST
 * autopsy mode is active (AUTOPSY_DEV_TEST=true, toggled live via
 * /enable-dev-autopsy). Prevents test autopsies from pinging/spamming the live
 * PHMC + faction Discords.
 *
 * Resolution rules when dev-test is active:
 *   - Webhook: <PRIMARY_ENV_KEY>_DEV override, else the global DEV_WEBHOOK_URL.
 *   - Log channel: DEV_LOG_CHANNEL_ID.
 *   - No dev target configured => the message is dropped (never sent live).
 * When dev-test is off, everything resolves exactly as before.
 */

export function isDevTestActive() {
    return String(process.env.AUTOPSY_DEV_TEST || '').toLowerCase() === 'true';
}

/**
 * Dev webhook target for a primary env key (e.g. 'ASSIGNMENT_WEBHOOK_URL').
 * Empty string when dev-test is off or no dev target is configured.
 * @param {string} primaryEnvKey
 * @returns {string}
 */
export function devWebhookUrl(primaryEnvKey) {
    const override = (process.env[`${primaryEnvKey}_DEV`] || '').trim();
    const global = (process.env.DEV_WEBHOOK_URL || '').trim();
    return override || global || '';
}

/**
 * Dev log channel id (empty when dev-test is off or unset).
 * @returns {string}
 */
export function devLogChannelId() {
    return (process.env.DEV_LOG_CHANNEL_ID || '').trim() || '';
}