/**
 * autopsy-stats.js — Weekly/monthly autopsy request stats.
 * Reads all `autopsy-requested` entries and summarizes received/processed by
 * month, week, faction, and assigned ME. `detectedAt` = submission time;
 * `completedAt` (or caseState 'complete') = processed.
 */
import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import firebase from '../services/firebase.js';

export const data = new SlashCommandBuilder()
    .setName('autopsy-stats')
    .setDescription('(Owner) Weekly/monthly autopsy request stats');

export async function execute(interaction) {
    const ownerId = process.env.BOT_OWNER_ID;
    if (!ownerId || interaction.user.id !== ownerId) {
        await interaction.reply({ content: 'Only the bot owner can view autopsy stats.', flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    firebase.init();
    const db = firebase.db;

    try {
        const snap = await db.ref('autopsy-requested').once('value');
        const entries = [];
        if (snap.exists()) {
            snap.forEach((child) => {
                const v = child.val() || {};
                if (v.wasMatch === false && !v.name) return;
                entries.push({ key: child.key, ...v });
            });
        }

        const now = Date.now();
        const ts = (e) => {
            const t = e.detectedAt ? new Date(e.detectedAt).getTime() : e.createdAt || 0;
            return Number.isFinite(t) ? t : 0;
        };
        const isProcessed = (e) => !!e.completedAt || String(e.caseState || '').toLowerCase() === 'complete';

        const total = entries.length;
        const processed = entries.filter(isProcessed).length;
        const pending = total - processed;

        // ── Monthly (last 6) ──
        const monthKey = (t) => {
            const d = new Date(t);
            return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
        };
        const months = new Map();
        entries.forEach((e) => {
            const t = ts(e);
            if (!t) return;
            const k = monthKey(t);
            if (!months.has(k)) months.set(k, { r: 0, p: 0 });
            months.get(k).r++;
            if (isProcessed(e)) months.get(k).p++;
        });
        const monthLines = [...months.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1).slice(-6)
            .map(([k, c]) => `${k}: ${c.r} rec / ${c.p} done`);

        // ── Weekly (last 4, Mon-start UTC) ──
        const weekStart = (t) => {
            const d = new Date(t);
            const day = (d.getUTCDay() + 6) % 7;
            return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - day * 86400000;
        };
        const weeks = new Map();
        entries.forEach((e) => {
            const t = ts(e);
            if (!t) return;
            const k = weekStart(t);
            if (!weeks.has(k)) weeks.set(k, { r: 0, p: 0 });
            weeks.get(k).r++;
            if (isProcessed(e)) weeks.get(k).p++;
        });
        const weekLines = [...weeks.entries()].sort((a, b) => b[0] - a[0]).slice(0, 4)
            .map(([k, c]) => `w/c ${new Date(k).toISOString().slice(0, 10)}: ${c.r} rec / ${c.p} done`);

        // ── Last 30 days ──
        const last30 = entries.filter((e) => ts(e) >= now - 30 * 86400000);
        const last30Processed = last30.filter(isProcessed).length;

        // ── By faction ──
        const factions = new Map();
        entries.forEach((e) => factions.set(e.faction || '?', (factions.get(e.faction || '?') || 0) + 1));

        // ── By ME (assignments) ──
        // Multi-decedent requests (caseState 'multi') hold ONE assignment per
        // decedent under cases/<idx>/assignedTo — the top-level assignedTo is the
        // comma-joined aggregate for dashboards. Count each per-case assignment
        // against its own ME so "Anne Carter, Alyson Frost" doesn't become a
        // merged row.
        const mes = new Map();
        const bumpMe = (name, done) => {
            if (!name) return;
            if (!mes.has(name)) mes.set(name, { a: 0, p: 0 });
            mes.get(name).a++;
            if (done) mes.get(name).p++;
        };
        const caseDone = (c) => !!c.completedAt || String(c.caseState || '').toLowerCase() === 'complete';

        entries.forEach((e) => {
            if (String(e.caseState || '') === 'multi') {
                const cases = e.cases && typeof e.cases === 'object' ? Object.values(e.cases) : [];
                if (cases.length > 0) {
                    cases.forEach((c) => bumpMe(c && c.assignedTo, c ? caseDone(c) : false));
                    return;
                }
                // Legacy multi without per-case records — split the aggregate.
                String(e.assignedTo || '').split(',').map((s) => s.trim()).filter(Boolean)
                    .forEach((n) => bumpMe(n, isProcessed(e)));
                return;
            }
            if (!e.assignedTo) return;
            bumpMe(e.assignedTo, isProcessed(e));
        });
        const meLines = [...mes.entries()].sort((a, b) => b[1].a - a[1].a).slice(0, 8)
            .map(([n, c]) => `${n}: ${c.a} assigned / ${c.p} done`);

        // ── Pending ──
        const pendingList = entries.filter((e) => !isProcessed(e))
            .sort((a, b) => ts(a) - ts(b))
            .map((e) => `${e.name || '?'}${e.assignedTo ? ' → ' + e.assignedTo : ''} (${Math.floor((now - ts(e)) / 86400000)}d)`)
            .join('\n') || 'None';

        const embed = new EmbedBuilder()
            .setColor(0x00bcd4)
            .setTitle('Autopsy Request Stats')
            .setDescription(`Total: **${total}** received | **${processed}** processed | **${pending}** pending`)
            .addFields(
                { name: 'Last 30 Days', value: `${last30.length} received / ${last30Processed} processed`, inline: false },
                { name: 'Monthly (last 6)', value: monthLines.join('\n') || '—', inline: false },
                { name: 'Weekly (last 4)', value: weekLines.join('\n') || '—', inline: false },
                { name: 'By Faction', value: [...factions.entries()].map(([f, c]) => `${f}: ${c}`).join(' | ') || '—', inline: false },
                { name: 'By ME (assignments)', value: meLines.join('\n') || '—', inline: false },
                { name: 'Pending', value: pendingList.length > 1000 ? pendingList.slice(0, 1000) : pendingList, inline: false },
            )
            .setFooter({ text: 'detectedAt = submission time · completedAt = processed' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (err) {
        console.error('[CMD] autopsy-stats error:', err.message);
        await interaction.editReply({ content: `Error: ${err.message}` });
    }
}
