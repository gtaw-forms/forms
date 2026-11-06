/**
 * forms-stats.js — Per-staffer saved-report breakdown (replaces autopsy-stats).
 * Pulls per-person per-month counts from the VPS saved-report store
 * (`GET /api/reports/attribution`, all authors included) and renders a
 * shareable summary image. Months are requestable via a period preset or an
 * explicit from/to (YYYY-MM); report types filter via `type`.
 */
import { SlashCommandBuilder, EmbedBuilder, MessageFlags, AttachmentBuilder } from 'discord.js';
import { isOwnerOrWhitelisted } from '../services/permissions.js';
import { firstApiKey } from '../services/apiKeyUtil.js';
import { renderFormsStatsImage } from '../services/formsStatsImage.js';
import { uploadViaProxy } from '../services/imageProxy.js';

const TYPE_CHOICES = [
    ['All coroner reports', 'all-coroners'],
    ['Autopsy', 'autopsy'],
    ['Coroner report', 'coroner-report'],
    ['Death record', 'death_record'],
    ['Coroner email', 'coroner_email'],
    ['Mass fatality', 'mass-ftality-test'],
];

const TYPE_LABELS = {
    'all-coroners': 'Coroner Reports',
    autopsy: 'Autopsy Reports',
    'coroner-report': 'Coroner Reports (CK/PK)',
    death_record: 'Death Records',
    coroner_email: 'Coroner Emails',
    'mass-ftality-test': 'Mass Fatality Reports',
};

const PERIOD_CHOICES = [
    ['Last 3 months', 'last-3'],
    ['Last 6 months', 'last-6'],
    ['Last 12 months', 'last-12'],
    ['Year to date', 'year-to-date'],
    ['All time', 'all-time'],
];

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

const monthKey = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
const shiftMonth = (ym, delta) => {
    let [y, m] = ym.split('-').map(Number);
    m += delta;
    while (m < 1) { m += 12; y--; }
    while (m > 12) { m -= 12; y++; }
    return `${y}-${String(m).padStart(2, '0')}`;
};
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const prettyRange = (from, to) => {
    if (from === to) {
        const [y, m] = from.split('-').map(Number);
        return `${MONTH_NAMES[m - 1]} ${y}`;
    }
    const [fy, fm] = from.split('-').map(Number);
    const [ty, tm] = to.split('-').map(Number);
    if (fy === ty) return `${MONTH_NAMES[fm - 1]}–${MONTH_NAMES[tm - 1]} ${ty}`;
    return `${MONTH_NAMES[fm - 1]} ${fy}–${MONTH_NAMES[tm - 1]} ${ty}`;
};

export const data = new SlashCommandBuilder()
    .setName('forms-stats')
    .setDescription('(Owner) Saved-report breakdown per staffer + image')
    .addStringOption((option) =>
        option
            .setName('type')
            .setDescription('Report type (default: all coroner reports)')
            .addChoices(...TYPE_CHOICES.map(([name, value]) => ({ name, value })))
            .setRequired(false)
    )
    .addStringOption((option) =>
        option
            .setName('period')
            .setDescription('Month range preset (default: last 6 months)')
            .addChoices(...PERIOD_CHOICES.map(([name, value]) => ({ name, value })))
            .setRequired(false)
    )
    .addStringOption((option) =>
        option
            .setName('from')
            .setDescription('Start month YYYY-MM (overrides period; needs to)')
            .setRequired(false)
    )
    .addStringOption((option) =>
        option
            .setName('to')
            .setDescription('End month YYYY-MM (overrides period; needs from)')
            .setRequired(false)
    );

