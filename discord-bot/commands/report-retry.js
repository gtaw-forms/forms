import {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    MessageFlags,
} from 'discord.js';
import firebase from '../services/firebase.js';

export const data = new SlashCommandBuilder()
    .setName('report-retry')
    .setDescription('Retry a stuck report (timed out, topic not found, etc.)');

const RETRYABLE_STATUSES = ['pick_timed_out', 'topic_not_found', 'reply_failed', 'error', 'searching'];

export async function execute(interaction) {
    const ownerId = process.env.BOT_OWNER_ID;
    if (!ownerId || interaction.user.id !== ownerId) {
        await interaction.reply({
            content: 'Only the bot owner can retry reports.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    firebase.init();
    const db = firebase.db;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        // Scan scheduledReports for stuck reports
        const snap = await db.ref('scheduledReports').once('value');
        if (!snap.exists()) {
            await interaction.editReply({ content: 'No reports found in the database.' });
            return;
        }

        const stuck = [];
        snap.forEach((authorSnap) => {
            const authorId = authorSnap.key;
            authorSnap.forEach((reportSnap) => {
                const r = reportSnap.val();
                if (r.hasdeployed === true) return;
                if (r.deployStatus && RETRYABLE_STATUSES.includes(r.deployStatus)) {
                    stuck.push({
                        authorId,
                        key: reportSnap.key,
                        label: r.originalKey || reportSnap.key,
                        status: r.deployStatus,
                        message: (r.deployMessage || '').slice(0, 80),
                    });
                }
            });
        });

        if (stuck.length === 0) {
            const embed = new EmbedBuilder()
                .setColor(0x28a745)
                .setTitle('No Stuck Reports')
                .setDescription('No reports found in a retryable state.')
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        // Build dropdown (max 25)
        const options = stuck.slice(0, 25).map((r) => {
            const label = (r.label || 'Untitled').slice(0, 100);
            const desc = `[${r.status}] ${r.message}`.slice(0, 100);
            return new StringSelectMenuOptionBuilder()
                .setLabel(label)
                .setDescription(desc)
                .setValue(`${r.authorId}|${r.key}`);
        });

        const select = new StringSelectMenuBuilder()
            .setCustomId('retry_report_select')
            .setPlaceholder('Select a report to retry...')
            .addOptions(options);

        const row = new ActionRowBuilder().addComponents(select);

        const embed = new EmbedBuilder()
            .setColor(0xffc107)
            .setTitle('Retry Stuck Report')
            .setDescription(`Select a report to re-queue for deployment. It will be picked up by the bot on the next cycle.`)
            .setFooter({ text: `${stuck.length} stuck report(s) found` })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed], components: [row] });
    } catch (err) {
        console.error('[RETRY] Error:', err.message);
        await interaction.editReply({ content: `Error: ${err.message}` });
    }
}
