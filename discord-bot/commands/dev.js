import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { showDevPanel } from '../services/devPanel.js';
import { isOwnerOrWhitelisted } from '../services/permissions.js';

export const data = new SlashCommandBuilder()
    .setName('dev')
    .setDescription('(Owner) Developer tools panel');

export async function execute(interaction) {
    if (!isOwnerOrWhitelisted(interaction)) {
        await interaction.reply({ content: 'Only the bot owner can use this command.', flags: MessageFlags.Ephemeral });
        return;
    }
    await showDevPanel(interaction);
}
