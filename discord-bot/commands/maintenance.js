import {
    SlashCommandBuilder,
    EmbedBuilder,
    MessageFlags,
} from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('maintenance')
    .setDescription('Pause or resume auto-deployments (owner only)')
    .addSubcommand(sub => sub
        .setName('on')
        .setDescription('Pause all queued and future deployments')
    )
    .addSubcommand(sub => sub
        .setName('off')
        .setDescription('Resume auto-deployments')
    )
    .addSubcommand(sub => sub
        .setName('status')
        .setDescription('Check if maintenance mode is active')
    );

export async function execute(interaction) {
    const ownerId = process.env.BOT_OWNER_ID;

    if (!ownerId || interaction.user.id !== ownerId) {
        await interaction.reply({
            content: '❌ Only the bot owner can use this command.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const sub = interaction.options.getSubcommand();
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        const { isMaintenanceMode, setMaintenanceMode } = await import('../services/autoDeploy.js');
        const firebase = (await import('../services/firebase.js')).default;
        firebase.init();
        const db = firebase.db;

        if (sub === 'status') {
            const mode = await isMaintenanceMode();
            const embed = new EmbedBuilder()
                .setColor(mode ? 0xffc107 : 0x2ecc71)
                .setTitle(mode ? '⏸️ Maintenance Mode: ON' : '✅ Maintenance Mode: OFF')
                .setDescription(mode
                    ? 'Auto-deployments are paused. No reports will be queued or sent.'
                    : 'Auto-deployments are active. New reports will be queued normally.')
                .setFooter({ text: 'Use /maintenance on|off to toggle' })
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        const enabling = sub === 'on';
        await setMaintenanceMode(enabling, db);

        const embed = new EmbedBuilder()
            .setColor(enabling ? 0xffc107 : 0x2ecc71)
            .setTitle(enabling ? '⏸️ Maintenance Mode Enabled' : '✅ Maintenance Mode Disabled')
            .setDescription(enabling
                ? 'All pending deployments have been cancelled. New reports will not be queued.'
                : 'Auto-deployments have resumed. New reports will be queued normally.')
            .setTimestamp();
        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('[MAINTENANCE] ❌ Error:', error.message);
        await interaction.editReply({ content: `❌ ${error.message}` });
    }
}
