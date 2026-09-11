import {
    SlashCommandBuilder,
    MessageFlags,
    AttachmentBuilder,
} from 'discord.js';
import { generateBusinessCard, uploadCardImage } from '../services/cardGenerator.js';
import { isPhmcStaff } from '../services/permissions.js';

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
    )
    .addStringOption(option =>
        option
            .setName('phone')
            .setDescription('Phone number shown on the card')
            .setRequired(false)
            .setMaxLength(20)
    );

export async function execute(interaction) {
    if (!isPhmcStaff(interaction)) {
        await interaction.reply({
            content: 'Only PHMC Staff can use this command.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const name = interaction.options.getString('name', true);
    const rank = interaction.options.getString('rank', true);
    const phone = interaction.options.getString('phone', false) ?? '';

    console.log(`[CARD] /card invoked by ${interaction.user.tag} | name="${name}" rank="${rank}" phone="${phone}"`);

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        const imageBuffer = await generateBusinessCard(name, rank, phone);

        const attachment = new AttachmentBuilder(imageBuffer, {
            name: 'business-card.png',
            description: `Business card for ${name}`,
        });

        // Shareable mirror (fail-open: line omitted when the proxy fails).
        const imageUrl = await uploadCardImage(imageBuffer);
        let content = `Here's the business card for **${name}**:`;
        if (imageUrl) content += `\nYour image URL: \`${imageUrl}\``;

        console.log(`[CARD] [DONE] Sending card to ${interaction.user.tag}${imageUrl ? ' (+ImgBB URL)' : ''}`);

        await interaction.editReply({ content, files: [attachment] });
    } catch (error) {
        console.error(`[CARD] [ERR] Error:`, error.message);
        await interaction.editReply({
            content: `[ERR] ${error.message}`,
        });
    }
}
