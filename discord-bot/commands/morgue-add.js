import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { isSupervisorUp } from '../services/permissions.js';
import { firstApiKey } from '../services/apiKeyUtil.js';

// Manual morgue-record intake: when a body is missing from the morgue (game /
// server issue), supervisors can create the entry from whatever is on hand so
// Load matching finds it. Posts through /api/morgue/bulk (regular API key,
// same ingest path as the logger) — local file canonical, version auto-bumped.
//
// caseId: the API requires a numeric id. Supervisors who know the in-game
// case number pass it; otherwise one is auto-allocated from the reserved
// 900001+ manual range (6-digit, visually distinct, practically
// collision-proof against 5-digit game numbering).
// Name/OOC: stored game-style — `Name ((Ooc))` when both are given and
// differ, so both search terms substring-match (mirrors logger records like
// "Unknown (( Leo Marsh ))").

const API_BASE = 'http://127.0.0.1:3001';
const MANUAL_ID_FLOOR = 900001;

export const data = new SlashCommandBuilder()
    .setName('morgue-add')
    .setDescription('Manually add a morgue record (Supervisors+)')
    .addStringOption((o) => o.setName('name').setDescription('Decedent IC name (or Unknown)').setRequired(true))
    .addStringOption((o) => o.setName('ooc').setDescription('Decedent OOC name').setRequired(false))
    .addStringOption((o) => o.setName('case_id').setDescription('In-game case number if known (auto-assigned otherwise)').setRequired(false))
    .addStringOption((o) => o.setName('sex').setDescription('Sex').setRequired(false).addChoices(
        { name: 'Male', value: 'Male' },
        { name: 'Female', value: 'Female' },
    ))
    .addStringOption((o) => o.setName('date').setDescription('Date of death (e.g. 18/SEP/2026)').setRequired(false))
    .addStringOption((o) => o.setName('time').setDescription('Time of death (e.g. 06:40 PM)').setRequired(false))
    .addStringOption((o) => o.setName('location').setDescription('Place of death').setRequired(false))
    .addStringOption((o) => o.setName('cause').setDescription('Cause of death').setRequired(false))
    .addStringOption((o) => o.setName('identified').setDescription('Identified?').setRequired(false).addChoices(
        { name: 'Yes', value: 'Yes' },
        { name: 'No', value: 'No' },
    ));

async function api(path, { method = 'GET', body } = {}) {
    const apiKey = firstApiKey(process.env.MORGUE_API_KEYS);
    if (!apiKey) throw new Error('No morgue API key configured on the bot (MORGUE_API_KEYS).');
    const res = await fetch(`${API_BASE}${path}`, {
        method,
        headers: { 'x-api-key': apiKey, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Morgue API HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    return res.json();
}

export async function execute(interaction) {
    if (!isSupervisorUp(interaction)) {
        await interaction.reply({ content: 'Only Supervisors and up can add morgue records.', flags: MessageFlags.Ephemeral });
        return;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const name = (interaction.options.getString('name') || '').trim();
    const ooc = (interaction.options.getString('ooc') || '').trim();
    const caseIdOpt = (interaction.options.getString('case_id') || '').trim();
    if (!name) {
        await interaction.editReply({ content: 'Give at least a decedent name.' });
        return;
    }
    const storedName = (ooc && ooc.toLowerCase() !== name.toLowerCase()) ? `${name} ((${ooc}))` : name;

    try {
        // 1. Dupe check (exact, on both the stored and the IC name).
        const look = await api('/api/morgue/lookup-by-names', {
            method: 'POST',
            body: { names: [...new Set([storedName, name])], exact: true },
        });
        const hit = (look.results || []).find((r) => r.matched);
        if (hit && hit.records && hit.records[0]) {
            const rec = hit.records[0];
            await interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setColor(0xe67e22)
                    .setTitle('Already in the morgue')
                    .setDescription(`**${rec.name || '?'}** is already recorded as case \`#${rec.caseId || rec.firebaseKey || '?'}\` — no duplicate created.`)
                    .setTimestamp()],
            });
            return;
        }

        // 2. Case id: provided (must be numeric + free) or auto-allocated.
        let caseId = '';
        if (caseIdOpt) {
            if (!/^\d+$/.test(caseIdOpt)) {
                await interaction.editReply({ content: 'Case ID must be numeric (the in-game case number).' });
                return;
            }
            const existing = await api(`/api/morgue/${encodeURIComponent(caseIdOpt)}`).catch((e) => {
                if (/HTTP 404/.test(e.message)) return null;
                throw e;
            });
            if (existing && existing.record) {
                await interaction.editReply({ content: `Case \`#${caseIdOpt}\` already exists (${existing.record.name || 'unnamed'}) — refusing to overwrite.` });
                return;
            }
            caseId = caseIdOpt;
        } else {
            const list = await api('/api/morgue?limit=10000');
            let max = 0;
            for (const r of list.records || []) {
                const n = parseInt(r.caseId, 10);
                if (Number.isFinite(n) && n > max) max = n;
            }
            caseId = String(Math.max(max + 1, MANUAL_ID_FLOOR));
        }

        // 3. Post through the bulk ingest path (single record).
        const date = (interaction.options.getString('date') || '').trim();
        const time = (interaction.options.getString('time') || '').trim();
        const record = {
            caseId,
            name: storedName,
            sex: interaction.options.getString('sex') || 'Unknown',
            identified: interaction.options.getString('identified') || 'Yes',
            location: (interaction.options.getString('location') || '').trim() || 'Unknown',
            timeOfDeath: [date, time].filter(Boolean).join(' ').trim(),
            causeOfDeath: (interaction.options.getString('cause') || '').trim() || 'Unknown',
            dnaProfile: 'N/A',
            estimatedAge: 'Unknown',
            physicalDescription: 'Manually added — see case file.',
            tattoos: 'None',
            bac: '0.00%',
            narcotics: 'N/A',
            bullets: [],
            findings: [],
            source: `Manual-Discord-${interaction.user.tag}`,
        };
        const posted = await api('/api/morgue/bulk', { method: 'POST', body: { records: [record] } });
        if (!posted || posted.failed > 0) {
            const detail = (posted && posted.errors && posted.errors[0] && posted.errors[0].error) || 'API rejected the record';
            await interaction.editReply({ content: `Failed to save: ${detail}` });
            return;
        }

        await interaction.editReply({
            embeds: [new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle('Morgue record added')
                .setDescription([
                    `**${storedName}** saved as case \`#${caseId}\`${caseIdOpt ? '' : ' (auto-assigned manual ID)'}.`,
                    `DOD: ${record.timeOfDeath || '—'} · Location: ${record.location}`,
                    '',
                    '_Load matching will now find this record._',
                ].join('\n'))
                .setFooter({ text: `Added by ${interaction.user.tag}` })
                .setTimestamp()],
        });
        console.log(`[MORGUE-ADD] ${interaction.user.tag} added case #${caseId} (${storedName})`);
    } catch (err) {
        console.error('[CMD] morgue-add error:', err.message);
        await interaction.editReply({ content: `Error: ${err.message}` });
    }
}
