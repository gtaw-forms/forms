import {
    SlashCommandBuilder,
    EmbedBuilder,
    MessageFlags,
} from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('death-record-pending')
    .setDescription('List pending death record drafts waiting for review');

export async function execute(interaction) {
    const ownerId = process.env.BOT_OWNER_ID;
    if (!ownerId || interaction.user.id !== ownerId) {
        await interaction.reply({
            content: 'Only the bot owner can run this command.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        const { default: firebase } = await import('../services/firebase.js');
        firebase.init();
        const db = firebase.db;

        const snap = await db.ref('deathRecordDrafts')
            .orderByChild('status')
            .once('value');

        if (!snap.exists()) {
            const embed = new EmbedBuilder()
                .setTitle('Death Record Drafts')
                .setColor(0x007bff)
                .setDescription('No death record drafts found.')
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        const pending = [];
        const approved = [];
        const denied = [];
        const other = [];

        snap.forEach((child) => {
            const draft = child.val();
            const entry = {
                key: child.key,
                decedentName: draft.decedentName || 'Unknown',
                status: draft.status || 'unknown',
                caseId: draft.morgueCaseId || '-',
                createdAt: draft.createdAt || 0,
                messageId: draft.messageId,
                channelId: draft.channelId,
                formId: draft.formId || '-',
            };

            if (draft.status === 'pending_review' || draft.status === 'morgue_updated') {
                pending.push(entry);
            } else if (draft.status === 'approved') {
                approved.push(entry);
            } else if (draft.status === 'denied') {
                denied.push(entry);
            } else {
                other.push(entry);
            }
        });

        // Sort newest first
        const sortNewest = (a, b) => b.createdAt - a.createdAt;
        pending.sort(sortNewest);

        const lines = [];
        const totalChars = 4000; // embed description limit
        let used = 0;

        for (const p of pending) {
            const timeAgo = p.createdAt
                ? `<t:${Math.floor(p.createdAt / 1000)}:R>`
                : 'unknown';
            const link = p.messageId && p.channelId
                ? `[Jump](<https://discord.com/channels/${interaction.guildId}/${p.channelId}/${p.messageId}>)`
                : '';

            const caseStr = p.caseId !== '-' ? `Case #${p.caseId}` : '';
            const formStr = p.formId === 'mass-ftality-test' ? ' [MF]' : '';
            const line = `• **${p.decedentName}**${formStr} ${caseStr} — ${timeAgo} ${link}\n`;

            if (used + line.length > totalChars) {
                lines.push(`...and ${pending.length - lines.length} more`);
                break;
            }
            used += line.length;
            lines.push(line);
        }

        const fields = [
            { name: 'Pending Review', value: String(pending.length), inline: true },
            { name: 'Approved', value: String(approved.length), inline: true },
            { name: 'Denied', value: String(denied.length), inline: true },
        ];

        const embed = new EmbedBuilder()
            .setTitle('Death Record Drafts')
            .setColor(pending.length > 0 ? 0xffa500 : 0x28a745)
            .addFields(fields);

        if (pending.length > 0) {
            embed.setDescription(lines.join(''));
            embed.setFooter({ text: `${pending.length} pending — click Jump to review` });
        } else {
            embed.setDescription('All drafts have been reviewed. No pending items.');
        }

        embed.setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        console.log(`[CMD] /death-record-pending — ${pending.length} pending, ${approved.length} approved, ${denied.length} denied`);
    } catch (err) {
        console.error('[CMD] ❌ death-record-pending error:', err.message);
        await interaction.editReply({
            content: `Error: ${err.message.slice(0, 300)}`,
        });
    }
}
