import {
    SlashCommandBuilder,
    MessageFlags,
    AttachmentBuilder,
} from 'discord.js';
import { generateBusinessCard } from '../services/cardGenerator.js';

export const data = new SlashCommandBuilder()
    .setName('card')
    .setDescription('Generate a PHMC business card')
    .addStringOption(option =>
        option
            .setName('name')
            .setDescription('Character name')
            .setRequired(true)
            .setMaxLength(60)
    )
    .addStringOption(option =>
        option
            .setName('rank')
            .setDescription('Rank / title (e.g., Paramedic, Captain)')
            .setRequired(true)
            .setMaxLength(60)
    );

export async function execute(interaction) {
    const name = interaction.options.getString('name', true);
    const rank = interaction.options.getString('rank', true);

    console.log(`[CARD] 🔍 /card invoked by ${interaction.user.tag} | name="${name}" rank="${rank}"`);

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        const imageBuffer = await generateBusinessCard(name, rank);

        const attachment = new AttachmentBuilder(imageBuffer, {
            name: 'business-card.png',
            description: `Business card for ${name}`,
        });

        console.log(`[CARD] ✅ Sending card to ${interaction.user.tag}`);

        await interaction.editReply({
            content: `Here's the business card for **${name}**:`,
            files: [attachment],
        });
    } catch (error) {
        console.error(`[CARD] ❌ Error:`, error.message);
        await interaction.editReply({
            content: `❌ ${error.message}`,
        });
    }
}
