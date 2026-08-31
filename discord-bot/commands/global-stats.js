/**
 * global-stats.js — PHMC Forms global usage stats.
 *
 * Three pages reachable via buttons on the embed:
 *   - Overview        — volume by section, by month, top users per section
 *   - Full Breakdown  — every form type, top users overall + per section
 *   - Activity Heatmap— reports by day-of-week × hour-of-day (UTC) grid
 *
 * Aggregates `scheduledReports` (bot deploy queue) + `newSavedReports` (live saves).
 */
import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import firebase from '../services/firebase.js';

const FORM_NAMES = {
    'coroner-report': 'Coroner Report',
    'coroner_email': 'Coroner Email',
    'autopsy': 'Autopsy Report',
    'mass-ftality-test': 'Mass Fatality Report',
    'death_record': 'Death Record',
    'patient_notes': 'Patient Notes',
    'er_protocol': 'ER Protocol',
    'physical_evaluation': 'Physical Evaluation',
    'staff-patient-file': 'Staff Patient File',
    'surgical': 'Surgical',
    'session_notes': 'Session Notes',
    'intensive_treatment': 'Intensive Treatment',
    'psych-eval': 'Psych Evaluation',
    'general_consultation': 'General Consultation',
    'obgyn_consult': 'OB/GYN Consult',
};

// Section grouping mirrors the app's consent-wizard taxonomy (useConsent FORM_SECTIONS),
// with the clinical bucket split out as "ER / Clinical" per request.
const FORM_SECTIONS = {
    'Coroners': ['coroner-report', 'coroner_email', 'autopsy', 'mass-ftality-test', 'death_record'],
    'ER / Clinical': ['er_protocol', 'patient_notes', 'physical_evaluation', 'staff-patient-file', 'surgical', 'general_consultation', 'obgyn_consult'],
    'Mental Health': ['session_notes', 'intensive_treatment', 'psych-eval'],
};
const SECTION_ICONS = { 'Coroners': '🩺', 'ER / Clinical': '🚑', 'Mental Health': '🧠', 'Other / Unclassified': '📦' };

const sectionOf = (fid) => {
    for (const [name, ids] of Object.entries(FORM_SECTIONS)) {
        if (ids.includes(fid)) return name;
    }
    return 'Other / Unclassified';
};

const PAGE_OVERVIEW = 'overview';
const PAGE_BREAKDOWN = 'breakdown';
const PAGE_HEATMAP = 'heatmap';
const PAGES = [PAGE_OVERVIEW, PAGE_BREAKDOWN, PAGE_HEATMAP];

const fmt = (n) => Number(n || 0).toLocaleString('en-US');
const bar = (val, max, width = 16) => {
    const filled = max > 0 ? Math.round((val / max) * width) : 0;
    return '█'.repeat(filled) + '░'.repeat(Math.max(0, width - filled));
};
const topField = (sm, count = 5) => {
    if (!sm || sm.size === 0) return '—';
    const top = [...sm.entries()].sort((a, b) => b[1] - a[1]).slice(0, count);
    const max = top[0][1] || 1;
    return top.map(([a, c]) => `${bar(c, max)} **${a.replace(/_/g, ' ')}** — ${fmt(c)}`).join('\n');
};

async function gatherStats(db) {
    const byForm = new Map();
    const sectionAuthors = new Map(); // section -> Map(author -> count)
    const allAuthors = new Map();
    const byMonth = new Map();
    const heat = Array.from({ length: 7 }, () => new Array(24).fill(0));
    let total = 0;

    for (const path of ['newSavedReports', 'scheduledReports']) {
        const snap = await db.ref(path).once('value');
        if (!snap.exists()) continue;
        for (const [a, reports] of Object.entries(snap.val())) {
            if (!reports || typeof reports !== 'object') continue;
            for (const [, r] of Object.entries(reports)) {
                if (!r || typeof r !== 'object' || !(r.formId || r.originalKey || r.data)) continue;
                const fid = r.formId || 'unknown';
                byForm.set(fid, (byForm.get(fid) || 0) + 1);
                total++;
                allAuthors.set(a, (allAuthors.get(a) || 0) + 1);
                const section = sectionOf(fid);
                if (!sectionAuthors.has(section)) sectionAuthors.set(section, new Map());
                const sm = sectionAuthors.get(section);
                sm.set(a, (sm.get(a) || 0) + 1);
                const t = Number(r.timestamp) || 0;
                if (t) {
                    const d = new Date(t);
                    const mk = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
                    byMonth.set(mk, (byMonth.get(mk) || 0) + 1);
                    heat[d.getUTCDay()][d.getUTCHours()]++;
                }
            }
        }
    }
    return { total, byForm, sectionAuthors, allAuthors, byMonth, heat };
}

