import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('test-autopsy')
    .setDescription('Run dry-deploy tests for the autopsy pipeline (owner only)')
    .addStringOption(opt =>
        opt.setName('scenario')
            .setDescription('Specific scenario to run (default: all)')
            .setRequired(false)
            .addChoices(
                { name: 'LSSD Autopsy', value: 'LSSD' },
                { name: 'PHMC Autopsy', value: 'PHMC' },
                { name: 'No OOC Name', value: 'NoOOC' },
            ));

export async function execute(interaction) {
    const ownerId = process.env.BOT_OWNER_ID;
    if (!ownerId || interaction.user.id !== ownerId) {
        await interaction.reply({ content: 'Only the bot owner can run autopsy tests.', flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const scenario = interaction.options.getString('scenario');

    try {
        const { runAllDryDeployments } = await import('../services/deployTest.js');
        const result = await runAllDryDeployments(scenario);

        const summary = result.results.map(function (r) {
            if (r.skipped) return '⏭️ **' + r.name + '** — Skipped';
            return (r.ok ? '✅' : '❌') + ' **' + r.name + '** — ' + (r.ok ? 'Passed' : 'Failed' + (r.error ? ': ' + r.error : ''));
        }).join('\n');

        const embed = new EmbedBuilder()
            .setColor(result.ok ? 0x28a745 : 0xffc107)
            .setTitle('Autopsy Dry-Deploy Test Complete')
            .setDescription([
                '**Run ID:** `' + result.runId + '`',
                '**Result:** ' + (result.ok ? 'All passed' : 'Some tests failed'),
                '',
                summary,
                '',
                'Check the bot-spam channel and console logs for detailed step output.',
            ].join('\n'))
            .setFooter({ text: 'Triggered by ' + interaction.user.tag })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (err) {
        console.error('[CMD] test-autopsy error:', err.message);
        await interaction.editReply({ content: 'Error: ' + err.message });
    }
}
