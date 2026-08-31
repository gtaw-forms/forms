import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import firebase from '../services/firebase.js';
import { getDiscordId } from '../services/meDiscordNotify.js';
import { forwardAssignmentWebhook, PHMC_FORWARD_WEBHOOK_URL } from '../services/assignmentWebhook.js';

// Default forwarding destination = PHMC_FORWARD_WEBHOOK_URL (configurable via
// FORWARD_WEBHOOK_URL in .env); the /webhook option still allows an override.

/**
 * Resolve a real autopsy case from `autopsy-requested` by case number,
 * topic id, or a case-title fragment.
 */
async function resolveCase(db, needle) {
    const snap = await db.ref('autopsy-requested').once('value');
    const all = snap.val() || {};
    const q = String(needle).trim().toLowerCase();
    for (const [topicId, e] of Object.entries(all)) {
        if (!e || typeof e !== 'object') continue;
        const caseNum = String(e.caseNum || e.caseNumber || '');
        const caseTitle = e.caseTitle || e.title || '';
        const caseTopicId = String(e.caseTopicId || topicId || '');
        if (
            caseNum.toLowerCase() === q ||
            caseTopicId.toLowerCase() === q ||
            caseTitle.toLowerCase().includes(q)
        ) {
            return { topicId, entry: e };
        }
    }
    return null;
}

export const data = new SlashCommandBuilder()
    .setName('forward-autopsy-notify')
    .setDescription('Forward an autopsy assignment notification to the community webhook (owner only)')
    .addStringOption(opt =>
        opt.setName('case')
            .setDescription('Case number, topic id, or title fragment (e.g. 486, 9977, Bradley)')
            .setRequired(true))
    .addStringOption(opt =>
        opt.setName('me')
            .setDescription('ME to attribute (defaults to the case assignedTo)')
            .setRequired(false))
    .addStringOption(opt =>
        opt.setName('webhook')
            .setDescription('Override destination webhook URL (defaults to the community Autopsy Bot)')
            .setRequired(false));

export async function execute(interaction) {
    const ownerId = process.env.BOT_OWNER_ID;
    if (!ownerId || interaction.user.id !== ownerId) {
        await interaction.reply({ content: 'Only the bot owner can forward notifications.', flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const caseQuery = interaction.options.getString('case').trim();
    const meOverride = interaction.options.getString('me')?.trim() || null;
    const webhookOverride = interaction.options.getString('webhook')?.trim() || null;
    const webhookUrl = webhookOverride || PHMC_FORWARD_WEBHOOK_URL;

    firebase.init();
    const db = firebase.db;

    try {
        const found = await resolveCase(db, caseQuery);
        if (!found) {
            await interaction.editReply({ content: `No case found matching "${caseQuery}" in autopsy-requested. Use a case number, topic id, or title fragment.` });
            return;
        }
        const { topicId, entry } = found;
        const caseTitle = entry.caseTitle || entry.title || `Case ${topicId}`;
        const caseNum = entry.caseNum || entry.caseNumber || '';
        const caseTopicId = entry.caseTopicId || topicId;
        const caseUrl = entry.caseUrl || `${process.env.FORUM_BASE_URL}/viewtopic.php?t=${caseTopicId}`;
        const assigned = meOverride || entry.assignedTo || '';

        const discordId = await getDiscordId(db, assigned);

        const ok = await forwardAssignmentWebhook(webhookUrl, {
            me: assigned || null,
            discordId,
            caseTitle,
            caseNumber: caseNum || null,
            decedent: entry.name || null,
            ooc: entry.oocName || null,
            caseUrl,
            deathType: entry.deathType || null,
            title: '🔬 Autopsy Case Assigned',
        });

        const embed = new EmbedBuilder()
            .setColor(ok ? 0x00bcd4 : 0xe74c3c)
            .setTitle(ok ? 'Forwarded Autopsy Notification' : 'Forward Failed')
            .setDescription([
                ok ? `**Case:** ${caseTitle}` : `Could not forward to the webhook (HTTP error/timeout).`,
                ok ? `**ME:** ${assigned || 'unknown'}${discordId ? ` (<@${discordId}>)` : ''}` : '',
                ok ? `**Resolved from:** \`${topicId}\`` : '',
                ok ? `**Destination:** \`${webhookUrl.replace('https://discord.com/api/webhooks/', '')}\`` : '',
                '',
                ok ? `_Full webhook embed sent._` : '',
            ].filter(Boolean).join('\n'))
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (err) {
        console.error('[CMD] forward-autopsy-notify error:', err.message);
        await interaction.editReply({ content: `Error: ${err.message}` });
    }
}