export async function execute(interaction) {
    if (!isOwnerOrWhitelisted(interaction)) {
        await interaction.reply({ content: 'Only the bot owner can view forms stats.', flags: MessageFlags.Ephemeral });
        return;
    }

    const type = interaction.options.getString('type', false) || 'all-coroners';
    const period = interaction.options.getString('period', false) || 'last-6';
    const fromOpt = (interaction.options.getString('from', false) || '').trim();
    const toOpt = (interaction.options.getString('to', false) || '').trim();

    if ((fromOpt && !MONTH_RE.test(fromOpt)) || (toOpt && !MONTH_RE.test(toOpt))) {
        await interaction.reply({ content: 'from/to must be YYYY-MM (e.g. 2026-05).', flags: MessageFlags.Ephemeral });
        return;
    }
    if ((fromOpt && !toOpt) || (!fromOpt && toOpt)) {
        await interaction.reply({ content: 'Pass both from and to, or neither (use period).', flags: MessageFlags.Ephemeral });
        return;
    }
    if (fromOpt && fromOpt > toOpt) {
        await interaction.reply({ content: 'from must not be after to.', flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        const cur = monthKey(new Date());
        let from = null;
        let to = null;
        if (fromOpt) {
            from = fromOpt;
            to = toOpt;
        } else if (period === 'year-to-date') {
            from = `${cur.slice(0, 4)}-01`;
            to = cur;
        } else if (period === 'all-time') {
            from = null;
            to = null;
        } else {
            const n = Number(period.split('-')[1]) || 6;
            to = cur;
            from = shiftMonth(cur, -(n - 1));
        }

        const params = new URLSearchParams({ forms: type });
        if (from) params.set('from', from);
        if (to) params.set('to', to);
        const apiKey = firstApiKey(process.env.MORGUE_API_KEYS);
        const response = await fetch(`http://127.0.0.1:3001/api/reports/attribution?${params.toString()}`, {
            headers: { 'x-api-key': apiKey || '' },
        });
        if (!response.ok) throw new Error(`attribution API returned HTTP ${response.status}`);
        const attr = await response.json();
        if (!attr?.success) throw new Error('attribution API returned no data');

        if (!attr.grandTotal || attr.months.length === 0) {
            await interaction.editReply({ content: `No ${TYPE_LABELS[type] || type} reports saved in that range.` });
            return;
        }
        if (attr.months.length > 24) {
            await interaction.editReply({ content: `Range covers ${attr.months.length} months (max 24) — narrow from/to.` });
            return;
        }

        const rangeLabel = prettyRange(attr.from, attr.to);
        const title = `PHMC — ${TYPE_LABELS[type] || type} per Person, ${rangeLabel}`;
        const image = await renderFormsStatsImage({
            title,
            subtitle: `Saved ${String(TYPE_LABELS[type] || type).toLowerCase()} · attributed by examining staffer · generated ${new Date().toISOString().slice(0, 10)}`,
            months: attr.months,
            people: attr.people,
            monthTotals: attr.monthTotals,
            grandTotal: attr.grandTotal,
            footer: `Source: VPS saved-report store · examiner = coronerEmployee/phmcEmployee on each report (fallback: author) · all authors included.`,
        });

        const safeRange = `${attr.from}_${attr.to}`.replace(/[^0-9A-Za-z_-]/g, '');
        const attachment = new AttachmentBuilder(image, { name: `forms-stats-${type}-${safeRange}.png` });

        // Shareable mirror (fail-open: line omitted when the proxy fails).
        const imageUrl = await uploadViaProxy(image, 'imglink').catch(() => null);

        const topLines = attr.people.slice(0, 5)
            .map((p, i) => `${i + 1}. **${p.name}** — ${p.total}`)
            .join('\n');
        const embed = new EmbedBuilder()
            .setColor(0x0d47a1)
            .setTitle(title)
            .setDescription(`**${attr.grandTotal}** reports · **${attr.people.length}** staff · ${attr.from} to ${attr.to}`)
            .addFields({ name: 'Top staff', value: topLines || '—', inline: false })
            .setTimestamp();
        if (attr.skippedNoTimestamp) {
            embed.setFooter({ text: `${attr.skippedNoTimestamp} report(s) skipped (no timestamp)` });
        }

        let content = null;
        if (imageUrl) content = `Shareable image URL: \`${imageUrl}\``;
        await interaction.editReply({ content, embeds: [embed], files: [attachment] });
    } catch (err) {
        console.error('[CMD] forms-stats error:', err.message);
        await interaction.editReply({ content: `Error: ${err.message}` });
    }
}
