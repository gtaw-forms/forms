/**
 * ME Discord Notify — Maps forum usernames to Discord user IDs and
 * sends assignment notification pings to the bot-spam channel.
 *
 * Firebase paths:
 *   autopsy-requests/discord-members/<forum_name_lower> = "discordUserId"
 */

import { sendLogMessage } from './logChannel.js';

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
 * Send an assignment notification to the bot-spam channel.
 * Pings the Discord user if a mapping exists, otherwise just tags the name.
 *
 * @param {import('firebase-admin').database.Database} db
 * @param {string} assignedName — forum username of the ME
 * @param {string} caseTitle — e.g. "Case 43 - John Doe ((Blake Jefferson)) - Arthur Blackwood"
 * @param {string} [caseUrl] — link to the case topic
 * @param {object} [options]
 * @param {boolean} [options.isMassAutopsy=false]
 */
export async function notifyAssignment(db, assignedName, caseTitle, caseUrl, { isMassAutopsy = false } = {}) {
    try {
        const discordId = await getDiscordId(db, assignedName);
        const mention = discordId ? `<@${discordId}>` : `**${assignedName}**`;
        const label = isMassAutopsy ? 'Mass Autopsy' : 'Autopsy Assignment';

        const titleLine = caseUrl ? `[${caseTitle}](${caseUrl})` : caseTitle;

        await sendLogMessage(
            `${mention} — **${label}**: ${titleLine}`,
            null
        );
        console.log(`[ME-NOTIFY] Notified ${assignedName} → ${discordId ? `<@${discordId}>` : '(no Discord mapping)'} for ${caseTitle}`);
    } catch (err) {
        console.warn(`[ME-NOTIFY] Failed to notify ${assignedName}: ${err.message}`);
    }
}