function buildNavRow(active = PAGE_OVERVIEW) {
    const btn = (id, label, emoji) => new ButtonBuilder()
        .setCustomId(`global_stats_page_${id}`)
        .setLabel(label)
        .setEmoji(emoji)
        .setStyle(id === active ? ButtonStyle.Primary : ButtonStyle.Secondary);
    return new ActionRowBuilder().addComponents(
        btn(PAGE_OVERVIEW, 'Overview', '📊'),
        btn(PAGE_BREAKDOWN, 'Full Breakdown', '📋'),
        btn(PAGE_HEATMAP, 'Activity Heatmap', '🔥'),
    );
}

function buildOverviewEmbed(stats) {
    const sections = new Map();
    for (const [fid, count] of stats.byForm.entries()) {
        const name = sectionOf(fid);
        if (!sections.has(name)) sections.set(name, []);
        sections.get(name).push([fid, count]);
    }
    const sectionTotal = (items) => items.reduce((s, [, c]) => s + c, 0);
    const maxSection = Math.max(...[...sections.values()].map(sectionTotal), 1);
    const volumeLines = [...sections.entries()].sort((a, b) => sectionTotal(b[1]) - sectionTotal(a[1]))
        .map(([name, items]) => {
            const subtotal = sectionTotal(items);
            const icon = SECTION_ICONS[name] || '📦';
            const detail = items.sort((a, b) => b[1] - a[1])
                .map(([fid, c]) => `${FORM_NAMES[fid] || fid} ${fmt(c)}`).join(' · ');
            return `${icon} **${name}** — ${fmt(subtotal)} (${stats.total > 0 ? Math.round((subtotal / stats.total) * 100) : 0}%)\n${bar(subtotal, maxSection)} \`${detail}\``;
        }).join('\n');

    const monthList = [...stats.byMonth.entries()].sort().slice(-6);
    const maxMonth = Math.max(...monthList.map(([, c]) => c), 1);
    const monthLines = monthList.map(([m, c]) => `${bar(c, maxMonth)} ${m}: ${fmt(c)}`).join('\n');

    return new EmbedBuilder()
        .setColor(0x00bcd4)
        .setTitle('📊 PHMC Forms — Global Usage Stats')
        .setThumbnail('https://i.imgur.com/Hxjt4M2.png')
        .setDescription(`**${fmt(stats.total)}** reports · **${stats.allAuthors.size}** users`)
        .addFields(
            { name: '🗂️ Report Volume by Section', value: volumeLines || '—', inline: false },
            { name: '📈 By Month (last 6)', value: monthLines || '—', inline: false },
            { name: '🩺 Top Coroners', value: topField(stats.sectionAuthors.get('Coroners'), 5), inline: false },
            { name: '🚑 Top ER / Clinical', value: topField(stats.sectionAuthors.get('ER / Clinical'), 5), inline: false },
            { name: '🧠 Top Mental Health', value: topField(stats.sectionAuthors.get('Mental Health'), 5), inline: false },
        )
        .setFooter({ text: 'PHMC Forms — global stats · use the buttons below for more' })
        .setTimestamp();
}

