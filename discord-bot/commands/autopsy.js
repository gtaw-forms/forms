import {
    SlashCommandBuilder,
    MessageFlags,
} from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('autopsy')
    .setDescription('(Legacy) Use /report autopsy instead')
    .addStringOption(option =>
        option
            .setName('name')
            .setDescription('Search by decedent name or case number')
            .setRequired(false)
            .setMaxLength(100)
    );

export async function execute(interaction) {
    console.log(`[AUTOPSY] ↪️ /autopsy is deprecated — redirecting to /report autopsy`);

    await interaction.reply({
        content: '📢 This command has moved. Use `/report form type:autopsy name:<search>` instead — unified under the `/report` system.',
        flags: MessageFlags.Ephemeral,
    });
}
