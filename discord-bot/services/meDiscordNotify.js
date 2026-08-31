/**
 * ME Discord Notify — Maps forum usernames to Discord user IDs and
 * sends assignment notification pings to the bot-spam channel.
 *
 * Firebase paths:
 *   autopsy-requests/discord-members/<forum_name_lower> = "discordUserId"
 */

import { sendLogMessage } from './logChannel.js';
import { notifyAssignmentWebhook, assignmentWebhookConfigured, forwardAssignmentWebhook, PHMC_FORWARD_WEBHOOK_URL } from './assignmentWebhook.js';

/**
 * Look up a Discord user ID for a given forum username.
 * @param {import('firebase-admin').database.Database} db
 * @param {string} forumName — e.g. "Arthur Blackwood"
 * @returns {Promise<string|null>}
 */
export async function getDiscordId(db, forumName) {
    if (!forumName) return null;
    try {
        const snap = await db.ref(`autopsy-requests/discord-members/${forumName.toLowerCase()}`).once('value');
        return snap.val() || null;
    } catch {
        return null;
    }
}

/**
 * Store (or remove) a Discord user mapping for a forum username.
 * @param {import('firebase-admin').database.Database} db
 * @param {string} forumName
 * @param {string|null} discordUserId — null to remove mapping
 */
export async function setDiscordMapping(db, forumName, discordUserId) {
    const key = forumName.toLowerCase();
    if (discordUserId) {
        await db.ref(`autopsy-requests/discord-members/${key}`).set(discordUserId);
    } else {
        await db.ref(`autopsy-requests/discord-members/${key}`).remove();
    }
}

/**
 * Send an assignment notification to the ME.
 *
 * When ASSIGNMENT_WEBHOOK_URL is configured, the ME is pinged on the assignment
 * webhook (rich embed + View Case / PHMC Forms buttons) and the log-channel message
 * is posted WITHOUT the mention so the ME is never pinged twice. Without a webhook
 * config it falls back to the legacy log-channel ping.
 *
 * @param {import('firebase-admin').database.Database} db
 * @param {string} assignedName — forum username of the ME
 * @param {string} caseTitle — e.g. "Case 43 - John Doe ((Blake Jefferson)) - Arthur Blackwood"
 * @param {string} [caseUrl] — link to the case topic
 * @param {object} [options]
 * @param {boolean} [options.isMassAutopsy=false]
 * @param {string} [options.decedent] — decedent name (webhook embed)
 * @param {string} [options.ooc] — decedent OOC name (webhook embed)
 * @param {string|number} [options.caseNumber]
 * @param {string} [options.deathType] — "CK"/"PK" for the wait window label
 */
export async function notifyAssignment(db, assignedName, caseTitle, caseUrl, {
    isMassAutopsy = false, decedent, ooc, caseNumber, deathType, label, embedTitle,
} = {}) {
    try {
        const discordId = await getDiscordId(db, assignedName);
        const resolvedLabel = label || (isMassAutopsy ? 'Mass Autopsy' : 'Autopsy Assignment');
        const titleLine = caseUrl ? `[${caseTitle}](${caseUrl})` : caseTitle;

        const webhookMode = assignmentWebhookConfigured();
        if (webhookMode) {
            await notifyAssignmentWebhook({
                me: assignedName, discordId, caseTitle, caseNumber,
                decedent, ooc, caseUrl, deathType,
                title: embedTitle || (isMassAutopsy ? '🔬 Mass Autopsy Assigned' : '🔬 Autopsy Case Assigned'),
            });
        }

        // Auto-forward to the PHMC Discord forwarding webhook (same template as
        // /forward-autopsy-notify) so assigned autopsies are posted there without
        // a manual command. Non-blocking — failures are logged, never thrown.
        try {
            await forwardAssignmentWebhook(PHMC_FORWARD_WEBHOOK_URL, {
                me: assignedName, discordId, caseTitle, caseNumber,
                decedent, ooc, caseUrl, deathType,
                title: embedTitle || (isMassAutopsy ? '🔬 Mass Autopsy Assigned' : '🔬 Autopsy Case Assigned'),
            });
        } catch (e) {
            console.warn(`[ME-NOTIFY] Auto-forward failed for ${assignedName}: ${e.message}`);
        }

        // Webhook mode already pinged — never mention again here.
        const mention = (webhookMode || !discordId) ? `**${assignedName}**` : `<@${discordId}>`;
        await sendLogMessage(
            `${mention} — **${resolvedLabel}**: ${titleLine}`,
            null
        );
        console.log(`[ME-NOTIFY] Notified ${assignedName} → ${discordId ? `<@${discordId}>` : '(no Discord mapping)'} for ${caseTitle}${webhookMode ? ' (webhook ping)' : ''}`);
    } catch (err) {
        console.warn(`[ME-NOTIFY] Failed to notify ${assignedName}: ${err.message}`);
    }
}
