import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { isOwnerOrWhitelisted } from '../services/permissions.js';

export const data = new SlashCommandBuilder()
    .setName('telemetry-now')
    .setDescription('Post the pending client-telemetry rollup now (hourly job runs on its own)');

export async function execute(interaction) {
    if (!isOwnerOrWhitelisted(interaction)) {
        await interaction.reply({ content: 'Only the bot owner can trigger a telemetry rollup.', flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        const { runTelemetryRollup } = await import('../services/telemetryRollup.js');
        const result = await runTelemetryRollup();

        if (result.posted) {
            await interaction.editReply({
                content: `Telemetry rollup posted (${result.events} events, ${result.users} users, ${result.errors} errors).`,
            });
        } else {
            await interaction.editReply({ content: `Rollup skipped: ${result.reason}.` });
        }
    } catch (err) {
        console.error('[CMD] telemetry-now error:', err.message);
        await interaction.editReply({ content: `Error: ${err.message}` });
    }
}
