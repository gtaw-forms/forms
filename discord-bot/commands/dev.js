import { SlashCommandBuilder } from 'discord.js';
import { showDevPanel } from '../services/devPanel.js';

export const data = new SlashCommandBuilder()
    .setName('dev')
    .setDescription('(Owner) Developer tools panel');

export async function execute(interaction) {
    await showDevPanel(interaction);
}
