import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import firebase from '../services/firebase.js';
import { notifyAssignment, getDiscordId } from '../services/meDiscordNotify.js';

export const data = new SlashCommandBuilder()
    .setName('test-autopsy-notify')
    .setDescription('Test the ME Discord assignment ping with a real case (owner only)')
    .addStringOption(opt =>
        opt.setName('me')
            .setDescription('Forum username of the ME (e.g. Anne Carter)')
            .setRequired(true))
    .addStringOption(opt =>
        opt.setName('case')
            .setDescription('Case number, topic id, or title fragment to pull real data for (e.g. 486, 9977, Bradley)')
            .setRequired(true));

/**
 * Resolve a real autopsy case from the `autopsy-requested` node.
 * Matches by case number, topic id, or a case-title fragment.
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

export async function execute(interaction) {
    const ownerId = process.env.BOT_OWNER_ID;
    if (!ownerId || interaction.user.id !== ownerId) {
        await interaction.reply({ content: 'Only the bot owner can run this.', flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const me = interaction.options.getString('me').trim();
    const caseQuery = interaction.options.getString('case').trim();

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
        const assigned = me || entry.assignedTo || 'unknown';

        // Show mapping status for the target ME
        const discordId = await getDiscordId(db, assigned);
        const mappingStatus = discordId
            ? `<@${discordId}> (\`${discordId}\`)`
            : '**No Discord mapping** — will use plain name fallback';

        // Send the FULL real-data notification (same path as a live assignment/reassign)
        await notifyAssignment(db, assigned, caseTitle, caseUrl, {
            decedent: entry.name || null,
            ooc: entry.oocName || null,
            caseNumber: caseNum || null,
            deathType: entry.deathType || null,
            label: 'Autopsy Case Reassigned',
            embedTitle: '🔬 Autopsy Case Reassigned',
        });

        const embed = new EmbedBuilder()
            .setColor(0x00bcd4)
            .setTitle('Test Autopsy Notification (real case)')
            .setDescription([
                `**ME:** ${assigned}`,
                `**Case:** ${caseTitle}`,
                `**Resolved from:** \`${topicId}\``,
                '',
                `**Discord Mapping:** ${mappingStatus}`,
                '',
                `_Sent the full webhook embed for this real case above._`,
            ].join('\n'))
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (err) {
        console.error('[CMD] test-autopsy-notify error:', err.message);
        await interaction.editReply({ content: `Error: ${err.message}` });
    }
}
