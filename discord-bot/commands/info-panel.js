import { SlashCommandBuilder, MessageFlags, ChannelType } from 'discord.js';
import { isOwnerOrWhitelisted } from '../services/permissions.js';
import { postInfoPanel } from '../services/infoPanel.js';

export const data = new SlashCommandBuilder()
    .setName('info-panel')
    .setDescription('(Owner) Post or refresh the bot Information panel')
    .addSubcommand(sub => sub
        .setName('setup')
        .setDescription('Post the Information panel')
        .addChannelOption(o => o
            .setName('channel')
            .setDescription('Channel to post the panel in (default: this channel)')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)))
    .addSubcommand(sub => sub
        .setName('refresh')
        .setDescription('Re-render all posted panels from current code, in place'));

export async function execute(interaction) {
    if (!isOwnerOrWhitelisted(interaction)) {
        await interaction.reply({
            content: '❌ Only the bot owner can use this command.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const sub = interaction.options.getSubcommand();
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (sub === 'refresh') {
        try {
            const { refreshAllPanels } = await import('../services/infoPanel.js');
            const r = await refreshAllPanels(interaction.client);
            await interaction.editReply({
                content: `✅ Panels refreshed: ${r.updated} updated` +
                    (r.removed > 0 ? `, ${r.removed} stale untracked` : '') +
                    (r.failed > r.removed ? `, ${r.failed - r.removed} failed` : '') +
                    (r.updated === 0 && r.removed === 0 ? ' (none tracked yet — use /info-panel setup first)' : '') +
                    '.',
            });
        } catch (err) {
            await interaction.editReply({ content: `❌ Refresh failed: ${err.message}` });
        }
        return;
    }

    const channel = interaction.options.getChannel('channel') || interaction.channel;
    try {
        await postInfoPanel(channel);
        await interaction.editReply({ content: `✅ Information panel posted in ${channel}.` });
    } catch (err) {
        await interaction.editReply({ content: `❌ Failed to post panel: ${err.message}` });
    }
}
