import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import firebase from '../services/firebase.js';
import { getRotationStatus } from '../services/autopsyRotation.js';

export const data = new SlashCommandBuilder()
    .setName('rotation-list')
    .setDescription('Show the autopsy rotation order and current workload for each ME');

export async function execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    firebase.init();
    const db = firebase.db;

    try {
        const status = await getRotationStatus(db);

        if (!status.configured) {
            await interaction.editReply({
                content: 'No rotation list is configured yet. Use `/rotation-set list:"Name1, Name2, ..."` by the bot owner to create one.',
            });
            return;
        }

        const lines = status.meStatus.map((m) => {
            const next = m.isEffectiveNext ? ' **<-- NEXT**' : '';
            const loa = m.onLoa ? ' **-- LEAVE OF ABSENCE**' : '';
            const active = m.activeCases > 0 ? ` (${m.activeCases} active case${m.activeCases > 1 ? 's' : ''})` : '';
            const recency = m.lastAssigned
                ? ` - last assigned ${timeAgo(m.lastAssigned)}`
                : ' - no prior assignments';
            return `**${m.name}**${next}${loa}${active}${recency}`;
        });

        lines.push('');
        lines.push('_LEAVE OF ABSENCE = skipped during assignment_');
        lines.push('_Active case(s) = not eligible until completed_');
        lines.push('_Assigned within 24h = skipped if another ME is available_');

        if (status.surgeMode) {
            lines.push('');
            lines.push(`**🔀 SURGE MODE ACTIVE** — every ME has an active case. Next case goes to the **least-loaded** ME (ties → **oldest last-assigned**${status.surgePick ? ` → **${status.surgePick}**` : ''}).`);
        }

        const nextUp = status.surgeMode
            ? `${status.surgePick || 'least-loaded ME'} (surge)`
            : (status.effectiveNext || 'None available');

        const embed = new EmbedBuilder()
            .setColor(0x00bcd4)
            .setTitle('Autopsy Rotation')
            .setDescription(lines.join('\n'))
            .addFields(
                { name: 'Position Pointer', value: `#${status.position + 1} of ${status.list.length}`, inline: true },
                { name: 'Next Up', value: nextUp, inline: true },
            )
            .setFooter({ text: 'Next eligible ME in rotation (skips LOA and active cases). Surge mode = least-loaded, ties → oldest last-assigned.' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (err) {
        console.error('[CMD] rotation-list error:', err.message);
        await interaction.editReply({ content: `Error: ${err.message}` });
    }
}

function timeAgo(epochMs) {
    const seconds = Math.floor((Date.now() - epochMs) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}
