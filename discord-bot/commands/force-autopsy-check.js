import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('force-autopsy-check')
    .setDescription('Manually trigger the autopsy request monitor to scan f=265');

export async function execute(interaction) {
    const ownerId = process.env.BOT_OWNER_ID;
    if (!ownerId || interaction.user.id !== ownerId) {
        await interaction.reply({ content: 'Only the bot owner can force an autopsy check.', flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        const { checkForNewRequests } = await import('../services/autopsyRequestMonitor.js');
        const result = await checkForNewRequests();

        const embed = new EmbedBuilder()
            .setColor(0x00bcd4)
            .setTitle('Autopsy Check Complete')
            .setDescription(`Manual autopsy forum check finished.\nSee bot logs for details.`)
            .setFooter({ text: `Triggered by ${interaction.user.tag}` })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (err) {
        console.error('[CMD] force-autopsy-check error:', err.message);
        await interaction.editReply({ content: `Error: ${err.message}` });
    }
}
