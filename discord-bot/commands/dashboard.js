import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags,
} from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('dashboard')
    .setDescription('Manage the live system status dashboard')
    .addSubcommand(sub =>
        sub.setName('setup')
            .setDescription('Set up the dashboard in this or a specified channel')
            .addChannelOption(opt =>
                opt.setName('channel')
                    .setDescription('Channel for the dashboard (defaults to current)')
                    .setRequired(false)
            )
    )
    .addSubcommand(sub =>
        sub.setName('destroy')
            .setDescription('Remove the dashboard and stop refreshing')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'setup') {
        const channel = interaction.options.getChannel('channel') || interaction.channel;

        if (!channel.isTextBased()) {
            await interaction.reply({
                content: '❌ Please select a text channel.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            const { setupDashboard } = await import('../services/dashboardManager.js');
            await setupDashboard(channel.id);
            await interaction.editReply({
                content: `✅ Dashboard set up in ${channel}. It will refresh automatically every 5 minutes.`,
            });
        } catch (err) {
            console.error('[DASHBOARD] Setup error:', err);
            await interaction.editReply({
                content: `❌ Failed to set up dashboard: ${err.message}`,
            });
        }
    } else if (sub === 'destroy') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            const { destroyDashboard } = await import('../services/dashboardManager.js');
            await destroyDashboard();
            await interaction.editReply({
                content: '🗑️ Dashboard removed and refresh stopped.',
            });
        } catch (err) {
            console.error('[DASHBOARD] Destroy error:', err);
            await interaction.editReply({
                content: `❌ Failed to destroy dashboard: ${err.message}`,
            });
        }
    }
}
