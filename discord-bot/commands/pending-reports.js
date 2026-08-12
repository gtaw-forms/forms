import {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
} from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('pending-reports')
    .setDescription('List all reports stuck in the deploy queue (not yet completed)');

const CONFIRM_PREFIX = 'pendingrpt_confirm_';

export async function execute(interaction) {
    const ownerId = process.env.BOT_OWNER_ID;
    if (!ownerId || interaction.user.id !== ownerId) {
        await interaction.reply({
            content: 'Only the bot owner can run this command.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    // Show confirmation with estimated scope
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Quick count first — just get a size estimate without loading everything
    let estimateTotal = 0;
    let estimateAuthors = 0;
    try {
        const { default: firebase } = await import('../services/firebase.js');
        firebase.init();
        const db = firebase.db;
        const countSnap = await db.ref('scheduledReports').once('value');
        if (countSnap.exists()) {
            countSnap.forEach((authorSnap) => {
                estimateAuthors++;
                authorSnap.forEach(() => estimateTotal++);
            });
        }
    } catch (e) {
        // If we can't even count, proceed anyway
    }

    if (estimateTotal === 0) {
        const embed = new EmbedBuilder()
            .setTitle('Pending Reports')
            .setColor(0x28a745)
            .setDescription('No reports in the deploy queue.')
            .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
        return;
    }

    const confirmId = CONFIRM_PREFIX + interaction.user.id;
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(confirmId)
            .setLabel(`Scan ${estimateTotal} report(s) from ${estimateAuthors} author(s)`)
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('pendingrpt_cancel')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary),
    );

    await interaction.editReply({
        content: `[WARN] This will scan **${estimateTotal} report(s)** across **${estimateAuthors} author(s)** in scheduledReports. Proceed?`,
        components: [row],
    });

    // Wait for the confirm button — expire after 30s
    let confirmed = false;
    try {
        const btnInteraction = await interaction.channel.awaitMessageComponent({
            filter: (i) => {
                if (i.customId === 'pendingrpt_cancel') return true;
                if (i.customId === confirmId && i.user.id === interaction.user.id) return true;
                return false;
            },
            time: 30000,
        });

        if (btnInteraction.customId === 'pendingrpt_cancel') {
            await btnInteraction.update({ content: 'Cancelled.', components: [] });
            return;
        }
        confirmed = true;
        await btnInteraction.deferUpdate();
    } catch (e) {
        // Timed out or error
        if (!interaction.ephemeral) {
            await interaction.editReply({ content: 'Confirmation timed out.', components: [] });
        } else {
            await interaction.editReply({ content: 'Confirmation timed out.', components: [] });
        }
        return;
    }

    if (!confirmed) return;

    // ── Proceed with the full scan ──
    try {
        const { default: firebase } = await import('../services/firebase.js');
        firebase.init();
        const db = firebase.db;

        const snap = await db.ref('scheduledReports').once('value');
        if (!snap.exists()) {
            const embed = new EmbedBuilder()
                .setTitle('Pending Reports')
                .setColor(0x28a745)
                .setDescription('No reports in the deploy queue.')
                .setTimestamp();
            await interaction.editReply({ embeds: [embed], components: [] });
            return;
        }

        const groups = {
            pending: [],
            searching: [],
            replying: [],
            retrying: [],
            error: [],
            timed_out: [],
            other: [],
            completed: [],
        };

        snap.forEach((authorSnap) => {
            const authorId = authorSnap.key;
            authorSnap.forEach((reportSnap) => {
                const r = reportSnap.val();
                const status = r.deployStatus || 'pending';
                const entry = {
                    key: reportSnap.key,
                    authorId,
                    label: r.originalKey || r.formName || reportSnap.key,
                    formId: r.formId || '',
                    status,
                    timestamp: r.createdAt || r.timestamp || 0,
                    message: r.deployMessage || '',
                };

                if (status === 'deployed' || status === 'already_completed' || r.hasdeployed) {
                    groups.completed.push(entry);
                } else if (status === 'pending') {
                    groups.pending.push(entry);
                } else if (status === 'searching') {
                    groups.searching.push(entry);
                } else if (status === 'replying') {
                    groups.replying.push(entry);
                } else if (status === 'retrying' || status === 'retry_queued') {
                    groups.retrying.push(entry);
                } else if (status === 'error' || status === 'reply_failed' || status === 'topic_not_found') {
                    groups.error.push(entry);
                } else if (status === 'pick_timed_out') {
                    groups.timed_out.push(entry);
                } else {
                    groups.other.push(entry);
                }
            });
        });

        const nonDeployed = groups.pending.length + groups.searching.length
            + groups.replying.length + groups.retrying.length
            + groups.error.length + groups.timed_out.length + groups.other.length;

        if (nonDeployed === 0) {
            const embed = new EmbedBuilder()
                .setTitle('Pending Reports')
                .setColor(0x28a745)
                .setDescription('All reports have been deployed. Nothing pending.')
                .addFields({ name: 'Total Deployed', value: String(groups.completed.length), inline: true })
                .setTimestamp();
            await interaction.editReply({ embeds: [embed], components: [] });
            return;
        }

        const formatList = (entries, maxShow = 10) => {
            const sorted = entries.sort((a, b) => b.timestamp - a.timestamp);
            const lines = sorted.slice(0, maxShow).map(e => {
                const age = e.timestamp
                    ? `<t:${Math.floor(e.timestamp / 1000)}:R>`
                    : 'unknown';
                const label = e.label.length > 60 ? e.label.slice(0, 57) + '...' : e.label;
                const msg = e.message ? ' -- ' + e.message.slice(0, 60) : '';
                return '- **' + label + '** ' + age + msg;
            });
            if (sorted.length > maxShow) {
                lines.push('... and ' + sorted.length + ' more');
            }
            return lines.join('\n');
        };

        const embed = new EmbedBuilder()
            .setTitle('Pending Reports')
            .setColor(0xffa500)
            .setDescription(nonDeployed + ' report(s) waiting for deploy')
            .setTimestamp()
            .setFooter({ text: 'Only visible to bot owner' });

        if (groups.pending.length > 0) {
            embed.addFields({ name: '[WARN] Pending (' + groups.pending.length + ')', value: formatList(groups.pending) || 'None' });
        }
        if (groups.searching.length > 0) {
            embed.addFields({ name: 'Searching (' + groups.searching.length + ')', value: formatList(groups.searching) || 'None' });
        }
        if (groups.replying.length > 0) {
            embed.addFields({ name: 'Replying (' + groups.replying.length + ')', value: formatList(groups.replying) || 'None' });
        }
        if (groups.retrying.length > 0) {
            embed.addFields({ name: 'Retrying (' + groups.retrying.length + ')', value: formatList(groups.retrying) || 'None' });
        }
        if (groups.error.length > 0) {
            embed.addFields({ name: '[ERR] Errors (' + groups.error.length + ')', value: formatList(groups.error) || 'None' });
        }
        if (groups.timed_out.length > 0) {
            embed.addFields({ name: 'Timed Out (' + groups.timed_out.length + ')', value: formatList(groups.timed_out) || 'None' });
        }
        if (groups.other.length > 0) {
            embed.addFields({ name: 'Other (' + groups.other.length + ')', value: formatList(groups.other) || 'None' });
        }

        embed.addFields({ name: 'Total Deployed', value: String(groups.completed.length), inline: true });

        await interaction.editReply({ embeds: [embed], components: [] });
        console.log('[CMD] /pending-reports -- ' + nonDeployed + ' pending, ' + groups.completed.length + ' deployed');

    } catch (err) {
        console.error('[CMD] [ERR] pending-reports error:', err.message);
        await interaction.editReply({ content: 'Error: ' + err.message.slice(0, 300), components: [] });
    }
}
