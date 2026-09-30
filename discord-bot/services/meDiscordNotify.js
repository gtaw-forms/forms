/**
 * ME Discord Notify — Maps forum usernames to Discord user IDs and
 * sends assignment notification pings to the bot-spam channel.
 *
 * Firebase paths:
 *   autopsy-requests/discord-members/<forum_name_lower> = "discordUserId"
 */

import { sendLogMessage } from './logChannel.js';
import { deathTypeWindow } from './assignmentWebhook.js';
import { postMassAssignmentPanel } from './massAssignmentPanel.js';

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
 * Post the mass-assignment panel — Components V2 first (live supervisor
 * reassign + Load links + countdowns), with the legacy embed panel as
 * fail-closed fallback (V2 over-budget, send failure). When either panel
 * posts, callers must skip the per-body notifyAssignment pings so each ME is
 * tagged exactly once.
 *
 * @param {import('firebase-admin').database.Database|null} db
 * @param {object} client — logged-in discord.js Client (falls back to registered)
 * @param {Array} assignments — raw entries (see massAssignmentPanel.js header)
 * @param {object} [opts] — { channelId?, requestTopicId?, noPing?, devReassign? }
 *   devReassign defaults ON (live supervisor button); showcase passes false.
 */
export async function notifyMassAssignmentPanel(db, client, assignments, opts = {}) {
    try {
        const { postMassPanelV2 } = await import('./massPanelV2.js');
        const res = await postMassPanelV2(db, client, assignments, {
            channelId: opts.channelId,
            requestTopicId: opts.requestTopicId,
            noPing: opts.noPing,
            devReassign: opts.devReassign !== false,
        });
        if (res && res.posted) return res;
        console.warn(`[ME-NOTIFY] V2 mass panel not posted (${(res && res.reason) || 'unknown'}) — legacy fallback`);
    } catch (e) {
        console.warn(`[ME-NOTIFY] V2 mass panel error (${e.message}) — legacy fallback`);
    }
    return postMassAssignmentPanel(db, client, assignments, opts);
}

/**
 * Send an assignment notification to the ME — exactly ONE ping, via the V2
 * single-assignment panel. (Legacy embed sends were removed: they fired
 * alongside the V2 panel and double-pinged the ME.) A mention-free trail
 * line still goes to the log channel.
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
 * @param {string} [options.requestTopicId] — autopsy-requested/<id> key; links the V2 panel's Info/Reassign buttons to the live row
 * @param {string|number} [options.caseIdx] — mass sub-case index (V2 reassign target)
 * @param {object} [options.client] — discord.js Client override for the V2 post (falls back to registered)
 */
export async function notifyAssignment(db, assignedName, caseTitle, caseUrl, {
    isMassAutopsy = false, decedent, ooc, caseNumber, deathType, label, embedTitle, action,
    requestTopicId, caseIdx, client: discordClient,
} = {}) {
    try {
        const buttonTitle = embedTitle || (isMassAutopsy ? '🔬 Mass Autopsy Assigned' : '🔬 Autopsy Case Assigned');
        // Single V2 panel: the ONLY assignment ping. The legacy embed sends
        // (assignment webhook, auto-forward, bot-native #autopsies post) were
        // removed — they double-pinged alongside this panel (seen live: one
        // legacy embed + one V2 panel for the same case). Manual
        // /forward-autopsy-notify is untouched (separate on-demand path).
        try {
            const { postSinglePanelV2 } = await import('./singlePanelV2.js');
            await postSinglePanelV2(db, discordClient || null, {
                me: assignedName, caseNumber, caseTitle, decedent, ooc, caseUrl,
                deathType, deadline: deathTypeWindow(deathType),
                title: buttonTitle, action,
            }, { requestTopicId, caseIdx });
        } catch (e) {
            console.warn(`[ME-NOTIFY] Single V2 panel skipped for ${assignedName}: ${e.message}`);
        }

        // Staff trail in the log channel — never mentions (the V2 panel owns
        // the single ping, so any mention here would double-ping).
        const resolvedLabel = label || (isMassAutopsy ? 'Mass Autopsy' : 'Autopsy Assignment');
        const titleLine = caseUrl ? `[${caseTitle}](${caseUrl})` : caseTitle;
        await sendLogMessage(
            `**${assignedName}** — **${resolvedLabel}**: ${titleLine}`,
            null
        );
        console.log(`[ME-NOTIFY] Notified ${assignedName} for ${caseTitle} (V2 panel)`);
    } catch (err) {
        console.warn(`[ME-NOTIFY] Failed to notify ${assignedName}: ${err.message}`);
    }
}
