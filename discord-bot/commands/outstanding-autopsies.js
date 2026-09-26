import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { isSupervisorUp } from '../services/permissions.js';
import firebase from '../services/firebase.js';
import { getOutstandingCases } from '../services/outstandingAutopsies.js';

export const data = new SlashCommandBuilder()
    .setName('outstanding-autopsies')
    .setDescription('Show outstanding autopsies with wait windows and time remaining');

function fmtDur(h) {
    const a = Math.abs(Math.round(h));
    if (a < 1) return 'under 1h';
    if (a < 48) return `${a}h`;
    const d = Math.floor(a / 24);
    return `${d}d${a % 24 ? ` ${a % 24}h` : ''}`;
}

function rowLine(r) {
    const who = r.decedent && r.label !== r.decedent ? `${r.label} (${r.decedent})` : r.label;
    const link = r.caseUrl ? `[${who}](<${r.caseUrl}>)` : `*${who}*`;
    const age = r.ageH == null ? 'age unknown' : `${fmtDur(r.ageH)} waiting`;
    const left = r.remainingH == null
        ? ''
        : (r.overdue ? ` — **OVERDUE ${fmtDur(r.remainingH)}**` : ` — ${fmtDur(r.remainingH)} left (of ${r.limitH}h ${r.deathType})`);
    return `• **${r.me}** — ${link} — ${age}${left}`;
}

export async function execute(interaction) {
    if (!isSupervisorUp(interaction)) {
        await interaction.reply({ content: 'Only Supervisors and up can view outstanding autopsies.', flags: MessageFlags.Ephemeral });
        return;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    firebase.init();
    const db = firebase.db;

    try {
        const rows = await getOutstandingCases(db);
        if (rows.length === 0) {
            const embed = new EmbedBuilder()
                .setColor(0x28a745)
                .setTitle('Outstanding Autopsies')
                .setDescription('No outstanding autopsies — queue is clear.')
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
            return;
        }
        const overdue = rows.filter((r) => r.overdue);
        const upcoming = rows.filter((r) => !r.overdue);
        const fields = [];
        if (overdue.length > 0) {
            fields.push({
                name: `Overdue (${overdue.length})`,
                value: overdue.slice(0, 10).map(rowLine).join('\n').slice(0, 1024) || 'None',
                inline: false,
            });
        }
        if (upcoming.length > 0) {
            fields.push({
                name: `Upcoming (${upcoming.length})`,
                value: upcoming.slice(0, 10).map(rowLine).join('\n').slice(0, 1024) || 'None',
                inline: false,
            });
        }
        const hidden = Math.max(0, rows.length - 20);
        const embed = new EmbedBuilder()
            .setColor(overdue.length > 0 ? 0xe74c3c : 0x00bcd4)
            .setTitle('Outstanding Autopsies')
            .setDescription(
                `**${rows.length}** open case(s)${hidden > 0 ? ` — showing 20 most urgent, ${hidden} more` : ''}. ` +
                `Windows: CK 72h · PK 120h · other 48h.`
            )
            .addFields(fields)
            .setFooter({ text: 'Supervisors: reassign with /reassign-autopsy' })
            .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
    } catch (err) {
        console.error('[CMD] outstanding-autopsies error:', err.message);
        await interaction.editReply({ content: `Error: ${err.message}` });
    }
}
