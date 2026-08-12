import {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
} from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('purge-death-drafts')
    .setDescription('Delete ALL death record drafts from Firebase and Discord messages')
    .addStringOption(option =>
        option.setName('confirm')
            .setDescription('Type "DELETE ALL" to confirm')
            .setRequired(true));

export async function execute(interaction) {
    const ownerId = process.env.BOT_OWNER_ID;
    if (!ownerId || interaction.user.id !== ownerId) {
        await interaction.reply({
            content: 'Only the bot owner can run this command.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const confirmText = interaction.options.getString('confirm');
    if (confirmText !== 'DELETE ALL') {
        await interaction.reply({
            content: 'Type `DELETE ALL` in the confirm option to proceed.\n\nThis will **permanently** remove all death record drafts from Firebase and delete their Discord messages. This cannot be undone.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        const { default: firebase } = await import('../services/firebase.js');
        firebase.init();
        const db = firebase.db;

        const snap = await db.ref('deathRecordDrafts').once('value');
        if (!snap.exists()) {
            await interaction.editReply({ content: 'No death record drafts found. Nothing to purge.' });
            return;
        }

        let deletedCount = 0;
        let discordDeleted = 0;
        let discordFailed = 0;

        // Collect all messages to delete first
        const messagesToDelete = [];

        snap.forEach((child) => {
            const draft = child.val();
            if (draft.messageId && draft.channelId) {
                messagesToDelete.push({ messageId: draft.messageId, channelId: draft.channelId, key: child.key });
            }
            deletedCount++;
        });

        // Delete Discord messages
        for (const { messageId, channelId, key } of messagesToDelete) {
            try {
                const channel = await interaction.client.channels.fetch(channelId).catch(() => null);
                if (channel) {
                    const msg = await channel.messages.fetch(messageId).catch(() => null);
                    if (msg) {
                        await msg.delete();
                        discordDeleted++;
                    }
                }
            } catch (e) {
                discordFailed++;
                console.warn(`[PURGE] Could not delete Discord message for ${key}: ${e.message}`);
            }
        }

        // Delete all from Firebase
        await db.ref('deathRecordDrafts').set(null);

        const embed = new EmbedBuilder()
            .setTitle('Death Record Drafts Purged')
            .setColor(0xdc3545)
            .addFields(
                { name: 'Drafts Deleted', value: String(deletedCount), inline: true },
                { name: 'Discord Messages Removed', value: String(discordDeleted), inline: true },
            )
            .setDescription('All death record drafts have been cleared. Run `/death-record-check` to scan and re-create drafts for specific dates.')
            .setTimestamp();

        if (discordFailed > 0) {
            embed.addFields({ name: 'Discord Delete Failures', value: String(discordFailed) + ' (messages may have been manually deleted already)', inline: true });
        }

        await interaction.editReply({ content: null, embeds: [embed] });
        console.log('[CMD] /purge-death-drafts -- ' + deletedCount + ' deleted, ' + discordDeleted + ' Discord messages removed');

    } catch (err) {
        console.error('[CMD] [ERR] purge-death-drafts error:', err.message);
        await interaction.editReply({ content: 'Error: ' + err.message.slice(0, 300) });
    }
}
