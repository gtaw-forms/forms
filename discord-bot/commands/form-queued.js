import {
    SlashCommandBuilder,
    EmbedBuilder,
    MessageFlags,
} from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('form-queued')
    .setDescription('Show currently queued auto-deployments and their timers');

export async function execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        const { getQueuedDeployments, isMaintenanceMode } = await import('../services/autoDeploy.js');
        const maintenance = await isMaintenanceMode();
        const queue = getQueuedDeployments();

        if (maintenance && queue.length === 0) {
            const embed = new EmbedBuilder()
                .setColor(0xffc107)
                .setTitle('⏸️ Maintenance Mode Active')
                .setDescription('Auto-deployments are paused. Reports will not be queued.\nUse `/maintenance off` to resume.')
                .setFooter({ text: 'Reports in Firebase are waiting' })
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        if (queue.length === 0) {
            const embed = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle('✅ Deploy Queue Empty')
                .setDescription('No reports currently awaiting deployment.')
                .setFooter({ text: 'Auto-deploy checks every new report' })
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        const lines = queue.map((item, i) => {
            const typeIcon = item.type === 'pm' ? '✉️' : '📰';

            if (item.status === 'processing') {
                return `🚀 **Currently Deploying...**\n> ${typeIcon} **${item.label}**\n> 🎯 ${item.forum}`;
            }

            const mins = Math.floor(item.remainingSec / 60);
            const secs = item.remainingSec % 60;
            const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
            return `\`${i + 1}.\` ${typeIcon} **${item.label}**\n> 🎯 ${item.forum}\n> ⏱ **${timeStr}**`;
        });

        const queueCount = queue.filter(q => q.status === 'queued').length;
        const processingCount = queue.filter(q => q.status === 'processing').length;
        const embed = new EmbedBuilder()
            .setColor(queue.some(q => q.status === 'processing') ? 0x007bff : 0xffc107)
            .setTitle(processingCount > 0 ? '🚀 Deploying...' : `⏳ Deploy Queue (${queueCount})`)
            .setDescription(lines.join('\n\n'))
            .setFooter({ text: processingCount > 0 ? 'Currently sending...' : 'Reports deploy after 5-min correction window' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('[FORM-QUEUED] ❌ Error:', error.message);
        await interaction.editReply({ content: `❌ ${error.message}` });
    }
}
