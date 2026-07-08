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

    const { getQueuedDeployments, getStuckReports, skipReport } = await import('../services/autoDeploy.js');
    let queue = getQueuedDeployments();
    let skippable = queue.filter(e => e.status === 'queued');

    // If queue is empty but maintenance mode might be hiding reports, scan Firebase directly
    if (skippable.length === 0) {
        const firebase = await import('../services/firebase.js');
        firebase.default.init();
        const db = firebase.default.db;
        const snap = await db.ref('appMetadata/botMaintenance').once('value');
        if (snap.val() === true) {
            const stuck = await getStuckReports();
            if (stuck.length > 0) {
                skippable = stuck;
            }
        }
    }

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
        const value = entry.entityKey || `${entry.authorId}|${entry.key}`;
        // Stuck reports (from Firebase) may not have in-memory fields
        const forum = entry.forum || '?';
        const type = entry.type || entry.status || 'stuck';
        const timeStr = entry.remainingSec != null
            ? (entry.remainingSec > 60 ? `${Math.round(entry.remainingSec / 60)}m` : `${entry.remainingSec}s`)
            : 'stuck';
        const desc = `[${forum}] ${type} — ${timeStr}`.slice(0, 100);
        return new StringSelectMenuOptionBuilder()
            .setLabel(label)
            .setDescription(desc)
            .setValue(value);
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