function buildBreakdownEmbed(stats) {
    const allForms = [...stats.byForm.entries()].sort((a, b) => b[1] - a[1])
        .map(([f, c]) => `**${FORM_NAMES[f] || f}** — ${fmt(c)}`).join('\n');

    const overall = [...stats.allAuthors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    const overallLines = overall.length
        ? overall.map(([a, c]) => `${bar(c, overall[0][1])} **${a.replace(/_/g, ' ')}** — ${fmt(c)}`).join('\n')
        : '—';

    return new EmbedBuilder()
        .setColor(0x0066cc)
        .setTitle('📋 PHMC Forms — Full Breakdown')
        .setThumbnail('https://i.imgur.com/Hxjt4M2.png')
        .setDescription(`**${fmt(stats.total)}** reports · **${stats.allAuthors.size}** users`)
        .addFields(
            { name: '🗂️ Every Form Type', value: allForms || '—', inline: false },
            { name: '🏅 Top 10 Users (overall)', value: overallLines, inline: false },
            { name: '🩺 Top Coroners', value: topField(stats.sectionAuthors.get('Coroners'), 8), inline: false },
            { name: '🚑 Top ER / Clinical', value: topField(stats.sectionAuthors.get('ER / Clinical'), 8), inline: false },
            { name: '🧠 Top Mental Health', value: topField(stats.sectionAuthors.get('Mental Health'), 8), inline: false },
        )
        .setFooter({ text: 'PHMC Forms — full breakdown' })
        .setTimestamp();
}

function buildHeatmapEmbed(stats) {
    const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const SHADES = ['·', '░', '▒', '▓', '█'];
    let max = 0;
    let peakCount = 0;
    let peakHour = 0;
    const dayTotals = new Array(7).fill(0);
    for (let d = 0; d < 7; d++) {
        for (let h = 0; h < 24; h++) {
            const c = stats.heat[d][h];
            if (c > max) max = c;
            dayTotals[d] += c;
            if (c > peakCount) { peakCount = c; peakHour = h; }
        }
    }
    const grid = DAYS.map((dn, d) => `${dn} ${stats.heat[d].map((c) => SHADES[max > 0 ? Math.min(4, Math.floor((c / max) * 5)) : 0]).join('')}`).join('\n');
    const busiestDay = DAYS[dayTotals.indexOf(Math.max(...dayTotals))];
    const pk = String(peakHour).padStart(2, '0');

    return new EmbedBuilder()
        .setColor(0xe67e22)
        .setTitle('🔥 PHMC Forms — Activity Heatmap')
        .setThumbnail('https://i.imgur.com/Hxjt4M2.png')
        .setDescription('Report submissions by **day of week** (rows) × **hour of day UTC** (columns 0–23).')
        .addFields(
            { name: 'Grid', value: '```' + grid + '```', inline: false },
            { name: 'Legend', value: '`·` none · `░` low · `▒` med · `▓` high · `█` peak', inline: false },
            { name: 'Peak', value: `Busiest day: **${busiestDay}** · Peak hour: **${pk}:00–${pk}:59 UTC** (${fmt(peakCount)} reports)`, inline: false },
        )
        .setFooter({ text: 'PHMC Forms — activity heatmap' })
        .setTimestamp();
}

export const data = new SlashCommandBuilder()
    .setName('global-stats')
    .setDescription('(Owner) PHMC Forms usage stats — volume, breakdown, activity heatmap');

export async function execute(interaction) {
    const ownerId = process.env.BOT_OWNER_ID;
    if (!ownerId || interaction.user.id !== ownerId) {
        await interaction.reply({ content: 'Only the bot owner can view global stats.', flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    firebase.init();
    const db = firebase.db;

    try {
        const stats = await gatherStats(db);
        await interaction.editReply({ embeds: [buildOverviewEmbed(stats)], components: [buildNavRow(PAGE_OVERVIEW)] });
    } catch (err) {
        console.error('[CMD] global-stats error:', err.message);
        await interaction.editReply({ content: `Error: ${err.message}` });
    }
}

/** Button page handler (registered in index.js interactionCreate). */
export async function handleStatsPage(interaction) {
    const page = interaction.customId.replace('global_stats_page_', '');
    if (!PAGES.includes(page)) {
        await interaction.update({});
        return;
    }
    try {
        firebase.init();
        const stats = await gatherStats(firebase.db);
        const embed = page === PAGE_BREAKDOWN ? buildBreakdownEmbed(stats)
            : page === PAGE_HEATMAP ? buildHeatmapEmbed(stats)
            : buildOverviewEmbed(stats);
        await interaction.update({ embeds: [embed], components: [buildNavRow(page)] });
    } catch (err) {
        console.error('[CMD] global-stats page error:', err.message);
        await interaction.update({ content: 'Error: ' + err.message, embeds: [], components: [] });
    }
}
