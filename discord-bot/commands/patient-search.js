import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('patient-search')
    .setDescription('Search the Medical Records forum (f=97) for a patient thread')
    .addStringOption(opt =>
        opt.setName('name')
            .setDescription('Patient name to search for')
            .setRequired(true));

export async function execute(interaction) {
    const ownerId = process.env.BOT_OWNER_ID;
    if (!ownerId || interaction.user.id !== ownerId) {
        await interaction.reply({ content: 'Only the bot owner can search patients.', flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const searchName = interaction.options.getString('name').trim();

    try {
        const { getForumClient } = await import('../services/forumClient.js');

        console.log(`[CMD] patient-search: Searching for "${searchName}" in f=97...`);
        const client = getForumClient();
        await client.login(null, null, { force: false, baseUrl: process.env.FORUM_BASE_URL });

        const { topicId, title } = await client.searchForPatientTopic(searchName);

        const embed = new EmbedBuilder()
            .setColor(topicId ? 0x28a745 : 0xffc107)
            .setTitle('Patient Search Results')
            .addFields(
                { name: 'Search Term', value: searchName, inline: true },
                { name: 'Found', value: topicId ? '✅ Yes' : '❌ No', inline: true },
            );

        if (topicId) {
            embed.addFields(
                { name: 'Topic ID', value: `#${topicId}`, inline: true },
                { name: 'Topic Title', value: title || '(no title)', inline: false },
                { name: 'URL', value: `${process.env.FORUM_BASE_URL || 'https://phmc.gta.world'}/viewtopic.php?t=${topicId}`, inline: false },
            );
        } else {
            embed.setDescription('No matching patient thread found in f=97.');
        }

        embed.setFooter({ text: `Triggered by ${interaction.user.tag}` }).setTimestamp();
        await interaction.editReply({ embeds: [embed] });
    } catch (err) {
        console.error('[CMD] patient-search error:', err.message);
        await interaction.editReply({ content: `Error: ${err.message}` });
    }
}
