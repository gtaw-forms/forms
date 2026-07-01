import {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    MessageFlags,
} from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('report-skip')
    .setDescription('Skip a queued report (remove from deploy queue without deploying)');

export async function execute(interaction) {
    const ownerId = process.env.BOT_OWNER_ID;
    if (!ownerId || interaction.user.id !== ownerId) {
        await interaction.reply({
            content: 'Only the bot owner can skip queued reports.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const { getQueuedDeployments, skipReport } = await import('../services/autoDeploy.js');
    const queue = getQueuedDeployments();

    // Filter out the currently-processing item (can't skip what's running)
    const skippable = queue.filter(e => e.status === 'queued');

    if (skippable.length === 0) {
        const embed = new EmbedBuilder()
            .setColor(0xffc107)
            .setTitle('No Skippable Reports')
            .setDescription('There are no queued reports to skip. The current deployment or an empty queue means nothing to remove.')
            .setFooter({ text: 'Use /form-queued to check the queue' })
            .setTimestamp();
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }

    // Build dropdown options (Discord limits: 25 options, label max 100 chars)
    const options = skippable.slice(0, 25).map((entry, i) => {
        const label = (entry.label || 'Untitled').slice(0, 100);
        const desc = `[${entry.forum}] ${entry.type} — ${entry.remainingSec > 60 ? `${Math.round(entry.remainingSec / 60)}m` : `${entry.remainingSec}s`}`.slice(0, 100);
        return new StringSelectMenuOptionBuilder()
            .setLabel(label)
            .setDescription(desc)
            .setValue(entry.entityKey);
    });

    const select = new StringSelectMenuBuilder()
        .setCustomId('skip_report_select')
        .setPlaceholder('Select a report to skip...')
        .addOptions(options);

    const row = new ActionRowBuilder().addComponents(select);

    const embed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle('Skip Queued Report')
        .setDescription(`Select a report to remove from the deploy queue. It will be marked as \`skipped_manual\` and will not deploy.`)
        .setFooter({ text: `${skippable.length} report(s) queued` })
        .setTimestamp();

    await interaction.reply({
        embeds: [embed],
        components: [row],
        flags: MessageFlags.Ephemeral,
    });
}
